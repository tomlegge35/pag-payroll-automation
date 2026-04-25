/**
 * Netlify Scheduled Function: poll-payroll-inbox
 * Runs: every 15 minutes during business hours (Mon-Fri 08:00-18:00)
 * Schedule: "0,15,30,45 8-18 * * 1-5"
 *
 * Polls payroll inbox for replies from Khalid
 * Creates query records and notifies PAG
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { pollPayrollInbox, extractCycleFromSubject, markEmailAsRead, parseQueryFromEmail } from '../../src/lib/graph/inbox'
import { sendQueryAlertToPAG } from '../../src/lib/graph/email'

const handler: Handler = async () => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Poll the inbox for new emails
    const emails = await pollPayrollInbox()

    if (!emails || emails.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No new emails found' })
      }
    }

    let processed = 0

    for (const email of emails) {
      try {
        // Extract cycle from subject line
        const cycleRef = extractCycleFromSubject(email.subject)
        if (!cycleRef) {
          continue
        }

        // Find matching open cycle in database
        const { data: cycle } = await supabase
          .from('payroll_cycles')
          .select('id, month, year, status')
          .eq('month', cycleRef.month)
          .eq('year', cycleRef.year)
          .in('status', ['inputs_submitted', 'processing', 'approval_pending'])
          .single()

        if (!cycle) {
          continue
        }

        // Parse the query text from the email
        const queryText = parseQueryFromEmail(email)

        // Check if this email has already been processed (by message ID)
        const { data: existing } = await supabase
          .from('queries')
          .select('id')
          .eq('email_message_id', email.id)
          .single()

        if (existing) {
          continue
        }

        // Create the query record
        const { data: query, error: queryError } = await supabase
          .from('queries')
          .insert({
            cycle_id: cycle.id,
            query_text: queryText,
            status: 'open',
            email_message_id: email.id,
            email_conversation_id: email.conversationId,
            raised_at: new Date().toISOString()
          })
          .select()
          .single()

        if (queryError || !query) {
          console.error('Failed to create query:', queryError)
          continue
        }

        // Notify PAG team
        await sendQueryAlertToPAG(cycle.id, cycle.month, cycle.year, queryText)

        // Mark email as read
        await markEmailAsRead(email.id)

        processed++
      } catch (emailError) {
        console.error('Error processing email:', emailError)
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Processed ${processed} new queries` })
    }
  } catch (error) {
    console.error('Poll inbox error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}

export { handler }
