import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/games/today
 * 
 * Fetches today's NBA games with odds for manual pick submission
 * Returns games that haven't started yet
 */
export async function GET() {
  try {
    const supabase = getSupabase()
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Fetch today's and upcoming scheduled NBA games
    // CRITICAL: Only return games that haven't started yet to prevent picks on live games
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .gte('game_date', today)
      .gte('game_start_timestamp', now.toISOString())
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })

    if (error) {
      console.error('[Games:Today] Error fetching games:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    // Transform games to include calculated odds averages
    const transformedGames = (games || []).map(game => {
      const odds = game.odds || {}
      const sportsbooks = Object.keys(odds)

      // Calculate average spread
      let avgSpread = null
      let avgSpreadOdds = null
      const spreads: number[] = []
      const spreadOdds: number[] = []

      sportsbooks.forEach(book => {
        const bookOdds = odds[book]
        if (bookOdds?.spread?.line !== undefined) {
          spreads.push(Math.abs(bookOdds.spread.line))
          if (bookOdds.spread.home_odds) spreadOdds.push(bookOdds.spread.home_odds)
        }
      })

      if (spreads.length > 0) {
        avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length
        avgSpreadOdds = spreadOdds.length > 0
          ? Math.round(spreadOdds.reduce((a, b) => a + b, 0) / spreadOdds.length)
          : -110
      }

      // Calculate average total
      let avgTotal = null
      let avgOverOdds = null
      let avgUnderOdds = null
      const totals: number[] = []
      const overOdds: number[] = []
      const underOdds: number[] = []

      sportsbooks.forEach(book => {
        const bookOdds = odds[book]
        if (bookOdds?.total?.line !== undefined) {
          totals.push(bookOdds.total.line)
          if (bookOdds.total.over_odds) overOdds.push(bookOdds.total.over_odds)
          if (bookOdds.total.under_odds) underOdds.push(bookOdds.total.under_odds)
        }
      })

      if (totals.length > 0) {
        avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length
        avgOverOdds = overOdds.length > 0
          ? Math.round(overOdds.reduce((a, b) => a + b, 0) / overOdds.length)
          : -110
        avgUnderOdds = underOdds.length > 0
          ? Math.round(underOdds.reduce((a, b) => a + b, 0) / underOdds.length)
          : -110
      }

      // Calculate average moneyline
      let avgHomeMl = null
      let avgAwayMl = null
      const homeMLs: number[] = []
      const awayMLs: number[] = []

      sportsbooks.forEach(book => {
        const bookOdds = odds[book]
        if (bookOdds?.moneyline?.home) homeMLs.push(bookOdds.moneyline.home)
        if (bookOdds?.moneyline?.away) awayMLs.push(bookOdds.moneyline.away)
      })

      if (homeMLs.length > 0) {
        avgHomeMl = Math.round(homeMLs.reduce((a, b) => a + b, 0) / homeMLs.length)
      }
      if (awayMLs.length > 0) {
        avgAwayMl = Math.round(awayMLs.reduce((a, b) => a + b, 0) / awayMLs.length)
      }

      return {
        id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        game_date: game.game_date,
        game_time: game.game_time,
        game_start_timestamp: game.game_start_timestamp,
        status: game.status,
        odds: {
          spread: avgSpread !== null ? {
            line: avgSpread,
            home_odds: avgSpreadOdds,
            away_odds: avgSpreadOdds
          } : null,
          total: avgTotal !== null ? {
            line: avgTotal,
            over_odds: avgOverOdds,
            under_odds: avgUnderOdds
          } : null,
          moneyline: (avgHomeMl !== null && avgAwayMl !== null) ? {
            home: avgHomeMl,
            away: avgAwayMl
          } : null
        },
        raw_odds: odds // Include raw odds for reference
      }
    })

    return NextResponse.json({
      success: true,
      games: transformedGames,
      count: transformedGames.length
    })

  } catch (error) {
    console.error('[Games:Today] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

