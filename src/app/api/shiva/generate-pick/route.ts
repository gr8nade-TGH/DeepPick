import { NextResponse } from 'next/server'
import { executeWizardPipeline } from '@/lib/cappers/shiva-wizard-orchestrator'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for full pick generation

/**
 * SHIVA Pick Generation Endpoint (Unified with Wizard)
 *
 * This endpoint runs the SAME wizard pipeline (Steps 1-7) as the manual UI wizard.
 * This ensures cron jobs and manual picks use IDENTICAL logic and produce IDENTICAL results.
 *
 * Steps executed:
 * 1. Game Selection (already done by scanner)
 * 2. Odds Snapshot
 * 3. Factor Analysis (F1-F5: Pace Index, Offensive Form, Defensive Erosion, Three-Point Environment, Free-Throw Environment)
 * 4. Score Predictions
 * 5. Pick Generation (Market Edge)
 * 6. Bold Player Predictions (SKIPPED for cron)
 * 7. Pick Finalization
 *
 * Usage: POST /api/shiva/generate-pick
 * Body: { selectedGame: { id, home_team, away_team, game_date, game_time, total_line, spread_line, odds, status } }
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    console.log('🎯 [SHIVA:GeneratePick] Starting unified wizard pipeline...')

    const body = await request.json()
    const { selectedGame, betType = 'TOTAL' } = body

    if (!selectedGame || !selectedGame.id) {
      return NextResponse.json({
        success: false,
        error: 'Missing selectedGame in request body',
        decision: 'ERROR'
      }, { status: 400 })
    }

    console.log(`🎮 [SHIVA:GeneratePick] Processing game: ${selectedGame.away_team?.name || selectedGame.away_team} @ ${selectedGame.home_team?.name || selectedGame.home_team}`)
    console.log(`🎮 [SHIVA:GeneratePick] Bet type: ${betType}`)

    // Get Supabase client
    const supabase = getSupabaseAdmin()

    // Fetch the full game data from database
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', selectedGame.id)
      .single()

    if (gameError || !game) {
      console.error('[SHIVA:GeneratePick] Game not found:', gameError)
      return NextResponse.json({
        success: false,
        error: 'Game not found',
        decision: 'ERROR'
      }, { status: 404 })
    }

    // Generate run ID
    const runId = `shiva_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    console.log('[SHIVA:GeneratePick] Running unified wizard pipeline...')

    // Execute the wizard pipeline (Steps 1-7)
    const result = await executeWizardPipeline({
      game,
      runId,
      sport: 'NBA',
      betType: betType as 'TOTAL' | 'SPREAD',
      aiProvider: 'perplexity',
      newsWindowHours: 24
    })

    const duration = Date.now() - startTime

    if (!result.success) {
      console.error('[SHIVA:GeneratePick] Pipeline failed:', result.error)

      // Create cooldown for ERROR to prevent infinite retry loop
      // Common errors: Missing API data, rate limits, invalid game state
      // Cooldown for 2 hours to allow API data to become available
      const cooldownUntil = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

      // CRITICAL: Use UPSERT to handle expired cooldowns
      // The unique constraint on (game_id, capper, bet_type) means we need to update existing records
      // IMPORTANT: Use lowercase to match RPC function can_generate_pick (line 91 in migration 028)
      const { error: cooldownError } = await supabase
        .from('pick_generation_cooldowns')
        .upsert({
          game_id: game.id,
          capper: 'shiva',
          bet_type: betType.toLowerCase(), // ← lowercase to match RPC function can_generate_pick
          result: 'ERROR',
          units: 0,
          confidence_score: 0,
          reason: result.error?.substring(0, 500) || 'Pipeline execution failed',
          cooldown_until: cooldownUntil.toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'game_id,capper,bet_type'
        })

      if (cooldownError) {
        console.error('[SHIVA:GeneratePick] Failed to create/update ERROR cooldown:', cooldownError)
        console.error('[SHIVA:GeneratePick] Cooldown error details:', JSON.stringify(cooldownError, null, 2))
      } else {
        console.log(`[SHIVA:GeneratePick] ✅ ERROR cooldown created/updated until ${cooldownUntil.toISOString()}`)
      }

      return NextResponse.json({
        success: false,
        decision: 'ERROR',
        message: result.error || 'Pipeline execution failed',
        duration: `${duration}ms`
      }, { status: 500 })
    }

    const confidence = result.log?.confidenceBreakdown?.finalConfidence || 0

    // CRITICAL: Save run to database (for run log table)
    console.log('[SHIVA:GeneratePick] Saving run to database...')

    // Production schema (033_fix_runs_table.sql): id, run_id, game_id, state, metadata
    // Store all extra data in metadata JSONB column
    // Get market total from Step 2 snapshot (always available, even for PASS)
    const marketTotal = result.steps?.step2?.snapshot?.total?.line ||
      result.pick?.lockedOdds?.total?.line ||
      0

    // Get baseline_avg from Step 3 (sum of both teams' PPG)
    const baselineAvg = result.steps?.step3?.baseline_avg || 220

    const metadata = {
      capper: 'shiva',
      sport: 'NBA',
      bet_type: betType,
      units: result.pick?.units || 0,
      confidence,
      pick_type: result.pick?.pickType || betType,
      selection: result.pick?.selection || 'PASS',
      factor_contributions: result.log?.factors || [], // Now contains F1-F5 or S1-S5 factors!
      predicted_total: result.log?.finalPrediction?.total || 0,
      baseline_avg: baselineAvg, // Sum of away PPG + home PPG
      market_total: marketTotal,
      game: {
        home_team: typeof game.home_team === 'string' ? game.home_team : game.home_team?.name,
        away_team: typeof game.away_team === 'string' ? game.away_team : game.away_team?.name
      },
      steps: result.steps // Store all step results for debugging
    }

    const { error: runError } = await supabase
      .from('runs')
      .insert({
        id: runId,
        run_id: runId,
        game_id: game.id,
        state: result.pick ? 'COMPLETE' : 'VOIDED',
        metadata
      })

    if (runError) {
      console.error('[SHIVA:GeneratePick] Error saving run:', runError)
      console.error('[SHIVA:GeneratePick] Metadata:', metadata)
      // Don't fail the whole request, just log the error
    } else {
      console.log(`✅ [SHIVA:GeneratePick] Run saved to database: ${runId}`)
      console.log(`📊 [SHIVA:GeneratePick] Factors saved: ${result.log?.factors?.length || 0} factors`)
    }

    if (!result.pick) {
      console.log('[SHIVA:GeneratePick] Pipeline decided to PASS')

      // Create cooldown for PASS decision
      // Use 2-hour cooldown OR game time, whichever is SHORTER
      // This allows re-analysis if conditions change, but prevents spam
      let cooldownUntil: Date
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const gameDate = game.game_date
      const gameTime = game.game_time

      if (gameDate && gameTime) {
        // Combine game_date and game_time to get full timestamp
        const gameDateTime = new Date(`${gameDate}T${gameTime}Z`)

        // If game is in the future, use the SHORTER of 2 hours or game time
        if (gameDateTime > new Date()) {
          cooldownUntil = gameDateTime < twoHoursFromNow ? gameDateTime : twoHoursFromNow
          console.log(`[SHIVA:GeneratePick] Setting PASS cooldown to ${cooldownUntil.toISOString()} (shorter of 2 hours or game time)`)
        } else {
          // Game already started or passed, use 2 hours
          cooldownUntil = twoHoursFromNow
          console.log(`[SHIVA:GeneratePick] Game time passed, setting PASS cooldown for 2 hours: ${cooldownUntil.toISOString()}`)
        }
      } else {
        // No game time available, use 2 hours
        cooldownUntil = twoHoursFromNow
        console.log(`[SHIVA:GeneratePick] No game time available, setting PASS cooldown for 2 hours: ${cooldownUntil.toISOString()}`)
      }

      // CRITICAL: Use UPSERT to handle expired cooldowns
      // The unique constraint on (game_id, capper, bet_type) means we need to update existing records
      // IMPORTANT: Use lowercase 'total' to match RPC function can_generate_pick (line 91 in migration 028)
      const { error: cooldownError } = await supabase
        .from('pick_generation_cooldowns')
        .upsert({
          game_id: game.id,
          capper: 'shiva',
          bet_type: betType.toLowerCase(), // ← lowercase to match RPC function can_generate_pick
          result: 'PASS',
          units: 0,
          confidence_score: confidence,
          reason: `Low confidence: ${confidence.toFixed(2)}`,
          cooldown_until: cooldownUntil.toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'game_id,capper,bet_type'
        })

      if (cooldownError) {
        console.error('[SHIVA:GeneratePick] Error creating/updating PASS cooldown:', cooldownError)
        console.error('[SHIVA:GeneratePick] Cooldown error details:', JSON.stringify(cooldownError, null, 2))
      } else {
        console.log(`[SHIVA:GeneratePick] ✅ PASS cooldown created/updated until ${cooldownUntil.toISOString()}`)
      }

      return NextResponse.json({
        success: false,
        decision: 'PASS',
        message: 'Pipeline decided not to pick this game',
        confidence,
        runId,
        factors: result.log?.factors || [],
        cooldown_until: cooldownUntil.toISOString(),
        duration: `${duration}ms`
      })
    }

    const pick = result.pick

    console.log(`✅ [SHIVA:GeneratePick] Pick generated: ${pick.selection} (${pick.units} units, ${confidence.toFixed(2)} confidence)`)

    // Save pick to database
    const { data: savedPick, error: saveError } = await supabase
      .from('picks')
      .insert({
        game_id: game.id,
        run_id: runId, // CRITICAL: Link pick to run for insight card
        capper: 'shiva',
        pick_type: pick.pickType.toLowerCase(),
        selection: pick.selection,
        odds: pick.lockedOdds?.total?.over_odds || -110,
        units: pick.units,
        confidence: pick.confidence,
        game_snapshot: {
          sport: game.sport,
          league: game.league,
          home_team: game.home_team,
          away_team: game.away_team,
          game_date: game.game_date,
          game_time: game.game_time,
          game_start_timestamp: game.game_start_timestamp, // CRITICAL: Include full UTC timestamp
          total_line: game.total_line,
          spread_line: game.spread_line,
          odds: game.odds
        },
        status: 'pending',
        is_system_pick: true,
        reasoning: `SHIVA pick generated via wizard pipeline`,
        algorithm_version: 'shiva_v1'
      })
      .select()
      .single()

    if (saveError) {
      console.error('[SHIVA:GeneratePick] Error saving pick:', saveError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save pick',
        details: saveError.message,
        decision: 'ERROR'
      }, { status: 500 })
    }

    console.log(`💾 [SHIVA:GeneratePick] Pick saved to database: ${savedPick.id}`)

    // Create PERMANENT cooldown for PICK_GENERATED decision
    // Once a pick is generated for a game, we should NEVER generate another pick for that game/bet_type
    // Set cooldown to year 2099 to make it effectively permanent
    // CRITICAL: Use UPSERT to handle expired cooldowns
    // The unique constraint on (game_id, capper, bet_type) means we need to update existing records
    // IMPORTANT: Use lowercase 'total' to match RPC function can_generate_pick (line 91 in migration 028)
    const cooldownUntil = new Date('2099-12-31T23:59:59Z')
    const { error: cooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .upsert({
        game_id: game.id,
        capper: 'shiva',
        bet_type: betType.toLowerCase(), // ← lowercase to match RPC function can_generate_pick
        result: 'PICK_GENERATED',
        units: pick.units,
        confidence_score: confidence,
        reason: `Pick generated: ${pick.selection}`,
        cooldown_until: cooldownUntil.toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'game_id,capper,bet_type'
      })

    if (cooldownError) {
      console.error('[SHIVA:GeneratePick] Error creating/updating PICK_GENERATED cooldown:', cooldownError)
      console.error('[SHIVA:GeneratePick] Cooldown error details:', JSON.stringify(cooldownError, null, 2))
    } else {
      console.log(`[SHIVA:GeneratePick] ✅ PERMANENT cooldown created/updated for PICK_GENERATED (until ${cooldownUntil.toISOString()})`)
    }

    return NextResponse.json({
      success: true,
      decision: 'PICK',
      message: 'Pick generated successfully using unified wizard pipeline',
      pick: {
        id: savedPick.id,
        game_id: game.id,
        pick_type: pick.pickType,
        selection: pick.selection,
        units: pick.units,
        confidence: pick.confidence,
        odds: pick.lockedOdds?.total?.over_odds || -110
      },
      factors: result.log?.factors || [],
      cooldown_until: cooldownUntil.toISOString(),
      duration: `${duration}ms`
    })

  } catch (error) {
    console.error('❌ [SHIVA:GeneratePick] Error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      decision: 'ERROR'
    }, { status: 500 })
  }
}

