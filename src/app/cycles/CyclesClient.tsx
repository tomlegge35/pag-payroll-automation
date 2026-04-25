'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Cycle {
  id: string
  reference: string
  period_start: string
  period_end: string
  pay_date: string | null
  stage: string
  created_at: string
}

const STAGE_COLOURS: Record<string, string> = {
  initiated:          'bg-blue-100 text-blue-800',
  inputs_requested:   'bg-cyan-100 text-cyan-800',
  inputs_submitted:   'bg-orange-100 text-orange-800',
  under_review:       'bg-purple-100 text-purple-800',
  queries_raised:     'bg-red-100 text-red-800',
  queries_resolved:   'bg-teal-100 text-teal-800',
  approved:           'bg-green-100 text-green-800',
  payment_confirmed:  'bg-gray-100 text-gray-600',
}

const STAGE_LABELS: Record<string, string> = {
  initiated:          'Initiated',
  inputs_requested:   'Inputs Requested',
  inputs_submitted:   'Inputs Submitted',
  under_review:       'Under Review',
  queries_raised:     'Queries Raised',
  queries_resolved:   'Queries Resolved',
  approved:           'Approved',
  payment_confirmed:  'Payment Confirmed',
}

function formatPeriod(periodStart: string): string {
  const d = new Date(periodStart)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function CyclesClient({ cycles, role }: { cycles: Cycle[]; role: string }) {
  const router = useRouter()
  const canStart = ['pag_admin', 'pag_operator'].includes(role)

  const now = new Date()
  const nextMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2
  const nextYear = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()

  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(nextMonth)
  const [selectedYear, setSelectedYear] = useState(nextYear)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  async function handleStart() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/cycles/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear, force: false }),
      })
      const data = await res.json()
      if (res.status === 409) {
        // Already exists — navigate to it
        router.push(`/cycle/${data.cycleId}/review`)
        return
      }
      if (!res.ok) {
        setError(data.error || 'Failed to start cycle')
        setLoading(false)
        return
      }
      setShowModal(false)
      router.refresh()
      router.push(`/cycle/${data.cycleId}/review`)
    } catch (err) {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Start New Cycle button */}
      {canStart && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            + Start New Cycle
          </button>
        </div>
      )}

      {/* Cycles table */}
      {cycles.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">No payroll cycles yet.</p>
          {canStart && (
            <p className="text-gray-400 text-sm mt-2">Click &quot;Start New Cycle&quot; to begin.</p>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left">
                <th className="px-4 py-3 text-gray-600 font-medium">Reference</th>
                <th className="px-4 py-3 text-gray-600 font-medium">Period</th>
                <th className="px-4 py-3 text-gray-600 font-medium">Pay Date</th>
                <th className="px-4 py-3 text-gray-600 font-medium">Stage</th>
                <th className="px-4 py-3 text-gray-600 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {cycles.map(cycle => (
                <tr key={cycle.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{cycle.reference}</td>
                  <td className="px-4 py-3 text-gray-700">{formatPeriod(cycle.period_start)}</td>
                  <td className="px-4 py-3 text-gray-600">{cycle.pay_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLOURS[cycle.stage] || 'bg-gray-100 text-gray-600'}`}>
                      {STAGE_LABELS[cycle.stage] || cycle.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/cycle/${cycle.id}/review`}
                      className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Start New Cycle Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Start New Payroll Cycle</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="input w-full"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="input w-full"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleStart}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Starting…' : 'Start Cycle'}
              </button>
              <button
                onClick={() => { setShowModal(false); setError('') }}
                className="btn btn-ghost flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
