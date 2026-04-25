/**
 * POST /api/cycles/[id]/upload
 * Stage 5: Accountant uploads completed payroll files
 * Stores payslips, parses PDF summaries, advances stage to under_review
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parsePayslipPDF } from '@/lib/pdf/parser'
import { runVarianceAnalysis, saveVarianceAnalysis } from '@/lib/payroll/variance'
import { sendUploadReceivedEmail, sendVarianceReportEmail } from '@/lib/graph/email'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const cycleId = params.id

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, reference, period_start, stage')
      .eq('id', cycleId)
      .maybeSingle()

    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

    const body = await request.json() as {
      payslipPaths?: string[]        // storage paths in 'payslips' bucket
      checklistItems?: boolean[]
    }

    const payslipPaths = body.payslipPaths || []
    const parseErrors: string[] = []

    // Process each uploaded payslip file
    const payslipRecords: Array<{
      cycle_id: string
      employee_id: string | null
      file_name: string
      file_path: string
      file_size: number | null
      parsed_gross: number | null
      parsed_net: number | null
      parsed_tax: number | null
      parsed_ni: number | null
      uploaded_by: string
      uploaded_at: string
    }> = []

    for (const filePath of payslipPaths) {
      try {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('payslips')
          .download(filePath)

        if (dlErr || !fileData) {
          parseErrors.push(`Failed to download ${filePath}: ${dlErr?.message}`)
          continue
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())
        const parseResult = await parsePayslipPDF(buffer)

        // Try to match employee by name from parsed data
        let employeeId: string | null = null
        if (parseResult.data?.employeeName) {
          const nameParts = parseResult.data.employeeName.trim().toLowerCase()
          const { data: emp } = await supabase
            .from('employees')
            .select('id, full_name')
            .ilike('full_name', `%${nameParts.split(' ')[0]}%`)
            .maybeSingle()
          if (emp) employeeId = emp.id
        }

        const fileName = filePath.split('/').pop() || filePath

        payslipRecords.push({
          cycle_id: cycleId,
          employee_id: employeeId,
          file_name: fileName,
          file_path: filePath,
          file_size: buffer.length,
          parsed_gross: parseResult.data?.grossPay ?? null,
          parsed_net: parseResult.data?.netPay ?? null,
          parsed_tax: parseResult.data?.paye ?? null,
          parsed_ni: parseResult.data?.employeeNI ?? null,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
        })
      } catch (err) {
        parseErrors.push(`Error processing ${filePath}: ${(err as Error).message}`)
      }
    }

    if (payslipRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('payslips')
        .upsert(payslipRecords, { onConflict: 'cycle_id,employee_id' })
      if (insertError) throw insertError
    }

    // Run variance analysis if we parsed any payslips
    if (payslipRecords.length > 0) {
      try {
        const variances = await runVarianceAnalysis(supabase, cycleId)
        await saveVarianceAnalysis(supabase, cycleId, variances)
      } catch (varErr) {
        console.error('Variance analysis failed (non-fatal):', varErr)
      }
    }

    // Advance stage
    await supabase
      .from('payroll_cycles')
      .update({ stage: 'under_review', updated_at: new Date().toISOString() })
      .eq('id', cycleId)

    const periodDate = new Date(cycle.period_start)
    const month = periodDate.getMonth() + 1
    const year = periodDate.getFullYear()

    try {
      await sendUploadReceivedEmail(cycleId, month, year, payslipRecords.length)
    } catch (emailErr) {
      console.error('Upload received email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({
      success: true,
      payslipsProcessed: payslipRecords.length,
      parseErrors,
      stage: 'under_review',
    })
  } catch (err) {
    console.error('Upload route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
