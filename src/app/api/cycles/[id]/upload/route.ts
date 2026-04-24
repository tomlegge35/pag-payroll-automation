/**
 * POST /api/cycles/[id]/upload
 * Stage 5: Khalid uploads completed payroll
 * Parses PDFs, writes payroll_records, triggers variance analysis
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parsePayslipPDF } from '@/lib/pdf/parser'
import { runVarianceAnalysis, saveVarianceAnalysis } from '@/lib/payroll/variance'
import { sendUploadReceivedEmail, sendVarianceReportEmail } from '@/lib/graph/email'

const REQUIRED_CHECKLIST_ITEMS = 8

interface UploadRequest {
  checklistItems: boolean[]
  payrollSummaryPath?: string
  payslipPaths: string[]
  activitySummaryPath?: string
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const cycleId = params.id
    
    // Verify cycle exists and is in correct state
    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, month, year, status')
      .eq('id', cycleId)
      .single()
    
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
    }
    
    if (cycle.status !== 'inputs_submitted' && cycle.status !== 'processing') {
      return NextResponse.json(
        { error: `Cannot upload: cycle is in status '${cycle.status}'. Expected 'inputs_submitted'.` },
        { status: 422 }
      )
    }
    
    const body: UploadRequest = await request.json()
    
    // Validate all 8 checklist items are ticked
    const checkedItems = body.checklistItems?.filter(Boolean).length || 0
    if (checkedItems < REQUIRED_CHECKLIST_ITEMS) {
      return NextResponse.json(
        { error: `All ${REQUIRED_CHECKLIST_ITEMS} compliance checklist items must be confirmed. Only ${checkedItems} checked.` },
        { status: 422 }
      )
    }
    
    // Update cycle status to processing
    await supabase
      .from('payroll_cycles')
      .update({ status: 'processing', xero_confirmed: true })
      .eq('id', cycleId)
    
    // Parse payslip PDFs and extract payroll data
    const payrollRecords = []
    const parseErrors = []
    const manualReviewRequired = []
    
    for (const payslipPath of (body.payslipPaths || [])) {
      try {
        // Download file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('payroll-documents')
          .download(payslipPath)
        
        if (downloadError) {
          parseErrors.push(`Failed to download ${payslipPath}: ${downloadError.message}`)
          continue
        }
        
        const buffer = Buffer.from(await fileData.arrayBuffer())
        const parseResult = await parsePayslipPDF(buffer)
        
        if (!parseResult.success || parseResult.confidence < 0.6) {
          // Add to manual review queue
          manualReviewRequired.push({
            path: payslipPath,
            bestEffort: parseResult.data,
            confidence: parseResult.confidence,
            errors: parseResult.errors,
          })
          continue
        }
        
        // Look up employee by name or payroll ID
        const searchName = parseResult.data?.employeeName
        const searchId = parseResult.data?.employeeId
        
        let employeeId = null
        if (searchId) {
          const { data: emp } = await supabase
            .from('employees')
            .select('id')
            .eq('payroll_id', searchId)
            .single()
          employeeId = emp?.id
        }
        
        if (!employeeId && searchName) {
          const { data: emp } = await supabase
            .from('employees')
            .select('id')
            .ilike('name', `%${searchName}%`)
            .single()
          employeeId = emp?.id
        }
        
        if (!employeeId) {
          manualReviewRequired.push({
            path: payslipPath,
            bestEffort: parseResult.data,
            confidence: parseResult.confidence,
            error: 'Could not match to employee record',
          })
          continue
        }
        
        payrollRecords.push({
          cycle_id: cycleId,
          employee_id: employeeId,
          gross_pay: parseResult.data?.grossPay,
          regular_pay: parseResult.data?.regularPay,
          holiday_pay: parseResult.data?.holidayPay,
          holiday_hours: parseResult.data?.holidayHours,
          public_holiday_pay: parseResult.data?.publicHolidayPay,
          paye: parseResult.data?.paye,
          ee_nic: parseResult.data?.eeNic,
          pension_ee: parseResult.data?.pensionEE,
          student_loan: parseResult.data?.studentLoan,
          postgrad_loan: parseResult.data?.postgradLoan,
          total_deductions: parseResult.data?.totalDeductions,
          net_pay: parseResult.data?.netPay,
          er_nic: parseResult.data?.erNic,
          er_pension: parseResult.data?.erPension,
          total_employer_cost: parseResult.data?.netPay && parseResult.data?.erNic && parseResult.data?.erPension
            ? (parseResult.data.netPay + (parseResult.data.erNic || 0) + (parseResult.data.erPension || 0) + (parseResult.data.paye || 0) + (parseResult.data.eeNic || 0) + (parseResult.data.pensionEE || 0))
            : null,
        })
      } catch (err) {
        parseErrors.push(`Error processing ${payslipPath}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    
    // If manual review needed, return that data without completing upload
    if (manualReviewRequired.length > 0) {
      return NextResponse.json({
        success: false,
        requiresManualReview: true,
        manualReviewItems: manualReviewRequired,
        parsedCount: payrollRecords.length,
        message: '${manualReviewRequired.length} payslip(s) require manual review before proceeding',
      })
    }
    
    // Save payroll records (transactional - all or nothing)
    if (payrollRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('payroll_records')
        .upsert(payrollRecords, { onConflict: 'cycle_id,employee_id' })
      
      if (insertError) throw insertError
    }
    
    // Run variance analysis
    const variances = await runVarianceAnalysis(supabase, cycleId)
    await saveVarianceAnalysis(supabase, cycleId, variances)
    
    // Update cycle status to approval_pending
    await supabase
      .from('payroll_cycles')
      .update({ status: 'approval_pending' })
      .eq('id', cycleId)
    
    // Send upload received email (E5)
    await sendUploadReceivedEmail(cycleId, cycle.month, cycle.year)
    
    // Send variance report email (E6)
    const flaggedVariances = variances.filter(v => v.flag !== 'ok')
    if (flaggedVariances.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
      
      const employeeMap: Record<string, string> = {}
      for (const emp of (employees || [])) {
        employeeMap[emp.id] = emp.name
      }
      
      await sendVarianceReportEmail(
        cycleId,
        cycle.month,
        cycle.year,
        flaggedVariances.map(v => ({
          employeeName: employeeMap[v.employee_id] || 'Unknown',
          metric: v.metric,
          priorValue: v.prior_value || 0,
          currentValue: v.current_value || 0,
          variancePct: v.variance_pct || 0,
          flag: v.flag,
        }))
      )
    }
    
    return NextResponse.json({
      success: true,
      recordsSaved: payrollRecords.length,
      variancesFound: variances.length,
      flaggedVariances: flaggedVariances.length,
      parseErrors,
    })
  } catch (error) {
    console.error('Error processing upload:', error)
    return NextResponse.json(
      { error: 'Failed to process payroll upload' },
      { status: 500 }
    )
  }
}
