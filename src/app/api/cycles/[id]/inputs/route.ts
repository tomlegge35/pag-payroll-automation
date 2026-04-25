/**
 * POST /api/cycles/[id]/inputs
 * Stage 3: PAG submits payroll inputs / changes for the cycle
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInputsToRodliffeEmail } from '@/lib/graph/email'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const cycleId = params.id

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || !['pag_admin', 'pag_operator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, reference, period_start, stage')
      .eq('id', cycleId)
      .maybeSingle()

    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
    if (!['initiated', 'inputs_requested'].includes(cycle.stage)) {
      return NextResponse.json({ error: 'Cycle is not in a state to accept inputs', stage: cycle.stage }, { status: 409 })
    }

    const body = await request.json()
    const inputs: Array<{ employee_id: string; input_type: string; description?: string; amount?: number; hours?: number }> = body.inputs || []

    if (inputs.length > 0) {
      const inputRecords = inputs.map(input => ({
        cycle_id: cycleId,
        employee_id: input.employee_id,
        input_type: input.input_type,
        description: input.description || null,
        amount: input.amount ?? null,
        hours: input.hours ?? null,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('payroll_inputs').insert(inputRecords)
      if (error) throw error
    }

    // Advance stage
    await supabase
      .from('payroll_cycles')
      .update({ stage: 'inputs_submitted', updated_at: new Date().toISOString() })
      .eq('id', cycleId)

    // Optionally send to accountant
    if (body.submitToAccountant) {
      const { data: employees } = await supabase
        .from('employees')
        .select('employee_number, full_name, job_title')
        .eq('is_active', true)
        .order('employee_number')

      const periodDate = new Date(cycle.period_start)
      const month = periodDate.getMonth() + 1
      const year = periodDate.getFullYear()

      try {
        await sendInputsToRodliffeEmail(cycleId, month, year, employees || [], inputs)
      } catch (emailErr) {
        console.error('Inputs email failed (non-fatal):', emailErr)
      }
    }

    return NextResponse.json({ success: true, cycleId, stage: 'inputs_submitted' })
  } catch (err) {
    console.error('Inputs route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
