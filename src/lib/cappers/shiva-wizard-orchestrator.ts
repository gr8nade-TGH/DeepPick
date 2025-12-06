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
  capperId?: string
  sport?: 'NBA' | 'NFL' | 'MLB'
  betType?: 'TOTAL' | 'SPREAD'
  aiProvider?: 'perplexity' | 'openai'
  newsWindowHours?: number
  factorConfig?: {
    weights: Record<string, number>
    enabled_factors: string[]
    baseline_model?: string // For pick diversity - different models produce different predictions
    ai_archetype?: 'pulse' | 'influencer' | 'interpreter' | 'mathematician'  // Grok-powered personality
  }
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
    step5_5?: any  // AI Archetype factor (Grok-powered)
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
  const { game, runId, capperId = 'SHIVA', sport = 'NBA', betType = 'TOTAL', aiProvider = 'perplexity', newsWindowHours = 24, factorConfig } = input

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
    steps.step2 = await captureOddsSnapshot(runId, game, sport, betType)
    console.log('[WizardOrchestrator] Step 2: Odds snapshot captured')

    // Step 3: Factor Analysis (F1-F5)
    console.log('[WizardOrchestrator] Step 3: Computing factors...')
    steps.step3 = await computeFactors(runId, { home: homeTeam, away: awayTeam }, sport, betType, capperId, aiProvider, newsWindowHours, factorConfig)
    console.log('[WizardOrchestrator] Step 3: Factors computed:', steps.step3.factors?.length || 0, 'factors')

    // Step 0 (Pre-Analysis): AI Archetype Baseline Adjustment
    // Run archetype BEFORE Step 4 to influence baseline calculation
    // This enables pick diversity - different archetypes shift the baseline differently
    const aiArchetype = factorConfig?.ai_archetype
    let archetypeBaselineAdjustment = 0
    let cachedArchetypeResult: any = null

    if (aiArchetype) {
      console.log('[WizardOrchestrator] Step 0: Running AI Archetype pre-analysis:', aiArchetype)

      try {
        const aiArchetypeResult = await executeAIArchetype({
          archetype: aiArchetype,
          awayTeam,
          homeTeam,
          betType,
          spread: steps.step2.snapshot?.spread,
          total: steps.step2.snapshot?.total?.line,
          gameDate: game.game_time || new Date().toISOString()
        })

        if (aiArchetypeResult.success) {
          // Extract baseline adjustment from archetype result
          const adjustment = aiArchetypeResult.baselineAdjustment
          if (adjustment) {
            archetypeBaselineAdjustment = adjustment.value || 0
            console.log('[WizardOrchestrator] Step 0: Archetype baseline adjustment:', {
              archetype: aiArchetype,
              adjustment: archetypeBaselineAdjustment,
              direction: adjustment.direction,
              reasoning: adjustment.reasoning
            })
          }

          // Cache the full result for Step 5.5 (avoid re-running AI)
          cachedArchetypeResult = aiArchetypeResult

          steps.step0 = {
            run_id: runId,
            archetype: aiArchetype,
            baselineAdjustment: archetypeBaselineAdjustment,
            adjustmentDetails: adjustment,
            cachedForStep5_5: true
          }
        } else {
          console.warn('[WizardOrchestrator] Step 0: Archetype failed, proceeding without adjustment:', aiArchetypeResult.error)
        }
      } catch (error) {
        console.error('[WizardOrchestrator] Step 0: Archetype error:', error)
      }
    }

    // Step 4: Score Predictions
    // IMPORTANT: Use Vegas market line as baseline instead of calculated team stats
    // This ensures all cappers start from the same anchor (market consensus)
    // Factor adjustments then move the prediction away from market
    const marketBaseline = betType === 'TOTAL'
      ? (steps.step2.snapshot?.total?.line || 220)
      : (steps.step2.snapshot?.spread?.away_spread || 0)

    // Get baseline model from factor config (for pick diversity)
    const baselineModel = factorConfig?.baseline_model
    console.log('[WizardOrchestrator] Step 4: Generating predictions with Vegas baseline:', { marketBaseline, betType, baselineModel, archetypeBaselineAdjustment })
    steps.step4 = await generatePredictions(runId, steps.step3, sport, betType, game, marketBaseline, baselineModel, archetypeBaselineAdjustment)
    console.log('[WizardOrchestrator] Step 4: Predictions generated')

    // Step 5: Market Edge Adjustment
    console.log('[WizardOrchestrator] Step 5: Calculating market edge...')

    let edgeVsMarketFactor: any
    let finalConfidence: number
    let baseConfidence: number
    let pickDirection: string
    let marketEdgePts: number
    let isAwayPick = false // Only used for SPREAD picks

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

      // Determine pick direction based on WHO COVERS THE SPREAD (not who wins outright)
      // predictedMargin: positive = home wins by X, negative = away wins by |X|
      // marketSpread: negative = home favored (e.g., -6.5), positive = away favored
      const awayTeam = typeof game.away_team === 'string' ? game.away_team : game.away_team.name
      const homeTeam = typeof game.home_team === 'string' ? game.home_team : game.home_team.name

      // For SPREAD betting: Pick based on who COVERS, not who wins
      // predictedMargin: positive = home wins by X, negative = away wins by |X|
      // marketSpread: negative = home favored (e.g., -6.5), positive = away favored (e.g., +3.5 means away is -3.5)
      const spreadAbs = Math.abs(marketSpread)
      let coverReason = ''

      if (marketSpread < 0) {
        // HOME is favorite (e.g., marketSpread = -6.5)
        // HOME covers if they win by MORE than |spread|
        // AWAY covers if HOME wins by LESS than |spread| OR AWAY wins outright
        if (predictedMargin < 0) {
          // Away wins outright - covers as underdog
          isAwayPick = true
          coverReason = `Away wins outright (by ${Math.abs(predictedMargin).toFixed(1)}) - covers as underdog`
        } else if (predictedMargin < spreadAbs) {
          // Home wins but doesn't cover their spread
          isAwayPick = true
          coverReason = `Home wins by ${predictedMargin.toFixed(1)} but spread is ${spreadAbs} - away covers`
        } else {
          // Home wins and covers their spread
          isAwayPick = false
          coverReason = `Home wins by ${predictedMargin.toFixed(1)} and covers spread of ${spreadAbs}`
        }
      } else {
        // AWAY is favorite (e.g., marketSpread = +3.5 means away is -3.5)
        // AWAY covers if they win by MORE than spread
        // HOME covers if AWAY wins by LESS than spread OR HOME wins outright
        if (predictedMargin > 0) {
          // Home wins outright - covers as underdog
          isAwayPick = false
          coverReason = `Home wins outright (by ${predictedMargin.toFixed(1)}) - covers as underdog vs favorite away`
        } else if (Math.abs(predictedMargin) < spreadAbs) {
          // Away wins but doesn't cover their spread
          isAwayPick = false
          coverReason = `Away wins by ${Math.abs(predictedMargin).toFixed(1)} but spread is ${spreadAbs} - home covers`
        } else {
          // Away wins and covers their spread
          isAwayPick = true
          coverReason = `Away wins by ${Math.abs(predictedMargin).toFixed(1)} and covers spread of ${spreadAbs}`
        }
      }
      pickDirection = isAwayPick ? awayTeam : homeTeam

      console.log('[WizardOrchestrator] SPREAD pick direction:', {
        predictedMargin,
        marketSpread,
        spreadAbs,
        homeFavorite: marketSpread < 0,
        isAwayPick,
        pickDirection,
        reason: coverReason
      })

      // Calculate edge: how much better is HOME than market expects?
      // predictedMargin: positive = home wins by X, negative = away wins by |X|
      // marketSpread: positive = away favored (home underdog by X), negative = home favored
      //
      // Examples:
      // - Mkt=+8.5 (home +8.5 underdog), Pred=-4.8 (away wins by 4.8)
      //   Market expects home to lose by 8.5, we predict home loses by 4.8
      //   Edge = -4.8 - (-8.5) = +3.7 (home is 3.7 pts better than market → value on home)
      //
      // - Mkt=-6.5 (home -6.5 favorite), Pred=+2.0 (home wins by 2.0)
      //   Market expects home to win by 6.5, we predict home wins by 2.0
      //   Edge = 2.0 - 6.5 = -4.5 (home is 4.5 pts worse than market → value on away)
      //
      // Formula: Edge = predictedMargin - (-marketSpread) = predictedMargin + marketSpread
      marketEdgePts = predictedMargin + marketSpread

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

    // Step 5.5: AI Archetype Factor (Grok-powered personality layer)
    // This adds 0-5 points to one side based on the capper's selected AI archetype
    // NOTE: The AI was already called in Step 0 - we use the cached result here
    let aiArchetypeFactor: any = null
    let step5_5Confidence = finalConfidence

    if (aiArchetype && cachedArchetypeResult) {
      console.log('[WizardOrchestrator] Step 5.5: Using cached AI Archetype result from Step 0:', aiArchetype)

      try {
        // Use the cached result from Step 0 (no re-run needed)
        if (cachedArchetypeResult.success && cachedArchetypeResult.factor) {
          aiArchetypeFactor = cachedArchetypeResult.factor

          // Add AI Archetype factor to the factors array and recalculate confidence
          const allFactorsWithArchetype = [
            ...(steps.step5.confidenceResult?.factorContributions || []),
            aiArchetypeFactor
          ]

          // Recalculate confidence with AI Archetype included
          const { calculateConfidence } = await import('@/lib/cappers/shiva-v1/confidence-calculator')
          const factorWeightsWithArchetype = {
            ...steps.step3.factorWeights,
            edgeVsMarket: 100,
            edgeVsMarketSpread: 100,
            aiArchetype: 100  // 100% weight (fixed)
          }
          const confSource = betType === 'TOTAL' ? 'nba_totals_v1' : 'nba_spread_v1'
          const confidenceWithArchetype = calculateConfidence({
            factors: [...(steps.step3.factors || []), edgeVsMarketFactor, aiArchetypeFactor],
            factorWeights: factorWeightsWithArchetype,
            confSource
          })

          step5_5Confidence = confidenceWithArchetype.confScore

          steps.step5_5 = {
            run_id: runId,
            archetype: aiArchetype,
            factor: aiArchetypeFactor,
            confidenceBefore: finalConfidence,
            confidenceAfter: step5_5Confidence,
            confidenceResult: confidenceWithArchetype,
            baselineAdjustment: cachedArchetypeResult.baselineAdjustment,  // Include baseline adjustment details
            usedCachedResult: true  // Flag that we used Step 0 cache
          }

          console.log('[WizardOrchestrator] Step 5.5: AI Archetype applied (from cache):', {
            archetype: aiArchetype,
            direction: aiArchetypeFactor.parsed_values_json?.direction,
            points: aiArchetypeFactor.parsed_values_json?.points,
            baselineAdjustment: cachedArchetypeResult.baselineAdjustment?.value || 0,
            confidenceBefore: finalConfidence.toFixed(2),
            confidenceAfter: step5_5Confidence.toFixed(2)
          })
        } else {
          console.log('[WizardOrchestrator] Step 5.5: Cached archetype result has no factor, skipping')
          steps.step5_5 = { skipped: true, reason: cachedArchetypeResult.error || 'No factor in cached result' }
        }
      } catch (archetypeError) {
        console.error('[WizardOrchestrator] Step 5.5: AI Archetype error:', archetypeError)
        steps.step5_5 = { skipped: true, error: archetypeError instanceof Error ? archetypeError.message : 'Unknown error' }
      }
    } else if (aiArchetype && !cachedArchetypeResult) {
      // Fallback: If Step 0 failed but archetype is configured, try running now
      console.log('[WizardOrchestrator] Step 5.5: No cached result, running AI Archetype now:', aiArchetype)

      try {
        const aiArchetypeResult = await executeAIArchetype({
          archetype: aiArchetype,
          awayTeam,
          homeTeam,
          betType,
          spread: steps.step2.snapshot?.spread,
          total: steps.step2.snapshot?.total?.line,
          gameDate: game.game_time || new Date().toISOString()
        })

        if (aiArchetypeResult.success && aiArchetypeResult.factor) {
          aiArchetypeFactor = aiArchetypeResult.factor

          const { calculateConfidence } = await import('@/lib/cappers/shiva-v1/confidence-calculator')
          const factorWeightsWithArchetype = {
            ...steps.step3.factorWeights,
            edgeVsMarket: 100,
            edgeVsMarketSpread: 100,
            aiArchetype: 100
          }
          const confSource = betType === 'TOTAL' ? 'nba_totals_v1' : 'nba_spread_v1'
          const confidenceWithArchetype = calculateConfidence({
            factors: [...(steps.step3.factors || []), edgeVsMarketFactor, aiArchetypeFactor],
            factorWeights: factorWeightsWithArchetype,
            confSource
          })

          step5_5Confidence = confidenceWithArchetype.confScore

          steps.step5_5 = {
            run_id: runId,
            archetype: aiArchetype,
            factor: aiArchetypeFactor,
            confidenceBefore: finalConfidence,
            confidenceAfter: step5_5Confidence,
            confidenceResult: confidenceWithArchetype,
            baselineAdjustment: aiArchetypeResult.baselineAdjustment,
            usedCachedResult: false  // Flag that we ran fresh (Step 0 failed)
          }

          console.log('[WizardOrchestrator] Step 5.5: AI Archetype applied (fresh run):', {
            archetype: aiArchetype,
            direction: aiArchetypeFactor.parsed_values_json?.direction,
            points: aiArchetypeFactor.parsed_values_json?.points,
            confidenceBefore: finalConfidence.toFixed(2),
            confidenceAfter: step5_5Confidence.toFixed(2)
          })
        } else {
          steps.step5_5 = { skipped: true, reason: aiArchetypeResult.error || 'No factor returned' }
        }
      } catch (archetypeError) {
        console.error('[WizardOrchestrator] Step 5.5: AI Archetype error:', archetypeError)
        steps.step5_5 = { skipped: true, error: archetypeError instanceof Error ? archetypeError.message : 'Unknown error' }
      }
    } else {
      console.log('[WizardOrchestrator] Step 5.5: No AI Archetype configured, skipping')
      steps.step5_5 = { skipped: true, reason: 'No AI archetype configured' }
    }

    // Update finalConfidence to include AI Archetype contribution
    finalConfidence = step5_5Confidence

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

    steps.step7 = await finalizePick(runId, finalConfidence, predictedValue, marketLine, pickDirection, steps.step2.snapshot, betType, isAwayPick)
    console.log('[WizardOrchestrator] Step 7: Pick finalized')

    // Build result
    // CRITICAL: Use factorContributions from Step 5.5 if AI Archetype was applied,
    // otherwise fall back to Step 5 confidence calculation
    // This includes weighted scores (overScore, underScore) for run log display
    // The confidence calculator already computed these with proper weights applied
    let factorContributions = steps.step5.confidenceResult?.factorContributions || []

    // If AI Archetype was applied, use the updated factor contributions from Step 5.5
    if (steps.step5_5?.confidenceResult?.factorContributions) {
      factorContributions = steps.step5_5.confidenceResult.factorContributions
    } else if (aiArchetypeFactor) {
      // Fallback: manually add AI Archetype factor if confidence wasn't recalculated
      factorContributions = [...factorContributions, aiArchetypeFactor]
    }

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
 * @param betType - Required to validate only the relevant odds (TOTAL line for TOTAL picks, SPREAD line for SPREAD picks)
 */
async function captureOddsSnapshot(runId: string, game: any, sport: string, betType: 'TOTAL' | 'SPREAD' = 'TOTAL') {
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

  // REQUIRE valid total line data for TOTAL picks - no fallbacks!
  if (betType === 'TOTAL' && totalLines.length === 0) {
    throw new Error(`No valid total line data available from sportsbooks. Cannot generate TOTAL pick without accurate market odds. Game: ${homeTeam} vs ${awayTeam}`)
  }

  // REQUIRE minimum number of books for consensus (for TOTAL picks)
  if (betType === 'TOTAL' && totalLines.length > 0 && totalLines.length < 2) {
    console.warn('[WizardOrchestrator:Step2] ⚠️ Only 1 sportsbook has total line - may be soft/stale line')
  }

  // Calculate average total line (use 0 as default for SPREAD picks where total isn't required)
  const avgTotalLine = totalLines.length > 0
    ? parseFloat((totalLines.reduce((a, b) => a + b, 0) / totalLines.length).toFixed(1))
    : 0

  // Calculate line variance to detect disagreement between books (only if we have total lines)
  const minTotalLine = totalLines.length > 0 ? Math.min(...totalLines) : 0
  const maxTotalLine = totalLines.length > 0 ? Math.max(...totalLines) : 0
  const totalLineVariance = maxTotalLine - minTotalLine

  // Flag suspicious variance (books disagree by >2 points) - only for TOTAL picks
  if (betType === 'TOTAL' && totalLineVariance > 2.0) {
    console.warn('[WizardOrchestrator:Step2] ⚠️ High total line variance detected:', {
      minLine: minTotalLine,
      maxLine: maxTotalLine,
      variance: totalLineVariance,
      avgLine: avgTotalLine,
      warning: 'Books disagree significantly - possible line movement or stale data'
    })
  }

  if (totalLines.length > 0) {
    console.log('[WizardOrchestrator:Step2] Total line calculation:', {
      sportsbooks: sportsbooks.length,
      totalLines,
      avgTotalLine,
      minLine: minTotalLine,
      maxLine: maxTotalLine,
      variance: totalLineVariance,
      booksConsidered: totalLines.length
    })
  }

  // Calculate average spread line from all sportsbooks
  const spreadLines = sportsbooks
    .map(book => odds[book]?.spread?.line)
    .filter(line => line !== undefined && line !== null)

  // REQUIRE valid spread data for SPREAD picks - no fallbacks!
  if (betType === 'SPREAD' && spreadLines.length === 0) {
    throw new Error(`No valid spread line data available from sportsbooks. Cannot generate SPREAD pick without accurate market odds. Game: ${homeTeam} vs ${awayTeam}`)
  }

  // REQUIRE minimum number of books for consensus (for SPREAD picks)
  if (betType === 'SPREAD' && spreadLines.length > 0 && spreadLines.length < 2) {
    console.warn('[WizardOrchestrator:Step2] ⚠️ Only 1 sportsbook has spread line - may be soft/stale line')
  }

  // Calculate average spread line (use 0 as default for TOTAL picks where spread isn't required)
  const avgSpreadLine = spreadLines.length > 0
    ? parseFloat((spreadLines.reduce((a, b) => a + b, 0) / spreadLines.length).toFixed(1))
    : 0

  // Calculate line variance to detect disagreement between books (only if we have spread lines)
  const minSpreadLine = spreadLines.length > 0 ? Math.min(...spreadLines) : 0
  const maxSpreadLine = spreadLines.length > 0 ? Math.max(...spreadLines) : 0
  const spreadLineVariance = maxSpreadLine - minSpreadLine

  // Flag suspicious variance (books disagree by >1.5 points) - only for SPREAD picks
  if (betType === 'SPREAD' && spreadLineVariance > 1.5) {
    console.warn('[WizardOrchestrator:Step2] ⚠️ High spread line variance detected:', {
      minLine: minSpreadLine,
      maxLine: maxSpreadLine,
      variance: spreadLineVariance,
      avgLine: avgSpreadLine,
      warning: 'Books disagree significantly - possible line movement or stale data'
    })
  }

  // Determine favored team based on average spread
  // Negative spread = home team favored, positive = away team favored
  const favTeam = avgSpreadLine < 0 ? homeTeam : awayTeam

  if (spreadLines.length > 0) {
    console.log('[WizardOrchestrator:Step2] Spread line calculation:', {
      sportsbooks: sportsbooks.length,
      spreadLines,
      avgSpreadLine,
      minLine: minSpreadLine,
      maxLine: maxSpreadLine,
      variance: spreadLineVariance,
      favTeam,
      booksConsidered: spreadLines.length
    })
  }

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
  capperId: string,
  aiProvider: string,
  newsWindowHours: number,
  factorConfig?: { weights: Record<string, number>; enabled_factors: string[] }
) {
  const supabase = getSupabaseAdmin()

  // Get factor weights from profile OR use provided factorConfig
  // NOTE: These are weight PERCENTAGES (0-100), not decimal weights
  // NO FALLBACK WEIGHTS - must be configured in UI (except Edge vs Market which is always 100%)
  let factorWeights: Record<string, number> = {}

  if (factorConfig) {
    // Use provided factor config (from user_cappers table)
    console.log('[WizardOrchestrator] Using provided factor config:', factorConfig)
    factorWeights = factorConfig.weights
  } else {
    // Query for capper profile (uppercase, removed is_active filter since all profiles are inactive)
    const { data: profileData, error: profileError } = await supabase
      .from('capper_profiles')
      .select('*')
      .eq('capper_id', capperId.toUpperCase())
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
    console.log('[WizardOrchestrator] Raw profile factors from DB:', JSON.stringify(profileData.factors))

    for (const factor of profileData.factors) {
      console.log('[WizardOrchestrator] Processing factor:', { key: factor.key, enabled: factor.enabled, weight: factor.weight })
      if (factor.enabled && factor.key !== 'edgeVsMarket' && factor.key !== 'edgeVsMarketSpread') {
        factorWeights[factor.key] = factor.weight
        console.log('[WizardOrchestrator] Added to factorWeights:', factor.key, '=', factor.weight)
      }
    }

    console.log('[WizardOrchestrator] Final factorWeights object:', JSON.stringify(factorWeights))
    console.log('[WizardOrchestrator] Enabled factor count:', Object.keys(factorWeights).length)
  }

  // Validate that we have weights
  if (Object.keys(factorWeights).length === 0) {
    throw new Error(
      `[WizardOrchestrator] No enabled factors found in profile! Please configure factor weights in the SHIVA Management UI.`
    )
  }

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
    baseline_avg: result.baseline_avg || (betType === 'TOTAL' ? 220 : 0), // TOTALS: 220, SPREAD: 0
    // Pass through stats bundle for baseline projection calculation
    statsBundle: result.statsBundle,
    // Pass through debug info (used for recalibration checks)
    totals_debug: result.totals_debug,
    spread_debug: result.spread_debug
  }
}

// ============================================================================
// BASELINE MODEL TYPES - For Pick Diversity
// ============================================================================
export type TotalsBaselineModel = 'pace-efficiency' | 'ppg-based' | 'matchup-defensive'
export type SpreadBaselineModel = 'net-rating' | 'scoring-margin' | 'h2h-projection'

export const TOTALS_BASELINE_MODELS = {
  'pace-efficiency': {
    name: 'Pace-Efficiency',
    description: 'Uses pace × offensive ratings. Best for: fast-paced teams.',
    icon: '⚡'
  },
  'ppg-based': {
    name: 'PPG Average',
    description: 'Uses raw scoring averages. Best for: consistent scorers.',
    icon: '📊'
  },
  'matchup-defensive': {
    name: 'Matchup-Defensive',
    description: 'Weights opponent defense heavily. Best for: elite defenses.',
    icon: '🛡️'
  }
}

export const SPREAD_BASELINE_MODELS = {
  'net-rating': {
    name: 'Net Rating',
    description: 'Uses efficiency differential (ORtg - DRtg).',
    icon: '📈'
  },
  'scoring-margin': {
    name: 'Scoring Margin',
    description: 'Uses actual point differentials from games.',
    icon: '🎯'
  },
  'h2h-projection': {
    name: 'Head-to-Head',
    description: 'Projects scores vs specific opponent defense.',
    icon: '⚔️'
  }
}

/**
 * Calculate stats-based baseline from team statistics
 *
 * DIVERSITY SYSTEM: Different baseline models produce different predictions,
 * which leads to different Edge vs Market calculations, creating genuine splits.
 *
 * @param statsBundle - NBA stats bundle with team performance data
 * @param betType - 'TOTAL' or 'SPREAD'
 * @param vegasFallback - Vegas line to use if stats are unavailable
 * @param baselineModel - Which baseline calculation model to use (for pick diversity)
 * @returns Stats-based baseline value
 */
function calculateStatsBaseline(
  statsBundle: any,
  betType: string,
  vegasFallback: number,
  baselineModel?: string
): { baseline: number; debug: any } {
  if (!statsBundle) {
    console.warn('[StatsBaseline] No stats bundle available, falling back to Vegas:', vegasFallback)
    return { baseline: vegasFallback, debug: { source: 'vegas_fallback', reason: 'No stats bundle' } }
  }

  const HCA = 2.8 // Home Court Advantage in points
  const LEAGUE_AVG_PPG = 115 // 2024-25 NBA league average PPG

  if (betType === 'TOTAL') {
    const model = (baselineModel as TotalsBaselineModel) || 'pace-efficiency'
    let rawBaseline: number
    let debugInfo: any = { model }

    switch (model) {
      case 'ppg-based': {
        // MODEL 2: PPG-Based - Uses raw scoring averages
        const awayPpg = statsBundle.awayPpg || 110
        const homePpg = statsBundle.homePpg || 110
        const awayOppPpg = statsBundle.awayOppPpg || 110
        const homeOppPpg = statsBundle.homeOppPpg || 110
        const awayVsHomeDef = awayPpg + (homeOppPpg - LEAGUE_AVG_PPG)
        const homeVsAwayDef = homePpg + (awayOppPpg - LEAGUE_AVG_PPG)
        rawBaseline = awayVsHomeDef + homeVsAwayDef
        debugInfo = { ...debugInfo, awayPpg, homePpg, awayOppPpg, homeOppPpg, rawBaseline: rawBaseline.toFixed(1) }
        break
      }
      case 'matchup-defensive': {
        // MODEL 3: Matchup-Defensive - Weights defense more heavily
        const expPace = (statsBundle.awayPaceLast10 + statsBundle.homePaceLast10) / 2
        const awayORtg = statsBundle.awayORtgLast10 || 110
        const homeORtg = statsBundle.homeORtgLast10 || 110
        const awayDRtg = statsBundle.awayDRtgSeason || 110
        const homeDRtg = statsBundle.homeDRtgSeason || 110
        const awayEffectiveRtg = 0.6 * awayORtg + 0.4 * homeDRtg
        const homeEffectiveRtg = 0.6 * homeORtg + 0.4 * awayDRtg
        const awayExpPts = (expPace * awayEffectiveRtg) / 100
        const homeExpPts = (expPace * homeEffectiveRtg) / 100
        rawBaseline = awayExpPts + homeExpPts
        debugInfo = { ...debugInfo, expPace: expPace.toFixed(1), awayEffectiveRtg: awayEffectiveRtg.toFixed(1), homeEffectiveRtg: homeEffectiveRtg.toFixed(1), rawBaseline: rawBaseline.toFixed(1) }
        break
      }
      case 'pace-efficiency':
      default: {
        // MODEL 1: Pace-Efficiency (Default)
        const expPace = (statsBundle.awayPaceLast10 + statsBundle.homePaceLast10) / 2
        const awayExpPts = (expPace * statsBundle.awayORtgLast10) / 100
        const homeExpPts = (expPace * statsBundle.homeORtgLast10) / 100
        rawBaseline = awayExpPts + homeExpPts
        debugInfo = { ...debugInfo, expPace: expPace.toFixed(1), awayORtg: statsBundle.awayORtgLast10?.toFixed(1), homeORtg: statsBundle.homeORtgLast10?.toFixed(1), rawBaseline: rawBaseline.toFixed(1) }
        break
      }
    }

    // FIX: Regress toward Vegas to avoid systematic OVER bias
    // Raw stats-based calculations tend to overestimate totals by 5-15 points
    // Blend: 80% raw stats + 20% Vegas to stay grounded
    // Reduced from 60% to 20% Vegas to allow more baseline model diversity
    const REGRESSION_WEIGHT = 0.20 // 20% Vegas, 80% stats
    const regressedBaseline = (rawBaseline * (1 - REGRESSION_WEIGHT)) + (vegasFallback * REGRESSION_WEIGHT)

    const baseline = Math.max(180, Math.min(260, regressedBaseline))
    console.log(`[StatsBaseline:TOTALS:${model}]`, {
      ...debugInfo,
      rawBaseline: rawBaseline.toFixed(1),
      vegas: vegasFallback,
      regressionWeight: REGRESSION_WEIGHT,
      regressedBaseline: regressedBaseline.toFixed(1),
      finalBaseline: baseline.toFixed(1)
    })
    return { baseline, debug: { source: 'stats', ...debugInfo, rawBaseline, regressedBaseline, finalBaseline: baseline } }

  } else if (betType === 'SPREAD') {
    const model = (baselineModel as SpreadBaselineModel) || 'net-rating'
    let baseline: number
    let debugInfo: any = { model, HCA }

    switch (model) {
      case 'scoring-margin': {
        // MODEL 2: Scoring Margin - Uses actual point differentials
        const awayPpg = statsBundle.awayPpg || 110
        const awayOppPpg = statsBundle.awayOppPpg || 110
        const homePpg = statsBundle.homePpg || 110
        const homeOppPpg = statsBundle.homeOppPpg || 110
        const awayMargin = awayPpg - awayOppPpg
        const homeMargin = homePpg - homeOppPpg
        const rawBaseline = (homeMargin - awayMargin) + HCA
        baseline = Math.max(-25, Math.min(25, rawBaseline))
        debugInfo = { ...debugInfo, awayMargin: awayMargin.toFixed(1), homeMargin: homeMargin.toFixed(1), baseline: baseline.toFixed(1) }
        break
      }
      case 'h2h-projection': {
        // MODEL 3: Head-to-Head Projection
        const awayPpg = statsBundle.awayPpg || 110
        const homePpg = statsBundle.homePpg || 110
        const awayOppPpg = statsBundle.awayOppPpg || LEAGUE_AVG_PPG
        const homeOppPpg = statsBundle.homeOppPpg || LEAGUE_AVG_PPG
        const awayProjectedScore = awayPpg + (homeOppPpg - LEAGUE_AVG_PPG)
        const homeProjectedScore = homePpg + (awayOppPpg - LEAGUE_AVG_PPG) + (HCA / 2)
        const rawBaseline = (homeProjectedScore - awayProjectedScore) + (HCA / 2)
        baseline = Math.max(-25, Math.min(25, rawBaseline))
        debugInfo = { ...debugInfo, awayProjected: awayProjectedScore.toFixed(1), homeProjected: homeProjectedScore.toFixed(1), baseline: baseline.toFixed(1) }
        break
      }
      case 'net-rating':
      default: {
        // MODEL 1: Net Rating (Default)
        const awayNetRtg = statsBundle.awayORtgLast10 - statsBundle.awayDRtgSeason
        const homeNetRtg = statsBundle.homeORtgLast10 - statsBundle.homeDRtgSeason
        const netRtgDiff = awayNetRtg - homeNetRtg
        const clampedNetRtgDiff = Math.max(-20, Math.min(20, netRtgDiff))
        baseline = -clampedNetRtgDiff + HCA
        debugInfo = { ...debugInfo, awayNetRtg: awayNetRtg.toFixed(1), homeNetRtg: homeNetRtg.toFixed(1), baseline: baseline.toFixed(1) }
        break
      }
    }

    const interpretation = baseline > 0 ? `Home favored by ${baseline.toFixed(1)} pts` : `Away favored by ${Math.abs(baseline).toFixed(1)} pts`
    console.log(`[StatsBaseline:SPREAD:${model}]`, { ...debugInfo, interpretation })
    return { baseline, debug: { source: 'stats', ...debugInfo, interpretation } }
  }

  console.warn('[StatsBaseline] Unknown bet type:', betType)
  return { baseline: vegasFallback, debug: { source: 'vegas_fallback', reason: `Unknown bet type: ${betType}` } }
}

/**
 * Step 4: Generate predictions
 *
 * NEW: Uses stats-based baseline instead of Vegas market line.
 * This enables pick diversity - different cappers with different factor weights
 * will produce different predictions that may land on opposite sides of Vegas.
 *
 * The Edge vs Market factor (Step 5) then captures the TRUE edge:
 * how far our stats-based prediction differs from market consensus.
 */
async function generatePredictions(runId: string, step3Result: any, sport: string, betType: string, game?: any, vegasLine?: number, baselineModel?: string, archetypeBaselineAdjustment: number = 0) {
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

  // NEW: Calculate STATS-BASED BASELINE instead of using Vegas
  // This enables pick diversity - different cappers will produce different predictions
  // The baselineModel parameter determines which calculation method to use
  const vegasFallback = vegasLine ?? (betType === 'TOTAL' ? 220 : 0)
  const { baseline: rawStatsBaseline, debug: baselineDebug } = calculateStatsBaseline(
    step3Result.statsBundle,
    betType,
    vegasFallback,
    baselineModel
  )

  // Apply AI Archetype baseline adjustment (Step 0)
  // This shifts the baseline BEFORE factor adjustments are applied
  // Positive adjustment = shift toward OVER/AWAY, Negative = shift toward UNDER/HOME
  const statsBaseline = rawStatsBaseline + archetypeBaselineAdjustment
  if (archetypeBaselineAdjustment !== 0) {
    console.log('[WizardOrchestrator:Step4] Archetype baseline adjustment applied:', {
      rawBaseline: rawStatsBaseline.toFixed(2),
      adjustment: archetypeBaselineAdjustment,
      adjustedBaseline: statsBaseline.toFixed(2)
    })
    baselineDebug.archetypeAdjustment = archetypeBaselineAdjustment
    baselineDebug.rawBaseline = rawStatsBaseline
  }

  // Extract team names for winner field
  const awayTeamName = game ? (typeof game.away_team === 'string' ? game.away_team : game.away_team?.name) : 'AWAY'
  const homeTeamName = game ? (typeof game.home_team === 'string' ? game.home_team : game.home_team?.name) : 'HOME'

  if (betType === 'TOTAL') {
    // TOTALS: Calculate predicted total using STATS BASELINE
    // Step 1: Start with STATS-BASED BASELINE (pace + efficiency projection)
    // Step 2: Add factor adjustment (edgeRaw = overScore - underScore from F1-F5)
    // Step 3: Edge vs Market compares this prediction to Vegas in Step 5
    //
    // Example: Stats baseline = 228, edgeRaw = +3.0 → predicted = 231
    //          Vegas = 223.5 → Edge = +7.5 (strong OVER)
    const factorAdjustment = confidenceResult.edgeRaw
    const predictedTotal = Math.max(180, Math.min(280, statsBaseline + factorAdjustment))

    console.log('[WizardOrchestrator:Step4] TOTALS Prediction calculation:', {
      statsBaseline: statsBaseline.toFixed(1),
      vegasLine: vegasFallback,
      baselineSource: baselineDebug.source,
      edgeRaw: confidenceResult.edgeRaw.toFixed(2),
      factorAdjustment: factorAdjustment.toFixed(2),
      predictedTotal: predictedTotal.toFixed(1),
      vsVegas: (predictedTotal - vegasFallback).toFixed(1),
      note: 'Using STATS-BASED baseline for pick diversity'
    })

    return {
      run_id: runId,
      predictions: {
        pace_exp: baselineDebug.expPace || 100.0,
        delta_100: 0.0,
        spread_pred_points: 0.0,
        total_pred_points: predictedTotal,
        scores: {
          home: predictedTotal / 2 + 2,
          away: predictedTotal / 2 - 2
        },
        winner: 'TBD', // TOTALS don't have a winner prediction
        conf7_score: confidenceResult.confScore,
        // NEW: Include baseline debug info for transparency
        baseline_debug: baselineDebug
      },
      confidence: confidenceResult,
      conf_source: confSource
    }
  } else if (betType === 'SPREAD') {
    // SPREAD: Calculate predicted margin using STATS BASELINE
    // Step 1: Start with STATS-BASED BASELINE (net rating + HCA)
    //         statsBaseline = predicted home margin (positive = home wins by X)
    // Step 2: Add factor adjustment (edgeRaw = awayScore - homeScore from S1-S6)
    // Step 3: Edge vs Market compares this prediction to Vegas in Step 5
    //
    // statsBaseline: positive = home favored, negative = away favored
    // factorAdjustment: positive = factors favor away, negative = factors favor home
    // Subtracting positive factorAdjustment reduces home's predicted margin
    const factorAdjustment = confidenceResult.edgeRaw
    const predictedMargin = statsBaseline - factorAdjustment

    // Calculate predicted scores based on margin
    // Assume average NBA game total is ~220 points (only used for score distribution)
    const avgGameTotal = 220
    const predictedAwayScore = (avgGameTotal / 2) - (predictedMargin / 2)
    const predictedHomeScore = (avgGameTotal / 2) + (predictedMargin / 2)

    // Determine winner based on margin - use actual team name
    // If predictedMargin < 0, away team wins outright
    const winner = predictedMargin < 0 ? awayTeamName : homeTeamName

    console.log('[WizardOrchestrator:Step4] SPREAD Prediction calculation:', {
      statsBaseline: statsBaseline.toFixed(1),
      vegasLine: vegasFallback,
      baselineSource: baselineDebug.source,
      edgeRaw: confidenceResult.edgeRaw.toFixed(2),
      factorAdjustment: factorAdjustment.toFixed(2),
      predictedMargin: predictedMargin.toFixed(1),
      predictedAwayScore: predictedAwayScore.toFixed(1),
      predictedHomeScore: predictedHomeScore.toFixed(1),
      winner,
      note: 'Using STATS-BASED baseline for pick diversity'
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
        winner, // Now contains actual team name (e.g., "Chicago Bulls")
        conf7_score: confidenceResult.confScore,
        // NEW: Include baseline debug info for transparency
        baseline_debug: baselineDebug
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
  // Edge is from HOME's perspective: positive = home has value, negative = away has value
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive edge = home team has value (home is better than market expects)
    homeScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative edge = away team has value (home is worse than market expects)
    awayScore = Math.abs(signal) * MAX_POINTS
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
  betType: string,
  isAwayPick?: boolean // true if pick is for away team (SPREAD only)
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
    // marketLine is always from HOME perspective (positive = home underdog, negative = home favorite)
    // If picking AWAY team, we need to show the AWAY spread (which is -marketLine)
    // Example: marketLine = +4.5 (home gets +4.5) → away spread = -4.5
    const teamSpread = isAwayPick ? -marketLine : marketLine
    selection = `${pickDirection} ${teamSpread > 0 ? '+' : ''}${teamSpread}`
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

/**
 * Step 5.5: Execute AI Archetype
 * Calls the appropriate Grok function based on the capper's selected archetype
 * Returns a factor object with 0-5 points contribution
 */
interface AIArchetypeInput {
  archetype: 'pulse' | 'influencer' | 'interpreter' | 'mathematician'
  awayTeam: string
  homeTeam: string
  betType: 'TOTAL' | 'SPREAD'
  spread?: { away: number; home: number; line?: number }
  total?: number
  gameDate: string
}

interface AIArchetypeResult {
  success: boolean
  factor?: {
    key: string
    name: string
    factor_no: number
    normalized_value: number
    weight_total_pct: number
    raw_values_json: any
    parsed_values_json: {
      direction: 'away' | 'home'
      points: number
      archetype: string
      overScore?: number
      underScore?: number
      awayScore?: number
      homeScore?: number
    }
    notes: string
    caps_applied: boolean
    cap_reason: string | null
  }
  // NEW: Baseline adjustment for pick diversity (Step 0)
  baselineAdjustment?: {
    value: number          // -5 to +5
    direction: 'OVER' | 'UNDER' | 'AWAY' | 'HOME'
    reasoning: string
  }
  error?: string
}

async function executeAIArchetype(input: AIArchetypeInput): Promise<AIArchetypeResult> {
  const { archetype, awayTeam, homeTeam, betType, spread, total, gameDate } = input

  try {
    // Import Grok client functions
    const {
      getGrokSentiment,
      getInfluencerSentiment,
      getInterpreterAnalysis,
      getMathematicianAnalysis
    } = await import('@/lib/ai-insights/grok-client')

    // Build request based on bet type
    const baseRequest = {
      awayTeam,
      homeTeam,
      spread: spread ? { away: spread.away || -(spread.line || 0), home: spread.home || (spread.line || 0) } : undefined,
      total,
      gameDate,
      betType
    }

    let direction: 'away' | 'home' = 'home'
    let points = 0
    let archetypeName = ''
    let rawData: any = {}
    let notes = ''
    let baselineAdjustment: AIArchetypeResult['baselineAdjustment'] = undefined

    switch (archetype) {
      case 'pulse': {
        archetypeName = 'The Pulse'
        const result = await getGrokSentiment(baseRequest)
        if (result.success && result.pulseScore) {
          direction = result.pulseScore.direction
          points = result.pulseScore.points
          rawData = result.sentiment
          notes = `Public sentiment: ${result.pulseScore.teamName} (${points.toFixed(1)} pts)`
          baselineAdjustment = result.baselineAdjustment
        } else {
          return { success: false, error: result.error || 'Pulse returned no score' }
        }
        break
      }

      case 'influencer': {
        archetypeName = 'The Influencer'
        const result = await getInfluencerSentiment({ ...baseRequest, minFollowers: 10000 })
        if (result.success && result.influencerScore) {
          direction = result.influencerScore.direction
          points = result.influencerScore.points
          rawData = result.sentiment
          notes = `Influencer sentiment: ${result.influencerScore.teamName} (${points.toFixed(1)} pts)`
          baselineAdjustment = result.baselineAdjustment
        } else {
          return { success: false, error: result.error || 'Influencer returned no score' }
        }
        break
      }

      case 'interpreter': {
        archetypeName = 'The Interpreter'
        const result = await getInterpreterAnalysis(baseRequest)
        if (result.success && result.interpreterScore) {
          direction = result.interpreterScore.direction
          points = result.interpreterScore.points
          rawData = result.analysis
          notes = `Research analysis: ${result.interpreterScore.teamName} (${points.toFixed(1)} pts)`
          baselineAdjustment = result.baselineAdjustment
        } else {
          return { success: false, error: result.error || 'Interpreter returned no score' }
        }
        break
      }

      case 'mathematician': {
        archetypeName = 'The Mathematician'
        // Mathematician needs stats data - use placeholder values for now
        // TODO: Pass real stats from Step 3 when available
        const mathRequest = {
          awayTeam,
          homeTeam,
          total: total || 220,
          gameDate,
          stats: {
            away: {
              pace: 100,
              ortg: 112,
              drtg: 110,
              ppg: 110,
              oppPpg: 108,
              threeP_pct: 0.36,
              threeP_rate: 0.38,
              ft_rate: 0.25,
              ftPct: 0.78,
              turnovers: 13,
              offReb: 10,
              defReb: 34,
              restDays: 1
            },
            home: {
              pace: 98,
              ortg: 114,
              drtg: 108,
              ppg: 112,
              oppPpg: 106,
              threeP_pct: 0.37,
              threeP_rate: 0.40,
              ft_rate: 0.26,
              ftPct: 0.80,
              turnovers: 12,
              offReb: 9,
              defReb: 35,
              restDays: 2
            }
          }
        }
        const result = await getMathematicianAnalysis(mathRequest)
        if (result.success && result.mathScore) {
          direction = result.mathScore.direction
          points = result.mathScore.points
          rawData = result.analysis
          notes = `Math projection: ${result.mathScore.teamName} (${points.toFixed(1)} pts)`
          baselineAdjustment = result.baselineAdjustment
        } else {
          return { success: false, error: result.error || 'Mathematician returned no score' }
        }
        break
      }

      default:
        return { success: false, error: `Unknown archetype: ${archetype}` }
    }

    // Build factor object
    // For TOTALS: use overScore/underScore ONLY
    // For SPREAD: use awayScore/homeScore ONLY
    // CRITICAL: Do NOT include both sets - this breaks bet type detection in confidence calculator

    // Build parsed_values_json based on bet type (only include relevant score fields)
    const parsedValuesJson: {
      direction: 'away' | 'home'
      points: number
      archetype: string
      signal: number
      overScore?: number
      underScore?: number
      awayScore?: number
      homeScore?: number
    } = {
      direction,
      points,
      archetype,
      signal: direction === 'away' ? points / 5 : -points / 5
    }

    if (betType === 'TOTAL') {
      // TOTALS: Use overScore/underScore
      if (direction === 'away') {
        parsedValuesJson.overScore = points
        parsedValuesJson.underScore = 0
      } else {
        parsedValuesJson.overScore = 0
        parsedValuesJson.underScore = points
      }
    } else {
      // SPREAD: Use awayScore/homeScore
      if (direction === 'away') {
        parsedValuesJson.awayScore = points
        parsedValuesJson.homeScore = 0
      } else {
        parsedValuesJson.awayScore = 0
        parsedValuesJson.homeScore = points
      }
    }

    const factor = {
      key: 'aiArchetype',
      name: `AI Archetype: ${archetypeName}`,
      factor_no: 7,  // After Edge vs Market (factor 6)
      normalized_value: direction === 'away' ? points / 5 : -points / 5,  // Normalize to [-1, 1]
      weight_total_pct: 100,  // 100% weight (fixed)
      raw_values_json: rawData,
      parsed_values_json: parsedValuesJson,
      notes,
      caps_applied: points >= 4.9,
      cap_reason: points >= 4.9 ? 'max points reached' : null
    }

    return { success: true, factor, baselineAdjustment }

  } catch (error) {
    console.error('[executeAIArchetype] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

