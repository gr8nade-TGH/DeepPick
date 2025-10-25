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
      sport: game.sport?.toUpperCase() || 'NBA',
      status: game.status || 'scheduled',
      start_time_utc: `${game.game_date}T${game.game_time}`,
      home: game.home_team?.name || 'Home Team',
      away: game.away_team?.name || 'Away Team',
      odds: {
        ml_home: game.odds?.home_ml || 0,
        ml_away: game.odds?.away_ml || 0,
        spread_team: game.odds?.spread_favorite === 'home' ? (game.home_team?.name || 'Home Team') : (game.away_team?.name || 'Away Team'),
        spread_line: game.odds?.spread_line || 0,
        total_line: game.odds?.total_line || 0,
      },
      book_count: game.odds?.book_count || 0,
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