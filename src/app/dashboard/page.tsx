export const dynamic = 'force-dynamic'

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
