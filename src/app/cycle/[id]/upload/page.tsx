import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import UploadForm from '@/components/cycle/UploadForm'

export default async function CycleUploadPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = userProfile?.role || 'pag_operator'
  
  if (role !== 'accountant') {
    redirect('/dashboard')
  }

  const { data: cycle } = await supabase
    .from('payroll_cycles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!cycle) notFound()

  const { data: inputs } = await supabase
    .from('payroll_inputs')
    .select('*, employees(name)')
    .eq('cycle_id', params.id)
    .order('submitted_at', { ascending: false })

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
            <span className="text-gray-900">Upload Payroll</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">
            Upload Completed Payroll
          </h1>
          <p className="text-gray-600 mt-1">
            {cycleLabel} — Complete the compliance checklist and upload payslips
          </p>
        </div>
        
        <UploadForm 
          cycleId={params.id}
          cycle={cycle}
          inputs={inputs || []}
        />
      </div>
    </DashboardLayout>
  )
}
