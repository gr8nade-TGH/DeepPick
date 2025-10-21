import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 30

/**
 * GET /api/games/by-id?game_id=...
 * Returns a single game by ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gameId = searchParams.get('game_id')

    if (!gameId) {
      return NextResponse.json(
        { error: 'game_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (error || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Transform to API shape
    const transformed = {
      game_id: game.id,
      league: game.league,
      status: game.status,
      start_time_utc: game.start_time,
      away: game.away_team,
      home: game.home_team,
      odds: {
        ml_away: game.away_ml,
        ml_home: game.home_ml,
        spread_team: game.spread_favorite === 'home' ? game.home_team : game.away_team,
        spread_line: game.spread_line,
        total_line: game.total_line,
      },
    }

    return NextResponse.json(
      { game: transformed },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('Unexpected error in /api/games/by-id:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

