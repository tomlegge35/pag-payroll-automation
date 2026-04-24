import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import InputsForm from '@/components/cycle/InputsForm'
import { formatMonthYear } from '@/lib/utils/dates'

export default async function CycleInputsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = userRole?.role || 'pag_operator'
  
  // Only PAG staff can submit inputs
  if (!['pag_admin', 'pag_operator'].includes(role)) {
    redirect('/dashboard')
  }

  const { data: cycle } = await supabase
    .from('payroll_cycles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!cycle) notFound()
  
  if (cycle.status !== 'initiated') {
    redirect(`/cycle/${params.id}/review`)
  }

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('status', 'active')
    .order('name')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Payroll</span>
            <span>›</span>
            <span>{formatMonthYear(cycle.month, cycle.year)}</span>
            <span>›</span>
            <span className="text-gray-900">Submit Inputs</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">
            Submit Payroll Inputs
          </h1>
          <p className="text-gray-600 mt-1">
            {formatMonthYear(cycle.month, cycle.year)} — Review standing data and submit any changes
          </p>
        </div>
        
        <InputsForm
          cycleId={params.id}
          cycle={cycle}
          employees={employees || []}
          role={role}
        />
      </div>
    </DashboardLayout>
  )
}
