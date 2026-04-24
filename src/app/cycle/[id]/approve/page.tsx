import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import VarianceTable from '@/components/cycle/VarianceTable'
import ApprovalPanel from '@/components/cycle/ApprovalPanel'
import { formatMonthYear } from '@/lib/utils/dates'

export default async function CycleApprovePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = userRole?.role || 'pag_operator'
  
  if (!['pag_admin', 'pag_operator'].includes(role)) {
    redirect('/dashboard')
  }

  const { data: cycle } = await supabase
    .from('payroll_cycles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!cycle) notFound()

  // Get variance analysis with employee details
  const { data: variances } = await supabase
    .from('variance_analysis')
    .select('*, employees(name, payroll_id)')
    .eq('cycle_id', params.id)
    .order('flag', { ascending: false })
    .order('variance_pct', { ascending: false })

  // Get payroll records for summary
  const { data: records } = await supabase
    .from('payroll_records')
    .select('*, employees(name)')
    .eq('cycle_id', params.id)

  const unexplainedCount = (variances || []).filter(v => v.status === 'unexplained').length
  const canApprove = unexplainedCount === 0

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Payroll</span>
            <span>›</span>
            <span>{formatMonthYear(cycle.month, cycle.year)}</span>
            <span>›</span>
            <span className="text-gray-900">Review & Approve</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-navy">
                Variance Review & Approval
              </h1>
              <p className="text-gray-600 mt-1">
                {formatMonthYear(cycle.month, cycle.year)} payroll — review all flagged variances before approving
              </p>
            </div>
            {!canApprove && (
              <div className="bg-amber-50 border border-amber-300 rounded-md px-4 py-2 text-amber-800 text-sm font-medium">
                ⚠ {unexplainedCount} unexplained variance{unexplainedCount !== 1 ? 's' : ''} remaining
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            <VarianceTable 
              variances={variances || []} 
              cycleId={params.id}
            />
          </div>
          <div>
            <ApprovalPanel 
              cycleId={params.id}
              cycle={cycle}
              canApprove={canApprove}
              unexplainedCount={unexplainedCount}
              records={records || []}
              role={role}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
