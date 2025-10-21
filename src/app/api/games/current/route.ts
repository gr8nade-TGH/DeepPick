import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 30 // 30s cache

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const league = searchParams.get('league')
    const q = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (!league) {
      return NextResponse.json(
        { error: 'league parameter is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Query games from now onwards (scheduled/in_progress)
    const cutoff = new Date().toISOString()

    let query = supabase
      .from('games')
      .select('*')
      .eq('sport', league.toLowerCase())
      .in('status', ['scheduled', 'live'])
      .gte('game_date', new Date().toISOString().split('T')[0]) // Today onwards
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })
      .limit(limit)

    if (q) {
      query = query.or(`home_team->>name.ilike.%${q}%,away_team->>name.ilike.%${q}%,id.ilike.%${q}%`)
    }

    const { data: games, error } = await query

    if (error) {
      console.error('Supabase error fetching games:', error)
      return NextResponse.json(
        { error: 'Failed to fetch games' },
        { status: 500 }
      )
    }

    console.log('Raw games data:', JSON.stringify(games, null, 2))

    const transformed = (games || []).map((game: any) => {
      console.log('Transforming game:', game.id, 'odds:', game.odds)
      return {
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
    })

    return NextResponse.json(
      { games: transformed },
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