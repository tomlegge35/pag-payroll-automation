/**
 * POST /api/cycles/[id]/approve
 * Stage 7: PAG approves or rejects payroll
 * Hard control: All variances must be explained before approval
 */

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { 
  sendPayrollApprovedEmail, 
  sendPayrollRejectedEmail,
  sendStaffVarianceEmail 
} from '@/lib/graph/email'

interface ApproveRequest {
  action: 'approve' | 'reject'
  reasonCode?: string
  reasonText?: string
  varianceExplanations?: Record<string, { explanation: string; status: 'accepted' | 'explained' }>
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const adminSupabase = createAdminClient()
    const cycleId = params.id
    
    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user is pag_admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    
    if (userRole?.role !== 'pag_admin') {
      return NextResponse.json({ error: 'Only PAG admins can approve payroll' }, { status: 403 })
    }
    
    // Get cycle
    const { data: cycle } = await adminSupabase
      .from('payroll_cycles')
      .select('id, month, year, status')
      .eq('id', cycleId)
      .single()
    
    if (!cycle || cycle.status !== 'approval_pending') {
      return NextResponse.json(
        { error: 'Cycle not found or not in approval_pending status' },
        { status: 422 }
      )
    }
    
    const body: ApproveRequest = await request.json()
    
    // Update variance explanations if provided
    if (body.varianceExplanations) {
      for (const [varianceId, explData] of Object.entries(body.varianceExplanations)) {
        await adminSupabase
          .from('variance_analysis')
          .update({
            explanation: explData.explanation,
            status: explData.status,
            actioned_by: user.id,
            actioned_at: new Date().toISOString(),
          })
          .eq('id', varianceId)
      }
    }
    
    if (body.action === 'approve') {
      // SERVER-SIDE HARD CHECK: Verify no unexplained variances
      const { data: unexplained } = await adminSupabase
        .from('variance_analysis')
        .select('id')
        .eq('cycle_id', cycleId)
        .eq('status', 'unexplained')
      
      if (unexplained && unexplained.length > 0) {
        return NextResponse.json(
          { 
            error: `Cannot approve: ${unexplained.length} unexplained variance(s) remain. All variances must be explained before approval.`,
            unexplainedCount: unexplained.length
          },
          { status: 422 }
        )
      }
      
      // Record approval action
      await adminSupabase
        .from('approval_actions')
        .insert({
          cycle_id: cycleId,
          action: 'approve',
          actioned_by: user.id,
          actioned_at: new Date().toISOString(),
        })
      
      // Update cycle status
      await adminSupabase
        .from('payroll_cycles')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', cycleId)
      
      // Get net pay data for approval email
      const { data: records } = await adminSupabase
        .from('payroll_records')
        .select('net_pay, employees(name)')
        .eq('cycle_id', cycleId)
      
      const netPayTable = (records || []).map(r => ({
        name: (r.employees as any)?.name || 'Unknown',
        netPay: r.net_pay || 0,
      }))
      
      // Send approval email to Khalid (E7)
      await sendPayrollApprovedEmail(cycleId, cycle.month, cycle.year, netPayTable)
      
      // Send staff variance notifications (E9)
      const { data: variances } = await adminSupabase
        .from('variance_analysis')
        .select('*, employees(name, email)')
        .eq('cycle_id', cycleId)
        .neq('flag', 'ok')
      
      // Group variances by employee
      const employeeVariances: Record<string, { name: string; email: string; variances: string[] }> = {}
      for (const v of (variances || [])) {
        const emp = v.employees as any
        if (!emp?.email) continue
        
        if (!employeeVariances[v.employee_id]) {
          employeeVariances[v.employee_id] = {
            name: emp.name,
            email: emp.email,
            variances: [],
          }
        }
        
        if (v.variance_abs !== null) {
          const direction = v.variance_abs > 0 ? 'increased' : 'decreased'
          const amount = Math.abs(v.variance_abs).toFixed(2)
          employeeVariances[v.employee_id].variances.push(
            `Your <strong>${v.metric}</strong> has ${direction} by £${amount}`
          )
        }
      }
      
      for (const [, empData] of Object.entries(employeeVariances)) {
        const summary = empData.variances.map(v => `<p>• ${v}</p>`).join('')
        await sendStaffVarianceEmail(
          empData.email,
          empData.name,
          cycle.month,
          cycle.year,
          summary
        )
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Payroll approved successfully',
        notificationsSent: Object.keys(employeeVariances).length
      })
    } else if (body.action === 'reject') {
      if (!body.reasonCode || !body.reasonText) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 422 }
        )
      }
      
      // Record rejection action
      await adminSupabase
        .from('approval_actions')
        .insert({
          cycle_id: cycleId,
          action: 'reject',
          reason_code: body.reasonCode,
          reason_text: body.reasonText,
          actioned_by: user.id,
          actioned_at: new Date().toISOString(),
        })
      
      // Log to quality_log
      await adminSupabase
        .from('quality_log')
        .insert({
          cycle_id: cycleId,
          raised_by: 'pag',
          category: 'process_deviation',
          description: `Payroll rejected: ${body.reasonCode} - ${body.reasonText}`,
          logged_at: new Date().toISOString(),
        })
      
      // Reset cycle to processing for re-upload
      await adminSupabase
        .from('payroll_cycles')
        .update({ status: 'processing' })
        .eq('id', cycleId)
      
      // Send rejection email to Khalid (E8)
      await sendPayrollRejectedEmail(
        cycleId,
        cycle.month,
        cycle.year,
        [{ code: body.reasonCode, text: body.reasonText }]
      )
      
      return NextResponse.json({
        success: true,
        message: 'Payroll rejected. Khalid has been notified to re-upload.',
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing approval:', error)
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}
