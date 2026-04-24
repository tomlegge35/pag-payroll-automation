import Link from 'next/link'
import { formatMonthYear } from '@/lib/utils/dates'

interface ActionItemsProps {
  cycle: any | null
  role: string
  openQueries: any[]
}

export default function ActionItems({ cycle, role, openQueries }: ActionItemsProps) {
  const isPAG = ['pag_admin', 'pag_operator'].includes(role)
  const isAccountant = role === 'accountant'
  
  const items = []
  
  if (cycle) {
    const monthYear = formatMonthYear(cycle.month, cycle.year)
    
    if (cycle.status === 'initiated' && isPAG) {
      items.push({
        priority: 'high',
        title: `Submit ${monthYear} Payroll Inputs`,
        description: 'Review standing data and submit any changes to Rodliffe',
        href: `/cycle/${cycle.id}/inputs`,
        action: 'Submit Inputs',
      })
    }
    
    if (cycle.status === 'processing' && isAccountant) {
      items.push({
        priority: 'high',
        title: `Upload ${monthYear} Payroll`,
        description: 'Complete compliance checklist and upload payslip PDFs',
        href: `/cycle/${cycle.id}/upload`,
        action: 'Upload Now',
      })
    }
    
    if (cycle.status === 'approval_pending' && isPAG) {
      items.push({
        priority: 'high',
        title: `Approve ${monthYear} Payroll`,
        description: 'Review variance analysis and approve or reject payroll',
        href: `/cycle/${cycle.id}/approve`,
        action: 'Review & Approve',
      })
    }
  }
  
  if (openQueries.length > 0) {
    items.push({
      priority: 'medium',
      title: `${openQueries.length} Open Quer${openQueries.length !== 1 ? 'ies' : 'y'}`,
      description: isPAG ? 'Queries from Rodliffe awaiting your response' : 'Queries awaiting PAG response',
      href: cycle ? `/cycle/${openQueries[0].cycle_id}/queries` : '/dashboard',
      action: 'View Queries',
    })
  }
  
  return (
    <div className="card">
      <h3 className="mb-4">Action Items</h3>
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-sm">No actions required right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${
              item.priority === 'high' ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.priority === 'high' && <span className="text-orange-500 text-xs font-bold">● REQUIRED</span>}
                  <span className="text-sm font-medium text-gray-900">{item.title}</span>
                </div>
                <p className="text-xs text-gray-600">{item.description}</p>
              </div>
              <Link href={item.href} className="btn-primary text-sm ml-4 whitespace-nowrap">
                {item.action}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
