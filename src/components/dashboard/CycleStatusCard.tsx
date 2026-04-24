import Link from 'next/link'
import { formatMonthYear } from '@/lib/utils/dates'

interface Cycle {
  id: string
  month: number
  year: number
  status: string
}

const STAGE_MAP: Record<string, { label: string; step: number; color: string }> = {
  initiated: { label: 'Cycle Initiated', step: 1, color: 'bg-blue-500' },
  inputs_submitted: { label: 'Inputs Submitted', step: 2, color: 'bg-indigo-500' },
  processing: { label: 'Processing', step: 3, color: 'bg-yellow-500' },
  approval_pending: { label: 'Approval Pending', step: 4, color: 'bg-orange-500' },
  approved: { label: 'Approved', step: 5, color: 'bg-green-500' },
  paid: { label: 'Payments Made', step: 6, color: 'bg-teal-500' },
  closed: { label: 'Closed', step: 7, color: 'bg-gray-500' },
}

const STATUS_BADGES: Record<string, string> = {
  initiated: 'badge-blue',
  inputs_submitted: 'badge-blue',
  processing: 'badge-amber',
  approval_pending: 'badge-amber',
  approved: 'badge-green',
  paid: 'badge-green',
  closed: 'badge-gray',
}

const STAGE_ACTIONS: Record<string, { label: string; href: string; role?: string }> = {
  initiated: { label: 'Submit Inputs', href: '/cycle/[id]/inputs', role: 'pag' },
  inputs_submitted: { label: 'View Inputs', href: '/cycle/[id]/review' },
  processing: { label: 'Upload Payroll', href: '/cycle/[id]/upload', role: 'accountant' },
  approval_pending: { label: 'Review & Approve', href: '/cycle/[id]/approve', role: 'pag' },
  approved: { label: 'View Summary', href: '/cycle/[id]/summary' },
  paid: { label: 'View Summary', href: '/cycle/[id]/summary' },
}

export default function CycleStatusCard({ cycle, role }: { cycle: Cycle; role: string }) {
  const stageInfo = STAGE_MAP[cycle.status] || { label: cycle.status, step: 0, color: 'bg-gray-500' }
  const badgeClass = STATUS_BADGES[cycle.status] || 'badge-gray'
  const action = STAGE_ACTIONS[cycle.status]
  const totalSteps = 7
  const progress = (stageInfo.step / totalSteps) * 100
  
  const actionHref = action?.href?.replace('[id]', cycle.id)
  const showAction = action && (!action.role || 
    (action.role === 'pag' && ['pag_admin', 'pag_operator'].includes(role)) ||
    (action.role === 'accountant' && role === 'accountant'))

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-navy">
            {formatMonthYear(cycle.month, cycle.year)} Payroll
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">Active cycle</p>
        </div>
        <span className={`${badgeClass} status-pill`}>{stageInfo.label}</span>
      </div>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Stage {stageInfo.step} of {totalSteps}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`${stageInfo.color} h-2 rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      {/* Stage steps */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
        {['Init', 'Inputs', 'Processing', 'Approval', 'Approved', 'Paid', 'Closed'].map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`w-4 h-4 rounded-full ${i < stageInfo.step ? stageInfo.color : 'bg-gray-200'} flex items-center justify-center text-white`} style={{fontSize: '8px'}}>
              {i < stageInfo.step ? '✓' : i + 1}
            </div>
            <span className="hidden sm:block">{label}</span>
          </div>
        ))}
      </div>
      
      {showAction && actionHref && (
        <Link href={actionHref} className="btn-primary inline-block text-center">
          {action.label} →
        </Link>
      )}
    </div>
  )
}
