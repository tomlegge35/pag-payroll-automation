import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CycleStatusCard from '@/components/dashboard/CycleStatusCard'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import ActionItems from '@/components/dashboard/ActionItems'
import { formatMonthYear } from '@/lib/utils/dates'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/auth/login')
  
  // Get current active cycle
  const { data: cycles } = await supabase
    .from('payroll_cycles')
    .select('*')
    .not('status', 'in', '("closed")')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
  
  const activeCycle = cycles?.[0] || null
  
  // Get user role
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
  
  // Get open queries
  const { data: openQueries } = await supabase
    .from('queries')
    .select('*, payroll_cycles(month, year)')
    .eq('status', 'open')
    .limit(5)
  
  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Payroll Dashboard</h1>
          <p className="text-gray-600 mt-1">Premier Advisory Group Ltd — Payroll Management System</p>
        </div>
        
        {activeCycle ? (
          <CycleStatusCard cycle={activeCycle} role={role} />
        ) : (
          <div className="card bg-blue-50 border-blue-200">
            <p className="text-blue-800">
              No active payroll cycle. The next cycle will be initiated on the nearest working day to the 15th.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActionItems cycle={activeCycle} role={role} openQueries={openQueries || []} />
          </div>
          <div>
            <ActivityFeed activities={recentActivity || []} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
