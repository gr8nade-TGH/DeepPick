import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

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

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 })
    }

    // Check if user has CAPPER or ADMIN role
    if (profile.role !== 'capper' && profile.role !== 'admin') {
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

    // Insert the pick with user_id
    const { data: pick, error: pickError } = await getSupabaseAdmin()
      .from('picks')
      .insert({
        game_id,
        capper: capper || 'manual', // Use 'manual' as default for user picks
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
        user_id: user.id // Link pick to user
      })
      .select()
      .single()

    if (pickError) {
      console.error('Error creating pick:', pickError)
      return NextResponse.json({
        success: false,
        error: pickError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      pick,
      message: `Pick placed: ${selection} at ${odds > 0 ? '+' : ''}${odds} for ${units} units`
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

