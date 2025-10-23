/**
 * SHIVA v1 Pipeline Orchestrator
 * 
 * Centralized coordination of the 7-step pick generation process
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { computeTotalsFactors } from './factors/nba-totals'
import { calculateConfidence } from './confidence-calculator'
import { getFactorWeightsFromProfile } from './confidence-calculator'

export interface PipelineInput {
  gameId: string
  awayTeam: string
  homeTeam: string
  sport: 'NBA' | 'NFL' | 'MLB'
  betType: 'SPREAD' | 'MONEYLINE' | 'TOTAL'
  capperId: string
  aiProvider?: 'perplexity' | 'openai'
  newsWindowHours?: number
}

export interface PipelineResult {
  runId: string
  success: boolean
  steps: {
    step1?: any
    step2?: any
    step3?: any
    step4?: any
    step5?: any
    step6?: any
    step7?: any
  }
  finalPick?: {
    type: string
    selection: string
    units: number
    confidence: number
    lockedOdds: any
  }
  errors: string[]
  executionTimeMs: number
}

/**
 * Run the complete SHIVA v1 pipeline
 */
export async function runFullPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startTime = Date.now()
  const runId = crypto.randomUUID()
  const errors: string[] = []
  const steps: any = {}
  
  try {
    console.log('[ORCHESTRATOR:START]', { runId, input })
    
    // Step 1: Initialize run
    steps.step1 = await initializeRun(runId, input)
    
    // Step 2: Capture odds snapshot
    steps.step2 = await captureOddsSnapshot(runId, input)
    
    // Step 3: Compute factors
    steps.step3 = await computeFactors(runId, input, steps.step2)
    
    // Step 4: Generate predictions and base confidence
    steps.step4 = await generatePredictions(runId, input, steps.step3)
    
    // Step 5: Apply market edge adjustment
    steps.step5 = await applyMarketEdge(runId, input, steps.step4, steps.step2)
    
    // Step 6: Generate final pick
    steps.step6 = await generatePick(runId, input, steps.step5, steps.step2)
    
    // Step 7: Create insight card
    steps.step7 = await createInsightCard(runId, input, steps.step6, steps.step3)
    
    console.log('[ORCHESTRATOR:SUCCESS]', { runId, executionTimeMs: Date.now() - startTime })
    
    return {
      runId,
      success: true,
      steps,
      finalPick: steps.step6?.pick,
      errors,
      executionTimeMs: Date.now() - startTime
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(errorMsg)
    console.error('[ORCHESTRATOR:ERROR]', { runId, error: errorMsg })
    
    return {
      runId,
      success: false,
      steps,
      errors,
      executionTimeMs: Date.now() - startTime
    }
  }
}

/**
 * Step 1: Initialize run in database
 */
async function initializeRun(runId: string, input: PipelineInput) {
  const admin = getSupabaseAdmin()
  
  const { data, error } = await admin
    .from('runs')
    .insert({
      id: runId,
      capper_id: input.capperId,
      sport: input.sport,
      bet_type: input.betType,
      game_id: input.gameId,
      state: 'IN-PROGRESS',
      created_at: new Date().toISOString()
    })
    .select()
    .single()
  
  if (error) throw new Error(`Failed to initialize run: ${error.message}`)
  
  return { run_id: runId, state: 'IN-PROGRESS' }
}

/**
 * Step 2: Capture current odds snapshot
 */
async function captureOddsSnapshot(runId: string, input: PipelineInput) {
  // This would integrate with your odds API
  // For now, return mock data
  return {
    snapshot_id: `snapshot_${runId}`,
    is_active: true,
    snapshot: {
      game_id: input.gameId,
      sport: input.sport,
      home_team: input.homeTeam,
      away_team: input.awayTeam,
      start_time_utc: new Date().toISOString(),
      captured_at_utc: new Date().toISOString(),
      books_considered: 3,
      moneyline: { home_avg: -110, away_avg: -110 },
      spread: { fav_team: input.homeTeam, line: -3.5, odds: -110 },
      total: { line: 220.5, over_odds: -110, under_odds: -110 }
    }
  }
}

/**
 * Step 3: Compute factors based on sport/bet type
 */
async function computeFactors(runId: string, input: PipelineInput, oddsSnapshot: any) {
  if (input.sport === 'NBA' && input.betType === 'TOTAL') {
    // Get factor weights from capper profile
    const admin = getSupabaseAdmin()
    let factorWeights: Record<string, number> = {}
    
    try {
      const profileRes = await admin
        .from('capper_settings')
        .select('profile_json')
        .eq('capper_id', input.capperId)
        .eq('sport', input.sport)
        .eq('bet_type', input.betType)
        .single()
      
      if (profileRes.data?.profile_json?.factors) {
        factorWeights = getFactorWeightsFromProfile(profileRes.data.profile_json)
      } else {
        // Default weights
        factorWeights = {
          paceIndex: 20,
          offForm: 20,
          defErosion: 20,
          threeEnv: 20,
          whistleEnv: 20
        }
      }
    } catch (error) {
      console.warn('Failed to load factor weights, using defaults')
      factorWeights = {
        paceIndex: 20,
        offForm: 20,
        defErosion: 20,
        threeEnv: 20,
        whistleEnv: 20
      }
    }
    
    // Compute NBA totals factors
    const ctx = {
      game_id: input.gameId,
      away: input.awayTeam,
      home: input.homeTeam,
      sport: 'NBA' as const,
      betType: 'TOTAL' as const,
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
    
    return await computeTotalsFactors(ctx)
  }
  
  // Legacy factors for other sports/bet types
  throw new Error(`Factor computation not implemented for ${input.sport} ${input.betType}`)
}

/**
 * Step 4: Generate predictions and base confidence
 */
async function generatePredictions(runId: string, input: PipelineInput, factorsResult: any) {
  if (!factorsResult?.factors) {
    throw new Error('No factors available for prediction generation')
  }
  
  // Calculate confidence using the new system
  const factorWeights = factorsResult.factorWeights || {}
  const confidenceResult = calculateConfidence({
    factors: factorsResult.factors,
    factorWeights,
    confSource: 'nba_totals_v1'
  })
  
  // Mock prediction logic (would be more sophisticated in reality)
  const predictedTotal = 220 + (confidenceResult.edgeRaw * 10) // Simple mock
  
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
      winner: input.homeTeam,
      conf7_score: confidenceResult.confScore
    },
    confidence: confidenceResult,
    conf_source: 'nba_totals_v1'
  }
}

/**
 * Step 5: Apply market edge adjustment
 */
async function applyMarketEdge(runId: string, input: PipelineInput, predictions: any, oddsSnapshot: any) {
  const marketTotalLine = oddsSnapshot?.snapshot?.total?.line || 220
  const predictedTotal = predictions?.predictions?.total_pred_points || 220
  const baseConfidence = predictions?.confidence?.confScore || 0
  
  const marketEdgePts = predictedTotal - marketTotalLine
  const edgeFactor = Math.max(-1, Math.min(1, marketEdgePts / 10))
  const adjustedConfidence = Math.max(0, Math.min(5, baseConfidence + (edgeFactor * 1.0)))
  
  return {
    run_id: runId,
    conf_final: adjustedConfidence,
    dominant: 'total',
    conf_market_adj: adjustedConfidence - baseConfidence,
    finalFactor: {
      name: 'Edge vs Market',
      edgePts: marketEdgePts,
      confidenceBefore: baseConfidence,
      confidenceAfter: adjustedConfidence
    }
  }
}

/**
 * Step 6: Generate final pick
 */
async function generatePick(runId: string, input: PipelineInput, confidence: any, oddsSnapshot: any) {
  const finalConfidence = confidence?.conf_final || 0
  const predictedTotal = confidence?.predictions?.total_pred_points || 220
  const marketLine = oddsSnapshot?.snapshot?.total?.line || 220
  
  // Determine pick direction and units using same logic as Step 5
  const pickDirection = predictedTotal > marketLine ? 'OVER' : 'UNDER'
  let units = 0
  if (finalConfidence >= 4.5) units = 5
  else if (finalConfidence >= 4.0) units = 3
  else if (finalConfidence >= 3.5) units = 2
  else if (finalConfidence >= 2.5) units = 1
  // else units = 0 (PASS)
  
  const pick = {
    id: `pick_${runId}`,
    run_id: runId,
    pick_type: 'TOTAL',
    selection: `${pickDirection} ${marketLine}`,
    units,
    confidence: finalConfidence,
    locked_odds: oddsSnapshot?.snapshot,
    locked_at: new Date().toISOString()
  }
  
  return {
    run_id: runId,
    decision: 'PICK',
    confidence: finalConfidence,
    pick
  }
}

/**
 * Step 7: Create insight card
 */
async function createInsightCard(runId: string, input: PipelineInput, pick: any, factors: any) {
  return {
    run_id: runId,
    insight_card_id: `card_${runId}`,
    generated_at: new Date().toISOString()
  }
}


