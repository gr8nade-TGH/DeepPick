import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * DEBUG: Test SHIVA scanner to see what games are available
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()

  try {
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    console.log('='.repeat(80))
    console.log('SHIVA SCANNER DEBUG TEST')
    console.log('='.repeat(80))
    console.log(`Current time: ${now.toISOString()}`)
    console.log(`5 minutes from now: ${fiveMinutesFromNow.toISOString()}`)

    // Step 1: Get ALL NBA games
    const { data: allGames, error: allGamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, game_time, status, total_line, spread_line')
      .eq('sport', 'nba')
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })

    console.log(`\nStep 1: ALL NBA games in database: ${allGames?.length || 0}`)
    if (allGamesError) {
      console.error('Error fetching all games:', allGamesError)
    }

    // Step 2: Get SCHEDULED games only
    const { data: scheduledGames, error: scheduledError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, game_time, status, total_line, spread_line')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })

    console.log(`\nStep 2: SCHEDULED NBA games: ${scheduledGames?.length || 0}`)
    if (scheduledError) {
      console.error('Error fetching scheduled games:', scheduledError)
    }

    // Step 3: Get games starting in the future (5+ minutes from now)
    const timeString = fiveMinutesFromNow.toTimeString().split(' ')[0]
    const dateString = fiveMinutesFromNow.toISOString().split('T')[0]

    const { data: futureGames, error: futureError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, game_time, status, total_line, spread_line')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .or(`game_date.gte.${dateString},and(game_date.eq.${dateString},game_time.gte.${timeString})`)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })

    console.log(`\nStep 3: Future games (5+ min from now): ${futureGames?.length || 0}`)
    if (futureError) {
      console.error('Error fetching future games:', futureError)
    }

    // Step 4: Check for existing picks
    const gameIds = futureGames?.map(g => g.id) || []
    const { data: existingPicks, error: picksError } = await supabase
      .from('picks')
      .select('id, game_id, pick_type, capper, status')
      .in('game_id', gameIds)
      .eq('capper', 'shiva')
      .eq('pick_type', 'total')

    console.log(`\nStep 4: Existing SHIVA TOTAL picks: ${existingPicks?.length || 0}`)
    if (picksError) {
      console.error('Error fetching picks:', picksError)
    }

    const gamesWithPicks = new Set(existingPicks?.map(p => p.game_id) || [])
    const gamesWithoutPicks = futureGames?.filter(g => !gamesWithPicks.has(g.id)) || []

    console.log(`\nStep 5: Games WITHOUT picks: ${gamesWithoutPicks.length}`)

    // Step 6: Check cooldowns
    const { data: cooldowns, error: cooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .select('game_id, cooldown_until, result, units, created_at')
      .in('game_id', gamesWithoutPicks.map(g => g.id))
      .eq('capper', 'shiva')
      .eq('bet_type', 'total')
      .gt('cooldown_until', now.toISOString())

    console.log(`\nStep 6: Active cooldowns: ${cooldowns?.length || 0}`)
    if (cooldownError) {
      console.error('Error fetching cooldowns:', cooldownError)
    }

    const gamesInCooldown = new Set(cooldowns?.map(c => c.game_id) || [])
    const eligibleGames = gamesWithoutPicks.filter(g => !gamesInCooldown.has(g.id))

    console.log(`\nStep 7: ELIGIBLE games (final): ${eligibleGames.length}`)
    console.log('='.repeat(80))

    // Build detailed response
    return NextResponse.json({
      timestamp: now.toISOString(),
      summary: {
        total_nba_games: allGames?.length || 0,
        scheduled_games: scheduledGames?.length || 0,
        future_games: futureGames?.length || 0,
        games_without_picks: gamesWithoutPicks.length,
        active_cooldowns: cooldowns?.length || 0,
        eligible_games: eligibleGames.length
      },
      all_games: allGames?.map(g => ({
        id: g.id,
        matchup: `${g.away_team?.name || g.away_team} @ ${g.home_team?.name || g.home_team}`,
        game_date: g.game_date,
        game_time: g.game_time,
        status: g.status,
        total_line: g.total_line,
        spread_line: g.spread_line
      })),
      scheduled_games: scheduledGames?.map(g => ({
        id: g.id,
        matchup: `${g.away_team?.name || g.away_team} @ ${g.home_team?.name || g.home_team}`,
        game_date: g.game_date,
        game_time: g.game_time,
        total_line: g.total_line
      })),
      future_games: futureGames?.map(g => ({
        id: g.id,
        matchup: `${g.away_team?.name || g.away_team} @ ${g.home_team?.name || g.home_team}`,
        game_date: g.game_date,
        game_time: g.game_time,
        total_line: g.total_line
      })),
      existing_picks: existingPicks?.map(p => ({
        game_id: p.game_id,
        pick_type: p.pick_type,
        status: p.status
      })),
      cooldowns: cooldowns?.map(c => ({
        game_id: c.game_id,
        cooldown_until: c.cooldown_until,
        result: c.result,
        units: c.units
      })),
      eligible_games: eligibleGames.map(g => ({
        id: g.id,
        matchup: `${g.away_team?.name || g.away_team} @ ${g.home_team?.name || g.home_team}`,
        game_date: g.game_date,
        game_time: g.game_time,
        total_line: g.total_line,
        spread_line: g.spread_line
      })),
      next_eligible_game: eligibleGames.length > 0 ? {
        id: eligibleGames[0].id,
        matchup: `${eligibleGames[0].away_team?.name || eligibleGames[0].away_team} @ ${eligibleGames[0].home_team?.name || eligibleGames[0].home_team}`,
        game_date: eligibleGames[0].game_date,
        game_time: eligibleGames[0].game_time,
        total_line: eligibleGames[0].total_line
      } : null
    })

  } catch (error: any) {
    console.error('Error in scanner test:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

