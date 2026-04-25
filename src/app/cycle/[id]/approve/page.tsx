import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import VarianceTable from '@/components/cycle/VarianceTable'
import ApprovalPanel from '@/components/cycle/ApprovalPanel'

export default async function CycleApprovePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = userProfile?.role || 'pag_operator'
  
  if (!['pag_admin', 'pag_operator'].includes(role)) {
    redirect('/dashboard')
  }

  const { data: cycle } = await supabase
    .from('payroll_cycles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!cycle) notFound()

  const { data: variances } = await supabase
    .from('variance_analysis')
    .select('*, employees(name, payroll_id)')
    .eq('cycle_id', params.id)
    .order('flag', { ascending: false })
    .order('variance_pct', { ascending: false })

  const { data: records } = await supabase
    .from('payroll_records')
    .select('*, employees(name)')
    .eq('cycle_id', params.id)

  const unexplainedCount = (variances || []).filter(v => v.status === 'unexplained').length
  const canApprove = unexplainedCount === 0

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const cycleLabel = monthNames[(cycle.month || 1) - 1] + ' ' + cycle.year

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Payroll</span>
            <span>›</span>
            <span>{cycleLabel}</span>
            <span>›</span>
            <span className="text-gray-900">Approve</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">
            Approve Payroll
          </h1>
          {unexplainedCount > 0 && (
            <div className="mt-2 inline-flex items-center bg-amber-100 border border-amber-300 rounded-md px-4 py-2 text-amber-800 text-sm font-medium">
              ⚠ {unexplainedCount} unexplained variance{unexplainedCount !== 1 ? 's' : ''} remaining
            </div>
          )}
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
