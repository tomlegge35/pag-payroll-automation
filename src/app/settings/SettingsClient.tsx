'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

interface SystemSetting {
  key: string
  value: string | null
  description: string | null
}

const ROLE_LABELS: Record<string, string> = {
  pag_admin: 'PAG Admin',
  pag_operator: 'PAG Operator',
  accountant: 'Accountant',
}

const ROLE_COLOURS: Record<string, string> = {
  pag_admin: 'bg-red-100 text-red-700',
  pag_operator: 'bg-blue-100 text-blue-700',
  accountant: 'bg-green-100 text-green-700',
}

export default function SettingsClient({
  users,
  settings,
  role,
  currentUserId,
}: {
  users: UserProfile[]
  settings: SystemSetting[]
  role: string
  currentUserId: string
}) {
  const router = useRouter()
  const isAdmin = role === 'pag_admin'

  // Invite form state
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'pag_admin' | 'pag_operator' | 'accountant'>('pag_operator')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    setInviteMsg('')
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) { setInviteError(data.error || 'Failed to send invite'); setInviteLoading(false); return }
      setInviteMsg(`Invite sent to ${inviteEmail}`)
      setInviteEmail(''); setInviteName(''); setShowInvite(false)
      router.refresh()
    } catch { setInviteError('Network error') }
    setInviteLoading(false)
  }

  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentlyActive }),
    })
    router.refresh()
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Users section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          {isAdmin && (
            <button onClick={() => setShowInvite(v => !v)} className="btn btn-primary text-sm">
              + Invite User
            </button>
          )}
        </div>

        {/* Success message */}
        {inviteMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            {inviteMsg}
          </div>
        )}

        {/* Invite Form */}
        {showInvite && isAdmin && (
          <form onSubmit={handleInvite} className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-3">
            <h3 className="font-medium text-gray-800 text-sm">Invite New User</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Jane Smith"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="input w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Role *</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as typeof inviteRole)}
                className="input w-full sm:w-48"
              >
                <option value="pag_operator">PAG Operator</option>
                <option value="pag_admin">PAG Admin</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={inviteLoading} className="btn btn-primary text-sm">
                {inviteLoading ? 'Sending…' : 'Send Invite'}
              </button>
              <button type="button" onClick={() => setShowInvite(false)} className="btn btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* User list */}
        {users.length === 0 ? (
          <p className="text-gray-500 text-sm">No users yet.</p>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <div
                key={u.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${u.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {u.full_name || u.email}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {isAdmin && u.id !== currentUserId ? (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 bg-white"
                    >
                      <option value="pag_operator">PAG Operator</option>
                      <option value="pag_admin">PAG Admin</option>
                      <option value="accountant">Accountant</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${ROLE_COLOURS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  )}
                  {isAdmin && u.id !== currentUserId && (
                    <button
                      onClick={() => handleToggleActive(u.id, u.is_active)}
                      className={`text-xs px-2 py-1 rounded border ${u.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                    >
                      {u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Settings */}
      {settings.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
          <div className="space-y-3">
            {settings.map(s => (
              <div key={s.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 font-mono">{s.key}</p>
                  {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                </div>
                <span className="text-sm text-gray-700">{s.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
