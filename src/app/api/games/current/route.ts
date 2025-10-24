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

    // Query games from now onwards (scheduled/live) - SAME AS /odds PAGE
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
      console.error('Query details:', { league, q, limit })
      return NextResponse.json(
        { error: 'Failed to fetch games', details: error.message },
        { status: 500 }
      )
    }

    console.debug('[games/current] Raw games count:', games?.length)
    console.debug('[games/current] First game odds structure:', games?.[0]?.odds ? Object.keys(games[0].odds) : 'NO ODDS')

    // Transform using the SAME LOGIC as /odds page
    const transformed = (games || []).map((game: any) => {
      // Extract sportsbook names from odds object (just like /odds page)
      const sportsbooks = game.odds ? Object.keys(game.odds) : []
      
      // Calculate average odds from all sportsbooks (same as /odds page)
      const calculateAvgMoneyline = (isHome: boolean) => {
        const values = sportsbooks
          .map(book => game.odds[book]?.moneyline?.[isHome ? 'home' : 'away'])
          .filter(val => val !== undefined && val !== null)
        return values.length > 0 
          ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
          : 0
      }

      const calculateAvgSpread = () => {
        const values = sportsbooks
          .map(book => game.odds[book]?.spread?.line)
          .filter(val => val !== undefined && val !== null)
        return values.length > 0 
          ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
          : 0
      }

      const calculateAvgTotal = () => {
        const values = sportsbooks
          .map(book => game.odds[book]?.total?.line)
          .filter(val => val !== undefined && val !== null)
        return values.length > 0 
          ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
          : 0
      }

      // Determine spread favorite (team with negative spread)
      const avgSpread = calculateAvgSpread()
      const spreadTeam = avgSpread < 0 ? game.home_team?.name : game.away_team?.name

      const result = {
        game_id: game.id,
        sport: game.sport?.toUpperCase() || 'NBA',
        status: game.status || 'scheduled',
        start_time_utc: `${game.game_date}T${game.game_time}`,
        home: game.home_team?.name || 'Home Team',
        away: game.away_team?.name || 'Away Team',
        odds: {
          ml_home: calculateAvgMoneyline(true),
          ml_away: calculateAvgMoneyline(false),
          spread_team: spreadTeam || game.home_team?.name || 'Home Team',
          spread_line: Math.abs(avgSpread),
          total_line: calculateAvgTotal(),
        },
        book_count: sportsbooks.length,
      }

      console.debug('[games/current] Transformed game:', game.id, 'odds:', result.odds)
      return result
    })

    console.debug('[games/current] Final response:', JSON.stringify({ games: transformed }, null, 2))

    return NextResponse.json(
      { games: transformed },
      {
        headers: {
          'Cache-Control': `s-maxage=${revalidate}, stale-while-revalidate`,
        },
      }
    )
  } catch (e) {
    console.error('[games/current] API error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}