export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CyclesClient from './CyclesClient'

function formatPeriod(periodStart: string): string {
  const d = new Date(periodStart)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default async function CyclesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role || 'pag_operator'

  const { data: cycles } = await supabase
    .from('payroll_cycles')
    .select('id, reference, period_start, period_end, pay_date, stage, created_at')
    .order('period_start', { ascending: false })

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll Cycles</h1>
            <p className="text-gray-500 text-sm mt-1">All payroll cycles for Premier Advisory Group</p>
          </div>
        </div>
        <CyclesClient cycles={cycles || []} role={role} />
      </div>
    </DashboardLayout>
  )
}
