export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Cycle {
  id: string
  reference: string
  period_start: string
  period_end: string
  stage: string
  created_at: string
}

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = userProfile?.role || 'pag_operator'

  if (!['pag_admin', 'pag_operator'].includes(role)) {
    redirect('/dashboard')
  }

  const { data: cycles } = await supabase
    .from('payroll_cycles')
    .select('*')
    .order('created_at', { ascending: false })

  const completedCycles = (cycles || []).filter((c: Cycle) => c.stage === 'payment_confirmed')
  const activeCycles = (cycles || []).filter((c: Cycle) => c.stage !== 'payment_confirmed')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Payroll cycle history and reports</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Cycles</h2>
            {activeCycles.length === 0 ? (
              <p className="text-gray-500 text-sm">No active cycles.</p>
            ) : (
              <div className="space-y-2">
                {activeCycles.map((cycle: Cycle) => (
                  <div key={cycle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{cycle.reference}</span>
                      <span className="ml-2 text-xs text-gray-500 capitalize">{cycle.stage.replace('_', ' ')}</span>
                    </div>
                    <a href={'/cycle/' + cycle.id + '/review'} className="text-sm text-blue-600 hover:underline">
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Completed Cycles</h2>
            {completedCycles.length === 0 ? (
              <p className="text-gray-500 text-sm">No completed cycles yet.</p>
            ) : (
              <div className="space-y-2">
                {completedCycles.map((cycle: Cycle) => (
                  <div key={cycle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{cycle.reference}</span>
                    <a href={'/cycle/' + cycle.id + '/summary'} className="text-sm text-blue-600 hover:underline">
                      View Summary
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
