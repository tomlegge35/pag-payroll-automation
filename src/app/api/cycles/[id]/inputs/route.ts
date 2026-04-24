/**
 * POST /api/cycles/[id]/inputs
 * Stage 2: Submit payroll inputs (transactional - all or nothing)
 * Stage 3: Also triggers email to Khalid if submitToRodliffe=true
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInputsToRodliffeEmail } from '@/lib/graph/email'

interface InputItem {
  employee_id: string | null
  input_type: string
  field_changed?: string
  old_value?: string
  new_value?: string
  notes?: string
  supporting_doc_url?: string
}

interface InputsRequest {
  inputs: InputItem[]
  xeroConfirmed: boolean
  submitToRodliffe: boolean
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const cycleId = params.id
    
    // Verify cycle status
    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, month, year, status')
      .eq('id', cycleId)
      .single()
    
    if (!cycle || cycle.status !== 'initiated') {
      return NextResponse.json(
        { error: `Cannot submit inputs: cycle status is '${cycle?.status}'` },
        { status: 422 }
      )
    }
    
    const body: InputsRequest = await request.json()
    
    if (!body.xeroConfirmed) {
      return NextResponse.json(
        { error: 'You must confirm that holiday and leave data is up to date in Xero' },
        { status: 422 }
      )
    }
    
    // Prepare input records
    const inputRecords = body.inputs.map(input => ({
      cycle_id: cycleId,
      employee_id: input.employee_id,
      input_type: input.input_type,
      field_changed: input.field_changed,
      old_value: input.old_value,
      new_value: input.new_value,
      notes: input.notes,
      supporting_doc_url: input.supporting_doc_url,
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
    }))
    
    // Insert inputs (transactional)
    if (inputRecords.length > 0) {
      const { error } = await supabase
        .from('payroll_inputs')
        .insert(inputRecords)
      
      if (error) throw error
    }
    
    // Update cycle status
    await supabase
      .from('payroll_cycles')
      .update({ 
        status: 'inputs_submitted',
        xero_confirmed: body.xeroConfirmed,
      })
      .eq('id', cycleId)
    
    // If submitting to Rodliffe, send email (Stage 3)
    if (body.submitToRodliffe) {
      // Build inputs summary HTML
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
      
      const empMap: Record<string, string> = {}
      for (const emp of (employees || [])) empMap[emp.id] = emp.name
      
      const inputSummaryHtml = inputRecords.length === 0
        ? '<p>No changes this month. Standing data confirmed as current.</p>'
        : `<ul>${inputRecords.map(i => `<li><strong>${empMap[i.employee_id || ''] || 'N/A'}</strong>: ${i.input_type.replace('_', ' ')}${i.field_changed ? ` - ${i.field_changed}: ${i.old_value || 'N/A'} → ${i.new_value || 'N/A'}` : ''}</li>`).join('')}</ul>`
      
      await sendInputsToRodliffeEmail(
        cycleId,
        cycle.month,
        cycle.year,
        inputSummaryHtml,
        [] // document URLs - to be implemented with signed URLs
      )
    }
    
    return NextResponse.json({
      success: true,
      inputsSubmitted: inputRecords.length,
      message: body.submitToRodliffe 
        ? 'Inputs submitted and sent to Rodliffe Accounting' 
        : 'Inputs saved successfully',
    })
  } catch (error) {
    console.error('Error submitting inputs:', error)
    return NextResponse.json({ error: 'Failed to submit inputs' }, { status: 500 })
  }
}
