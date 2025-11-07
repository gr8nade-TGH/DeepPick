import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * UNIFIED CAPPER PICK GENERATION ENDPOINT
 * 
 * This endpoint generates picks for ANY capper (SHIVA, IFRIT, CERBERUS, etc.)
 * by loading their custom factor configuration from the user_cappers table.
 * 
 * Lock Key Format: {capper_id}_{sport}_{bet_type}_lock
 * Examples: shiva_nba_total_lock, ifrit_nba_spread_lock
 * 
 * This ensures each capper/sport/bet_type combination can run independently.
 */
export async function GET(request: Request) {
  const executionTime = new Date().toISOString()
  const { searchParams } = new URL(request.url)

  const capperId = searchParams.get('capperId')
  const sport = searchParams.get('sport') || 'NBA'
  const betType = searchParams.get('betType') || 'TOTAL'

  console.log(`\n${'='.repeat(80)}`)
  console.log(`🎯 [UNIFIED-PICK-GEN] EXECUTION START: ${executionTime}`)
  console.log(`🎯 [UNIFIED-PICK-GEN] Capper: ${capperId}, Sport: ${sport}, Bet Type: ${betType}`)
  console.log(`${'='.repeat(80)}\n`)

  if (!capperId) {
    return NextResponse.json({
      success: false,
      error: 'capperId parameter is required'
    }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Step 1: Load capper configuration
    console.log(`🎯 [UNIFIED-PICK-GEN] Step 1: Loading capper config for '${capperId}'...`)

    const { data: capper, error: capperError } = await supabase
      .from('user_cappers')
      .select('*')
      .eq('capper_id', capperId)
      .eq('sport', sport)
      .single()

    if (capperError || !capper) {
      console.error(`🎯 [UNIFIED-PICK-GEN] ❌ Capper not found:`, capperError)
      return NextResponse.json({
        success: false,
        error: `Capper '${capperId}' not found for sport '${sport}'`
      }, { status: 404 })
    }

    if (!capper.is_active) {
      console.log(`🎯 [UNIFIED-PICK-GEN] ⚠️ Capper is inactive, skipping`)
      return NextResponse.json({
        success: false,
        message: 'Capper is inactive',
        timestamp: executionTime
      })
    }

    if (!capper.bet_types.includes(betType)) {
      console.error(`🎯 [UNIFIED-PICK-GEN] ❌ Bet type '${betType}' not enabled for this capper`)
      return NextResponse.json({
        success: false,
        error: `Bet type '${betType}' not enabled for capper '${capperId}'`
      }, { status: 400 })
    }

    console.log(`🎯 [UNIFIED-PICK-GEN] ✅ Capper loaded: ${capper.display_name}`)

    // Step 2: Acquire lock using new format: {capper_id}_{sport}_{bet_type}_lock
    const lockKey = `${capperId}_${sport.toLowerCase()}_${betType.toLowerCase()}_lock`
    const lockTimeout = 5 * 60 * 1000 // 5 minutes
    const now = new Date()
    const lockId = `cron_${capperId}_${sport.toLowerCase()}_${betType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    console.log(`🎯 [UNIFIED-PICK-GEN] Step 2: Acquiring lock: ${lockKey}`)
    console.log(`🎯 [UNIFIED-PICK-GEN] Lock ID: ${lockId}`)

    // Try to acquire lock using RPC function
    const { data: lockResult, error: lockError } = await supabase.rpc('acquire_shiva_lock', {
      p_lock_key: lockKey,
      p_locked_by: lockId,
      p_timeout_seconds: 300 // 5 minutes
    })

    if (lockError) {
      console.error(`🎯 [UNIFIED-PICK-GEN] ⚠️ Lock RPC failed, trying manual lock:`, lockError)

      // Fallback to manual lock check
      const { data: existingLock } = await supabase
        .from('system_locks')
        .select('locked_at, locked_by')
        .eq('lock_key', lockKey)
        .maybeSingle()

      if (existingLock) {
        const lockedAt = new Date(existingLock.locked_at)
        const lockAge = now.getTime() - lockedAt.getTime()

        if (lockAge < lockTimeout) {
          console.log(`🎯 [UNIFIED-PICK-GEN] ⚠️ SKIPPING - Lock held by ${existingLock.locked_by}`)
          return NextResponse.json({
            success: false,
            message: 'Another instance is already running',
            lockedBy: existingLock.locked_by,
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
          expires_at: new Date(now.getTime() + lockTimeout).toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        }, { onConflict: 'lock_key' })

      if (upsertError) {
        console.error(`🎯 [UNIFIED-PICK-GEN] ❌ Failed to acquire lock:`, upsertError)
        return NextResponse.json({
          success: false,
          error: 'Failed to acquire lock',
          timestamp: executionTime
        }, { status: 409 })
      }
    }

    console.log(`🎯 [UNIFIED-PICK-GEN] ✅ Lock acquired`)

    // Step 3: Call scanner endpoint (handles both TOTAL and SPREAD via betType parameter)
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    const endpoint = `${baseUrl}/api/shiva/step1-scanner`

    console.log(`🎯 [UNIFIED-PICK-GEN] Step 3: Calling scanner: ${endpoint} (betType: ${betType})`)

    const scannerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `DeepPick-Capper-${capperId}/1.0`,
        'X-Capper-ID': capperId,
        'X-Sport': sport,
        'X-Bet-Type': betType
      },
      body: JSON.stringify({
        sport: sport,
        betType: betType
      })
    })

    if (!scannerResponse.ok) {
      const errorText = await scannerResponse.text()
      throw new Error(`Scanner failed: ${scannerResponse.status} - ${errorText}`)
    }

    const scannerResult = await scannerResponse.json()

    console.log(`🎯 [UNIFIED-PICK-GEN] Scanner result:`, scannerResult.success ? '✅ Success' : '❌ Failed')

    // Step 4: If scanner found a game, generate the pick with custom factor weights
    if (scannerResult.success && scannerResult.selectedGame) {
      console.log(`🎯 [UNIFIED-PICK-GEN] Step 4: Generating pick for game ${scannerResult.selectedGame.game_id}`)

      const generateEndpoint = `${baseUrl}/api/shiva/generate-pick`

      const generateResponse = await fetch(generateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `DeepPick-Capper-${capperId}/1.0`,
          'X-Capper-ID': capperId
        },
        body: JSON.stringify({
          selectedGame: scannerResult.selectedGame,
          betType: betType, // Pass bet type to generate-pick endpoint
          capperId: capperId, // Pass capper ID so picks are saved with correct capper
          factorConfig: capper.factor_config[betType] // Use custom factor weights!
        })
      })

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text()
        throw new Error(`Pick generation failed: ${generateResponse.status} - ${errorText}`)
      }

      const pickResult = await generateResponse.json()

      console.log(`🎯 [UNIFIED-PICK-GEN] ✅ Pick generated successfully`)

      // Release lock
      await supabase.from('system_locks').delete().eq('lock_key', lockKey)
      console.log(`🎯 [UNIFIED-PICK-GEN] ✅ Lock released`)

      return NextResponse.json({
        success: true,
        capper: capperId,
        sport,
        betType,
        result: pickResult,
        timestamp: executionTime
      })
    } else {
      console.log(`🎯 [UNIFIED-PICK-GEN] ℹ️ No eligible games found`)

      // Release lock
      await supabase.from('system_locks').delete().eq('lock_key', lockKey)
      console.log(`🎯 [UNIFIED-PICK-GEN] ✅ Lock released`)

      return NextResponse.json({
        success: true,
        capper: capperId,
        sport,
        betType,
        message: 'No eligible games found',
        timestamp: executionTime
      })
    }

  } catch (error) {
    console.error(`🎯 [UNIFIED-PICK-GEN] ❌ Error:`, error)

    // Release lock on error
    try {
      const supabase = getSupabaseAdmin()
      const lockKey = `${capperId}_${sport.toLowerCase()}_${betType.toLowerCase()}_lock`
      await supabase.from('system_locks').delete().eq('lock_key', lockKey)
      console.log(`🎯 [UNIFIED-PICK-GEN] ✅ Lock released (error path)`)
    } catch (lockErr) {
      console.error(`🎯 [UNIFIED-PICK-GEN] Error releasing lock:`, lockErr)
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

