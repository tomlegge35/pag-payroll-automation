export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Employee {
  id: string
  employee_number: string
  full_name: string
  email: string | null
  department: string | null
  job_title: string | null
  start_date: string | null
  is_active: boolean
}

export default async function EmployeesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = userProfile?.role || 'pag_operator'

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('full_name')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">{(employees || []).length} employees on record</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(employees || []).map((emp: Employee) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.full_name}</p>
                      <p className="text-xs text-gray-500">{emp.employee_number} · {emp.email || '—'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.department || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{emp.job_title || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={'text-xs px-2 py-1 rounded-full ' + (emp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a href={'/employees/' + emp.id} className="text-sm text-blue-600 hover:underline">View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(employees || []).length === 0 && (
            <div className="p-6 text-center text-gray-500 text-sm">No employees found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
