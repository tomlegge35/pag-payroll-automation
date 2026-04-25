'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: string
  name: string
  payroll_id: string
  fte_salary: number | null
  weekly_hours: number | null
  fte: number | null
  tax_code: string | null
  ni_category: string | null
  pension_scheme: string | null
  student_loan_type: string | null
}

interface InputsFormProps {
  cycleId: string
  cycle: { month: number; year: number }
  employees: Employee[]
  role: string
}

const INPUT_TYPES = [
  { value: 'salary_change', label: 'Salary Change' },
  { value: 'bonus', label: 'Bonus / One-off Payment' },
  { value: 'sick', label: 'Sick Leave Adjustment' },
  { value: 'holiday_adj', label: 'Holiday Adjustment' },
  { value: 'pension_change', label: 'Pension Change' },
  { value: 'tax_code', label: 'Tax Code Change' },
  { value: 'student_loan', label: 'Student Loan Change' },
  { value: 'attachment_of_earnings', label: 'Attachment of Earnings' },
  { value: 'expense', label: 'Expense Reimbursement' },
  { value: 'other', label: 'Other' },
]

interface InputRow {
  id: string
  employeeId: string
  inputType: string
  fieldChanged: string
  oldValue: string
  newValue: string
  notes: string
}

export default function InputsForm({ cycleId, cycle, employees, role }: InputsFormProps) {
  const router = useRouter()
  const [inputs, setInputs] = useState<InputRow[]>([])
  const [xeroConfirmed, setXeroConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)

  const addInput = (employeeId: string) => {
    const newInput: InputRow = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId,
      inputType: '',
      fieldChanged: '',
      oldValue: '',
      newValue: '',
      notes: '',
    }
    setInputs(prev => [...prev, newInput])
    setExpandedEmployee(employeeId)
  }

  const removeInput = (inputId: string) => {
    setInputs(prev => prev.filter(i => i.id !== inputId))
  }

  const updateInput = (inputId: string, field: keyof InputRow, value: string) => {
    setInputs(prev => prev.map(i => i.id === inputId ? { ...i, [field]: value } : i))
  }

  const handleSubmit = async (submitToRodliffe: boolean) => {
    if (!xeroConfirmed && submitToRodliffe) {
      setError('You must confirm that holiday, sick leave, and unpaid leave are up to date in Xero.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/cycles/${cycleId}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: inputs.map(i => ({
            employee_id: i.employeeId,
            input_type: i.inputType,
            field_changed: i.fieldChanged,
            old_value: i.oldValue,
            new_value: i.newValue,
            notes: i.notes,
          })),
          xeroConfirmed,
          submitToRodliffe,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to submit inputs')
        setSubmitting(false)
        return
      }

      router.push(`/cycle/${cycleId}/review`)
      router.refresh()
    } catch (e) {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Standing data table */}
      <div className="card overflow-hidden">
        <h3 className="mb-4">Standing Data — All Active Employees</h3>
        <p className="text-sm text-gray-600 mb-4">
          Review the standing data below. Click &quot;Add Change&quot; to record any changes for this month.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header">Employee</th>
                <th className="table-header">ID</th>
                <th className="table-header text-right">FTE Salary</th>
                <th className="table-header">Tax Code</th>
                <th className="table-header">NI Cat</th>
                <th className="table-header">Pension</th>
                <th className="table-header">Changes</th>
                <th className="table-header">Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const empInputs = inputs.filter(i => i.employeeId === emp.id)
                const hasChanges = empInputs.length > 0
                
                return (
                  <>
                    <tr key={emp.id} className={`border-b border-gray-100 ${hasChanges ? 'bg-blue-50' : ''}`}>
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-gray-500">{emp.payroll_id}</td>
                      <td className="table-cell text-right">
                        {emp.fte_salary ? `£${emp.fte_salary.toLocaleString()}` : 'N/A'}
                        {emp.fte && emp.fte < 1 ? ` (${emp.fte * 100}% FTE)` : ''}
                      </td>
                      <td className="table-cell">{emp.tax_code || 'N/A'}</td>
                      <td className="table-cell">{emp.ni_category || 'A'}</td>
                      <td className="table-cell">{emp.pension_scheme || 'N/A'}</td>
                      <td className="table-cell">
                        {hasChanges 
                          ? <span className="badge-blue status-pill">{empInputs.length} change{empInputs.length !== 1 ? 's' : ''}</span>
                          : <span className="text-green-600 text-xs">✓ No changes</span>
                        }
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => addInput(emp.id)}
                          className="text-xs text-pag-blue hover:text-navy font-medium"
                        >
                          + Add Change
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded change forms */}
                    {empInputs.map(input => (
                      <tr key={input.id} className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-5 gap-3 items-end">
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">Change Type *</label>
                              <select
                                value={input.inputType}
                                onChange={e => updateInput(input.id, 'inputType', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              >
                                <option value="">Select...</option>
                                {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">Field Changed</label>
                              <input
                                type="text"
                                value={input.fieldChanged}
                                onChange={e => updateInput(input.id, 'fieldChanged', e.target.value)}
                                placeholder="e.g. fte_salary"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">Previous Value</label>
                              <input
                                type="text"
                                value={input.oldValue}
                                onChange={e => updateInput(input.id, 'oldValue', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">New Value *</label>
                              <input
                                type="text"
                                value={input.newValue}
                                onChange={e => updateInput(input.id, 'newValue', e.target.value)}
                                placeholder="New value"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={input.notes}
                                onChange={e => updateInput(input.id, 'notes', e.target.value)}
                                placeholder="Notes..."
                                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs"
                              />
                              <button onClick={() => removeInput(input.id)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Xero confirmation */}
      <div className="card bg-amber-50 border-amber-200">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={xeroConfirmed}
            onChange={e => setXeroConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-pag-blue"
          />
          <span className="text-sm text-amber-900">
            <strong>Mandatory:</strong> I confirm that all holiday, sick leave, and unpaid leave records are up to date in Xero for this payroll period.
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">{error}</div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="btn-secondary disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={submitting || !xeroConfirmed}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit to Rodliffe →'}
        </button>
      </div>
    </div>
  )
}
