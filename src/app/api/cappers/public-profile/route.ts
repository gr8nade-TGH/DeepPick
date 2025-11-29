import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cappers/public-profile?capperId=xxx
 *
 * Fetches public profile information for a capper (user or system)
 * Falls back to creating a basic profile from picks data if the capper has placed picks
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

    // Try to fetch from user_cappers first (case-insensitive)
    const { data: userCapper, error: userCapperError } = await supabase
      .from('user_cappers')
      .select('capper_id, display_name, description, color_theme, created_at, social_links')
      .ilike('capper_id', capperId)
      .single()

    if (userCapper) {
      return NextResponse.json({
        success: true,
        capper: userCapper
      })
    }

    // If not found in user_cappers, try system cappers (capper_profiles) - case-insensitive
    const { data: systemCapper, error: systemCapperError } = await supabase
      .from('capper_profiles')
      .select('capper_id, display_name, description, color_theme, created_at')
      .ilike('capper_id', capperId)
      .single()

    if (systemCapper) {
      return NextResponse.json({
        success: true,
        capper: systemCapper
      })
    }

    // Fallback: Check if this capper has any picks (they're a user who placed manual picks)
    const { data: capperPicks, error: picksError } = await supabase
      .from('shiva_picks')
      .select('capper, created_at')
      .ilike('capper', capperId)
      .order('created_at', { ascending: true })
      .limit(1)

    if (capperPicks && capperPicks.length > 0) {
      // Create a basic profile from picks data
      const firstPick = capperPicks[0]
      return NextResponse.json({
        success: true,
        capper: {
          capper_id: capperId.toLowerCase(),
          display_name: firstPick.capper || capperId, // Use the capper name from picks
          description: 'Sharp Siege capper placing manual picks.',
          color_theme: 'purple', // Default color for user cappers
          created_at: firstPick.created_at,
          social_links: null,
          is_fallback: true // Flag to indicate this is generated, not a formal profile
        }
      })
    }

    // Capper truly not found
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

