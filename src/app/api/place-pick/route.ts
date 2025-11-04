import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

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
      is_system_pick = true,
      confidence,
      reasoning,
      algorithm_version
    } = body

    // Validate required fields (including capper to prevent defaulting to 'deeppick')
    if (!game_id || !capper || !pick_type || !selection || !odds) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: game_id, capper, pick_type, selection, odds'
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

    // Insert the pick
    const { data: pick, error: pickError } = await getSupabaseAdmin()
      .from('picks')
      .insert({
        game_id,
        capper,
        pick_type,
        selection,
        odds,
        units,
        game_snapshot,
        is_system_pick,
        confidence,
        reasoning,
        algorithm_version,
        status: 'pending'
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

