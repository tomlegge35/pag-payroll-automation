'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ApprovalPanelProps {
  cycleId: string
  cycle: { month: number; year: number; status: string }
  canApprove: boolean
  unexplainedCount: number
  records: Array<{ net_pay: number | null; employees: any }>
  role: string
}

const REJECTION_REASONS = [
  { value: 'incorrect_calculation', label: 'Incorrect calculation' },
  { value: 'missing_deduction', label: 'Missing deduction' },
  { value: 'wrong_employee_data', label: 'Wrong employee data' },
  { value: 'unexplained_variance', label: 'Unexplained variance' },
  { value: 'other', label: 'Other' },
]

export default function ApprovalPanel({ 
  cycleId, cycle, canApprove, unexplainedCount, records, role 
}: ApprovalPanelProps) {
  const router = useRouter()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectionCode, setRejectionCode] = useState('')
  const [rejectionText, setRejectionText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalNet = records.reduce((sum, r) => sum + (r.net_pay || 0), 0)

  const handleSubmit = async () => {
    if (!action) return
    if (action === 'reject' && (!rejectionCode || !rejectionText)) {
      setError('Please select a rejection reason and provide details.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/cycles/${cycleId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reasonCode: rejectionCode,
          reasonText: rejectionText,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'An error occurred')
        setLoading(false)
        return
      }

      router.push(`/cycle/${cycleId}/summary`)
      router.refresh()
    } catch (e) {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  if (!['pag_admin', 'pag_operator'].includes(role)) return null

  return (
    <div className="space-y-4">
      {/* Net pay summary */}
      <div className="card">
        <h3 className="mb-3">Net Pay Summary</h3>
        <div className="space-y-2">
          {records.map((r, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{r.employees?.name}</span>
              <span className="font-medium">£{(r.net_pay || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between text-sm font-bold">
            <span>Total BACS</span>
            <span className="text-navy">£{totalNet.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Approval panel */}
      <div className="card">
        <h3 className="mb-4">Approval Decision</h3>

        {!canApprove && (
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3 mb-4 text-sm text-amber-800">
            <strong>Action required:</strong> {unexplainedCount} variance{unexplainedCount !== 1 ? 's' : ''} still unexplained.
            All variances must be explained before approval.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => setAction('approve')}
            disabled={!canApprove}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              action === 'approve' 
                ? 'bg-green-600 text-white' 
                : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            ✓ Approve Payroll
          </button>

          <button
            onClick={() => setAction('reject')}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              action === 'reject'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
            }`}
          >
            ✗ Reject Payroll
          </button>
        </div>

        {action === 'reject' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason *</label>
              <select
                value={rejectionCode}
                onChange={e => setRejectionCode(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Select reason...</option>
                {REJECTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Details *</label>
              <textarea
                value={rejectionText}
                onChange={e => setRejectionText(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
        )}

        {action && (
          <button
            onClick={handleSubmit}
            disabled={loading || (action === 'reject' && (!rejectionCode || !rejectionText))}
            className={`w-full mt-4 py-2 px-4 rounded-md text-sm font-medium ${
              action === 'approve' ? 'btn-success' : 'btn-danger'
            } disabled:opacity-50`}
          >
            {loading ? 'Submitting...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
          </button>
        )}
      </div>
    </div>
  )
}
