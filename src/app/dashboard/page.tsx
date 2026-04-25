export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CycleStatusCard from '@/components/dashboard/CycleStatusCard'
import ActionItems from '@/components/dashboard/ActionItems'
import ActivityFeed from '@/components/dashboard/ActivityFeed'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = userRole?.role || 'pag_operator'

  // Get recent activity (audit log)
  const { data: recentActivity } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  // Get current cycle
  const { data: currentCycle } = await supabase
    .from('payroll_cycles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get action items based on role
  const { data: openQueries } = await supabase
    .from('queries')
    .select('*')
    .eq('status', 'open')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, {user.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CycleStatusCard cycle={currentCycle} role={role} />
            <ActionItems queries={openQueries || []} role={role} cycleId={currentCycle?.id} />
          </div>
          <div>
            <ActivityFeed activities={recentActivity || []} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
