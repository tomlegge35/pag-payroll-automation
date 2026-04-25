export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface UserProfile {
  id: string
  email: string
  role: string
  full_name: string | null
  created_at: string
}

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = userRole?.role || 'pag_operator'

  if (role !== 'pag_admin') {
    redirect('/dashboard')
  }

  const { data: allUsers } = await supabase
    .from('user_roles')
    .select('id, user_id, role, created_at')
    .order('created_at', { ascending: true })

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">System configuration and user management</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>
          {!allUsers || allUsers.length === 0 ? (
            <p className="text-gray-500 text-sm">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">User ID</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Role</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u: { id: string; user_id: string; role: string; created_at: string }) => (
                    <tr key={u.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-600 font-mono text-xs">{u.user_id.substring(0, 8)}...</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-1 bg-blue-50 text-pag-blue text-xs rounded-full capitalize">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">System Information</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-medium">Environment:</span> Production</p>
            <p><span className="font-medium">Payroll System:</span> PAG Payroll Automation v1.0</p>
            <p><span className="font-medium">Timezone:</span> Europe/London</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
