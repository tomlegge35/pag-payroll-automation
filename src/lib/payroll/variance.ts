/**
 * Variance Analysis Engine
 * Compares current month vs prior month payroll records
 * Flags variances according to threshold rules
 */

import { SupabaseClient } from '@supabase/supabase-js'

const VARIANCE_THRESHOLD_PCT = 5 // 5% triggers amber flag

interface PayrollMetric {
  key: string
  label: string
}

const METRICS: PayrollMetric[] = [
  { key: 'gross_pay', label: 'Gross Pay' },
  { key: 'regular_pay', label: 'Regular Pay' },
  { key: 'holiday_pay', label: 'Holiday Pay' },
  { key: 'holiday_hours', label: 'Holiday Hours' },
  { key: 'public_holiday_pay', label: 'Public Holiday Pay' },
  { key: 'paye', label: 'PAYE' },
  { key: 'ee_nic', label: 'EE NIC' },
  { key: 'pension_ee', label: 'Pension (EE)' },
  { key: 'student_loan', label: 'Student Loan' },
  { key: 'postgrad_loan', label: 'Postgrad Loan' },
  { key: 'net_pay', label: 'Net Pay' },
  { key: 'er_nic', label: 'ER NIC' },
  { key: 'er_pension', label: 'ER Pension' },
  { key: 'total_employer_cost', label: 'Total Employer Cost' },
]

interface VarianceRecord {
  cycle_id: string
  employee_id: string
  metric: string
  prior_value: number | null
  current_value: number | null
  variance_abs: number | null
  variance_pct: number | null
  flag: 'ok' | 'threshold' | 'leaver' | 'new_starter' | 'tax_code_change'
  status: 'unexplained' | 'explained' | 'accepted'
}

export async function runVarianceAnalysis(
  supabase: SupabaseClient,
  cycleId: string
): Promise<VarianceRecord[]> {
  // Get current cycle info
  const { data: cycle } = await supabase
    .from('payroll_cycles')
    .select('month, year')
    .eq('id', cycleId)
    .single()
  
  if (!cycle) throw new Error('Cycle not found')
  
  // Find prior cycle
  let priorMonth = cycle.month - 1
  let priorYear = cycle.year
  if (priorMonth === 0) { priorMonth = 12; priorYear-- }
  
  const { data: priorCycle } = await supabase
    .from('payroll_cycles')
    .select('id')
    .eq('month', priorMonth)
    .eq('year', priorYear)
    .single()
  
  // Get current payroll records
  const { data: currentRecords } = await supabase
    .from('payroll_records')
    .select('*, employees(name, status, start_date, end_date, tax_code)')
    .eq('cycle_id', cycleId)
  
  // Get prior payroll records (if available)
  const priorRecordsMap: Record<string, any> = {}
  if (priorCycle) {
    const { data: priorRecords } = await supabase
      .from('payroll_records')
      .select('*, employees(tax_code)')
      .eq('cycle_id', priorCycle.id)
    
    for (const pr of (priorRecords || [])) {
      priorRecordsMap[pr.employee_id] = pr
    }
  }
  
  // Get tax code changes from inputs
  const { data: taxCodeChanges } = await supabase
    .from('payroll_inputs')
    .select('employee_id')
    .eq('cycle_id', cycleId)
    .eq('input_type', 'tax_code')
  
  const taxCodeChangedIds = new Set((taxCodeChanges || []).map(t => t.employee_id))
  
  const variances: VarianceRecord[] = []
  
  for (const current of (currentRecords || [])) {
    const employee = current.employees
    const prior = priorRecordsMap[current.employee_id]
    
    // Determine base flag
    let baseFlag: VarianceRecord['flag'] = 'ok'
    
    if (!prior) {
      baseFlag = 'new_starter'
    } else if (employee?.status === 'leaver') {
      baseFlag = 'leaver'
    } else if (taxCodeChangedIds.has(current.employee_id)) {
      baseFlag = 'tax_code_change'
    }
    
    for (const metric of METRICS) {
      const currentVal = current[metric.key as keyof typeof current] as number | null
      const priorVal = prior?.[metric.key as keyof typeof prior] as number | null
      
      if (currentVal === null && priorVal === null) continue
      
      const varianceAbs = currentVal !== null && priorVal !== null
        ? currentVal - priorVal
        : null
      
      const variancePct = varianceAbs !== null && priorVal !== null && priorVal !== 0
        ? (varianceAbs / Math.abs(priorVal)) * 100
        : null
      
      // Determine flag
      let flag: VarianceRecord['flag'] = baseFlag
      if (flag === 'ok' && variancePct !== null && Math.abs(variancePct) > VARIANCE_THRESHOLD_PCT) {
        flag = 'threshold'
      }
      
      // Only record non-zero variances or new_starter/leaver
      if (varianceAbs === 0 && flag === 'ok') continue
      if (currentVal === null && priorVal === null) continue
      
      variances.push({
        cycle_id: cycleId,
        employee_id: current.employee_id,
        metric: metric.label,
        prior_value: priorVal,
        current_value: currentVal,
        variance_abs: varianceAbs,
        variance_pct: variancePct,
        flag,
        status: flag === 'ok' ? 'accepted' : 'unexplained',
      })
    }
  }
  
  return variances
}

export async function saveVarianceAnalysis(
  supabase: SupabaseClient,
  cycleId: string,
  variances: VarianceRecord[]
): Promise<void> {
  // Delete existing variance analysis for this cycle
  await supabase
    .from('variance_analysis')
    .delete()
    .eq('cycle_id', cycleId)
  
  if (variances.length === 0) return
  
  // Insert new variance analysis
  const { error } = await supabase
    .from('variance_analysis')
    .insert(variances)
  
  if (error) throw error
}
