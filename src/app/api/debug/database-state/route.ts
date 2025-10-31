import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * DATABASE STATE CHECKER
 * 
 * Quick snapshot of database state for debugging the SHIVA management dashboard.
 * Returns counts and recent records from key tables.
 */
export async function GET(request: Request) {
  const state: any = {
    timestamp: new Date().toISOString(),
    tables: {}
  }

  try {
    const supabase = getSupabaseAdmin()

    // ============================================================================
    // GAMES TABLE
    // ============================================================================
    const { data: allGames, error: allGamesError } = await supabase
      .from('games')
      .select('id, sport, status')
      .eq('sport', 'NBA')

    const { data: activeGames, error: activeGamesError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NBA')
      .in('status', ['scheduled', 'pre-game', 'in-progress'])
      .order('game_date', { ascending: true })

    state.tables.games = {
      total_nba_games: allGames?.length || 0,
      active_games: activeGames?.length || 0,
      status_breakdown: allGames?.reduce((acc: any, game: any) => {
        acc[game.status] = (acc[game.status] || 0) + 1
        return acc
      }, {}),
      recent_active: activeGames?.slice(0, 5).map((g: any) => ({
        id: g.id,
        matchup: `${g.away_team?.abbreviation || g.away_team} @ ${g.home_team?.abbreviation || g.home_team}`,
        date: g.game_date,
        time: g.game_time,
        status: g.status,
        total_line: g.total_line,
        spread_line: g.spread_line
      })) || []
    }

    // ============================================================================
    // RUNS TABLE
    // ============================================================================
    const { data: allRuns, error: allRunsError } = await supabase
      .from('runs')
      .select('run_id, capper, state, created_at')
      .eq('capper', 'shiva')

    const { data: recentRuns, error: recentRunsError } = await supabase
      .from('runs')
      .select('*')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
      .limit(10)

    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const runsLast24h = allRuns?.filter((r: any) => new Date(r.created_at) > last24Hours) || []

    state.tables.runs = {
      total_runs: allRuns?.length || 0,
      runs_last_24h: runsLast24h.length,
      state_breakdown: allRuns?.reduce((acc: any, run: any) => {
        acc[run.state] = (acc[run.state] || 0) + 1
        return acc
      }, {}),
      latest_run: recentRuns?.[0] ? {
        run_id: recentRuns[0].run_id,
        created_at: recentRuns[0].created_at,
        age_minutes: Math.floor((now.getTime() - new Date(recentRuns[0].created_at).getTime()) / 60000),
        state: recentRuns[0].state,
        game_id: recentRuns[0].game_id
      } : null,
      recent_runs: recentRuns?.map((r: any) => ({
        run_id: r.run_id,
        created_at: r.created_at,
        state: r.state,
        game_id: r.game_id
      })) || []
    }

    // ============================================================================
    // PICKS TABLE
    // ============================================================================
    const { data: allPicks, error: allPicksError } = await supabase
      .from('picks')
      .select('id, capper, created_at')
      .eq('capper', 'shiva')

    const { data: recentPicks, error: recentPicksError } = await supabase
      .from('picks')
      .select('*')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
      .limit(10)

    const picksLast24h = allPicks?.filter((p: any) => new Date(p.created_at) > last24Hours) || []

    state.tables.picks = {
      total_picks: allPicks?.length || 0,
      picks_last_24h: picksLast24h.length,
      latest_pick: recentPicks?.[0] ? {
        id: recentPicks[0].id,
        created_at: recentPicks[0].created_at,
        age_minutes: Math.floor((now.getTime() - new Date(recentPicks[0].created_at).getTime()) / 60000),
        pick_type: recentPicks[0].pick_type,
        selection: recentPicks[0].selection,
        units: recentPicks[0].units,
        confidence: recentPicks[0].confidence
      } : null,
      recent_picks: recentPicks?.map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        pick_type: p.pick_type,
        selection: p.selection,
        units: p.units,
        confidence: p.confidence
      })) || []
    }

    // ============================================================================
    // COOLDOWNS TABLE
    // ============================================================================
    const { data: allCooldowns, error: allCooldownsError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('capper', 'shiva')

    const { data: recentCooldowns, error: recentCooldownsError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
      .limit(20)

    const activeCooldowns = allCooldowns?.filter((cd: any) => new Date(cd.cooldown_until) > now) || []
    const expiredCooldowns = allCooldowns?.filter((cd: any) => new Date(cd.cooldown_until) <= now) || []

    state.tables.cooldowns = {
      total_cooldowns: allCooldowns?.length || 0,
      active_cooldowns: activeCooldowns.length,
      expired_cooldowns: expiredCooldowns.length,
      result_breakdown: allCooldowns?.reduce((acc: any, cd: any) => {
        acc[cd.result] = (acc[cd.result] || 0) + 1
        return acc
      }, {}),
      recent_cooldowns: recentCooldowns?.map((cd: any) => ({
        id: cd.id,
        game_id: cd.game_id,
        bet_type: cd.bet_type,
        result: cd.result,
        units: cd.units,
        confidence_score: cd.confidence_score,
        created_at: cd.created_at,
        cooldown_until: cd.cooldown_until,
        is_active: new Date(cd.cooldown_until) > now,
        time_remaining_minutes: Math.max(0, Math.floor((new Date(cd.cooldown_until).getTime() - now.getTime()) / 60000))
      })) || []
    }

    // ============================================================================
    // SYSTEM LOCKS TABLE
    // ============================================================================
    const { data: locks, error: locksError } = await supabase
      .from('system_locks')
      .select('*')

    state.tables.system_locks = {
      total_locks: locks?.length || 0,
      locks: locks?.map((lock: any) => ({
        lock_key: lock.lock_key,
        locked_by: lock.locked_by,
        locked_at: lock.locked_at,
        age_minutes: Math.floor((now.getTime() - new Date(lock.locked_at).getTime()) / 60000)
      })) || []
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    state.summary = {
      has_active_games: (activeGames?.length || 0) > 0,
      has_recent_runs: (runsLast24h.length) > 0,
      has_recent_picks: (picksLast24h.length) > 0,
      has_active_cooldowns: activeCooldowns.length > 0,
      has_stale_locks: locks?.some((lock: any) => {
        const lockAge = now.getTime() - new Date(lock.locked_at).getTime()
        return lockAge > 10 * 60 * 1000 // 10 minutes
      }) || false
    }

    // Diagnosis
    state.diagnosis = []
    
    if (!state.summary.has_active_games) {
      state.diagnosis.push('🚨 NO ACTIVE NBA GAMES - This is the primary reason no picks are being generated')
    }
    
    if (!state.summary.has_recent_runs) {
      state.diagnosis.push('⚠️ NO RUNS IN LAST 24H - Cron job may not be executing')
    }
    
    if (state.summary.has_active_games && state.summary.has_active_cooldowns) {
      const gamesInCooldown = activeGames?.filter((game: any) => 
        activeCooldowns.some((cd: any) => cd.game_id === game.id)
      ).length || 0
      
      if (gamesInCooldown === activeGames?.length) {
        state.diagnosis.push('⚠️ ALL ACTIVE GAMES ARE IN COOLDOWN - Wait for cooldowns to expire')
      } else if (gamesInCooldown > 0) {
        state.diagnosis.push(`ℹ️ ${gamesInCooldown}/${activeGames?.length} games are in cooldown`)
      }
    }
    
    if (state.summary.has_stale_locks) {
      state.diagnosis.push('🚨 STALE LOCK DETECTED - May be blocking cron execution')
    }

    if (state.diagnosis.length === 0) {
      state.diagnosis.push('✅ System appears healthy - check Vercel cron logs if picks still not generating')
    }

    return NextResponse.json(state, { status: 200 })

  } catch (error) {
    console.error('[DATABASE-STATE] Error:', error)
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

