/**
 * Netlify Scheduled Function: quarterly-report
 * Runs: Every 3 months on 1st at 09:00
 * Schedule: "0 9 1 3,6,9,12 *"
 * 
 * Generates and emails quarterly quality report after 3 cycles
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { sendQuarterlyReportEmail } from '../../src/lib/graph/email'
import { toZonedTime, format } from 'date-fns-tz'

export const handler: Handler = async () => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const londonNow = toZonedTime(new Date(), 'Europe/London')
    const quarter = Math.ceil((londonNow.getMonth() + 1) / 3)
    const year = londonNow.getFullYear()
    
    // Get the last 3 closed cycles for the report
    const { data: cycles } = await supabase
      .from('payroll_cycles')
      .select('id, month, year, status, initiated_at, approved_at, paid_confirmed_at')
      .eq('status', 'closed')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(3)
    
    if (!cycles || cycles.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No closed cycles for report' }) }
    }
    
    const cycleIds = cycles.map(c => c.id)
    
    // Get quality log data
    const { data: qualityLogs } = await supabase
      .from('quality_log')
      .select('*')
      .in('cycle_id', cycleIds)
      .order('logged_at', { ascending: false })
    
    // Get query statistics
    const { data: queries } = await supabase
      .from('queries')
      .select('*')
      .in('cycle_id', cycleIds)
    
    // Get rejection data
    const { data: rejections } = await supabase
      .from('approval_actions')
      .select('*')
      .in('cycle_id', cycleIds)
      .eq('action', 'reject')
    
    // Get variance flags
    const { data: variances } = await supabase
      .from('variance_analysis')
      .select('*')
      .in('cycle_id', cycleIds)
      .neq('flag', 'ok')
    
    // Calculate statistics
    const totalQueries = queries?.length || 0
    const resolvedQueries = queries?.filter(q => q.status === 'resolved').length || 0
    const queryResolutionRate = totalQueries > 0 ? Math.round(resolvedQueries / totalQueries * 100) : 100
    const totalRejections = rejections?.length || 0
    const totalVariances = variances?.length || 0
    
    // Calculate avg resolution time for queries
    const resolvedWithTime = (queries || []).filter(q => q.resolved_at && q.created_at)
    const avgResolutionHours = resolvedWithTime.length > 0
      ? Math.round(resolvedWithTime.reduce((sum, q) => {
          const created = new Date(q.created_at).getTime()
          const resolved = new Date(q.resolved_at).getTime()
          return sum + (resolved - created) / (1000 * 60 * 60)
        }, 0) / resolvedWithTime.length)
      : 0
    
    // Generate report HTML
    const cycleList = cycles.map(c => {
      const monthName = new Date(c.year, c.month - 1).toLocaleString('en-GB', { month: 'long' })
      const duration = c.initiated_at && c.paid_confirmed_at
        ? Math.round((new Date(c.paid_confirmed_at).getTime() - new Date(c.initiated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 'N/A'
      return `<li><strong>${monthName} ${c.year}</strong>: Cycle completed in ${duration} days</li>`
    }).join('')
    
    const qualityByCategory = (qualityLogs || []).reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const categoryRows = Object.entries(qualityByCategory).map(([cat, count]) => 
      `<tr><td>${cat.replace('_', ' ')}</td><td>${count}</td></tr>`
    ).join('')
    
    // Determine trend
    const score = queryResolutionRate + (totalRejections === 0 ? 20 : 0) + (avgResolutionHours < 24 ? 20 : 0)
    const trend = score >= 100 ? 'Improving ↑' : score >= 80 ? 'Stable →' : 'Needs attention ↓'
    const trendColor = score >= 100 ? '#28a745' : score >= 80 ? '#ffc107' : '#dc3545'
    
    const reportHtml = `
      <h3>Q${quarter} ${year} Quarterly Quality Report</h3>
      <p>This report covers the last ${cycles.length} payroll cycles:</p>
      <ul>${cycleList}</ul>
      
      <h4>Performance Summary</h4>
      <table style="width:100%; border-collapse: collapse; margin: 15px 0;">
        <tr style="background: #1F3864; color: white;">
          <th style="padding: 8px; text-align: left;">Metric</th>
          <th style="padding: 8px; text-align: right;">Value</th>
        </tr>
        <tr style="border-bottom: 1px solid #dee2e6;">
          <td style="padding: 8px;">Total Queries</td>
          <td style="padding: 8px; text-align: right;">${totalQueries}</td>
        </tr>
        <tr style="border-bottom: 1px solid #dee2e6; background: #f8f9fa;">
          <td style="padding: 8px;">Query Resolution Rate</td>
          <td style="padding: 8px; text-align: right;">${queryResolutionRate}%</td>
        </tr>
        <tr style="border-bottom: 1px solid #dee2e6;">
          <td style="padding: 8px;">Avg Resolution Time</td>
          <td style="padding: 8px; text-align: right;">${avgResolutionHours} hours</td>
        </tr>
        <tr style="border-bottom: 1px solid #dee2e6; background: #f8f9fa;">
          <td style="padding: 8px;">Payroll Rejections</td>
          <td style="padding: 8px; text-align: right;">${totalRejections}</td>
        </tr>
        <tr style="border-bottom: 1px solid #dee2e6;">
          <td style="padding: 8px;">Variance Flags</td>
          <td style="padding: 8px; text-align: right;">${totalVariances}</td>
        </tr>
        <tr style="background: #f8f9fa; font-weight: bold;">
          <td style="padding: 8px;">Overall Trend</td>
          <td style="padding: 8px; text-align: right; color: ${trendColor}">${trend}</td>
        </tr>
      </table>
      
      ${categoryRows ? `
        <h4>Issues by Category</h4>
        <table style="width:100%; border-collapse: collapse;">
          <tr style="background: #1F3864; color: white;">
            <th style="padding: 8px; text-align: left;">Category</th>
            <th style="padding: 8px; text-align: right;">Count</th>
          </tr>
          ${categoryRows}
        </table>
      ` : '<p>No quality log issues recorded this quarter.</p>'}
    `
    
    await sendQuarterlyReportEmail(quarter, year, reportHtml)
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, quarter, year, cyclesIncluded: cycles.length })
    }
  } catch (error) {
    console.error('Quarterly report error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate quarterly report' })
    }
  }
}
