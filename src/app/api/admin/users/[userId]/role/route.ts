import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { RoleChangeRequest, RoleChangeResponse } from '@/types/admin'

/**
 * PATCH /api/admin/users/[userId]/role
 * Update a user's role
 * Requires ADMIN role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Authenticate user
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Check if user has ADMIN role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { newRole, reason } = body as RoleChangeRequest

    // Validate new role
    if (!['free', 'capper', 'admin'].includes(newRole)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid role. Must be: free, capper, or admin'
      }, { status: 400 })
    }

    // Prevent admin from demoting themselves
    if (params.userId === user.id && newRole !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Cannot change your own admin role'
      }, { status: 400 })
    }

    // Update user role
    const admin = getSupabaseAdmin()
    const { data: updatedProfile, error: updateError } = await admin
      .from('profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating user role:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update user role'
      }, { status: 500 })
    }

    // Log the role change (optional - for audit trail)
    console.log(`[ADMIN] User ${user.email} changed role of ${params.userId} to ${newRole}${reason ? ` (Reason: ${reason})` : ''}`)

    return NextResponse.json({
      success: true,
      user: updatedProfile
    })

  } catch (error) {
    console.error('Error in /api/admin/users/[userId]/role:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

