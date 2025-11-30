import { NextResponse } from 'next/server'
import { executeWizardPipeline } from '@/lib/cappers/shiva-wizard-orchestrator'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { generateProfessionalAnalysis } from '@/lib/cappers/professional-analysis-generator'
import { generateBoldPredictions } from '@/lib/cappers/bold-predictions-generator'
import { validateSpreadDirection } from '@/lib/cappers/pick-validation'
import { isSystemCapper } from '@/lib/cappers/system-cappers'
import { calculateTierGrade, TierGradeInput, TierGradeResult } from '@/app/cappers/shiva/management/components/insight-card'

/**
 * Fetch capper's team-specific record and 7-day record for tier calculation
 */
async function fetchTierGradeInputs(
  supabase: any,
  capperId: string,
  teamAbbr: string,
  betType: string
): Promise<{ teamRecord?: { wins: number; losses: number; netUnits: number }; last7DaysRecord?: { wins: number; losses: number; netUnits: number } }> {
  const result: TierGradeInput = { baseConfidence: 0, unitsRisked: 0 }

  try {
    // Get team-specific record for this bet type
    const { data: teamPicks } = await supabase
      .from('picks')
      .select('status, net_units, pick_type, game_snapshot')
      .eq('capper', capperId)
      .eq('pick_type', betType.toLowerCase())
      .in('status', ['win', 'loss'])

    if (teamPicks && teamPicks.length > 0) {
      // Filter for picks on this team
      const teamFilteredPicks = teamPicks.filter((p: any) => {
        const homeAbbr = p.game_snapshot?.home_team?.abbreviation || p.game_snapshot?.home_team
        const awayAbbr = p.game_snapshot?.away_team?.abbreviation || p.game_snapshot?.away_team
        return homeAbbr === teamAbbr || awayAbbr === teamAbbr
      })

      if (teamFilteredPicks.length >= 3) {
        const wins = teamFilteredPicks.filter((p: any) => p.status === 'win').length
        const losses = teamFilteredPicks.filter((p: any) => p.status === 'loss').length
        const netUnits = teamFilteredPicks.reduce((sum: number, p: any) => sum + (p.net_units || 0), 0)
        result.teamRecord = { wins, losses, netUnits }
      }
    }

    // Get 7-day record
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentPicks } = await supabase
      .from('picks')
      .select('status, net_units, created_at')
      .eq('capper', capperId)
      .in('status', ['win', 'loss'])
      .gte('created_at', sevenDaysAgo)

    if (recentPicks && recentPicks.length >= 3) {
      const wins = recentPicks.filter((p: any) => p.status === 'win').length
      const losses = recentPicks.filter((p: any) => p.status === 'loss').length
      const netUnits = recentPicks.reduce((sum: number, p: any) => sum + (p.net_units || 0), 0)
      result.last7DaysRecord = { wins, losses, netUnits }
    }
  } catch (error) {
    console.error('[SHIVA:GeneratePick] Error fetching tier grade inputs:', error)
  }

  return result
}

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
 * 3. Factor Analysis (F1-F5 for TOTAL, S1-S5 for SPREAD)
 * 4. Score Predictions
 * 5. Pick Generation (Market Edge)
 * 6. Bold Player Predictions (AI-powered with MySportsFeeds injury data)
 * 7. Pick Finalization + Professional Analysis (AI-generated)
 *
 * Usage: POST /api/shiva/generate-pick
 * Body: { selectedGame: { id, home_team, away_team, game_date, game_time, total_line, spread_line, odds, status } }
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    console.log('🎯 [SHIVA:GeneratePick] Starting unified wizard pipeline...')

    const body = await request.json()
    const { selectedGame, betType = 'TOTAL', capperId = 'shiva', factorConfig } = body

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

    // CRITICAL: Check for existing picks BEFORE running the wizard to prevent duplicates
    // This prevents race conditions where multiple cron jobs try to generate picks simultaneously
    const betTypeLower = betType.toLowerCase()
    const { data: existingPicks, error: picksError } = await supabase
      .from('picks')
      .select('id, pick_type, status, selection')
      .eq('game_id', game.id)
      .eq('capper', capperId)
      .eq('pick_type', betTypeLower)
      .in('status', ['pending', 'won', 'lost', 'push'])

    if (picksError) {
      console.error('[SHIVA:GeneratePick] Error checking existing picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to check existing picks',
        details: picksError.message,
        decision: 'ERROR'
      }, { status: 500 })
    }

    if (existingPicks && existingPicks.length > 0) {
      console.log(`⚠️ [SHIVA:GeneratePick] Game already has ${betType} pick(s):`, existingPicks)
      return NextResponse.json({
        success: false,
        decision: 'DUPLICATE',
        message: `Game already has ${betType} pick: ${existingPicks[0].selection}`,
        existing_pick_id: existingPicks[0].id
      }, { status: 409 }) // 409 Conflict
    }

    // CRITICAL: Check for active cooldowns BEFORE running the wizard
    const nowIso = new Date().toISOString()
    const { data: cooldownData, error: cooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .select('cooldown_until, result, reason')
      .eq('game_id', game.id)
      .eq('capper', capperId)
      .eq('bet_type', betTypeLower)
      .gt('cooldown_until', nowIso)
      .single()

    if (cooldownError && cooldownError.code !== 'PGRST116') { // PGRST116 = no rows found (OK)
      console.error('[SHIVA:GeneratePick] Error checking cooldown:', cooldownError)
      return NextResponse.json({
        success: false,
        error: 'Failed to check cooldown',
        details: cooldownError.message,
        decision: 'ERROR'
      }, { status: 500 })
    }

    if (cooldownData) {
      console.log(`⚠️ [SHIVA:GeneratePick] Game is in cooldown until ${cooldownData.cooldown_until}:`, cooldownData)
      return NextResponse.json({
        success: false,
        decision: 'COOLDOWN',
        message: `Game is in cooldown until ${cooldownData.cooldown_until}`,
        cooldown_until: cooldownData.cooldown_until,
        reason: cooldownData.reason
      }, { status: 429 }) // 429 Too Many Requests
    }

    console.log('✅ [SHIVA:GeneratePick] No existing picks or cooldowns found, proceeding with wizard...')

    // Generate run ID
    const runId = `${capperId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    console.log('[SHIVA:GeneratePick] Running unified wizard pipeline...')

    // Execute the wizard pipeline (Steps 1-7)
    const result = await executeWizardPipeline({
      game,
      runId,
      capperId,
      sport: 'NBA',
      betType: betType as 'TOTAL' | 'SPREAD',
      aiProvider: 'perplexity',
      newsWindowHours: 24,
      factorConfig // Pass through the factorConfig if provided
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
      const { error: cooldownInsertError } = await supabase
        .from('pick_generation_cooldowns')
        .upsert({
          game_id: game.id,
          capper: capperId,
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

      if (cooldownInsertError) {
        console.error('[SHIVA:GeneratePick] Failed to create/update ERROR cooldown:', cooldownInsertError)
        console.error('[SHIVA:GeneratePick] Cooldown error details:', JSON.stringify(cooldownInsertError, null, 2))
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

    let confidence = result.log?.confidenceBreakdown?.finalConfidence || 0

    // CRITICAL: Save run to database (for run log table)
    console.log('[SHIVA:GeneratePick] Saving run to database...')

    // Production schema (033_fix_runs_table.sql): id, run_id, game_id, state, metadata
    // Store all extra data in metadata JSONB column

    // Get market line and predicted value based on bet type
    let marketLine: number
    let predictedValue: number
    let baselineAvg: number

    if (betType === 'TOTAL') {
      // TOTALS: Use total line and predicted total
      marketLine = result.steps?.step2?.snapshot?.total?.line ||
        result.pick?.lockedOdds?.total?.line ||
        220
      predictedValue = result.log?.finalPrediction?.total || 220
      baselineAvg = result.steps?.step3?.baseline_avg || 220 // Sum of away PPG + home PPG
    } else if (betType === 'SPREAD') {
      // SPREAD: Use spread line and predicted margin
      marketLine = result.steps?.step2?.snapshot?.spread?.line ||
        result.pick?.lockedOdds?.spread?.line ||
        0
      predictedValue = result.steps?.step4?.predictions?.spread_pred_points || 0
      baselineAvg = 0 // Baseline margin is 0 (no inherent advantage)
    } else {
      // Fallback for unknown bet types
      marketLine = 0
      predictedValue = 0
      baselineAvg = 0
    }

    const metadata: any = {
      capper: capperId,
      sport: 'NBA',
      bet_type: betType,
      units: result.pick?.units || 0,
      confidence,
      pick_type: result.pick?.pickType || betType,
      selection: result.pick?.selection || 'PASS',
      factor_contributions: result.log?.factors || [], // Now contains F1-F5 or S1-S5 factors!
      predicted_total: predictedValue, // For TOTAL: predicted total, For SPREAD: predicted margin
      baseline_avg: baselineAvg, // For TOTAL: sum of PPG, For SPREAD: 0
      market_total: marketLine, // For TOTAL: market total line, For SPREAD: market spread line
      predicted_home_score: result.log?.finalPrediction?.home || 0,
      predicted_away_score: result.log?.finalPrediction?.away || 0,
      game: {
        home_team: typeof game.home_team === 'string' ? game.home_team : game.home_team?.name,
        away_team: typeof game.away_team === 'string' ? game.away_team : game.away_team?.name
      },
      steps: result.steps // Store all step results for debugging
    }

    // Extract confidence values from wizard steps (same for both TOTAL and SPREAD)
    const conf7 = result.steps?.step4?.predictions?.conf7_score || 0
    const confMarketAdj = result.steps?.step5?.conf_market_adj || 0
    const confFinal = result.steps?.step5?.conf_final || confidence

    // ========================================
    // CRITICAL VALIDATION: Spread Direction
    // ========================================
    // NOTE: Injury impact is handled by S6 factor, not by blocking picks
    if (result.pick && result.pick.selection !== 'PASS' && betType === 'SPREAD') {
      console.log('[SHIVA:GeneratePick] Running spread direction validation...')

      try {
        const awayTeamName = typeof game.away_team === 'string' ? game.away_team : game.away_team?.name
        const homeTeamName = typeof game.home_team === 'string' ? game.home_team : game.home_team?.name

        // SPREAD DIRECTION VALIDATION: Ensure favorite/dog direction matches prediction
        const spreadValidation = validateSpreadDirection(
          predictedValue, // predicted margin
          marketLine,     // market spread
          result.pick.selection,
          awayTeamName,
          homeTeamName
        )

        if (!spreadValidation.isValid) {
          console.error('[SHIVA:GeneratePick] ❌ SPREAD VALIDATION FAILED:', spreadValidation.reason)

          // Override pick to PASS
          result.pick.selection = 'PASS'
          result.pick.units = 0
          result.pick.pickType = 'PASS'

          // Add validation failure to metadata
          metadata.spread_validation = {
            failed: true,
            reason: spreadValidation.reason,
            predicted_margin: spreadValidation.predictedMargin,
            market_spread: spreadValidation.marketSpread,
            favorite_team: spreadValidation.favoriteTeam
          }

          console.log('[SHIVA:GeneratePick] Pick blocked due to spread direction mismatch')
        } else {
          console.log('[SHIVA:GeneratePick] ✅ Spread validation passed')
          metadata.spread_validation = {
            passed: true,
            favorite_team: spreadValidation.favoriteTeam
          }
        }

      } catch (validationError) {
        console.error('[SHIVA:GeneratePick] Error during validation:', validationError)
        // Don't block pick on validation errors - log and continue
      }
    }

    // ========================================
    // TOTAL EDGE DETECTION (for SPREAD picks)
    // ========================================
    // For SPREAD picks, calculate predicted total and flag large discrepancies with market total
    if (result.pick && result.pick.selection !== 'PASS' && betType === 'SPREAD') {
      try {
        const predictedHomeScore = result.log?.finalPrediction?.home || 0
        const predictedAwayScore = result.log?.finalPrediction?.away || 0
        const predictedTotal = predictedHomeScore + predictedAwayScore
        const marketTotal = result.steps?.step2?.snapshot?.total?.line || 0

        if (predictedTotal > 0 && marketTotal > 0) {
          const totalEdge = predictedTotal - marketTotal
          const totalEdgeAbs = Math.abs(totalEdge)

          // Flag large total discrepancies (>10 points)
          if (totalEdgeAbs > 10) {
            console.warn('[SHIVA:GeneratePick] ⚠️ LARGE TOTAL EDGE DETECTED:', {
              predictedTotal: predictedTotal.toFixed(1),
              marketTotal: marketTotal.toFixed(1),
              totalEdge: totalEdge.toFixed(1),
              implication: totalEdge > 0 ? 'Strong OVER lean' : 'Strong UNDER lean'
            })

            // Add total edge to metadata for visibility
            metadata.total_edge_warning = {
              predicted_total: predictedTotal,
              market_total: marketTotal,
              total_edge: totalEdge,
              total_edge_abs: totalEdgeAbs,
              implication: totalEdge > 0 ? 'OVER' : 'UNDER',
              severity: totalEdgeAbs > 15 ? 'EXTREME' : 'HIGH'
            }
          }

          // Always store total edge for analysis
          metadata.total_edge_analysis = {
            predicted_total: predictedTotal,
            market_total: marketTotal,
            total_edge: totalEdge
          }

          console.log('[SHIVA:GeneratePick] Total edge analysis:', {
            predictedTotal: predictedTotal.toFixed(1),
            marketTotal: marketTotal.toFixed(1),
            totalEdge: totalEdge.toFixed(1)
          })
        }
      } catch (totalEdgeError) {
        console.error('[SHIVA:GeneratePick] Error calculating total edge:', totalEdgeError)
      }
    }

    // ========================================
    // CONFIDENCE RECALIBRATION (DISABLED)
    // ========================================
    // Previously applied penalties for missing data, but this was causing valid picks
    // to be converted to PASS because the data path checks were incorrect.
    // TODO: Fix the underlying data issues (missing team stats, injury data) before re-enabling.
    // See: step3.totals_debug.console_logs.bundle (team stats)
    // See: step3.totals_debug.injury_impact (injury data)
    console.log('[SHIVA:GeneratePick] Confidence recalibration DISABLED - using original confidence:', {
      confidence: confFinal.toFixed(2),
      units: result.pick?.units || 0
    })

    // ========================================
    // CRITICAL: Handle PASS after recalibration
    // ========================================
    // If confidence recalibration converted the pick to PASS, we should NOT save to picks table
    // Instead, create a cooldown and return early (same as when !result.pick)
    if (result.pick && result.pick.selection === 'PASS') {
      console.log('[SHIVA:GeneratePick] Pick converted to PASS after recalibration - NOT saving to picks table')

      // Create cooldown for PASS decision (same logic as when !result.pick)
      let cooldownUntil: Date
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const gameDate = game.game_date
      const gameTime = game.game_time

      if (gameDate && gameTime) {
        const gameDateTime = new Date(`${gameDate}T${gameTime}Z`)
        if (gameDateTime > new Date()) {
          cooldownUntil = gameDateTime < twoHoursFromNow ? gameDateTime : twoHoursFromNow
        } else {
          cooldownUntil = twoHoursFromNow
        }
      } else {
        cooldownUntil = twoHoursFromNow
      }

      const { error: passCooldownError } = await supabase
        .from('pick_generation_cooldowns')
        .upsert({
          game_id: game.id,
          capper: capperId,
          bet_type: betType.toLowerCase(),
          result: 'PASS',
          units: 0,
          confidence_score: confidence,
          reason: `Low confidence after recalibration: ${confidence.toFixed(2)}`,
          cooldown_until: cooldownUntil.toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'game_id,capper,bet_type'
        })

      if (passCooldownError) {
        console.error('[SHIVA:GeneratePick] Error creating PASS cooldown after recalibration:', passCooldownError)
      } else {
        console.log(`[SHIVA:GeneratePick] ✅ PASS cooldown created until ${cooldownUntil.toISOString()}`)
      }

      return NextResponse.json({
        success: false,
        decision: 'PASS',
        message: 'Pick converted to PASS after confidence recalibration',
        confidence,
        runId,
        factors: result.log?.factors || [],
        recalibration: metadata.confidence_recalibration,
        cooldown_until: cooldownUntil.toISOString(),
        duration: `${duration}ms`
      })
    }

    // Generate Bold Player Predictions and Professional Analysis (if pick was generated)
    let boldPredictions: any = null
    let professionalAnalysis: string = ''
    let injurySummary: any = null

    if (result.pick && result.pick.selection !== 'PASS') {
      console.log('[SHIVA:GeneratePick] Generating bold predictions and professional analysis...')

      try {
        // Generate Bold Player Predictions (Step 6)
        // Call directly instead of HTTP request for reliability
        console.log('[SHIVA:GeneratePick] Generating bold predictions...')

        const boldResult = await generateBoldPredictions({
          game: {
            away_team: typeof game.away_team === 'string' ? game.away_team : game.away_team?.name,
            home_team: typeof game.home_team === 'string' ? game.home_team : game.home_team?.name,
            game_date: game.game_date
          },
          predictedValue,
          marketLine,
          confidence: confFinal,
          factors: result.log?.factors || [],
          betType,
          selection: result.pick.selection
        })

        boldPredictions = boldResult.bold_predictions
        injurySummary = boldResult.injury_summary

        console.log('[SHIVA:GeneratePick] Bold predictions generated:', {
          hasPredictions: !!boldPredictions,
          predictionCount: boldPredictions?.predictions?.length || 0,
          hasInjurySummary: !!injurySummary
        })
      } catch (boldError) {
        console.error('[SHIVA:GeneratePick] Error generating bold predictions:', boldError)
      }

      try {
        // Extract team stats from run metadata (if available)
        let teamStats: any = undefined
        const statsBundle = result.steps?.step3?.totals_debug?.console_logs?.bundle
        if (statsBundle) {
          // Convert NBAStatsBundle to TeamStats format for professional analysis
          teamStats = {
            away: {
              pace: statsBundle.awayPaceLast10 || statsBundle.awayPaceSeason || 100.1,
              offensiveRating: statsBundle.awayORtgLast10 || 110.0,
              defensiveRating: statsBundle.awayDRtgSeason || 110.0,
              netRating: (statsBundle.awayORtgLast10 || 110.0) - (statsBundle.awayDRtgSeason || 110.0),
              threePointPct: statsBundle.away3PctLast10 || statsBundle.away3Pct || 0.35,
              threePointPctDefense: statsBundle.awayOpp3PAR ? (1 - statsBundle.awayOpp3PAR) : undefined,
              turnovers: statsBundle.awayTOVLast10 || 14.0,
              turnoversForced: undefined // Not available in current bundle
            },
            home: {
              pace: statsBundle.homePaceLast10 || statsBundle.homePaceSeason || 100.1,
              offensiveRating: statsBundle.homeORtgLast10 || 110.0,
              defensiveRating: statsBundle.homeDRtgSeason || 110.0,
              netRating: (statsBundle.homeORtgLast10 || 110.0) - (statsBundle.homeDRtgSeason || 110.0),
              threePointPct: statsBundle.home3PctLast10 || statsBundle.home3Pct || 0.35,
              threePointPctDefense: statsBundle.homeOpp3PAR ? (1 - statsBundle.homeOpp3PAR) : undefined,
              turnovers: statsBundle.homeTOVLast10 || 14.0,
              turnoversForced: undefined // Not available in current bundle
            }
          }
          console.log('[SHIVA:GeneratePick] Team stats extracted from bundle:', {
            awayNetRtg: teamStats.away.netRating.toFixed(1),
            homeNetRtg: teamStats.home.netRating.toFixed(1)
          })
        }

        // Extract total edge data for SPREAD picks (if available)
        let totalEdge: any = undefined
        if (betType === 'SPREAD' && metadata.total_edge_analysis) {
          totalEdge = {
            predicted_total: metadata.total_edge_analysis.predicted_total,
            market_total: metadata.total_edge_analysis.market_total,
            total_edge: metadata.total_edge_analysis.total_edge,
            implication: metadata.total_edge_analysis.total_edge > 0 ? 'OVER' : 'UNDER'
          }
        }

        // Generate Professional Analysis
        professionalAnalysis = await generateProfessionalAnalysis({
          game: {
            away_team: typeof game.away_team === 'string' ? game.away_team : game.away_team?.name,
            home_team: typeof game.home_team === 'string' ? game.home_team : game.home_team?.name,
            game_date: game.game_date
          },
          predictedValue,
          marketLine,
          confidence: confFinal,
          units: result.pick.units || 0,
          factors: result.log?.factors || [],
          betType,
          selection: result.pick.selection,
          injuryData: injurySummary,
          teamStats, // Pass actual team stats to prevent AI hallucination
          totalEdge   // Pass total edge analysis for SPREAD picks
        })
        console.log('[SHIVA:GeneratePick] Professional analysis generated successfully')
      } catch (analysisError) {
        console.error('[SHIVA:GeneratePick] Error generating professional analysis:', analysisError)
        professionalAnalysis = '' // Will use fallback in insight card
      }
    }

    const { error: runError } = await supabase
      .from('runs')
      .insert({
        id: runId,
        run_id: runId,
        game_id: game.id,
        state: result.pick ? 'COMPLETE' : 'VOIDED',
        // CRITICAL: Store bet_type and pick_type in columns (not just metadata)
        bet_type: betType,
        pick_type: betType,
        capper: capperId,
        // NEW: Store data in separate columns (PRIORITY)
        factor_contributions: result.log?.factors || [],
        predicted_total: predictedValue,
        baseline_avg: baselineAvg,
        market_total: marketLine,
        conf7,
        conf_market_adj: confMarketAdj,
        conf_final: confFinal,
        // NEW: Bold predictions, professional analysis, and injury summary
        bold_predictions: boldPredictions,
        professional_analysis: professionalAnalysis,
        injury_summary: injurySummary,
        // NOTE: predicted_home_score and predicted_away_score columns don't exist in database
        // These values are stored in metadata.steps.step4.predictions instead
        // OLD: Also store in metadata for backwards compatibility
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
      const { error: passCooldownError } = await supabase
        .from('pick_generation_cooldowns')
        .upsert({
          game_id: game.id,
          capper: capperId,
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

      if (passCooldownError) {
        console.error('[SHIVA:GeneratePick] Error creating/updating PASS cooldown:', passCooldownError)
        console.error('[SHIVA:GeneratePick] Cooldown error details:', JSON.stringify(passCooldownError, null, 2))
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

    // ========================================
    // CRITICAL: Final PASS guard - never save PASS picks
    // ========================================
    if (!pick || pick.selection === 'PASS' || pick.units === 0) {
      console.log('[SHIVA:GeneratePick] ❌ Final guard: Rejecting PASS pick - NOT saving to picks table')

      // Create cooldown for PASS decision
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
      await supabase
        .from('pick_generation_cooldowns')
        .upsert({
          game_id: game.id,
          capper: capperId,
          bet_type: betType.toLowerCase(),
          result: 'PASS',
          units: 0,
          confidence_score: confidence,
          reason: 'Final guard: Pick was PASS or 0 units',
          cooldown_until: twoHoursFromNow.toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'game_id,capper,bet_type'
        })

      return NextResponse.json({
        success: false,
        decision: 'PASS',
        message: 'Pick rejected by final guard (PASS or 0 units)',
        confidence,
        runId,
        factors: result.log?.factors || [],
        cooldown_until: twoHoursFromNow.toISOString(),
      })
    }

    console.log(`✅ [SHIVA:GeneratePick] Pick generated: ${pick.selection} (${pick.units} units, ${confidence.toFixed(2)} confidence)`)

    // CRITICAL: Create PERMANENT cooldown FIRST, before saving pick
    // This ensures that even if pick save fails (e.g., RLS policy error), we still create the cooldown
    // to prevent infinite retry loops on the same game
    // Once a pick is generated for a game, we should NEVER generate another pick for that game/bet_type
    // Set cooldown to year 2099 to make it effectively permanent
    const cooldownUntil = new Date('2099-12-31T23:59:59Z')
    const { error: pickCooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .upsert({
        game_id: game.id,
        capper: capperId,
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

    if (pickCooldownError) {
      console.error('[SHIVA:GeneratePick] Error creating/updating PICK_GENERATED cooldown:', pickCooldownError)
      console.error('[SHIVA:GeneratePick] Cooldown error details:', JSON.stringify(pickCooldownError, null, 2))
    } else {
      console.log(`[SHIVA:GeneratePick] ✅ PERMANENT cooldown created/updated for PICK_GENERATED (until ${cooldownUntil.toISOString()})`)
    }

    // Determine if this is a system capper or user capper (from database)
    const isSystemCapperCheck = await isSystemCapper(capperId)

    // For user cappers, get the user_id from user_cappers table
    let userId: string | null = null
    if (!isSystemCapperCheck) {
      const { data: capperData } = await supabase
        .from('user_cappers')
        .select('user_id')
        .eq('capper_id', capperId)
        .single()

      userId = capperData?.user_id || null
    }

    // ===== CALCULATE TIER GRADE =====
    // Get the team abbreviation from the pick selection or game
    const homeTeamAbbr = game.home_team?.abbreviation || game.home_team
    const awayTeamAbbr = game.away_team?.abbreviation || game.away_team
    // For TOTAL picks, use the home team; for SPREAD, use the team in selection
    const relevantTeam = pick.pickType === 'SPREAD'
      ? (pick.selection?.includes(homeTeamAbbr) ? homeTeamAbbr : awayTeamAbbr)
      : homeTeamAbbr

    // Fetch team record and 7-day record for tier calculation
    const tierInputs = await fetchTierGradeInputs(supabase, capperId, relevantTeam, pick.pickType)

    // Calculate the tier grade
    const tierGrade = calculateTierGrade({
      baseConfidence: pick.confidence,
      unitsRisked: pick.units,
      teamRecord: tierInputs.teamRecord,
      last7DaysRecord: tierInputs.last7DaysRecord
    })

    console.log(`🏆 [SHIVA:GeneratePick] Tier calculated: ${tierGrade.tier} (score: ${tierGrade.tierScore}, bonuses: units=${tierGrade.bonuses.units}, team=${tierGrade.bonuses.teamRecord}, hot=${tierGrade.bonuses.hotStreak})`)

    // Save pick to database
    const pickInsert: any = {
      game_id: game.id,
      run_id: runId, // CRITICAL: Link pick to run for insight card
      capper: capperId,
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
        odds: game.odds,
        // Store tier data in game_snapshot for historical accuracy
        tier_grade: {
          tier: tierGrade.tier,
          tierScore: tierGrade.tierScore,
          bonuses: tierGrade.bonuses,
          inputs: {
            baseConfidence: pick.confidence,
            unitsRisked: pick.units,
            teamRecord: tierInputs.teamRecord || null,
            last7DaysRecord: tierInputs.last7DaysRecord || null
          }
        }
      },
      status: 'pending',
      is_system_pick: isSystemCapper,
      reasoning: `${capperId.toUpperCase()} pick generated via wizard pipeline`,
      algorithm_version: `${capperId}_v1`
    }

    // Add user_id for user cappers
    if (userId) {
      pickInsert.user_id = userId
    }

    const { data: savedPick, error: saveError } = await supabase
      .from('picks')
      .insert(pickInsert)
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

