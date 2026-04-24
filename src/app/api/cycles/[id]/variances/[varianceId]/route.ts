/**
 * PATCH /api/cycles/[id]/variances/[varianceId]
 * Update a variance explanation and status
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; varianceId: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { explanation, status, reasonCode } = await request.json()
    
    if (!['explained', 'accepted'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    const fullExplanation = reasonCode ? `[${reasonCode}] ${explanation || ''}`.trim() : explanation
    
    const { error } = await supabase
      .from('variance_analysis')
      .update({
        explanation: fullExplanation,
        status,
        actioned_by: user.id,
        actioned_at: new Date().toISOString(),
      })
      .eq('id', params.varianceId)
      .eq('cycle_id', params.id)
    
    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update variance' }, { status: 500 })
  }
}
