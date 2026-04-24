/**
 * Netlify Scheduled Function: poll-payroll-inbox
 * Runs: every 15 minutes during business hours (Mon-Fri 08:00-18:00)
 * Schedule: "*/15 8-18 * * 1-5"
 *
 * Polls payroll inbox for replies from Khalid
 * Creates query records and notifies PAG
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { pollPayrollInbox, extractCycleFromSubject, parseQueryFromEmail, markEmailAsRead } from '../../src/lib/graph/inbox'
import { sendQueryAlertToPAG } from '../../src/lib/graph/email'

export const handler: Handler = async () => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Poll inbox for new messages
    const messages = await pollPayrollInbox()
    
    let queriesCreated = 0
    
    for (const message of messages) {
      // Extract cycle from subject tag [PAG-Payroll-YYYY-MM]
      const cycleInfo = extractCycleFromSubject(message.subject)
      if (!cycleInfo) {
        // Not a payroll cycle email - skip
        await markEmailAsRead(message.id)
        continue
      }
      
      // Find the cycle in database
      const { data: cycle } = await supabase
        .from('payroll_cycles')
        .select('id, status, month, year')
        .eq('month', cycleInfo.month)
        .eq('year', cycleInfo.year)
        .single()
      
      if (!cycle) {
        await markEmailAsRead(message.id)
        continue
      }
      
      // Check if this message ID was already processed
      const { data: existingQuery } = await supabase
        .from('queries')
        .select('id')
        .eq('email_message_id', message.internetMessageId)
        .single()
      
      if (existingQuery) {
        await markEmailAsRead(message.id)
        continue
      }
      
      // Parse query text from email
      const queryText = parseQueryFromEmail(message)
      
      // Determine if this is a query or acceptance
      const isAcceptance = message.subject.toLowerCase().includes('accept') ||
        message.body.content.toLowerCase().includes('accept inputs') ||
        message.body.content.toLowerCase().includes('i accept')
      
      if (isAcceptance && cycle.status === 'inputs_submitted') {
        // Khalid accepted inputs - update cycle to processing
        await supabase
          .from('payroll_cycles')
          .update({ status: 'processing', xero_confirmed: true })
          .eq('id', cycle.id)
        
        await markEmailAsRead(message.id)
        continue
      }
      
      // Create query record
      const { data: query } = await supabase
        .from('queries')
        .insert({
          cycle_id: cycle.id,
          raised_by: 'rodliffe',
          query_text: queryText,
          status: 'open',
          email_message_id: message.internetMessageId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()
      
      if (query) {
        // Log to quality_log
        await supabase
          .from('quality_log')
          .insert({
            cycle_id: cycle.id,
            raised_by: 'rodliffe',
            category: 'query',
            description: queryText.substring(0, 500),
            logged_at: new Date().toISOString(),
          })
        
        // Send query alert to PAG (E3)
        await sendQueryAlertToPAG(cycle.id, cycle.month, cycle.year, queryText, query.id)
        queriesCreated++
      }
      
      await markEmailAsRead(message.id)
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        messagesProcessed: messages.length,
        queriesCreated
      })
    }
  } catch (error) {
    console.error('Inbox poll error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to poll inbox' })
    }
  }
}
