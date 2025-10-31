import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * SHIVA DIAGNOSTICS ENDPOINT
 * 
 * Comprehensive diagnostic tool to identify why the SHIVA management dashboard
 * tables (Run Log and Cooldowns) are not populating.
 * 
 * Checks:
 * 1. Environment variables
 * 2. Database connectivity
 * 3. Active NBA games
 * 4. Existing runs
 * 5. Cooldown records
 * 6. System locks
 * 7. Database functions (acquire_shiva_lock)
 */
export async function GET(request: Request) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    status: 'running',
    checks: {}
  }

  try {
    // ============================================================================
    // CHECK 1: Environment Variables
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking environment variables...')
    diagnostics.checks.environment = {
      status: 'checking',
      variables: {
        DISABLE_SHIVA_CRON: process.env.DISABLE_SHIVA_CRON || 'not set',
        SHIVA_V1_API_ENABLED: process.env.SHIVA_V1_API_ENABLED || 'not set',
        SHIVA_V1_WRITE_ENABLED: process.env.SHIVA_V1_WRITE_ENABLED || 'not set',
        NEXT_PUBLIC_SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED || 'not set',
        NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED || 'not set',
        MYSPORTSFEEDS_API_KEY: process.env.MYSPORTSFEEDS_API_KEY ? '✅ Set' : '❌ Missing',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
        NODE_ENV: process.env.NODE_ENV || 'not set',
        VERCEL: process.env.VERCEL || 'not set',
        VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      }
    }

    // Check for blocking conditions
    const cronDisabled = process.env.DISABLE_SHIVA_CRON === 'true'
    const apiDisabled = process.env.SHIVA_V1_API_ENABLED !== 'true' && process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED !== 'true'
    const writeDisabled = process.env.SHIVA_V1_WRITE_ENABLED !== 'true' && process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED !== 'true'

    diagnostics.checks.environment.status = 'complete'
    diagnostics.checks.environment.issues = []
    
    if (cronDisabled) {
      diagnostics.checks.environment.issues.push('🚨 CRON IS DISABLED - DISABLE_SHIVA_CRON=true')
    }
    if (apiDisabled) {
      diagnostics.checks.environment.issues.push('⚠️ API might be disabled - check SHIVA_V1_API_ENABLED')
    }
    if (writeDisabled) {
      diagnostics.checks.environment.issues.push('⚠️ WRITES might be disabled - check SHIVA_V1_WRITE_ENABLED')
    }

    // ============================================================================
    // CHECK 2: Database Connectivity
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking database connectivity...')
    diagnostics.checks.database = {
      status: 'checking'
    }

    const supabase = getSupabaseAdmin()
    
    // Test basic query
    const { data: testData, error: testError } = await supabase
      .from('games')
      .select('id')
      .limit(1)

    if (testError) {
      diagnostics.checks.database.status = 'error'
      diagnostics.checks.database.error = testError.message
      diagnostics.checks.database.issues = ['🚨 DATABASE CONNECTION FAILED']
    } else {
      diagnostics.checks.database.status = 'connected'
      diagnostics.checks.database.issues = []
    }

    // ============================================================================
    // CHECK 3: Active NBA Games
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking for active NBA games...')
    diagnostics.checks.games = {
      status: 'checking'
    }

    const now = new Date()
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, game_time, status, total_line, spread_line')
      .eq('sport', 'NBA')
      .in('status', ['scheduled', 'pre-game', 'in-progress'])
      .order('game_date', { ascending: true })
      .limit(20)

    if (gamesError) {
      diagnostics.checks.games.status = 'error'
      diagnostics.checks.games.error = gamesError.message
    } else {
      diagnostics.checks.games.status = 'complete'
      diagnostics.checks.games.total_count = games?.length || 0
      diagnostics.checks.games.games = games || []
      diagnostics.checks.games.issues = []

      if (!games || games.length === 0) {
        diagnostics.checks.games.issues.push('🚨 NO ACTIVE NBA GAMES FOUND - This is why no picks are being generated!')
      }
    }

    // ============================================================================
    // CHECK 4: Recent Runs
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking recent runs...')
    diagnostics.checks.runs = {
      status: 'checking'
    }

    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('run_id, game_id, capper, state, created_at, metadata')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
      .limit(10)

    if (runsError) {
      diagnostics.checks.runs.status = 'error'
      diagnostics.checks.runs.error = runsError.message
    } else {
      diagnostics.checks.runs.status = 'complete'
      diagnostics.checks.runs.total_count = runs?.length || 0
      diagnostics.checks.runs.recent_runs = runs || []
      diagnostics.checks.runs.issues = []

      if (!runs || runs.length === 0) {
        diagnostics.checks.runs.issues.push('⚠️ NO RUNS FOUND - Cron may not be executing or failing early')
      } else {
        const latestRun = runs[0]
        const runAge = Date.now() - new Date(latestRun.created_at).getTime()
        const runAgeMinutes = Math.floor(runAge / 60000)
        
        diagnostics.checks.runs.latest_run = {
          run_id: latestRun.run_id,
          created_at: latestRun.created_at,
          age_minutes: runAgeMinutes,
          state: latestRun.state
        }

        if (runAgeMinutes > 30) {
          diagnostics.checks.runs.issues.push(`⚠️ Latest run is ${runAgeMinutes} minutes old - cron may not be running`)
        }
      }
    }

    // ============================================================================
    // CHECK 5: Cooldowns
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking cooldowns...')
    diagnostics.checks.cooldowns = {
      status: 'checking'
    }

    const { data: cooldowns, error: cooldownsError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
      .limit(20)

    if (cooldownsError) {
      diagnostics.checks.cooldowns.status = 'error'
      diagnostics.checks.cooldowns.error = cooldownsError.message
    } else {
      const activeCooldowns = cooldowns?.filter(cd => new Date(cd.cooldown_until) > now) || []
      
      diagnostics.checks.cooldowns.status = 'complete'
      diagnostics.checks.cooldowns.total_count = cooldowns?.length || 0
      diagnostics.checks.cooldowns.active_count = activeCooldowns.length
      diagnostics.checks.cooldowns.expired_count = (cooldowns?.length || 0) - activeCooldowns.length
      diagnostics.checks.cooldowns.recent_cooldowns = cooldowns || []
      diagnostics.checks.cooldowns.issues = []

      if (!cooldowns || cooldowns.length === 0) {
        diagnostics.checks.cooldowns.issues.push('⚠️ NO COOLDOWNS FOUND - Pick generation may never have run')
      }

      if (activeCooldowns.length > 0 && games && games.length > 0) {
        const allGamesInCooldown = games.every(game => 
          activeCooldowns.some(cd => cd.game_id === game.id)
        )
        if (allGamesInCooldown) {
          diagnostics.checks.cooldowns.issues.push('⚠️ ALL GAMES ARE IN COOLDOWN - No picks can be generated until cooldowns expire')
        }
      }
    }

    // ============================================================================
    // CHECK 6: System Locks
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking system locks...')
    diagnostics.checks.locks = {
      status: 'checking'
    }

    const { data: locks, error: locksError } = await supabase
      .from('system_locks')
      .select('*')
      .eq('lock_key', 'shiva_auto_picks_lock')
      .maybeSingle()

    if (locksError && locksError.code !== 'PGRST116') {
      diagnostics.checks.locks.status = 'error'
      diagnostics.checks.locks.error = locksError.message
    } else {
      diagnostics.checks.locks.status = 'complete'
      diagnostics.checks.locks.active_lock = locks || null
      diagnostics.checks.locks.issues = []

      if (locks) {
        const lockAge = Date.now() - new Date(locks.locked_at).getTime()
        const lockAgeMinutes = Math.floor(lockAge / 60000)
        
        diagnostics.checks.locks.lock_age_minutes = lockAgeMinutes
        
        if (lockAgeMinutes > 10) {
          diagnostics.checks.locks.issues.push(`🚨 STALE LOCK DETECTED - Lock is ${lockAgeMinutes} minutes old, may be blocking cron execution`)
        }
      }
    }

    // ============================================================================
    // CHECK 7: Database Functions
    // ============================================================================
    console.log('[DIAGNOSTICS] Checking database functions...')
    diagnostics.checks.functions = {
      status: 'checking'
    }

    // Test acquire_shiva_lock function
    const { data: lockTestData, error: lockTestError } = await supabase.rpc('acquire_shiva_lock', {
      p_lock_key: 'diagnostic_test_lock',
      p_locked_by: 'diagnostic_test',
      p_timeout_seconds: 60
    })

    if (lockTestError) {
      diagnostics.checks.functions.status = 'error'
      diagnostics.checks.functions.acquire_shiva_lock = {
        exists: false,
        error: lockTestError.message
      }
      diagnostics.checks.functions.issues = ['🚨 acquire_shiva_lock FUNCTION MISSING - Cron will fail to acquire lock']
    } else {
      diagnostics.checks.functions.status = 'complete'
      diagnostics.checks.functions.acquire_shiva_lock = {
        exists: true,
        test_result: lockTestData
      }
      diagnostics.checks.functions.issues = []

      // Clean up test lock
      await supabase
        .from('system_locks')
        .delete()
        .eq('lock_key', 'diagnostic_test_lock')
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    diagnostics.status = 'complete'
    diagnostics.summary = {
      critical_issues: [],
      warnings: [],
      info: []
    }

    // Collect all issues
    Object.entries(diagnostics.checks).forEach(([checkName, checkData]: [string, any]) => {
      if (checkData.issues && checkData.issues.length > 0) {
        checkData.issues.forEach((issue: string) => {
          if (issue.startsWith('🚨')) {
            diagnostics.summary.critical_issues.push(`[${checkName}] ${issue}`)
          } else if (issue.startsWith('⚠️')) {
            diagnostics.summary.warnings.push(`[${checkName}] ${issue}`)
          } else {
            diagnostics.summary.info.push(`[${checkName}] ${issue}`)
          }
        })
      }
    })

    // Overall health status
    if (diagnostics.summary.critical_issues.length > 0) {
      diagnostics.health = 'critical'
      diagnostics.health_message = 'Critical issues detected that prevent SHIVA from running'
    } else if (diagnostics.summary.warnings.length > 0) {
      diagnostics.health = 'warning'
      diagnostics.health_message = 'SHIVA may be running but with potential issues'
    } else {
      diagnostics.health = 'healthy'
      diagnostics.health_message = 'All systems operational'
    }

    console.log('[DIAGNOSTICS] Complete:', diagnostics.health)
    
    return NextResponse.json(diagnostics, { status: 200 })

  } catch (error) {
    console.error('[DIAGNOSTICS] Fatal error:', error)
    
    diagnostics.status = 'error'
    diagnostics.error = error instanceof Error ? error.message : 'Unknown error'
    diagnostics.health = 'critical'
    
    return NextResponse.json(diagnostics, { status: 500 })
  }
}

