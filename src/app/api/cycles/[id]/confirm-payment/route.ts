/**
 * POST /api/cycles/[id]/confirm-payment
 * Stage 8: PAG confirms payments have been made
 * Archives cycle, updates holiday tracker, sets status to closed
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    
    // Verify cycle is approved
    const { data: cycle } = await supabase
      .from('payroll_cycles')
      .select('id, month, year, status')
      .eq('id', cycleId)
      .single()
    
    if (!cycle || cycle.status !== 'approved') {
      return NextResponse.json(
        { error: 'Cycle must be in approved status to confirm payment' },
        { status: 422 }
      )
    }
    
    const now = new Date().toISOString()
    
    // Mark as paid
    await supabase
      .from('payroll_cycles')
      .update({ status: 'paid', paid_confirmed_at: now })
      .eq('id', cycleId)
    
    // Check if quarterly report is due (every 3 cycles)
    const { data: closedCycles } = await supabase
      .from('payroll_cycles')
      .select('id')
      .eq('status', 'closed')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    
    const closedCount = (closedCycles?.length || 0) + 1 // +1 for current
    const quarterlyReportDue = closedCount % 3 === 0
    
    // Close the cycle
    await supabase
      .from('payroll_cycles')
      .update({ status: 'closed' })
      .eq('id', cycleId)
    
    if (quarterlyReportDue) {
      // Trigger quarterly report via the scheduled function endpoint
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/quarterly`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ cycleId }),
      }).catch(err => console.warn('Quarterly report trigger failed:', err))
    }
    
    return NextResponse.json({
      success: true,
      message: 'Payment confirmed. Payroll cycle closed.',
      quarterlyReportTriggered: quarterlyReportDue,
    })
  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 })
  }
}
