/**
 * Netlify Scheduled Function: initiate-payroll-cycle
 * Runs: nearest working day to 15th at 09:00 Europe/London
 * Schedule: "0 9 10-18 * *" (daily 10th-18th, timezone handled in logic)
 *
 * Stage 1: Initiates the monthly payroll cycle
 */

import type { Handler, HandlerEvent } from '@netlify/functions'
import { isWeekend, getDate } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const LONDON_TZ = 'Europe/London'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pag-payroll.netlify.app'

export const handler: Handler = async (event: HandlerEvent) => {
  try {
    // Check if today is the nearest working day to the 15th
    const londonNow = toZonedTime(new Date(), LONDON_TZ)
    const dayOfMonth = getDate(londonNow)
    
    // Only run between 10th and 20th
    if (dayOfMonth < 10 || dayOfMonth > 20) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not the right time of month', day: dayOfMonth })
      }
    }
    
    // Check if it's a weekend (skip weekends)
    if (isWeekend(londonNow)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Weekend - skipping', day: dayOfMonth })
      }
    }
    
    // Check if a cycle was already initiated this month
    const currentMonth = londonNow.getMonth() + 1
    const currentYear = londonNow.getFullYear()
    
    // For the payroll cycle, we initiate for the CURRENT month
    // (i.e., on March 15th, we initiate the March payroll cycle)
    // Trigger the Next.js API to initiate the cycle
    const response = await fetch(`${APP_URL}/api/cycles/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'X-Internal-Function': 'netlify-scheduled',
      },
      body: JSON.stringify({ month: currentMonth, year: currentYear })
    })
    
    const result = await response.json()
    
    if (!response.ok && response.status !== 409) {
      // 409 = cycle already exists, which is OK
      console.error('Failed to initiate cycle:', result)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to initiate cycle', details: result })
      }
    }
    
    console.log('Cycle initiation result:', result)
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result })
    }
  } catch (error) {
    console.error('Scheduled function error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Scheduled function failed' })
    }
  }
}
