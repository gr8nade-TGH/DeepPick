import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * MULTI-CAPPER AUTO-PICKS CRON
 *
 * Scalable cron endpoint that processes ALL active cappers from user_cappers table
 * Runs every 3-5 minutes and calls unified orchestrator for each capper's bet types
 *
 * Architecture:
 * - Queries user_cappers for all active cappers
 * - For each capper, processes each enabled bet type (TOTAL, SPREAD)
 * - Calls unified orchestrator: /api/cappers/generate-pick?capperId={id}&betType={type}
 * - Unified orchestrator handles locks, cooldowns, factor weights, etc.
 *
 * Scalability:
 * - Supports 100-1000+ cappers without code changes
 * - Each capper has its own lock: {capper_id}_{sport}_{bet_type}_lock
 * - No conflicts between cappers (isolated picks and cooldowns)
 *
 * Future Enhancements:
 * - Priority-based scheduling (execution_priority)
 * - Interval-based scheduling (execution_interval_minutes)
 * - Round-robin to ensure fair distribution
 */
export async function GET(request: Request) {
  const executionTime = new Date().toISOString()

  // LOG REQUEST DETAILS
  const headers = Object.fromEntries(request.headers.entries())
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🤖 [MULTI-CAPPER-CRON] EXECUTION START: ${executionTime}`)
  console.log(`🔍 [MULTI-CAPPER-CRON] REQUEST HEADERS:`, JSON.stringify({
    'user-agent': headers['user-agent'],
    'x-vercel-id': headers['x-vercel-id'],
    'x-vercel-deployment-url': headers['x-vercel-deployment-url'],
  }, null, 2))
  console.log(`${'='.repeat(80)}\n`)

  // KILL SWITCH: Check if cron is disabled
  if (process.env.DISABLE_MULTI_CAPPER_CRON === 'true') {
    console.log('🤖 [MULTI-CAPPER-CRON] ⛔ KILL SWITCH ACTIVE - Cron is disabled')
    return NextResponse.json({
      success: false,
      message: 'Cron is disabled via environment variable',
      timestamp: executionTime,
    })
  }

  try {
    const supabase = getSupabaseAdmin()
    const startTime = Date.now()

    // Step 1: Query all active cappers
    console.log('🎯 [MULTI-CAPPER-CRON] Querying active cappers...')
    const { data: cappers, error: cappersError } = await supabase
      .from('user_cappers')
      .select('capper_id, display_name, sport, bet_types, execution_priority, execution_interval_minutes')
      .eq('is_active', true)
      .order('execution_priority', { ascending: false }) // Higher priority first

    if (cappersError) {
      console.error('❌ [MULTI-CAPPER-CRON] Error querying cappers:', cappersError)
      return NextResponse.json({
        success: false,
        error: 'Failed to query cappers',
        details: cappersError.message,
        timestamp: executionTime
      }, { status: 500 })
    }

    if (!cappers || cappers.length === 0) {
      console.log('⚠️ [MULTI-CAPPER-CRON] No active cappers found')
      return NextResponse.json({
        success: false,
        message: 'No active cappers found',
        timestamp: executionTime
      })
    }

    console.log(`✅ [MULTI-CAPPER-CRON] Found ${cappers.length} active cappers:`, 
      cappers.map(c => `${c.capper_id} (priority: ${c.execution_priority})`).join(', '))

    // Step 2: Determine base URL for API calls
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    console.log(`🌐 [MULTI-CAPPER-CRON] Using base URL: ${baseUrl}`)

    // Step 3: Process each capper
    const results = []
    let totalPicksGenerated = 0
    let totalAttempts = 0

    for (const capper of cappers) {
      const { capper_id, display_name, sport, bet_types } = capper

      console.log(`\n${'─'.repeat(60)}`)
      console.log(`🎲 [MULTI-CAPPER-CRON] Processing: ${display_name} (${capper_id})`)
      console.log(`   Sport: ${sport}, Bet Types: ${bet_types.join(', ')}`)

      // Process each bet type for this capper
      for (const betType of bet_types) {
        totalAttempts++
        console.log(`   🎯 Attempting ${betType} pick...`)

        try {
          const orchestratorUrl = `${baseUrl}/api/cappers/generate-pick?capperId=${capper_id}&betType=${betType}`
          console.log(`   📡 Calling: ${orchestratorUrl}`)

          const response = await fetch(orchestratorUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'DeepPick-Multi-Capper-Cron/1.0',
              'X-Cron-Execution': executionTime
            }
          })

          const result = await response.json()
          console.log(`   📊 Result:`, result)

          results.push({
            capper: capper_id,
            betType,
            success: result.success,
            message: result.message,
            pickGenerated: result.success && result.message?.includes('generated')
          })

          if (result.success && result.message?.includes('generated')) {
            totalPicksGenerated++
            console.log(`   ✅ Pick generated!`)
          } else {
            console.log(`   ⚠️ ${result.message || 'No pick generated'}`)
          }

        } catch (error) {
          console.error(`   ❌ Error processing ${capper_id} ${betType}:`, error)
          results.push({
            capper: capper_id,
            betType,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ [MULTI-CAPPER-CRON] EXECUTION COMPLETE`)
    console.log(`   Cappers Processed: ${cappers.length}`)
    console.log(`   Total Attempts: ${totalAttempts}`)
    console.log(`   Picks Generated: ${totalPicksGenerated}`)
    console.log(`   Duration: ${duration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      message: `Processed ${cappers.length} cappers`,
      cappersProcessed: cappers.length,
      totalAttempts,
      picksGenerated: totalPicksGenerated,
      results,
      duration: `${duration}ms`,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [MULTI-CAPPER-CRON] Error:', error)
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

