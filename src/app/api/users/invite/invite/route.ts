/**
 * POST /api/users/invite
 * Invite a new user by email — pag_admin only
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
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
      return NextResponse.json({ error: 'Only PAG admins can invite users' }, { status: 403 })
    }

    const body = await request.json() as {
      email: string
      full_name: string
      role: 'pag_admin' | 'pag_operator' | 'accountant'
    }

    if (!body.email || !body.role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
    }

    const admin = getServiceClient()

    // Send invite email via Supabase
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      body.email,
      { data: { full_name: body.full_name || '' } }
    )

    if (inviteError) {
      // If user already exists, just upsert their profile
      if (!inviteError.message.includes('already been registered')) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 })
      }
    }

    const userId = invited?.user?.id

    if (userId) {
      await admin.from('user_profiles').upsert({
        id: userId,
        email: body.email,
        full_name: body.full_name || null,
        role: body.role,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    return NextResponse.json({
      success: true,
      userId,
      message: `Invite sent to ${body.email}`,
    })
  } catch (err) {
    console.error('Invite user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
