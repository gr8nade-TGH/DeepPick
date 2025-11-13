import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/user-cappers/toggle-active
 * 
 * Toggles the is_active status of the user's capper
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    
    // Create authenticated Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore
            }
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { capper_id } = body

    if (!capper_id) {
      return NextResponse.json(
        { success: false, error: 'capper_id is required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Verify ownership
    const { data: capper, error: fetchError } = await admin
      .from('user_cappers')
      .select('user_id, is_active')
      .eq('capper_id', capper_id)
      .single()

    if (fetchError || !capper) {
      return NextResponse.json(
        { success: false, error: 'Capper not found' },
        { status: 404 }
      )
    }

    if (capper.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to modify this capper' },
        { status: 403 }
      )
    }

    // Toggle is_active
    const { error: updateError } = await admin
      .from('user_cappers')
      .update({ is_active: !capper.is_active })
      .eq('capper_id', capper_id)

    if (updateError) {
      console.error('[ToggleActiveAPI] Update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update capper status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      is_active: !capper.is_active
    })
  } catch (error) {
    console.error('[ToggleActiveAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

