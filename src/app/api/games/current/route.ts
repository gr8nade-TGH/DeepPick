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

    // Transform games - handle both The Odds API format and MySportsFeeds format
    const transformed = (games || []).map((game: any) => {
      try {
        // Check if odds is in MySportsFeeds format (direct object) or The Odds API format (sportsbook keys)
        const isMySportsFeedsFormat = game.odds && (game.odds.spread || game.odds.total || game.odds.moneyline)

        let ml_home = 0, ml_away = 0, spread_line = 0, total_line = 0, spread_team = ''
        let book_count = 0

        if (isMySportsFeedsFormat) {
          // MySportsFeeds format - direct access
          if (game.odds.moneyline) {
            ml_home = game.odds.moneyline.home || 0
            ml_away = game.odds.moneyline.away || 0
          }
          if (game.odds.spread) {
            spread_line = Math.abs(game.odds.spread.line || 0)
            spread_team = (game.odds.spread.line || 0) < 0 ? game.home_team?.name : game.away_team?.name
          }
          if (game.odds.total) {
            total_line = game.odds.total.line || 0
          }
          book_count = 1 // MySportsFeeds provides aggregated odds
        } else {
          // The Odds API format - sportsbook keys
          const sportsbooks = game.odds ? Object.keys(game.odds) : []
          book_count = sportsbooks.length

          const calculateAvgMoneyline = (isHome: boolean) => {
            const teamName = isHome ? game.home_team?.name : game.away_team?.name
            const values = sportsbooks
              .map(book => game.odds[book]?.moneyline?.[teamName])
              .filter(val => val !== undefined && val !== null)
            return values.length > 0
              ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
              : 0
          }

          const calculateAvgSpread = () => {
            const values = sportsbooks
              .map(book => {
                const spread = game.odds[book]?.spread
                if (!spread) return null
                const homeTeam = game.home_team?.name
                if (homeTeam && spread[homeTeam]?.point !== undefined) {
                  return spread[homeTeam].point
                }
                return null
              })
              .filter(val => val !== undefined && val !== null)
            return values.length > 0
              ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
              : 0
          }

          const calculateAvgTotal = () => {
            const values = sportsbooks
              .map(book => {
                const total = game.odds[book]?.total
                if (!total) return null
                return total.Over?.point || total.Under?.point || null
              })
              .filter(val => val !== undefined && val !== null)
            return values.length > 0
              ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
              : 0
          }

          ml_home = calculateAvgMoneyline(true)
          ml_away = calculateAvgMoneyline(false)
          const avgSpread = calculateAvgSpread()
          spread_line = Math.abs(avgSpread)
          spread_team = avgSpread < 0 ? game.home_team?.name : game.away_team?.name
          total_line = calculateAvgTotal()
        }

        const result = {
          game_id: game.id,
          sport: game.sport?.toUpperCase() || 'NBA',
          status: game.status || 'scheduled',
          start_time_utc: `${game.game_date}T${game.game_time}`,
          home: game.home_team?.name || 'Home Team',
          away: game.away_team?.name || 'Away Team',
          odds: {
            ml_home,
            ml_away,
            spread_team: spread_team || game.home_team?.name || 'Home Team',
            spread_line,
            total_line,
          },
          book_count,
        }

        return result
      } catch (transformError) {
        console.error('[games/current] Error transforming game:', game.id, transformError)
        // Return a minimal valid game object
        return {
          game_id: game.id,
          sport: game.sport?.toUpperCase() || 'NBA',
          status: game.status || 'scheduled',
          start_time_utc: `${game.game_date}T${game.game_time}`,
          home: game.home_team?.name || 'Home Team',
          away: game.away_team?.name || 'Away Team',
          odds: {
            ml_home: 0,
            ml_away: 0,
            spread_team: game.home_team?.name || 'Home Team',
            spread_line: 0,
            total_line: 0,
          },
          book_count: 0,
        }
      }
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