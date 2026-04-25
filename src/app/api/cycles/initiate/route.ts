/**
 * POST /api/cycles/initiate
 * Stage 1: Initiate a new payroll cycle
 * Called by scheduled function or manually by PAG admin
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendCycleInitiationEmail } from '@/lib/graph/email'
import { get25thAtNoon } from '@/lib/utils/dates'

function getPayDate(year: number, month: number): string {
  const d25 = new Date(year, month - 1, 25)
  // If 25th is Saturday move to Friday
  if (d25.getDay() === 6) d25.setDate(23)
  // If 25th is Sunday move to Friday
  if (d25.getDay() === 0) d25.setDate(24)
  return d25.toISOString().slice(0, 10)
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().slice(0, 10)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const force = body.force === true
    const supabase = createAdminClient()

    // Determine month/year — accept explicit override or use current
    const now = new Date()
    const month: number = body.month ?? (now.getMonth() + 1)
    const year: number = body.year ?? now.getFullYear()

    const reference = `PAG-${year}-${String(month).padStart(2, '0')}`
    const period_start = `${year}-${String(month).padStart(2, '0')}-01`
    const period_end = lastDayOfMonth(year, month)
    const pay_date = getPayDate(year, month)

    // Check if cycle already exists for this period
    const { data: existing } = await supabase
      .from('payroll_cycles')
      .select('id, stage')
      .eq('reference', reference)
      .maybeSingle()

    if (existing && !force) {
      return NextResponse.json(
        { error: 'Cycle already exists for this period', cycleId: existing.id },
        { status: 409 }
      )
    }

    if (existing && force) {
      return NextResponse.json({ cycleId: existing.id, reference, alreadyExists: true })
    }

    // Create the cycle
    const { data: cycle, error: cycleError } = await supabase
      .from('payroll_cycles')
      .insert({
        reference,
        period_start,
        period_end,
        pay_date,
        stage: 'initiated',
      })
      .select('id, reference, period_start, period_end, pay_date, stage')
      .single()

    if (cycleError || !cycle) {
      console.error('Failed to create cycle:', cycleError)
      return NextResponse.json({ error: 'Failed to create payroll cycle' }, { status: 500 })
    }

    // Fetch active employees for standing data email
    const { data: employees } = await supabase
      .from('employees')
      .select('employee_number, full_name, job_title, department, email')
      .eq('is_active', true)
      .order('employee_number')

    // Build simple HTML table for standing data
    const standingDataHtml = `<table border="1" cellpadding="4" style="border-collapse:collapse">
      <thead><tr><th>Number</th><th>Name</th><th>Role</th><th>Dept</th></tr></thead>
      <tbody>
        ${(employees || []).map(e =>
          `<tr><td>${e.employee_number}</td><td>${e.full_name}</td><td>${e.job_title || ''}</td><td>${e.department || ''}</td></tr>`
        ).join('')}
      </tbody>
    </table>`

    // Send initiation email (fire and forget — don't block on email failure)
    try {
      await sendCycleInitiationEmail(cycle.id, month, year, standingDataHtml)
    } catch (emailErr) {
      console.error('Initiation email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({ cycleId: cycle.id, reference, period_start, period_end, pay_date })
  } catch (err) {
    console.error('Initiate cycle error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
