'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'

interface UploadFormProps {
  cycleId: string
  cycle: { month: number; year: number }
  inputs: any[]
}

const CHECKLIST_ITEMS = [
  'All PAG inputs have been applied',
  'Standing data validated against prior month',
  'Leave data has been verified',
  'PAYE and NIC calculations have been checked',
  'Pension contributions are correct',
  'Student and postgraduate loans are correct (where applicable)',
  'RTI submission is ready (not yet filed)',
  'All changes are traceable to the input template or HMRC notice',
]

export default function UploadForm({ cycleId, cycle, inputs }: UploadFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [checklist, setChecklist] = useState<boolean[]>(new Array(8).fill(false))
  const [payslips, setPayslips] = useState<File[]>([])
  const [summary, setSummary] = useState<File | null>(null)
  const [activity, setActivity] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')

  const allChecked = checklist.every(Boolean)
  const canSubmit = allChecked && payslips.length > 0

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    onDrop: (files) => setPayslips(prev => [...prev, ...files]),
  })

  const handleSubmit = async () => {
    if (!canSubmit) return
    setUploading(true)
    setError('')

    try {
      const uploadedPaths: string[] = []
      
      // Upload payslips to Supabase Storage
      for (let i = 0; i < payslips.length; i++) {
        setUploadProgress(`Uploading payslip ${i + 1} of ${payslips.length}...`)
        const file = payslips[i]
        const path = `${cycleId}/payslips/${file.name}`
        
        const { error: uploadError } = await supabase.storage
          .from('payroll-documents')
          .upload(path, file, { upsert: true })
        
        if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        uploadedPaths.push(path)
      }
      
      // Upload summary if provided
      let summaryPath = undefined
      if (summary) {
        setUploadProgress('Uploading payroll summary...')
        const path = `${cycleId}/payroll-summary.pdf`
        await supabase.storage.from('payroll-documents').upload(path, summary, { upsert: true })
        summaryPath = path
      }
      
      // Upload activity if provided
      let activityPath = undefined
      if (activity) {
        const path = `${cycleId}/activity-summary.pdf`
        await supabase.storage.from('payroll-documents').upload(path, activity, { upsert: true })
        activityPath = path
      }
      
      setUploadProgress('Processing payslips...')
      
      // Call upload API to process PDFs
      const res = await fetch(`/api/cycles/${cycleId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistItems: checklist,
          payslipPaths: uploadedPaths,
          payrollSummaryPath: summaryPath,
          activitySummaryPath: activityPath,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (data.requiresManualReview) {
          // TODO: Handle manual review flow
          setError(`${data.manualReviewItems.length} payslip(s) require manual data entry. This feature is coming soon.`)
          setUploading(false)
          return
        }
        throw new Error(data.error || 'Upload failed')
      }
      
      setUploadProgress('Upload complete!')
      router.push(`/cycle/${cycleId}/approve`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
      setUploadProgress('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Inputs summary */}
      {inputs.length > 0 && (
        <div className="card">
          <h3 className="mb-3">PAG Inputs to Apply ({inputs.length})</h3>
          <div className="space-y-2">
            {inputs.map(input => (
              <div key={input.id} className="flex items-center gap-3 text-sm p-2 bg-blue-50 rounded">
                <span className="badge-blue status-pill">{input.input_type.replace('_', ' ')}</span>
                <span className="text-gray-700">{input.employees?.name}</span>
                {input.field_changed && <span className="text-gray-500">{input.field_changed}: {input.old_value} → {input.new_value}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance checklist */}
      <div className="card">
        <h3 className="mb-4">Compliance Checklist</h3>
        <p className="text-sm text-gray-600 mb-4">All items must be confirmed before uploading:</p>
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist[i]}
                onChange={e => {
                  const newChecklist = [...checklist]
                  newChecklist[i] = e.target.checked
                  setChecklist(newChecklist)
                }}
                className="mt-0.5 w-4 h-4 text-pag-blue"
              />
              <span className={`text-sm ${checklist[i] ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                {item}
              </span>
            </label>
          ))}
        </div>
        {allChecked && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            ✓ All compliance items confirmed
          </div>
        )}
      </div>

      {/* File upload */}
      <div className="card">
        <h3 className="mb-4">Upload Payslips *</h3>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-pag-blue bg-blue-50' : 'border-gray-300 hover:border-pag-blue'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-4xl mb-2">📄</div>
          <p className="text-gray-700 font-medium">
            {isDragActive ? 'Drop payslip PDFs here' : 'Drag payslip PDFs here or click to browse'}
          </p>
          <p className="text-gray-500 text-sm mt-1">One PDF per employee payslip</p>
        </div>
        
        {payslips.length > 0 && (
          <div className="mt-3 space-y-1">
            {payslips.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                <span className="text-gray-700">📄 {f.name}</span>
                <button
                  onClick={() => setPayslips(prev => prev.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optional files */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h4 className="text-sm font-medium mb-2">Payroll Summary PDF (optional)</h4>
          <input type="file" accept=".pdf" onChange={e => setSummary(e.target.files?.[0] || null)} className="text-sm" />
        </div>
        <div className="card">
          <h4 className="text-sm font-medium mb-2">Activity Summary PDF (optional)</h4>
          <input type="file" accept=".pdf" onChange={e => setActivity(e.target.files?.[0] || null)} className="text-sm" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {uploadProgress && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md text-sm">
          {uploadProgress}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || uploading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : `Upload & Process ${payslips.length} Payslip${payslips.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
