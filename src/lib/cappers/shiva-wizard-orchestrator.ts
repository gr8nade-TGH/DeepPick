/**
 * SHIVA Wizard Orchestrator
 * 
 * Server-side orchestrator that executes the same wizard steps (1-7) as the manual UI wizard.
 * This ensures the cron job and manual wizard use IDENTICAL logic and produce IDENTICAL results.
 * 
 * Steps:
 * 1. Game Selection (already done by scanner)
 * 2. Odds Snapshot
 * 3. Factor Analysis (F1-F5)
 * 4. Score Predictions
 * 5. Pick Generation (Market Edge)
 * 6. Bold Player Predictions (SKIPPED for cron)
 * 7. Pick Finalization
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'

export interface WizardOrchestratorInput {
  game: {
    id: string
    home_team: { name: string } | string
    away_team: { name: string } | string
    game_time?: string
    total_line?: number
    spread_line?: number
  }
  runId: string
  sport?: 'NBA' | 'NFL' | 'MLB'
  betType?: 'TOTAL' | 'SPREAD'
  aiProvider?: 'perplexity' | 'openai'
  newsWindowHours?: number
}

export interface WizardOrchestratorResult {
  success: boolean
  runId: string
  steps: {
    step1?: any
    step2?: any
    step3?: any
    step4?: any
    step5?: any
    step6?: any
    step7?: any
  }
  pick?: {
    pickType: string
    selection: string
    units: number
    confidence: number
    lockedOdds: any
  }
  log?: {
    factors?: any[]
    finalPrediction?: {
      total: number
      home: number
      away: number
    }
    confidenceBreakdown?: {
      baseConfidence: number
      finalConfidence: number
      marketEdgeAdjustment: number
    }
  }
  error?: string
  executionTimeMs: number
}

/**
 * Execute the full SHIVA wizard pipeline
 */
export async function executeWizardPipeline(input: WizardOrchestratorInput): Promise<WizardOrchestratorResult> {
  const startTime = Date.now()
  const { game, runId, sport = 'NBA', betType = 'TOTAL', aiProvider = 'perplexity', newsWindowHours = 24 } = input

  const steps: any = {}

  try {
    console.log('[WizardOrchestrator] Starting pipeline:', { runId, gameId: game.id })

    // Extract team names
    const homeTeam = typeof game.home_team === 'string' ? game.home_team : game.home_team.name
    const awayTeam = typeof game.away_team === 'string' ? game.away_team : game.away_team.name

    // Step 1: Game Selection (already done by scanner, just record it)
    steps.step1 = {
      run_id: runId,
      selected_game: {
        id: game.id,
        home_team: homeTeam,
        away_team: awayTeam,
        game_time: game.game_time
      }
    }
    console.log('[WizardOrchestrator] Step 1: Game selected')

    // Step 2: Odds Snapshot
    console.log('[WizardOrchestrator] Step 2: Capturing odds snapshot...')
    steps.step2 = await captureOddsSnapshot(runId, game, sport)
    console.log('[WizardOrchestrator] Step 2: Odds snapshot captured')

    // Step 3: Factor Analysis (F1-F5)
    console.log('[WizardOrchestrator] Step 3: Computing factors...')
    steps.step3 = await computeFactors(runId, { home: homeTeam, away: awayTeam }, sport, betType, aiProvider, newsWindowHours)
    console.log('[WizardOrchestrator] Step 3: Factors computed:', steps.step3.factors?.length || 0, 'factors')

    // Step 4: Score Predictions
    console.log('[WizardOrchestrator] Step 4: Generating predictions...')
    steps.step4 = await generatePredictions(runId, steps.step3, sport, betType)
    console.log('[WizardOrchestrator] Step 4: Predictions generated')

    // Step 5: Market Edge Adjustment
    console.log('[WizardOrchestrator] Step 5: Calculating market edge...')

    let edgeVsMarketFactor: any
    let finalConfidence: number
    let baseConfidence: number
    let pickDirection: string
    let marketEdgePts: number

    if (betType === 'TOTAL') {
      // TOTALS: Compare predicted total vs market total line
      const marketTotalLine = steps.step2.snapshot?.total?.line || 220
      const predictedTotal = steps.step4.predictions?.total_pred_points || 220
      baseConfidence = steps.step4.predictions?.conf7_score || 0
      pickDirection = predictedTotal > marketTotalLine ? 'OVER' : 'UNDER'
      marketEdgePts = predictedTotal - marketTotalLine

      // Create Edge vs Market factor (100% weight, max 5.0 points)
      edgeVsMarketFactor = createEdgeVsMarketFactor(predictedTotal, marketTotalLine, marketEdgePts)

      // Add Edge vs Market to factors array for confidence calculation
      const allFactors = [...(steps.step3.factors || []), edgeVsMarketFactor]

      // Recalculate confidence with Edge vs Market included
      const { calculateConfidence } = await import('@/lib/cappers/shiva-v1/confidence-calculator')
      const factorWeights = {
        ...steps.step3.factorWeights,
        edgeVsMarket: 100 // 100% weight (fixed)
      }
      const confidenceResult = calculateConfidence({
        factors: allFactors,
        factorWeights,
        confSource: 'nba_totals_v1'
      })

      finalConfidence = confidenceResult.confScore

      steps.step5 = {
        run_id: runId,
        conf_final: finalConfidence,
        dominant: 'total',
        conf_market_adj: finalConfidence - baseConfidence,
        edgeVsMarketFactor,
        confidenceResult
      }
    } else if (betType === 'SPREAD') {
      // SPREAD: Compare predicted margin vs market spread line
      const marketSpread = steps.step2.snapshot?.spread?.line || 0
      const predictedMargin = steps.step4.predictions?.spread_pred_points || 0
      baseConfidence = steps.step4.predictions?.conf7_score || 0

      // Determine pick direction based on predicted margin
      // Positive margin = away team favored, negative = home team favored
      const awayTeam = typeof game.away_team === 'string' ? game.away_team : game.away_team.name
      const homeTeam = typeof game.home_team === 'string' ? game.home_team : game.home_team.name
      pickDirection = predictedMargin > 0 ? awayTeam : homeTeam

      // Calculate edge: predicted margin vs market spread
      // marketSpread is from home perspective (negative = home favored, positive = away favored)
      // predictedMargin is from away perspective (positive = away wins, negative = home wins)
      // Direct subtraction gives us the edge
      // Example: Mkt=+4 (away favored by 4), Pred=-2 (home wins by 2) → Edge=-6 (home undervalued)
      marketEdgePts = predictedMargin - marketSpread

      // Create Edge vs Market Spread factor (100% weight, max 5.0 points)
      edgeVsMarketFactor = createEdgeVsMarketSpreadFactor(predictedMargin, marketSpread, marketEdgePts)

      // Add Edge vs Market Spread to factors array for confidence calculation
      const allFactors = [...(steps.step3.factors || []), edgeVsMarketFactor]

      // Recalculate confidence with Edge vs Market Spread included
      const { calculateConfidence } = await import('@/lib/cappers/shiva-v1/confidence-calculator')
      const factorWeights = {
        ...steps.step3.factorWeights,
        edgeVsMarketSpread: 100 // 100% weight (fixed)
      }
      const confidenceResult = calculateConfidence({
        factors: allFactors,
        factorWeights,
        confSource: 'nba_spread_v1'
      })

      finalConfidence = confidenceResult.confScore

      steps.step5 = {
        run_id: runId,
        conf_final: finalConfidence,
        dominant: 'spread',
        conf_market_adj: finalConfidence - baseConfidence,
        edgeVsMarketFactor,
        confidenceResult
      }
    } else {
      throw new Error(`[WizardOrchestrator] Unsupported bet type in Step 5: ${betType}`)
    }

    console.log('[WizardOrchestrator] Step 5: Market edge calculated, final confidence:', finalConfidence)

    // Step 6: Bold Player Predictions (SKIP for cron - this is AI-powered player props)
    console.log('[WizardOrchestrator] Step 6: Skipped (player predictions not needed for cron)')
    steps.step6 = { skipped: true }

    // Step 7: Pick Finalization
    console.log('[WizardOrchestrator] Step 7: Finalizing pick...')

    // Get predicted value and market line based on bet type
    const predictedValue = betType === 'TOTAL'
      ? steps.step4.predictions?.total_pred_points || 220
      : steps.step4.predictions?.spread_pred_points || 0
    const marketLine = betType === 'TOTAL'
      ? steps.step2.snapshot?.total?.line || 220
      : steps.step2.snapshot?.spread?.line || 0

    steps.step7 = await finalizePick(runId, finalConfidence, predictedValue, marketLine, pickDirection, steps.step2.snapshot, betType)
    console.log('[WizardOrchestrator] Step 7: Pick finalized')

    // Build result
    // CRITICAL: Use factorContributions from Step 5 confidence calculation
    // This includes weighted scores (overScore, underScore) for run log display
    // The confidence calculator already computed these with proper weights applied
    const factorContributions = steps.step5.confidenceResult?.factorContributions || []

    const result: WizardOrchestratorResult = {
      success: true,
      runId,
      steps,
      pick: steps.step7.decision === 'PICK' ? {
        pickType: betType === 'TOTAL' ? 'TOTAL' : 'SPREAD', // Dynamic based on betType
        selection: steps.step7.pick?.selection || 'PASS',
        units: steps.step7.pick?.units || 0,
        confidence: finalConfidence,
        lockedOdds: steps.step2.snapshot
      } : undefined,
      log: {
        factors: factorContributions, // Use factor contributions with weighted scores
        finalPrediction: {
          total: steps.step4.predictions?.total_pred_points || 0,
          home: steps.step4.predictions?.scores?.home || 0,
          away: steps.step4.predictions?.scores?.away || 0
        },
        confidenceBreakdown: {
          baseConfidence,
          finalConfidence,
          marketEdgeAdjustment: steps.step5.conf_market_adj || 0
        }
      },
      executionTimeMs: Date.now() - startTime
    }

    console.log('[WizardOrchestrator] Pipeline completed successfully:', {
      runId,
      decision: steps.step7.decision,
      confidence: finalConfidence,
      units: steps.step7.pick?.units || 0,
      executionTimeMs: result.executionTimeMs
    })

    return result

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[WizardOrchestrator] Pipeline failed:', { runId, error: errorMsg })

    return {
      success: false,
      runId,
      steps,
      error: errorMsg,
      executionTimeMs: Date.now() - startTime
    }
  }
}

/**
 * Step 2: Capture odds snapshot
 */
async function captureOddsSnapshot(runId: string, game: any, sport: string) {
  const supabase = getSupabaseAdmin()

  // Fetch current odds from the game
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', game.id)
    .single()

  if (gameError || !gameData) {
    throw new Error(`Failed to fetch game data: ${gameError?.message || 'Game not found'}`)
  }

  // Extract team names
  const homeTeam = typeof game.home_team === 'string' ? game.home_team : game.home_team.name
  const awayTeam = typeof game.away_team === 'string' ? game.away_team : game.away_team.name

  // Calculate average total line from all sportsbooks
  const odds = gameData.odds || {}
  const sportsbooks = Object.keys(odds)
  const totalLines = sportsbooks
    .map(book => odds[book]?.total?.line)
    .filter(line => line !== undefined && line !== null)

  // REQUIRE valid odds data - no fallbacks!
  if (totalLines.length === 0) {
    throw new Error(`No valid total line data available from sportsbooks. Cannot generate pick without accurate market odds. Game: ${homeTeam} vs ${awayTeam}`)
  }

  const avgTotalLine = parseFloat((totalLines.reduce((a, b) => a + b, 0) / totalLines.length).toFixed(1))

  console.log('[WizardOrchestrator:Step2] Total line calculation:', {
    sportsbooks: sportsbooks.length,
    totalLines,
    avgTotalLine,
    booksConsidered: totalLines.length
  })

  // Calculate average spread line from all sportsbooks
  const spreadLines = sportsbooks
    .map(book => odds[book]?.spread?.line)
    .filter(line => line !== undefined && line !== null)

  // REQUIRE valid spread data for SPREAD picks - no fallbacks!
  if (spreadLines.length === 0) {
    throw new Error(`No valid spread line data available from sportsbooks. Cannot generate SPREAD pick without accurate market odds. Game: ${homeTeam} vs ${awayTeam}`)
  }

  const avgSpreadLine = parseFloat((spreadLines.reduce((a, b) => a + b, 0) / spreadLines.length).toFixed(1))

  // Determine favored team based on average spread
  // Negative spread = home team favored, positive = away team favored
  const favTeam = avgSpreadLine < 0 ? homeTeam : awayTeam

  console.log('[WizardOrchestrator:Step2] Spread line calculation:', {
    sportsbooks: sportsbooks.length,
    spreadLines,
    avgSpreadLine,
    favTeam,
    booksConsidered: spreadLines.length
  })

  // Build snapshot from game data
  const snapshot = {
    game_id: game.id,
    sport: sport as 'NBA',
    home_team: homeTeam,
    away_team: awayTeam,
    start_time_utc: gameData.game_time || new Date().toISOString(),
    captured_at_utc: new Date().toISOString(),
    books_considered: sportsbooks.length,
    moneyline: gameData.odds?.moneyline || { home_avg: -150, away_avg: 130 },
    spread: { fav_team: favTeam, line: avgSpreadLine, odds: -110 },
    total: { line: avgTotalLine, over_odds: -110, under_odds: -110 },
    raw_payload: gameData.odds || {}
  }

  return {
    snapshot_id: `snapshot_${runId}`,
    is_active: true,
    snapshot
  }
}

/**
 * Step 3: Compute factors (F1-F5 for TOTALS, S1-S5 for SPREAD)
 */
async function computeFactors(
  runId: string,
  teams: { home: string; away: string },
  sport: string,
  betType: string,
  aiProvider: string,
  newsWindowHours: number
) {
  const supabase = getSupabaseAdmin()

  // Get factor weights from profile
  // NOTE: These are weight PERCENTAGES (0-100), not decimal weights
  // NO FALLBACK WEIGHTS - must be configured in UI (except Edge vs Market which is always 100%)
  let factorWeights: Record<string, number> = {}

  // Query for SHIVA profile (uppercase, removed is_active filter since all profiles are inactive)
  const { data: profileData, error: profileError } = await supabase
    .from('capper_profiles')
    .select('*')
    .eq('capper_id', 'SHIVA')
    .eq('sport', sport)
    .eq('bet_type', betType)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  if (profileError || !profileData?.factors) {
    throw new Error(
      `[WizardOrchestrator] Factor weights not configured! Please configure factor weights in the SHIVA Management UI. ` +
      `Error: ${profileError?.message || 'No factors found in capper_profiles table'}`
    )
  }

  // Convert factors array to weights object
  // factors is an array like: [{ key: 'paceIndex', enabled: true, weight: 50 }, ...]
  for (const factor of profileData.factors) {
    if (factor.enabled && factor.key !== 'edgeVsMarket' && factor.key !== 'edgeVsMarketSpread') {
      factorWeights[factor.key] = factor.weight
    }
  }

  // Validate that we have weights
  if (Object.keys(factorWeights).length === 0) {
    throw new Error(
      `[WizardOrchestrator] No enabled factors found in profile! Please configure factor weights in the SHIVA Management UI.`
    )
  }

  console.log('[WizardOrchestrator] Loaded factor weights from capper_profiles:', factorWeights)

  // Compute factors based on bet type
  const ctx = {
    game_id: runId,
    away: teams.away,
    home: teams.home,
    sport: sport as 'NBA',
    betType: betType as 'TOTAL' | 'SPREAD',
    leagueAverages: {
      pace: 100.0,
      ORtg: 110.0,
      DRtg: 110.0,
      threePAR: 0.35,
      FTr: 0.25,
      threePstdev: 0.05
    },
    factorWeights
  }

  let result: any
  let factorVersion: string

  if (betType === 'TOTAL') {
    // Import and use TOTALS orchestrator
    const { computeTotalsFactors } = await import('@/lib/cappers/shiva-v1/factors/nba-totals-orchestrator')
    result = await computeTotalsFactors(ctx)
    factorVersion = 'nba_totals_v1'
  } else if (betType === 'SPREAD') {
    // Import and use SPREAD orchestrator
    const { computeSpreadFactors } = await import('@/lib/cappers/shiva-v1/factors/nba-spread-orchestrator')
    result = await computeSpreadFactors(ctx)
    factorVersion = 'nba_spread_v1'
  } else {
    throw new Error(`[WizardOrchestrator] Unsupported bet type: ${betType}`)
  }

  return {
    factors: result.factors || [],
    factorWeights,
    factor_version: factorVersion,
    baseline_avg: result.baseline_avg || (betType === 'TOTAL' ? 220 : 0) // TOTALS: 220, SPREAD: 0
  }
}

/**
 * Step 4: Generate predictions
 */
async function generatePredictions(runId: string, step3Result: any, sport: string, betType: string) {
  const { calculateConfidence } = await import('@/lib/cappers/shiva-v1/confidence-calculator')

  if (!step3Result?.factors || step3Result.factors.length === 0) {
    throw new Error('No factors available for prediction generation')
  }

  // Calculate confidence using the factors (F1-F5 for TOTALS, S1-S5 for SPREAD)
  const confSource = betType === 'TOTAL' ? 'nba_totals_v1' : 'nba_spread_v1'
  const confidenceResult = calculateConfidence({
    factors: step3Result.factors,
    factorWeights: step3Result.factorWeights || {},
    confSource
  })

  // baseline_avg comes from Step 3 factor computation
  // TOTALS: awayPPG + homePPG (e.g., 220)
  // SPREAD: 0 (no inherent advantage)
  const baselineAvg = step3Result.baseline_avg || (betType === 'TOTAL' ? 220 : 0)

  if (betType === 'TOTAL') {
    // TOTALS: Calculate predicted total
    // edgeRaw is the net confidence (overScore - underScore), typically in range [-10, +10]
    // We scale by 2.0 to convert confidence points to total points adjustment
    // Example: edgeRaw = +5.0 → adjustment = +10 points → predicted = 230 (if baseline = 220)
    const factorAdjustment = confidenceResult.edgeRaw * 2.0
    const predictedTotal = Math.max(180, Math.min(280, baselineAvg + factorAdjustment))

    console.log('[WizardOrchestrator:Step4] TOTALS Prediction calculation:', {
      baselineAvg,
      edgeRaw: confidenceResult.edgeRaw,
      factorAdjustment,
      predictedTotal
    })

    return {
      run_id: runId,
      predictions: {
        pace_exp: 100.0,
        delta_100: 0.0,
        spread_pred_points: 0.0,
        total_pred_points: predictedTotal,
        scores: {
          home: predictedTotal / 2 + 2,
          away: predictedTotal / 2 - 2
        },
        winner: 'TBD',
        conf7_score: confidenceResult.confScore
      },
      confidence: confidenceResult,
      conf_source: confSource
    }
  } else if (betType === 'SPREAD') {
    // SPREAD: Calculate predicted margin
    // edgeRaw is the net confidence (awayScore - homeScore), typically in range [-10, +10]
    // Positive edgeRaw = away team favored, negative = home team favored
    // We scale by 1.5 to convert confidence points to margin points
    // Example: edgeRaw = +5.0 → margin = +7.5 (away favored by 7.5)
    const predictedMargin = confidenceResult.edgeRaw * 1.5

    // Calculate predicted scores based on margin
    // Assume average NBA game total is ~220 points (only used for score distribution, NOT for total prediction)
    const avgGameTotal = 220
    const predictedAwayScore = (avgGameTotal / 2) + (predictedMargin / 2)
    const predictedHomeScore = (avgGameTotal / 2) - (predictedMargin / 2)

    // Determine winner based on margin
    const winner = predictedMargin > 0 ? 'AWAY' : 'HOME'

    console.log('[WizardOrchestrator:Step4] SPREAD Prediction calculation:', {
      baselineAvg,
      edgeRaw: confidenceResult.edgeRaw,
      predictedMargin,
      predictedAwayScore,
      predictedHomeScore,
      winner
    })

    return {
      run_id: runId,
      predictions: {
        pace_exp: 100.0,
        delta_100: 0.0,
        spread_pred_points: predictedMargin,
        total_pred_points: null, // NULL for SPREAD picks (only used for TOTALS)
        scores: {
          away: predictedAwayScore,
          home: predictedHomeScore
        },
        winner,
        conf7_score: confidenceResult.confScore
      },
      confidence: confidenceResult,
      conf_source: confSource
    }
  } else {
    throw new Error(`[WizardOrchestrator] Unsupported bet type in generatePredictions: ${betType}`)
  }
}

/**
 * Helper: Create Edge vs Market factor
 * This factor has 100% weight and max 5.0 points
 */
function createEdgeVsMarketFactor(predictedTotal: number, marketTotalLine: number, marketEdgePts: number) {
  const MAX_POINTS = 5.0

  // Calculate signal: normalize edge by market total
  // Example: +4.1 pts on 238.5 line = +1.72% edge
  const edgePct = marketEdgePts / marketTotalLine

  // Scale signal to [-1, 1] range using tanh
  // This gives smooth saturation for extreme edges
  const signal = Math.tanh(edgePct * 10) // Scale by 10 to make ±10% edge approach ±1.0

  // Convert to overScore/underScore based on MAX_POINTS
  let overScore = 0
  let underScore = 0

  if (signal > 0) {
    // Positive edge favors OVER
    overScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative edge favors UNDER
    underScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    key: 'edgeVsMarket',
    name: 'Edge vs Market',
    factor_no: 6,
    normalized_value: signal,
    weight_total_pct: 100, // 100% weight (fixed)
    raw_values_json: {
      predictedTotal,
      marketTotal: marketTotalLine,
      edgePts: marketEdgePts,
      edgePct: edgePct * 100
    },
    parsed_values_json: {
      signal,
      overScore,
      underScore,
      edgePts: marketEdgePts
    },
    notes: `Edge: ${marketEdgePts > 0 ? '+' : ''}${marketEdgePts.toFixed(1)} pts (Pred: ${predictedTotal.toFixed(1)} vs Mkt: ${marketTotalLine})`,
    caps_applied: Math.abs(signal) >= 0.99,
    cap_reason: Math.abs(signal) >= 0.99 ? 'signal saturated' : null
  }
}

/**
 * Helper: Create Edge vs Market Spread factor (SPREAD)
 * This factor has 100% weight and max 5.0 points
 */
function createEdgeVsMarketSpreadFactor(predictedMargin: number, marketSpread: number, marketEdgePts: number) {
  const MAX_POINTS = 5.0

  // Calculate signal: normalize edge by typical spread range
  // For spreads, we use a smaller divisor (3.0) because spread edges are more significant
  // Example: +3.0 pts edge on -4.5 spread is a big deal
  const signal = Math.tanh(marketEdgePts / 3.0) // Scale by 3 for spread sensitivity

  // Convert to awayScore/homeScore based on MAX_POINTS
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive edge = away team has value
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative edge = home team has value
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    key: 'edgeVsMarketSpread',
    name: 'Edge vs Market - Spread',
    factor_no: 6,
    normalized_value: signal,
    weight_total_pct: 100, // 100% weight (fixed)
    raw_values_json: {
      predictedMargin,
      marketSpread,
      edgePts: marketEdgePts,
      edgePct: (marketEdgePts / Math.abs(marketSpread || 1)) * 100
    },
    parsed_values_json: {
      signal,
      awayScore,
      homeScore,
      edgePts: marketEdgePts
    },
    notes: `Edge: ${marketEdgePts > 0 ? '+' : ''}${marketEdgePts.toFixed(1)} pts (Pred Margin: ${predictedMargin.toFixed(1)} vs Mkt Spread: ${marketSpread})`,
    caps_applied: Math.abs(signal) >= 0.99,
    cap_reason: Math.abs(signal) >= 0.99 ? 'signal saturated' : null
  }
}

/**
 * Step 7: Finalize pick
 */
async function finalizePick(
  runId: string,
  finalConfidence: number,
  predictedValue: number,
  marketLine: number,
  pickDirection: string,
  oddsSnapshot: any,
  betType: string
) {
  // Determine units based on confidence
  // New thresholds: Higher confidence required for picks
  let units = 0
  if (finalConfidence > 9.0) units = 5      // 5 units (max)
  else if (finalConfidence > 8.0) units = 4  // 4 units
  else if (finalConfidence > 7.0) units = 3  // 3 units
  else if (finalConfidence > 6.0) units = 2  // 2 units
  else if (finalConfidence > 5.0) units = 1  // 1 unit
  // else units = 0 (PASS - confidence ≤ 5.0)

  const decision = units > 0 ? 'PICK' : 'PASS'

  // Format selection based on bet type
  let selection: string
  if (betType === 'TOTAL') {
    selection = `${pickDirection} ${marketLine}`
  } else if (betType === 'SPREAD') {
    // pickDirection is team name for SPREAD
    selection = `${pickDirection} ${marketLine > 0 ? '+' : ''}${marketLine}`
  } else {
    selection = pickDirection
  }

  const pick = units > 0 ? {
    id: `pick_${runId}`,
    run_id: runId,
    pick_type: betType,
    selection,
    units,
    confidence: finalConfidence,
    locked_odds: oddsSnapshot,
    locked_at: new Date().toISOString()
  } : null

  console.log('[WizardOrchestrator:Step7] Pick decision:', {
    decision,
    betType,
    confidence: finalConfidence,
    units,
    selection: pick?.selection
  })

  return {
    run_id: runId,
    decision,
    confidence: finalConfidence,
    pick
  }
}

