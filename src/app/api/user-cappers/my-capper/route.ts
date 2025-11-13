import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/user-cappers/my-capper
 * 
 * Fetches the authenticated user's capper data
 */
export async function GET() {
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
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

    // Get user's profile to check role
    const admin = getSupabaseAdmin()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (profile.role !== 'capper' && profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Not a capper' },
        { status: 403 }
      )
    }

    // Fetch user's capper data
    const { data: capper, error: capperError } = await admin
      .from('user_cappers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (capperError) {
      // If no capper found, return empty state
      if (capperError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'No capper found. Please create a capper first.' },
          { status: 404 }
        )
      }

      console.error('[MyCapperAPI] Database error:', capperError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch capper data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      capper
    })
  } catch (error) {
    console.error('[MyCapperAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

