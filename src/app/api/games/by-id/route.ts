import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 30

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

    if (error) {
      console.error('Supabase error fetching game by ID:', error)
      return NextResponse.json(
        { error: 'Game not found or failed to fetch' },
        { status: 404 }
      )
    }

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
          'Cache-Control': `s-maxage=${revalidate}, stale-while-revalidate`,
        },
      }
    )
  } catch (e) {
    console.error('API error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}