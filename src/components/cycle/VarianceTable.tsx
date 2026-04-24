'use client'

import { useState } from 'react'

interface Variance {
  id: string
  employee_id: string
  metric: string
  prior_value: number | null
  current_value: number | null
  variance_abs: number | null
  variance_pct: number | null
  flag: string
  status: string
  explanation: string | null
  employees: { name: string; payroll_id: string } | null
}

interface VarianceTableProps {
  variances: Variance[]
  cycleId: string
}

const FLAG_COLORS: Record<string, string> = {
  threshold: 'badge-amber',
  new_starter: 'badge-green',
  leaver: 'badge-red',
  tax_code_change: 'badge-blue',
  ok: 'badge-gray',
}

const FLAG_LABELS: Record<string, string> = {
  threshold: '>5% Change',
  new_starter: 'New Starter',
  leaver: 'Leaver',
  tax_code_change: 'Tax Code Change',
  ok: 'OK',
}

const STATUS_COLORS: Record<string, string> = {
  unexplained: 'text-red-600 font-medium',
  explained: 'text-blue-600',
  accepted: 'text-green-600',
}

const REASON_CODES = [
  { value: 'salary_increase', label: 'Salary increase per payroll inputs' },
  { value: 'new_starter', label: 'New starter - expected change' },
  { value: 'leaver', label: 'Leaver - final payment' },
  { value: 'tax_code_change', label: 'Tax code change' },
  { value: 'hours_variation', label: 'Hours variation (overtime/reduced)' },
  { value: 'holiday_pay', label: 'Holiday pay adjustment' },
  { value: 'bonus', label: 'One-off bonus payment' },
  { value: 'correction', label: 'Correction from prior period' },
  { value: 'other', label: 'Other (see notes)' },
]

export default function VarianceTable({ variances, cycleId }: VarianceTableProps) {
  const [explanations, setExplanations] = useState<Record<string, { reasonCode: string; notes: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const handleExplanation = async (varianceId: string, reasonCode: string, notes: string) => {
    setSaving(prev => ({ ...prev, [varianceId]: true }))
    
    try {
      await fetch(`/api/cycles/${cycleId}/variances/${varianceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          explanation: notes || reasonCode,
          status: 'accepted',
          reasonCode,
        }),
      })
      setSaved(prev => ({ ...prev, [varianceId]: true }))
    } catch (e) {
      console.error('Error saving explanation:', e)
    } finally {
      setSaving(prev => ({ ...prev, [varianceId]: false }))
    }
  }

  const flaggedVariances = variances.filter(v => v.flag !== 'ok')
  const okVariances = variances.filter(v => v.flag === 'ok')

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-amber-600">{variances.filter(v => v.status === 'unexplained').length}</div>
          <div className="text-xs text-gray-500 mt-1">Unexplained</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{variances.filter(v => v.status === 'accepted').length}</div>
          <div className="text-xs text-gray-500 mt-1">Accepted</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-navy">{flaggedVariances.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Flagged</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-400">{okVariances.length}</div>
          <div className="text-xs text-gray-500 mt-1">No Change</div>
        </div>
      </div>

      {/* Flagged variances */}
      {flaggedVariances.length > 0 && (
        <div className="card overflow-hidden">
          <h3 className="mb-4">Flagged Variances</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Metric</th>
                  <th className="table-header text-right">Prior</th>
                  <th className="table-header text-right">Current</th>
                  <th className="table-header text-right">Variance</th>
                  <th className="table-header">Flag</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {flaggedVariances.map(v => {
                  const isUnexplained = v.status === 'unexplained' && !saved[v.id]
                  const isSavedNow = saved[v.id]
                  const currentExpl = explanations[v.id]
                  
                  return (
                    <tr key={v.id} className={`border-b border-gray-100 ${isUnexplained ? 'bg-red-50' : isSavedNow ? 'bg-green-50' : ''}`}>
                      <td className="table-cell font-medium">{v.employees?.name}</td>
                      <td className="table-cell">{v.metric}</td>
                      <td className="table-cell text-right text-gray-500">
                        {v.prior_value != null ? `£${v.prior_value.toFixed(2)}` : '—'}
                      </td>
                      <td className="table-cell text-right font-medium">
                        {v.current_value != null ? `£${v.current_value.toFixed(2)}` : '—'}
                      </td>
                      <td className={`table-cell text-right ${(v.variance_abs || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {v.variance_abs != null ? `${v.variance_abs > 0 ? '+' : ''}£${Math.abs(v.variance_abs).toFixed(2)}` : '—'}
                        {v.variance_pct != null && <span className="text-xs text-gray-400 ml-1">({v.variance_pct > 0 ? '+' : ''}{v.variance_pct.toFixed(1)}%)</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`${FLAG_COLORS[v.flag] || 'badge-gray'} status-pill`}>
                          {FLAG_LABELS[v.flag] || v.flag}
                        </span>
                      </td>
                      <td className={`table-cell ${STATUS_COLORS[isSavedNow ? 'accepted' : v.status] || ''}`}>
                        {isSavedNow ? '✓ Accepted' : v.status}
                      </td>
                      <td className="table-cell">
                        {isUnexplained && (
                          <div className="space-y-1 min-w-[200px]">
                            <select
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                              value={currentExpl?.reasonCode || ''}
                              onChange={e => setExplanations(prev => ({ ...prev, [v.id]: { reasonCode: e.target.value, notes: currentExpl?.notes || '' } }))}
                            >
                              <option value="">Select reason...</option>
                              {REASON_CODES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                                value={currentExpl?.notes || ''}
                                onChange={e => setExplanations(prev => ({ ...prev, [v.id]: { reasonCode: currentExpl?.reasonCode || '', notes: e.target.value } }))}
                              />
                              <button
                                onClick={() => handleExplanation(v.id, currentExpl?.reasonCode || 'other', currentExpl?.notes || '')}
                                disabled={!currentExpl?.reasonCode || saving[v.id]}
                                className="text-xs bg-pag-blue text-white px-2 py-1 rounded disabled:opacity-50 whitespace-nowrap"
                              >
                                {saving[v.id] ? '...' : 'Accept'}
                              </button>
                            </div>
                          </div>
                        )}
                        {!isUnexplained && (
                          <span className="text-xs text-gray-500">{v.explanation || '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
