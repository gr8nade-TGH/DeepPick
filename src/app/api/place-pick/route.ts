import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateManualPickInsight } from '@/lib/capper-stats/manual-pick-insight'

export async function POST(request: NextRequest) {
  try {
    console.log('[place-pick] Starting pick placement...')
    const body = await request.json()
    console.log('[place-pick] Request body:', JSON.stringify(body, null, 2))

    const {
      game_id,
      capper,
      pick_type,
      selection,
      odds,
      units = 1.0,
      is_system_pick = false, // Default to false for manual picks
      confidence,
      reasoning,
      algorithm_version
    } = body

    // Get authenticated user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (e) {
              // Ignore cookie set errors in API routes
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (e) {
              // Ignore cookie remove errors in API routes
            }
          },
        },
      }
    )

    console.log('[place-pick] Getting user...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('[place-pick] Auth error:', userError)
    }

    if (!user) {
      console.log('[place-pick] No user found')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    console.log('[place-pick] User found:', user.id)

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[place-pick] Profile error:', profileError)
    }

    if (!profile) {
      console.log('[place-pick] No profile found')
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 })
    }

    console.log('[place-pick] Profile found:', { role: profile.role, full_name: profile.full_name })

    // Check if user has CAPPER or ADMIN role
    if (profile.role !== 'capper' && profile.role !== 'admin') {
      console.log('[place-pick] Role check failed:', profile.role)
      return NextResponse.json({
        success: false,
        error: 'Capper role required. Please upgrade your account to make picks.'
      }, { status: 403 })
    }

    // Validate required fields
    if (!game_id || !pick_type || !selection || !odds) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: game_id, pick_type, selection, odds'
      }, { status: 400 })
    }

    // Fetch the game to create snapshot
    const { data: game, error: gameError } = await getSupabaseAdmin()
      .from('games')
      .select('*')
      .eq('id', game_id)
      .single()

    if (gameError || !game) {
      return NextResponse.json({
        success: false,
        error: 'Game not found'
      }, { status: 404 })
    }

    // Create game snapshot
    const game_snapshot = {
      sport: game.sport,
      league: game.league,
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.game_date,
      game_time: game.game_time,
      game_start_timestamp: game.game_start_timestamp, // CRITICAL: Include full UTC timestamp
      odds: game.odds,
      status: game.status
    }

    // Use profile's full_name as capper if not specified
    const capperName = capper || profile.full_name || 'manual'
    console.log('[place-pick] Using capper name:', capperName)

    // Extract team info for insight generation
    const homeTeam = {
      name: game.home_team?.name || game.home_team || 'Home',
      abbreviation: game.home_team?.abbreviation || ''
    }
    const awayTeam = {
      name: game.away_team?.name || game.away_team || 'Away',
      abbreviation: game.away_team?.abbreviation || ''
    }

    // Generate manual pick insight data (for non-system picks)
    let insightCardSnapshot = null
    if (!is_system_pick) {
      try {
        console.log('[place-pick] Generating manual pick insight...')
        const insightData = await generateManualPickInsight(
          capperName,
          pick_type as 'spread' | 'total',
          selection,
          units,
          homeTeam,
          awayTeam
        )

        // Build insight card snapshot in the expected format
        insightCardSnapshot = {
          matchup: {
            away: awayTeam.name,
            home: homeTeam.name,
            game_date: game.game_date
          },
          pick: {
            type: pick_type.toUpperCase(),
            selection,
            units,
            confidence: confidence || 5
          },
          manual_insight: insightData,
          factors: [], // Manual picks don't have AI factors
          generated_at: new Date().toISOString()
        }
        console.log('[place-pick] Manual pick insight generated:', {
          capper: insightData.capper,
          betTypeRecord: insightData.betTypeRecord,
          streak: insightData.streak
        })
      } catch (insightError) {
        console.error('[place-pick] Error generating manual pick insight:', insightError)
        // Continue without insight - don't fail the pick
      }
    }

    // Insert the pick with user_id
    const { data: pick, error: pickError } = await getSupabaseAdmin()
      .from('picks')
      .insert({
        game_id,
        capper: capperName,
        pick_type,
        selection,
        odds,
        units,
        game_snapshot,
        is_system_pick,
        confidence,
        reasoning,
        algorithm_version,
        status: 'pending',
        user_id: user.id,
        insight_card_snapshot: insightCardSnapshot,
        insight_card_locked_at: insightCardSnapshot ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (pickError) {
      console.error('[place-pick] Error creating pick:', pickError)
      return NextResponse.json({
        success: false,
        error: pickError.message,
        details: pickError
      }, { status: 500 })
    }

    console.log('[place-pick] Pick created successfully:', pick?.id)

    return NextResponse.json({
      success: true,
      pick,
      message: `Pick placed: ${selection} at ${odds > 0 ? '+' : ''}${odds} for ${units} units`
    })

  } catch (error) {
    console.error('[place-pick] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

