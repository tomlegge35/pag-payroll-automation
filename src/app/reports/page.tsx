export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { formatMonthYear } from '@/lib/utils/dates'

interface Report {
  id: string
  cycle_id: string
  type: string
  generated_at: string
  generated_by: string
  quarter?: number
  year?: number
}

interface Cycle {
  id: string
  month: number
  year: number
  status: string
}

export default async function ReportsPage() {
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

  const { data: cycles } = await supabase
    .from('payroll_cycles')
    .select('id, month, year, status')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .order('generated_at', { ascending: false })

  const completedCycles = (cycles || []).filter((c: Cycle) => c.status === 'completed')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-500 text-sm mt-1">Generate and download payroll reports</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cycle Reports */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Cycle Reports</h2>
            {completedCycles.length === 0 ? (
              <p className="text-gray-500 text-sm">No completed cycles yet.</p>
            ) : (
              <div className="space-y-2">
                {completedCycles.map((cycle: Cycle) => (
                  <div key={cycle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">
                      {formatMonthYear(cycle.month, cycle.year)}
                    </span>
                    <a
                      href={`/cycle/${cycle.id}/summary`}
                      className="text-sm text-pag-blue hover:underline"
                    >
                      View Summary
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quarterly Reports */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quarterly Reports</h2>
            <p className="text-gray-500 text-sm mb-4">
              Quarterly reports are automatically generated and emailed to Khalid.
            </p>
            {(reports || []).filter((r: Report) => r.type === 'quarterly').length === 0 ? (
              <p className="text-gray-500 text-sm">No quarterly reports generated yet.</p>
            ) : (
              <div className="space-y-2">
                {(reports || []).filter((r: Report) => r.type === 'quarterly').map((report: Report) => (
                  <div key={report.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">
                      Q{report.quarter} {report.year}
                    </p>
                    <p className="text-xs text-gray-500">
                      Generated {new Date(report.generated_at).toLocaleDateString('en-GB')}
                    </p>
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
