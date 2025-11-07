import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * IFRIT AUTO-PICKS CRON - SPREAD
 *
 * Runs every 9 minutes to automatically generate IFRIT SPREAD picks
 * Uses the same logic as SHIVA but with custom factor weights
 * Separate from TOTAL picks cron to avoid conflicts
 *
 * Cooldown Logic:
 * - Step 1 Scanner checks if game is eligible (no existing picks, not in cooldown)
 * - If PASS (units=0): Records 2-hour temporary cooldown (game can be reconsidered later)
 * - If PICK_GENERATED (units>0): Records PERMANENT cooldown (game can NEVER be picked again for this bet type)
 * - Next run skips games with existing picks or in cooldown
 *
 * Permanent Cooldown Rationale:
 * - Once a pick is generated for a game/bet_type, we should never generate another pick
 * - This prevents duplicate picks and ensures one pick per game per bet type
 * - Cooldown is set to year 2099 to make it effectively permanent
 *
 * One-Game-Per-Run Policy:
 * - Each 9-minute cycle attempts ONLY ONE game
 * - No retry logic - if the game results in PASS, wait for next cycle
 * - This ensures controlled, predictable pick generation
 */
export async function GET(request: Request) {
  const executionTime = new Date().toISOString()

  // LOG REQUEST DETAILS TO IDENTIFY CALLER
  const headers = Object.fromEntries(request.headers.entries())
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🔥 [IFRIT-AUTO-PICKS-SPREAD] EXECUTION START: ${executionTime}`)
  console.log(`🔍 [IFRIT-AUTO-PICKS-SPREAD] REQUEST HEADERS:`, JSON.stringify({
    'user-agent': headers['user-agent'],
    'x-vercel-id': headers['x-vercel-id'],
    'x-vercel-deployment-url': headers['x-vercel-deployment-url'],
    'x-forwarded-for': headers['x-forwarded-for'],
    'referer': headers['referer'],
    'origin': headers['origin']
  }, null, 2))
  console.log(`${'='.repeat(80)}\n`)

  // KILL SWITCH: Check if cron is disabled via environment variable
  if (process.env.DISABLE_IFRIT_CRON === 'true') {
    console.log('🔥 [IFRIT-AUTO-PICKS-SPREAD] ⛔ KILL SWITCH ACTIVE - Cron is disabled via DISABLE_IFRIT_CRON env var')
    return NextResponse.json({
      success: false,
      message: 'Cron is disabled via environment variable',
      timestamp: executionTime,
      caller_info: {
        'user-agent': headers['user-agent'],
        'x-vercel-id': headers['x-vercel-id']
      }
    })
  }

  try {
    // CRITICAL: Check for concurrent execution using database lock
    // This prevents multiple cron jobs or manual triggers from running simultaneously
    const { getSupabaseAdmin } = await import('@/lib/supabase/server')
    const supabase = getSupabaseAdmin()

    // New lock key format: {capper_id}_{sport}_{bet_type}_lock
    const lockKey = 'ifrit_nba_spread_lock'
    const lockTimeout = 5 * 60 * 1000 // 5 minutes
    const now = new Date()
    const lockId = `cron_ifrit_nba_spread_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    console.log(`🔥 [IFRIT-AUTO-PICKS-SPREAD] Attempting to acquire lock: ${lockId}`)

    // ATOMIC LOCK ACQUISITION: Use PostgreSQL's INSERT ... ON CONFLICT to ensure only one instance can acquire the lock
    // This prevents race conditions where multiple instances check the lock at the same time
    const { data: lockResult, error: lockError } = await supabase.rpc('acquire_shiva_lock', {
      p_lock_key: lockKey,
      p_locked_by: lockId,
      p_timeout_seconds: 300 // 5 minutes
    })

    if (lockError) {
      console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] ❌ CRITICAL ERROR: Lock acquisition failed:', lockError)
      console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] ❌ This likely means the acquire_shiva_lock function does not exist!')
      console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] ❌ Falling back to manual lock check...')

      // Fallback to manual lock check
      const { data: existingLock, error: lockCheckError } = await supabase
        .from('system_locks')
        .select('locked_at, locked_by')
        .eq('lock_key', lockKey)
        .maybeSingle()

      if (lockCheckError && lockCheckError.code !== 'PGRST116') {
        console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] ❌ CRITICAL ERROR: Lock check failed:', lockCheckError)
        return NextResponse.json({
          success: false,
          error: 'Lock check failed',
          details: lockCheckError.message,
          timestamp: executionTime
        }, { status: 500 })
      }

      if (existingLock) {
        const lockedAt = new Date(existingLock.locked_at)
        const lockAge = now.getTime() - lockedAt.getTime()

        if (lockAge < lockTimeout) {
          console.log(`🔥 [IFRIT-AUTO-PICKS-SPREAD] ⚠️ SKIPPING - Another instance is running (locked ${Math.round(lockAge / 1000)}s ago by ${existingLock.locked_by})`)
          return NextResponse.json({
            success: false,
            message: 'Another instance is already running',
            lockedBy: existingLock.locked_by,
            lockedAt: existingLock.locked_at,
            lockAge: `${Math.round(lockAge / 1000)}s`,
            timestamp: executionTime
          })
        }
      }

      // Try to acquire lock manually
      const { error: upsertError } = await supabase
        .from('system_locks')
        .upsert({
          lock_key: lockKey,
          locked_at: now.toISOString(),
          locked_by: lockId,
          expires_at: new Date(now.getTime() + lockTimeout).toISOString()
        }, { onConflict: 'lock_key' })

      if (upsertError) {
        console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] ❌ CRITICAL ERROR: Failed to acquire lock:', upsertError)
        return NextResponse.json({
          success: false,
          error: 'Failed to acquire lock',
          details: upsertError.message,
          timestamp: executionTime
        }, { status: 500 })
      }
    } else if (!lockResult) {
      // Lock was not acquired (another instance is running)
      console.log(`🔥 [IFRIT-AUTO-PICKS-SPREAD] ⚠️ SKIPPING - Lock already held by another instance`)
      return NextResponse.json({
        success: false,
        message: 'Another instance is already running (atomic lock check)',
        timestamp: executionTime
      })
    }

    console.log(`🔥 [IFRIT-AUTO-PICKS-SPREAD] ✅ Lock acquired: ${lockId}`)

    console.log('🔥 [IFRIT-AUTO-PICKS-SPREAD] Starting automated IFRIT SPREAD pick generation...')
    const startTime = Date.now()

    // Step 1: Find eligible games (excludes games in cooldown or already picked)
    console.log('🎯 [IFRIT-AUTO-PICKS-SPREAD] Finding eligible SPREAD games...')

    // Determine the base URL for API calls
    // CRITICAL: Use production URL to avoid Vercel deployment protection on preview URLs
    // VERCEL_PROJECT_PRODUCTION_URL is the production domain (e.g., deep-pick.vercel.app)
    // VERCEL_URL could be a preview URL which has authentication enabled
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    console.log(`🌐 [IFRIT-AUTO-PICKS-SPREAD] Using base URL: ${baseUrl}`)
    console.log(`🌐 [IFRIT-AUTO-PICKS-SPREAD] VERCEL_PROJECT_PRODUCTION_URL: ${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    console.log(`🌐 [IFRIT-AUTO-PICKS-SPREAD] VERCEL_URL: ${process.env.VERCEL_URL}`)

    const scannerUrl = `${baseUrl}/api/shiva/step1-scanner`
    console.log(`🌐 [IFRIT-AUTO-PICKS-SPREAD] Calling scanner at: ${scannerUrl}`)

    const scannerResponse = await fetch(scannerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedGame: null,
        betType: 'SPREAD', // CRITICAL: Specify SPREAD bet type
        capper: 'ifrit' // CRITICAL: Specify IFRIT capper
      })
    })

    console.log(`📡 [IFRIT-AUTO-PICKS-SPREAD] Scanner response status: ${scannerResponse.status}`)
    console.log(`📡 [IFRIT-AUTO-PICKS-SPREAD] Scanner response headers:`, Object.fromEntries(scannerResponse.headers.entries()))

    const responseText = await scannerResponse.text()
    console.log(`📡 [IFRIT-AUTO-PICKS-SPREAD] Scanner response body (first 500 chars):`, responseText.substring(0, 500))

    let scannerResult
    try {
      scannerResult = JSON.parse(responseText)
    } catch (parseError) {
      console.error('❌ [IFRIT-AUTO-PICKS-SPREAD] Failed to parse scanner response as JSON:', parseError)
      console.error('❌ [IFRIT-AUTO-PICKS-SPREAD] Response was:', responseText.substring(0, 1000))
      throw new Error(`Scanner returned non-JSON response: ${responseText.substring(0, 200)}`)
    }

    console.log('📊 [IFRIT-AUTO-PICKS-SPREAD] Scanner result:', scannerResult)

    if (!scannerResult.success || !scannerResult.selected_game) {
      console.log('⚠️ [IFRIT-AUTO-PICKS-SPREAD] No eligible SPREAD games found')
      const duration = Date.now() - startTime
      console.log(`\n${'='.repeat(80)}`)
      console.log(`⚠️ [IFRIT-AUTO-PICKS-SPREAD] EXECUTION COMPLETE: No eligible games`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: false,
        message: 'No eligible SPREAD games found',
        picksGenerated: 0,
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    }

    const selectedGame = scannerResult.selected_game
    const gameId = selectedGame.id
    console.log(`🎮 [IFRIT-AUTO-PICKS-SPREAD] Selected game: ${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`)

    // Step 2: Run full pick generation pipeline
    console.log('⚡ [IFRIT-AUTO-PICKS-SPREAD] Running SPREAD pick generation...')
    const pickResponse = await fetch(`${baseUrl}/api/shiva/generate-pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedGame,
        betType: 'SPREAD', // CRITICAL: Specify SPREAD bet type
        capperId: 'ifrit' // CRITICAL: Specify IFRIT capper
      })
    })

    const pickResult = await pickResponse.json()
    console.log('📈 [IFRIT-AUTO-PICKS-SPREAD] Pick generation result:', pickResult)

    const duration = Date.now() - startTime

    // Release lock before returning
    const releaseLock = async () => {
      try {
        const { error } = await supabase
          .from('system_locks')
          .delete()
          .eq('lock_key', lockKey)

        if (error) {
          console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] Error releasing lock:', error)
        } else {
          console.log('🔥 [IFRIT-AUTO-PICKS-SPREAD] ✅ Lock released')
        }
      } catch (err) {
        console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] Error in releaseLock:', err)
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    if (pickResult.decision === 'PICK' && pickResult.pick) {
      console.log(`✅ [IFRIT-AUTO-PICKS-SPREAD] EXECUTION COMPLETE: SPREAD pick generated`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      await releaseLock()

      return NextResponse.json({
        success: true,
        message: 'IFRIT SPREAD pick generated successfully',
        picksGenerated: 1,
        game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
        gameId,
        pickDetails: pickResult,
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    } else if (pickResult.decision === 'PASS') {
      console.log(`⚠️ [IFRIT-AUTO-PICKS-SPREAD] EXECUTION COMPLETE: Game resulted in PASS (cooldown recorded)`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      await releaseLock()

      return NextResponse.json({
        success: false,
        message: 'Game resulted in PASS - cooldown recorded',
        picksGenerated: 0,
        game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
        gameId,
        decision: 'PASS',
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    } else {
      console.log(`❌ [IFRIT-AUTO-PICKS-SPREAD] EXECUTION COMPLETE: Unexpected result`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      await releaseLock()

      return NextResponse.json({
        success: false,
        message: 'Unexpected pick generation result',
        picksGenerated: 0,
        game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
        gameId,
        pickResult,
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    }

  } catch (error) {
    console.error('❌ [IFRIT-AUTO-PICKS-SPREAD] Error:', error)

    // Release lock on error
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/server')
      const supabase = getSupabaseAdmin()
      await supabase
        .from('system_locks')
        .delete()
        .eq('lock_key', 'ifrit_nba_spread_lock')
      console.log('🔥 [IFRIT-AUTO-PICKS-SPREAD] ✅ Lock released (error path)')
    } catch (lockErr) {
      console.error('🔥 [IFRIT-AUTO-PICKS-SPREAD] Error releasing lock on error:', lockErr)
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST(request: Request) {
  return GET(request)
}

