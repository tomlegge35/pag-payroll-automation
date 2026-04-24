/**
 * POST /api/cycles/initiate
 * Stage 1: Initiate a new payroll cycle
 * Called by scheduled function or manually by PAG admin
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendCycleInitiationEmail } from '@/lib/graph/email'
import { getCurrentPayrollPeriod } from '@/lib/utils/dates'

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    
    const body = await request.json().catch(() => ({}))
    const { month, year } = body.month && body.year 
      ? body 
      : getCurrentPayrollPeriod()
    
    // Check if cycle already exists for this month/year
    const { data: existing } = await supabase
      .from('payroll_cycles')
      .select('id, status')
      .eq('month', month)
      .eq('year', year)
      .single()
    
    if (existing) {
      return NextResponse.json(
        { error: `Payroll cycle for ${month}/${year} already exists with status: ${existing.status}` },
        { status: 409 }
      )
    }
    
    // Create new cycle
    const { data: cycle, error } = await supabase
      .from('payroll_cycles')
      .insert({
        month,
        year,
        status: 'initiated',
        xero_confirmed: false,
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Get employee standing data for email
    const { data: employees } = await supabase
      .from('employees')
      .select('name, payroll_id, fte_salary, tax_code, ni_category, pension_scheme, status')
      .eq('status', 'active')
      .order('name')
    
    // Build standing data HTML table
    const standingDataHtml = `
      <table style="width:100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #1F3864; color: white;">
            <th style="padding: 8px; text-align: left;">Employee</th>
            <th style="padding: 8px; text-align: left;">ID</th>
            <th style="padding: 8px; text-align: right;">FTE Salary</th>
            <th style="padding: 8px; text-align: left;">Tax Code</th>
            <th style="padding: 8px; text-align: left;">NI Cat</th>
            <th style="padding: 8px; text-align: left;">Pension</th>
          </tr>
        </thead>
        <tbody>
          ${(employees || []).map(e => `
            <tr style="border-bottom: 1px solid #dee2e6;">
              <td style="padding: 6px 8px;">${e.name}</td>
              <td style="padding: 6px 8px;">${e.payroll_id}</td>
              <td style="padding: 6px 8px; text-align: right;">${e.fte_salary ? `£${e.fte_salary.toLocaleString()}` : 'N/A'}</td>
              <td style="padding: 6px 8px;">${e.tax_code || 'N/A'}</td>
              <td style="padding: 6px 8px;">${e.ni_category || 'A'}</td>
              <td style="padding: 6px 8px;">${e.pension_scheme || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    
    // Send initiation email (E1)
    await sendCycleInitiationEmail(cycle.id, month, year, standingDataHtml)
    
    return NextResponse.json({ 
      success: true, 
      cycleId: cycle.id,
      message: `Payroll cycle initiated for ${month}/${year}`
    })
  } catch (error) {
    console.error('Error initiating cycle:', error)
    return NextResponse.json(
      { error: 'Failed to initiate payroll cycle' },
      { status: 500 }
    )
  }
}
