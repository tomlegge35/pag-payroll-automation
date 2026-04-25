/**
 * POST /api/cycles/[id]/approve
 * Stage 7: PAG admin approves or rejects the payroll
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPayrollApprovedEmail, sendPayrollRejectedEmail } from '@/lib/graph/email'

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
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'pag_admin') {
      return NextResponse.json({ error: 'Only PAG admins can approve payroll' }, { status: 403 })
    }

    const body = await request.json() as { action: 'approve' | 'reject'; notes?: string }
    if (!['approve', 'reject'].includes(body.action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, reference, period_start, stage')
      .eq('id', cycleId)
      .maybeSingle()

    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

    const approvalStages = ['under_review', 'queries_raised', 'queries_resolved']
    if (!approvalStages.includes(cycle.stage)) {
      return NextResponse.json({ error: 'Cycle is not ready for approval', stage: cycle.stage }, { status: 409 })
    }

    const newStage = body.action === 'approve' ? 'approved' : 'under_review'
    const periodDate = new Date(cycle.period_start)
    const month = periodDate.getMonth() + 1
    const year = periodDate.getFullYear()

    // Record approval action
    await supabase.from('payroll_approvals').insert({
      cycle_id: cycleId,
      approved_by: user.id,
      approval_type: body.action,
      notes: body.notes || null,
      approved_at: new Date().toISOString(),
    })

    // Update stage
    await supabase
      .from('payroll_cycles')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', cycleId)

    try {
      if (body.action === 'approve') {
        await sendPayrollApprovedEmail(cycleId, month, year, profile.full_name || user.email || 'PAG Admin')
      } else {
        await sendPayrollRejectedEmail(cycleId, month, year, body.notes || '')
      }
    } catch (emailErr) {
      console.error('Approval email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({ success: true, action: body.action, stage: newStage })
  } catch (err) {
    console.error('Approve route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
