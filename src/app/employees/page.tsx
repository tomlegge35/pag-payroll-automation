import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { formatDate } from '@/lib/utils/dates'

export default async function EmployeesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = userRole?.role || 'pag_operator'

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('status')
    .order('name')

  const active = (employees || []).filter(e => e.status === 'active')
  const leavers = (employees || []).filter(e => e.status === 'leaver')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy">Employees</h1>
            <p className="text-gray-600 mt-1">{active.length} active, {leavers.length} leaver{leavers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Active employees */}
        <div className="card overflow-hidden">
          <h3 className="mb-4">Active Employees ({active.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">ID</th>
                  <th className="table-header">Role</th>
                  <th className="table-header text-right">FTE Salary</th>
                  <th className="table-header text-right">FTE</th>
                  <th className="table-header">Tax Code</th>
                  <th className="table-header">NI Cat</th>
                  <th className="table-header">Pension</th>
                  <th className="table-header">Started</th>
                </tr>
              </thead>
              <tbody>
                {active.map(emp => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="table-cell font-medium">{emp.name}</td>
                    <td className="table-cell text-gray-500">{emp.payroll_id}</td>
                    <td className="table-cell">
                      <span className={`${emp.role === 'director' ? 'badge-blue' : 'badge-gray'} status-pill`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      {emp.fte_salary ? `£${emp.fte_salary.toLocaleString()}` : 'N/A'}
                    </td>
                    <td className="table-cell text-right">
                      {emp.fte ? `${(emp.fte * 100).toFixed(0)}%` : '100%'}
                    </td>
                    <td className="table-cell">{emp.tax_code || '—'}</td>
                    <td className="table-cell">{emp.ni_category || 'A'}</td>
                    <td className="table-cell">{emp.pension_scheme || '—'}</td>
                    <td className="table-cell text-gray-500">
                      {emp.start_date ? formatDate(emp.start_date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leavers */}
        {leavers.length > 0 && (
          <div className="card overflow-hidden">
            <h3 className="mb-4 text-gray-600">Leavers ({leavers.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">ID</th>
                    <th className="table-header">Started</th>
                    <th className="table-header">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {leavers.map(emp => (
                    <tr key={emp.id} className="border-b border-gray-100 opacity-60">
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-gray-500">{emp.payroll_id}</td>
                      <td className="table-cell text-gray-500">
                        {emp.start_date ? formatDate(emp.start_date) : '—'}
                      </td>
                      <td className="table-cell text-gray-500">
                        {emp.end_date ? formatDate(emp.end_date) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
