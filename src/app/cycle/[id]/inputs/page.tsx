import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import InputsForm from '@/components/cycle/InputsForm'

export default async function CycleInputsPage({ params }: { params: { id: string } }) {
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
  
  if (cycle.status !== 'initiated') {
    redirect(`/cycle/${params.id}/review`)
  }

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('status', 'active')
    .order('name')

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
            <span className="text-gray-900">Submit Inputs</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">
            Submit Payroll Inputs
          </h1>
          <p className="text-gray-600 mt-1">
            {cycleLabel} — Review standing data and submit any changes
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
