export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import VarianceTable from '@/components/cycle/VarianceTable'

function formatPeriod(periodStart: string): string {
  const d = new Date(periodStart)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

const STAGE_LABELS: Record<string, string> = {
  initiated: 'Initiated',
  inputs_requested: 'Inputs Requested',
  inputs_submitted: 'Inputs Submitted',
  under_review: 'Under Review',
  queries_raised: 'Queries Raised',
  queries_resolved: 'Queries Resolved',
  approved: 'Approved',
  payment_confirmed: 'Payment Confirmed',
}

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role || 'pag_operator'

  const { data: cycle } = await supabase
    .from('payroll_cycles')
    .select('id, reference, period_start, period_end, pay_date, stage')
    .eq('id', params.id)
    .maybeSingle()

  if (!cycle) redirect('/cycles')

  const { data: variances } = await supabase
    .from('payroll_variances')
    .select('*, employees(full_name, employee_number)')
    .eq('cycle_id', params.id)
    .order('created_at', { ascending: false })

  const { data: queries } = await supabase
    .from('payroll_queries')
    .select('id, subject, status, created_at')
    .eq('cycle_id', params.id)
    .order('created_at', { ascending: false })

  const period = formatPeriod(cycle.period_start)
  const stageLabel = STAGE_LABELS[cycle.stage] || cycle.stage

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cycle.reference}</h1>
            <p className="text-gray-500 text-sm mt-1">{period} · Pay date: {cycle.pay_date || '—'}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            {stageLabel}
          </span>
        </div>

        {/* Variance Summary */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Variances ({(variances || []).length})
          </h2>
          {(variances || []).length === 0 ? (
            <p className="text-gray-500 text-sm">No variances recorded yet.</p>
          ) : (
            <VarianceTable variances={variances || []} cycleId={params.id} role={role} />
          )}
        </div>

        {/* Queries Summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Queries ({(queries || []).length})
            </h2>
            <a href={`/cycle/${params.id}/queries`} className="text-sm text-primary-600 hover:underline">
              View all queries
            </a>
          </div>
          {(queries || []).length === 0 ? (
            <p className="text-gray-500 text-sm">No queries raised.</p>
          ) : (
            <ul className="space-y-2">
              {(queries || []).slice(0, 5).map(q => (
                <li key={q.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-800">{q.subject}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${q.status === 'resolved' ? 'bg-green-100 text-green-700' : q.status === 'replied' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {q.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {['pag_admin', 'pag_operator'].includes(role) && (
            <a href={`/cycle/${params.id}/approve`} className="btn btn-primary">
              Review &amp; Approve
            </a>
          )}
          <a href={`/cycle/${params.id}/summary`} className="btn btn-secondary">
            View Summary
          </a>
          <a href="/cycles" className="btn btn-ghost">
            Back to Cycles
          </a>
        </div>
      </div>
    </DashboardLayout>
  )
}
