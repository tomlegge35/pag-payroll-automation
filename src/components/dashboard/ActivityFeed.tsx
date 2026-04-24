import { formatDateTime } from '@/lib/utils/dates'

interface Activity {
  id: string
  table_name: string
  action: string
  new_data: any
  created_at: string
}

const ACTION_ICONS: Record<string, string> = {
  INSERT: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
}

const TABLE_LABELS: Record<string, string> = {
  payroll_cycles: 'Payroll Cycle',
  payroll_inputs: 'Input',
  payroll_records: 'Payroll Record',
  variance_analysis: 'Variance',
  approval_actions: 'Approval',
  queries: 'Query',
  employees: 'Employee',
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="card">
      <h3 className="mb-4">Recent Activity</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {activities.map(activity => (
            <div key={activity.id} className="flex items-start gap-3 text-sm">
              <span className="text-base">{ACTION_ICONS[activity.action] || '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 truncate">
                  {activity.action} {TABLE_LABELS[activity.table_name] || activity.table_name}
                </p>
                <p className="text-xs text-gray-400">{formatDateTime(activity.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
