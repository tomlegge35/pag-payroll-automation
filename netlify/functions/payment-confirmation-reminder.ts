/**
 * Netlify Scheduled Function: payment-confirmation-reminder
 * Runs: 25th of each month at 09:00
 * Schedule: "0 9 25 * *"
 * Stage 8: Sends payment confirmation request to PAG
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { sendPaymentConfirmationEmail } from '../../src/lib/graph/email'
import { toZonedTime } from 'date-fns-tz'

export const handler: Handler = async () => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const londonNow = toZonedTime(new Date(), 'Europe/London')
    const currentMonth = londonNow.getMonth() + 1
    const currentYear = londonNow.getFullYear()
    
    // Find approved cycle for this month
    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, month, year, status')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('status', 'approved')
      .single()
    
    if (!cycle) {
      console.log('No approved cycle found for', currentMonth, currentYear)
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No approved cycle found' })
      }
    }
    
    // Get net pay data
    const { data: records } = await supabase
      .from('payroll_records')
      .select('net_pay, employees(name)')
      .eq('cycle_id', cycle.id)
    
    const netPayTable = (records || []).map(r => ({
      name: (r.employees as any)?.name || 'Unknown',
      netPay: r.net_pay || 0,
    }))
    
    // Send payment confirmation email (E10)
    await sendPaymentConfirmationEmail(cycle.id, cycle.month, cycle.year, netPayTable)
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, cycleId: cycle.id })
    }
  } catch (error) {
    console.error('Payment confirmation error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send payment confirmation' })
    }
  }
}
