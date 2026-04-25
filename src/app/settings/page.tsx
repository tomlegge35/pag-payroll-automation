export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Setting {
  id: string
  key: string
  value: string | null
  description: string | null
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = userProfile?.role || 'pag_operator'

  if (role !== 'pag_admin') {
    redirect('/dashboard')
  }

  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .order('key')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at')

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">System configuration and user management</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
            {(settings || []).length === 0 ? (
              <p className="text-gray-500 text-sm">No settings configured.</p>
            ) : (
              <div className="space-y-4">
                {(settings || []).map((setting: Setting) => (
                  <div key={setting.id} className="border-b border-gray-100 pb-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{setting.key}</p>
                        {setting.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
                        {setting.value || '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Users</h2>
            {(users || []).length === 0 ? (
              <p className="text-gray-500 text-sm">No users yet.</p>
            ) : (
              <div className="space-y-3">
                {(users || []).map((u: UserProfile) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name || u.email}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className={'text-xs px-2 py-1 rounded-full ' + (u.role === 'pag_admin' ? 'bg-red-100 text-red-700' : u.role === 'pag_operator' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
