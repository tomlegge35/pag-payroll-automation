/**
 * PATCH /api/users/[id] — update role or active status
 * DELETE /api/users/[id] — deactivate user (soft delete)
 * pag_admin only
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'pag_admin') {
      return NextResponse.json({ error: 'Only PAG admins can modify users' }, { status: 403 })
    }

    const body = await request.json() as { role?: string; is_active?: boolean }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.role !== undefined) updates.role = body.role
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', params.id)
      .select('id, email, role, is_active')
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, user: data })
  } catch (err) {
    console.error('User PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'pag_admin') {
      return NextResponse.json({ error: 'Only PAG admins can deactivate users' }, { status: 403 })
    }

    if (params.id === user.id) {
      return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 })
    }

    await supabase
      .from('user_profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('User DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
