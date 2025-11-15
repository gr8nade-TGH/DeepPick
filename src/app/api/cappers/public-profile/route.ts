import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cappers/public-profile?capperId=xxx
 * 
 * Fetches public profile information for a capper (user or system)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const capperId = searchParams.get('capperId')

    if (!capperId) {
      return NextResponse.json(
        { success: false, error: 'capperId is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Try to fetch from user_cappers first
    const { data: userCapper, error: userCapperError } = await supabase
      .from('user_cappers')
      .select('capper_id, display_name, description, color_theme, created_at, social_links')
      .eq('capper_id', capperId)
      .single()

    if (userCapper) {
      return NextResponse.json({
        success: true,
        capper: userCapper
      })
    }

    // If not found in user_cappers, try system cappers (capper_profiles)
    const { data: systemCapper, error: systemCapperError } = await supabase
      .from('capper_profiles')
      .select('capper_id, display_name, description, color_theme, created_at')
      .eq('capper_id', capperId)
      .single()

    if (systemCapper) {
      return NextResponse.json({
        success: true,
        capper: systemCapper
      })
    }

    // Capper not found
    return NextResponse.json(
      { success: false, error: 'Capper not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('[CapperPublicProfile] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

