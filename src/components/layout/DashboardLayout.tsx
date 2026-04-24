'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: User
  role?: string
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', roles: ['pag_admin', 'pag_operator', 'accountant'] },
  { href: '/cycles', label: 'Payroll Cycles', roles: ['pag_admin', 'pag_operator', 'accountant'] },
  { href: '/employees', label: 'Employees', roles: ['pag_admin', 'pag_operator'] },
  { href: '/reports', label: 'Reports', roles: ['pag_admin', 'pag_operator'] },
  { href: '/settings', label: 'Settings', roles: ['pag_admin'] },
]

export default function DashboardLayout({ children, user, role }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filteredNav = navItems.filter(item =>
    !role || item.roles.includes(role)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-pag-blue transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex lg:flex-col`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-blue-700">
          <span className="text-white font-bold text-lg">PAG Payroll</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-blue-200"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:bg-blue-700 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className="px-4 py-4 border-t border-blue-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{user?.email}</p>
                {role && <p className="text-xs text-blue-200 capitalize">{role.replace('_', ' ')}</p>}
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-left text-xs text-blue-200 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            ☰
          </button>
          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
