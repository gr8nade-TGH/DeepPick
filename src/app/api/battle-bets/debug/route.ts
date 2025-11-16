import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/battle-bets/debug
 * 
 * Debug endpoint to check:
 * - Scheduled NBA games
 * - SPREAD picks for those games
 * - Potential matchups
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    // 1. Get scheduled NBA games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, spread_line, game_start_timestamp, status')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .gte('game_start_timestamp', new Date().toISOString())
      .order('game_start_timestamp', { ascending: true })
      .limit(10)

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 })
    }

    // 2. For each game, get SPREAD picks
    const gamesWithPicks = await Promise.all(
      (games || []).map(async (game) => {
        const { data: picks, error: picksError } = await supabase
          .from('picks')
          .select('id, capper, selection, pick_type, units, status')
          .eq('game_id', game.id)
          .eq('pick_type', 'spread')

        return {
          game: {
            id: game.id,
            matchup: `${game.away_team?.abbreviation || 'N/A'} @ ${game.home_team?.abbreviation || 'N/A'}`,
            spread: game.spread_line,
            startTime: game.game_start_timestamp,
            status: game.status
          },
          picks: picks || [],
          pickCount: picks?.length || 0,
          pendingPicks: picks?.filter(p => p.status === 'pending').length || 0
        }
      })
    )

    // 3. Get existing battles
    const { data: battles, error: battlesError } = await supabase
      .from('battle_matchups')
      .select('id, left_capper_id, right_capper_id, status, game_id')
      .neq('status', 'complete')
      .limit(10)

    return NextResponse.json({
      success: true,
      summary: {
        scheduledGames: games?.length || 0,
        gamesWithPicks: gamesWithPicks.filter(g => g.pickCount > 0).length,
        gamesWithMultiplePicks: gamesWithPicks.filter(g => g.pickCount >= 2).length,
        activeBattles: battles?.length || 0
      },
      games: gamesWithPicks,
      battles: battles || []
    })
  } catch (error) {
    console.error('[Battle Debug] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

