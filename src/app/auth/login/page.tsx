'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for a login link!')
    }
    setLoading(false)
  }

  const handleAzureSSO = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email openid profile',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-navy">Premier Advisory Group</h1>
          <p className="text-gray-600 mt-1 text-sm">Payroll Management System</p>
          <div className="w-16 h-1 bg-pag-blue mx-auto mt-4 rounded"></div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4 text-sm">
            {message}
          </div>
        )}

        {/* PAG Staff: Azure AD SSO */}
        <div className="mb-6">
          <button
            onClick={handleAzureSSO}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-pag-blue text-white py-3 px-4 rounded-md hover:bg-navy transition-colors font-medium disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6L11.4 24zM24 24H12.6L24 12.6V24zM24 11.4V0h-11.4L24 11.4zM11.4 0H0v11.4L11.4 0z"/>
            </svg>
            Sign in with Microsoft 365
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">For PAG staff — use your @premieradvisory.co.uk account</p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Khalid: Magic Link */}
        <form onSubmit={handleMagicLink}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="k.subhan@rodliffeaccounting.com"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">For accountants — receive a one-time login link</p>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          PAG Payroll System v1.0 — Confidential
        </p>
      </div>
    </div>
  )
}
