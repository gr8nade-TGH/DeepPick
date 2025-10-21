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

    // Query games from last 12h onwards (scheduled/in_progress)
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('games')
      .select('*')
      .eq('league', league)
      .in('status', ['scheduled', 'in_progress'])
      .gte('start_time', cutoff)
      .order('start_time', { ascending: true })
      .limit(limit)

    if (q) {
      query = query.or(`home_team.ilike.%${q}%,away_team.ilike.%${q}%,id.ilike.%${q}%`)
    }

    const { data: games, error } = await query

    if (error) {
      console.error('Supabase error fetching games:', error)
      return NextResponse.json(
        { error: 'Failed to fetch games' },
        { status: 500 }
      )
    }

    const transformed = (games || []).map((game: any) => ({
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
    }))

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