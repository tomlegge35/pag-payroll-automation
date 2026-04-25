/**
 * Netlify Scheduled Function: poll-payroll-inbox
 * Runs: every 15 minutes during business hours (Mon-Fri 08:00-18:00)
 * Schedule: "every-15 8-18 * * 1-5"
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
