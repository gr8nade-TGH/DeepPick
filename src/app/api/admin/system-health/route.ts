import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/system-health
 * 
 * Comprehensive system health dashboard data
 * Returns orchestrator status, capper execution stats, recent executions, and system alerts
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const now = new Date()

    // ============================================================================
    // 1. ORCHESTRATOR STATUS
    // ============================================================================
    const { data: orchestratorLock } = await supabase
      .from('system_locks')
      .select('*')
      .eq('lock_key', 'pick_orchestrator_lock')
      .single()

    const orchestratorStatus = {
      isRunning: orchestratorLock ? new Date(orchestratorLock.expires_at) > now : false,
      lastRun: orchestratorLock?.locked_at || null,
      lockedBy: orchestratorLock?.locked_by || null,
      expiresAt: orchestratorLock?.expires_at || null
    }

    // ============================================================================
    // 2. CAPPER EXECUTION SCHEDULES
    // ============================================================================
    const { data: schedules, error: schedulesError } = await supabase
      .from('capper_execution_schedules')
      .select('*')
      .order('priority', { ascending: false })

    if (schedulesError) {
      console.error('[SystemHealth] Error fetching schedules:', schedulesError)
    }

    const capperStats = schedules?.map(schedule => {
      const nextDue = schedule.next_execution_at 
        ? new Date(schedule.next_execution_at) 
        : null
      const isDue = nextDue ? nextDue <= now : true
      const minutesUntilNext = nextDue 
        ? Math.round((nextDue.getTime() - now.getTime()) / 60000)
        : null

      return {
        capper_id: schedule.capper_id,
        sport: schedule.sport,
        bet_type: schedule.bet_type,
        enabled: schedule.enabled,
        interval_minutes: schedule.interval_minutes,
        priority: schedule.priority,
        last_execution_at: schedule.last_execution_at,
        next_execution_at: schedule.next_execution_at,
        last_status: schedule.last_execution_status,
        last_error: schedule.last_execution_error,
        total_executions: schedule.total_executions,
        successful_executions: schedule.successful_executions,
        failed_executions: schedule.failed_executions,
        success_rate: schedule.total_executions > 0 
          ? Math.round((schedule.successful_executions / schedule.total_executions) * 100)
          : 0,
        is_due: isDue,
        minutes_until_next: minutesUntilNext
      }
    }) || []

    // ============================================================================
    // 3. RECENT EXECUTIONS (from runs table)
    // ============================================================================
    const { data: recentRuns, error: runsError } = await supabase
      .from('runs')
      .select(`
        run_id,
        created_at,
        capper,
        bet_type,
        pick_type,
        selection,
        confidence,
        state,
        game_id,
        games!inner(away_team, home_team)
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (runsError) {
      console.error('[SystemHealth] Error fetching recent runs:', runsError)
    }

    const recentExecutions = recentRuns?.map(run => {
      const game = run.games as any
      return {
        run_id: run.run_id,
        created_at: run.created_at,
        capper: run.capper,
        bet_type: run.bet_type,
        matchup: game ? `${game.away_team} @ ${game.home_team}` : 'Unknown',
        selection: run.selection,
        confidence: run.confidence,
        state: run.state
      }
    }) || []

    // ============================================================================
    // 4. SYSTEM LOCKS (check for stale locks)
    // ============================================================================
    const { data: allLocks } = await supabase
      .from('system_locks')
      .select('*')
      .order('created_at', { ascending: false })

    const locks = allLocks?.map(lock => {
      const expiresAt = new Date(lock.expires_at)
      const isExpired = expiresAt < now
      const isActive = expiresAt > now

      return {
        lock_key: lock.lock_key,
        locked_by: lock.locked_by,
        locked_at: lock.locked_at,
        expires_at: lock.expires_at,
        is_active: isActive,
        is_expired: isExpired,
        age_minutes: Math.round((now.getTime() - new Date(lock.locked_at).getTime()) / 60000)
      }
    }) || []

    // ============================================================================
    // 5. SYSTEM ALERTS (check for issues)
    // ============================================================================
    const alerts: any[] = []

    // Check for failed executions
    schedules?.forEach(schedule => {
      if (schedule.last_execution_status === 'failed') {
        alerts.push({
          type: 'execution_failure',
          severity: 'error',
          message: `${schedule.capper_id} ${schedule.bet_type} last execution failed: ${schedule.last_execution_error}`,
          capper: schedule.capper_id,
          created_at: schedule.updated_at
        })
      }

      // Check for low success rate
      if (schedule.total_executions >= 5) {
        const successRate = (schedule.successful_executions / schedule.total_executions) * 100
        if (successRate < 50) {
          alerts.push({
            type: 'low_success_rate',
            severity: 'warning',
            message: `${schedule.capper_id} ${schedule.bet_type} has low success rate: ${successRate.toFixed(1)}%`,
            capper: schedule.capper_id,
            created_at: schedule.updated_at
          })
        }
      }
    })

    // Check for stale locks
    locks.forEach(lock => {
      if (lock.is_expired && lock.age_minutes > 10) {
        alerts.push({
          type: 'stale_lock',
          severity: 'warning',
          message: `Stale lock detected: ${lock.lock_key} (${lock.age_minutes} minutes old)`,
          created_at: lock.locked_at
        })
      }
    })

    // ============================================================================
    // 6. SUMMARY STATS
    // ============================================================================
    const summary = {
      total_cappers: schedules?.length || 0,
      enabled_cappers: schedules?.filter(s => s.enabled).length || 0,
      total_executions: schedules?.reduce((sum, s) => sum + s.total_executions, 0) || 0,
      successful_executions: schedules?.reduce((sum, s) => sum + s.successful_executions, 0) || 0,
      failed_executions: schedules?.reduce((sum, s) => sum + s.failed_executions, 0) || 0,
      overall_success_rate: 0,
      active_locks: locks.filter(l => l.is_active).length,
      stale_locks: locks.filter(l => l.is_expired && l.age_minutes > 10).length,
      active_alerts: alerts.length
    }

    if (summary.total_executions > 0) {
      summary.overall_success_rate = Math.round(
        (summary.successful_executions / summary.total_executions) * 100
      )
    }

    // ============================================================================
    // RESPONSE
    // ============================================================================
    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      orchestrator: orchestratorStatus,
      cappers: capperStats,
      recent_executions: recentExecutions,
      locks,
      alerts,
      summary
    })

  } catch (error) {
    console.error('[SystemHealth] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

