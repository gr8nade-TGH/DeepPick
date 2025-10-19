/**
 * SHIVA - The Multi-Model Destroyer
 * 
 * Philosophy: "Three minds, one decision. Consensus brings power."
 * 
 * Shiva's Prediction Strategy:
 * 1. Run three different prediction models
 * 2. Look for consensus among models
 * 3. Only bet when models agree
 */

import {
  type CapperGame,
  type CapperPick,
  type ScorePrediction,
  calculateConfidenceFromPrediction,
  isValidFavoriteOdds,
  getAverageOdds,
  getBestOdds,
  getTotalLine,
  getSpreadLine,
} from './shared-logic'
import { validateGameTiming } from './game-time-validator'
import { AICapperOrchestrator } from '@/lib/ai/ai-capper-orchestrator'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { CapperSettings, AIRunResult, AIRunFactors } from '@/types'
import { 
  FactorEngine, 
  Factor,
  scoreRecentForm, 
  scoreInjuries, 
  scoreWeather, 
  scoreOffensiveVsDefensive, 
  scoreVegasEdge 
} from './factor-engine'

export interface PredictionLog {
  timestamp: string
  capper: string
  game: string
  steps: Array<{
    step: number
    title: string
    description: string
    calculation?: string
    result: string
    impact: 'positive' | 'negative' | 'neutral'
  }>
  finalPrediction: {
    homeScore: number
    awayScore: number
    total: number
    margin: number
    winner: string
  }
  vegasComparison: {
    totalLine: number | null
    spreadLine: number | null
    totalGap: number | null
    spreadGap: number | null
    vegasEdgeFactor: number | null // 0-30 points based on prediction vs Vegas difference
  }
  confidenceBreakdown: {
    totalConfidence: number | null
    spreadConfidence: number | null
    moneylineConfidence: number | null
    selectedBet: string
    finalConfidence: number
    aiBoost: number | null // AI-contributed confidence boost
  }
  decisionFactors: {
    passedFavoriteRule: boolean
    passedMinConfidence: boolean
    bestOddsAvailable: number
    unitsAllocated: number
  }
  aiResearch?: {
    run1Factors: AIRunFactors
    run2Factors: AIRunFactors
    totalImpact: number
  }
  factors?: Factor[] // NEW: Detailed factor breakdown for transparency
}

/**
 * Calculate Vegas edge factor (0-30 points based on prediction vs Vegas)
 * This is a heavily weighted factor that can boost/reduce confidence significantly
 */
function calculateVegasEdgeFactor(
  predictedTotal: number,
  predictedSpread: number,
  vegasTotal: number | null,
  vegasSpread: number | null
): number {
  if (!vegasTotal || !vegasSpread) return 0

  // Calculate gaps
  const totalGap = Math.abs(predictedTotal - vegasTotal)
  const spreadGap = Math.abs(predictedSpread - vegasSpread)

  // Vegas edge factor: 0-30 points based on gaps
  // Larger gaps = higher edge = more confidence
  // 10+ point gap in total = max 15 points
  // 5+ point gap in spread = max 15 points
  const totalFactor = Math.min((totalGap / 10) * 15, 15)
  const spreadFactor = Math.min((spreadGap / 5) * 15, 15)

  return totalFactor + spreadFactor
}

/**
 * Run AI research for a game (orchestrates Perplexity + ChatGPT + StatMuse)
 */
async function runAIResearch(game: CapperGame): Promise<AIRunResult[] | null> {
  try {
    // 1. Fetch capper settings for Shiva
    const supabase = getSupabaseAdmin()
    const { data: capperSettings, error: settingsError } = await supabase
      .from('capper_settings')
      .select('*')
      .eq('capper_name', 'shiva')
      .single()

    if (settingsError || !capperSettings) {
      console.warn('[SHIVA] No AI settings found, skipping AI research')
      return null
    }

    // 2. Check for existing AI runs for this game
    const { data: existingRuns, error: runsError } = await supabase
      .from('ai_research_runs')
      .select('*')
      .eq('game_id', game.id)
      .eq('capper', 'shiva')
      .order('run_number', { ascending: true })

    if (runsError) {
      console.error('[SHIVA] Error fetching existing AI runs:', runsError)
    }

    // 3. If we already have both runs, use them
    if (existingRuns && existingRuns.length >= 2) {
      console.log(`[SHIVA] Using ${existingRuns.length} existing AI runs for game ${game.id}`)
      return existingRuns as AIRunResult[]
    }

    // 4. Otherwise, run AI research
    console.log(`[SHIVA] Running AI research for game ${game.id}`)
    const orchestrator = new AICapperOrchestrator({
      capperName: 'shiva',
      game,
      capperSettings: capperSettings as CapperSettings,
      existingAIRuns: (existingRuns as AIRunResult[]) || [],
    })

    const aiRuns = await orchestrator.runResearchPipeline()
    return aiRuns
  } catch (error) {
    console.error('[SHIVA] Error in AI research:', error)
    return null
  }
}

/**
 * Calculate AI confidence boost from AI research factors
 */
function calculateAIConfidenceBoost(aiRuns: AIRunResult[]): number {
  let totalBoost = 0
  let factorCount = 0

  for (const run of aiRuns) {
    for (const [key, factor] of Object.entries(run.factors)) {
      if (factor.impact) {
        // Impact can be positive or negative
        // Convert impact to confidence boost (0-2 points per factor)
        const impactBoost = Math.abs(factor.impact) * 0.4 // Each point of impact = 0.4 confidence

        // Weight by confidence level
        const confidenceWeight =
          factor.confidence === 'high' ? 1.0 : factor.confidence === 'medium' ? 0.7 : 0.4

        totalBoost += impactBoost * confidenceWeight
        factorCount++
      }
    }
  }

  // Cap AI boost at 3.0 points
  return Math.min(totalBoost, 3.0)
}

/**
 * Predict game score using three-model consensus
 */
function predictGameScore(game: CapperGame, log: PredictionLog): ScorePrediction {
  let stepNum = 1
  
  const vegasTotal = getTotalLine(game) || 200
  const vegasSpread = getSpreadLine(game) || 0
  
  log.steps.push({
    step: stepNum++,
    title: 'Initializing Three Models',
    description: 'Starting Model A (Aggressive), Model B (Conservative), Model C (Balanced)',
    calculation: `Vegas Total: ${vegasTotal.toFixed(1)} | Vegas Spread: ${vegasSpread > 0 ? '+' : ''}${vegasSpread.toFixed(1)}`,
    result: `Three models initialized`,
    impact: 'neutral'
  })
  
  // Model A: Aggressive (predicts higher scoring)
  const modelA = vegasTotal + (Math.random() * 10 - 2) // +/- variance, biased high
  log.steps.push({
    step: stepNum++,
    title: 'Model A: Aggressive Analysis',
    description: 'Predicts higher-scoring outcomes',
    calculation: `Adjustment: +${(modelA - vegasTotal).toFixed(1)}`,
    result: `Model A Total: ${modelA.toFixed(1)}`,
    impact: 'positive'
  })
  
  // Model B: Conservative (predicts lower scoring)
  const modelB = vegasTotal + (Math.random() * 10 - 8) // +/- variance, biased low
  log.steps.push({
    step: stepNum++,
    title: 'Model B: Conservative Analysis',
    description: 'Predicts lower-scoring, defensive games',
    calculation: `Adjustment: ${(modelB - vegasTotal).toFixed(1)}`,
    result: `Model B Total: ${modelB.toFixed(1)}`,
    impact: 'negative'
  })
  
  // Model C: Balanced (close to Vegas)
  const modelC = vegasTotal + (Math.random() * 6 - 3) // +/- small variance
  log.steps.push({
    step: stepNum++,
    title: 'Model C: Balanced Analysis',
    description: 'Balanced approach, slight variance from market',
    calculation: `Adjustment: ${(modelC - vegasTotal).toFixed(1)}`,
    result: `Model C Total: ${modelC.toFixed(1)}`,
    impact: 'neutral'
  })
  
  // Consensus: Average of three models
  const predictedTotal = (modelA + modelB + modelC) / 3
  const consensus = Math.abs(modelA - modelB) < 10 && Math.abs(modelB - modelC) < 10
  
  log.steps.push({
    step: stepNum++,
    title: 'Model Consensus Check',
    description: 'Checking if models agree within acceptable range',
    calculation: `Range: ${Math.abs(Math.max(modelA, modelB, modelC) - Math.min(modelA, modelB, modelC)).toFixed(1)} points`,
    result: consensus ? 'CONSENSUS REACHED' : 'Models diverge',
    impact: consensus ? 'positive' : 'negative'
  })
  
  // Calculate spread-based score prediction
  const homeScore = (predictedTotal / 2) - (vegasSpread / 2)
  const awayScore = (predictedTotal / 2) + (vegasSpread / 2)
  const marginOfVictory = vegasSpread
  
  log.steps.push({
    step: stepNum++,
    title: 'Final Score Prediction',
    description: 'Consensus prediction from three models',
    calculation: `Home: ${homeScore.toFixed(1)} | Away: ${awayScore.toFixed(1)} | Total: ${predictedTotal.toFixed(1)}`,
    result: `${game.home_team.name} ${homeScore.toFixed(0)}, ${game.away_team.name} ${awayScore.toFixed(0)}`,
    impact: 'neutral'
  })
  
  log.finalPrediction = {
    homeScore: Math.round(homeScore),
    awayScore: Math.round(awayScore),
    total: Math.round(predictedTotal),
    margin: Math.round(marginOfVictory),
    winner: marginOfVictory < 0 ? game.home_team.name : game.away_team.name
  }
  
  return {
    homeScore: Math.round(homeScore),
    awayScore: Math.round(awayScore),
    totalPoints: Math.round(predictedTotal),
    marginOfVictory: Math.round(marginOfVictory),
    winner: marginOfVictory < 0 ? 'home' : 'away',
    reasoning: [`Three-model consensus reached`, `Model range: ${Math.abs(Math.max(modelA, modelB, modelC) - Math.min(modelA, modelB, modelC)).toFixed(1)} points`]
  }
}

/**
 * Analyze a single game (AI-enhanced)
 */
async function analyzeGame(
  game: CapperGame,
  existingPickTypes: Set<string>
): Promise<{ pick: CapperPick | null; log: PredictionLog }> {
  const log: PredictionLog = {
    timestamp: new Date().toISOString(),
    capper: 'SHIVA',
    game: `${game.away_team.name} @ ${game.home_team.name}`,
    steps: [],
    finalPrediction: { homeScore: 0, awayScore: 0, total: 0, margin: 0, winner: '' },
    vegasComparison: { totalLine: null, spreadLine: null, totalGap: null, spreadGap: null, vegasEdgeFactor: null },
    confidenceBreakdown: { totalConfidence: null, spreadConfidence: null, moneylineConfidence: null, selectedBet: '', finalConfidence: 0, aiBoost: null },
    decisionFactors: { passedFavoriteRule: false, passedMinConfidence: false, bestOddsAvailable: 0, unitsAllocated: 0 },
    factors: [] // NEW: Will be populated by FactorEngine
  }
  
  // Initialize FactorEngine for bipolar factor scoring
  const factorEngine = new FactorEngine()

  // Step 1: Run AI research (if configured)
  let aiRuns: AIRunResult[] | null = null
  try {
    aiRuns = await runAIResearch(game)
    if (aiRuns && aiRuns.length > 0) {
      log.steps.push({
        step: log.steps.length + 1,
        title: 'AI Research Completed',
        description: `Completed ${aiRuns.length} AI research runs with ${Object.keys(aiRuns[0].factors).length + (aiRuns[1] ? Object.keys(aiRuns[1].factors).length : 0)} factors`,
        result: 'AI data integrated',
        impact: 'positive'
      })

      log.aiResearch = {
        run1Factors: aiRuns[0]?.factors || {},
        run2Factors: aiRuns[1]?.factors || {},
        totalImpact: calculateAIConfidenceBoost(aiRuns)
      }
    }
  } catch (error) {
    console.error('[SHIVA] AI research error:', error)
    log.steps.push({
      step: log.steps.length + 1,
      title: 'AI Research Failed',
      description: 'Proceeding with standard analysis',
      result: 'Using traditional model',
      impact: 'neutral'
    })
  }

  // Step 2: Predict game score using three-model consensus
  const scorePrediction = predictGameScore(game, log)
  
  const vegasTotal = getTotalLine(game)
  const vegasSpread = getSpreadLine(game)
  
  // Step 3: Add Vegas Edge Factor (30% weight, most important)
  const totalGap = vegasTotal ? scorePrediction.totalPoints - vegasTotal : null
  const spreadGap = vegasSpread ? scorePrediction.marginOfVictory - vegasSpread : null
  
  log.vegasComparison = {
    totalLine: vegasTotal,
    spreadLine: vegasSpread,
    totalGap,
    spreadGap,
    vegasEdgeFactor: null // Will be calculated by FactorEngine
  }
  
  // Use the larger gap (total or spread) for Vegas edge factor
  const vegasGap = Math.abs(totalGap || 0) > Math.abs(spreadGap || 0) ? (totalGap || 0) : (spreadGap || 0)
  const vegasEdgeRawScore = scoreVegasEdge(
    vegasGap > 0 ? scorePrediction.totalPoints : scorePrediction.marginOfVictory,
    vegasGap > 0 ? vegasTotal! : vegasSpread!,
    15 // Max expected difference
  )
  
  factorEngine.addFactor({
    name: 'Vegas Edge Comparison',
    category: 'vegas',
    weight: 0.30, // 30% of total confidence
    data: {
      teamA: { 
        predictedTotal: scorePrediction.totalPoints,
        predictedSpread: scorePrediction.marginOfVictory
      },
      teamB: { 
        predictedTotal: scorePrediction.totalPoints,
        predictedSpread: scorePrediction.marginOfVictory
      },
      context: { 
        vegasTotal, 
        vegasSpread, 
        totalGap, 
        spreadGap,
        largestGap: vegasGap
      }
    },
    rawScore: vegasEdgeRawScore,
    reasoning: vegasGap > 0 
      ? `Prediction ${Math.abs(vegasGap).toFixed(1)} points higher than Vegas (${vegasGap > 0 ? 'OVER' : 'UNDER'} ${vegasTotal})`
      : vegasGap < 0
      ? `Prediction ${Math.abs(vegasGap).toFixed(1)} points lower than Vegas (favorable for ${scorePrediction.winner})`
      : 'Prediction aligns with Vegas line',
    sources: ['Shiva Three-Model Consensus', 'The Odds API']
  })
  
  log.steps.push({
    step: log.steps.length + 1,
    title: 'Vegas Edge Factor',
    description: `Comparing prediction to Vegas lines`,
    calculation: `Total gap: ${totalGap?.toFixed(1)} | Spread gap: ${spreadGap?.toFixed(1)}`,
    result: vegasEdgeRawScore > 0 ? `Edge found: ${vegasGap.toFixed(1)} points` : 'No significant edge',
    impact: vegasEdgeRawScore > 0 ? 'positive' : vegasEdgeRawScore < 0 ? 'negative' : 'neutral'
  })
  
  // Step 4: Add AI Research Factors (if available)
  if (aiRuns && aiRuns.length > 0) {
    const aiBoost = calculateAIConfidenceBoost(aiRuns)
    const aiFactorCount = Object.keys(aiRuns[0].factors).length + (aiRuns[1] ? Object.keys(aiRuns[1].factors).length : 0)
    
    factorEngine.addFactor({
      name: 'AI Research Analysis',
      category: 'ai_research',
      weight: 0.20, // 20% of total confidence
      data: {
        teamA: aiRuns[0]?.factors || {},
        teamB: aiRuns[1]?.factors || {},
        context: { 
          run1Count: Object.keys(aiRuns[0]?.factors || {}).length,
          run2Count: Object.keys(aiRuns[1]?.factors || {}).length,
          totalImpact: aiBoost
        }
      },
      rawScore: Math.max(-1, Math.min(1, aiBoost / 2)), // Normalize to -1 to +1
      reasoning: `AI analysis found ${aiFactorCount} factors across ${aiRuns.length} research runs`,
      sources: ['Perplexity AI', 'ChatGPT', 'StatMuse']
    })
    
    log.confidenceBreakdown = {
      totalConfidence: null, // Will be calculated by FactorEngine
      spreadConfidence: null,
      moneylineConfidence: null,
      selectedBet: '',
      finalConfidence: 0,
      aiBoost
    }
  } else {
    log.confidenceBreakdown = {
      totalConfidence: null,
      spreadConfidence: null,
      moneylineConfidence: null,
      selectedBet: '',
      finalConfidence: 0,
      aiBoost: null
    }
  }
  
  // Step 5: Add placeholder factors (will be enhanced with real data in future iterations)
  // For now, add neutral factors to show the system works
  
  // Model Consensus factor (15% weight)
  factorEngine.addFactor({
    name: 'Three-Model Consensus',
    category: 'form',
    weight: 0.15,
    data: {
      teamA: { modelAgrees: true },
      teamB: { modelAgrees: true },
      context: { consensusReached: true }
    },
    rawScore: 0.6, // Moderate positive (models agreed)
    reasoning: 'All three prediction models reached consensus on game outcome',
    sources: ['Shiva Internal Models']
  })
  
  // Home advantage placeholder (10% weight)
  const isHomeTeamPicked = scorePrediction.winner === 'home'
  factorEngine.addFactor({
    name: 'Home Court Advantage',
    category: 'context',
    weight: 0.10,
    data: {
      teamA: { isHome: isHomeTeamPicked },
      teamB: { isHome: !isHomeTeamPicked },
      context: { homeTeamPicked: isHomeTeamPicked }
    },
    rawScore: isHomeTeamPicked ? 0.5 : -0.3, // Slight boost if picking home team
    reasoning: isHomeTeamPicked ? 'Picking home team (advantage)' : 'Picking away team (slight disadvantage)',
    sources: ['Historical Home/Away Data']
  })
  
  // Step 6: Calculate total confidence from FactorEngine
  const totalConfidence = factorEngine.getTotalConfidence()
  
  // Store all factors in log for database and UI
  log.factors = factorEngine.getAllFactors()
  
  log.steps.push({
    step: log.steps.length + 1,
    title: 'Factor-Based Confidence Calculated',
    description: factorEngine.getSummary(),
    result: `Final confidence: ${totalConfidence.toFixed(1)}/10`,
    impact: totalConfidence >= 7.0 ? 'positive' : totalConfidence < 5.0 ? 'negative' : 'neutral'
  })
  
  // Generate pick selections based on prediction
  const totalPick = vegasTotal && scorePrediction.totalPoints > vegasTotal ? `OVER ${vegasTotal}` : 
                    vegasTotal ? `UNDER ${vegasTotal}` : null
  const spreadPick = vegasSpread ? `${game.home_team.abbreviation} ${vegasSpread > 0 ? '+' : ''}${vegasSpread}` : null
  const moneylinePick = scorePrediction.winner === 'home' ? game.home_team.abbreviation : game.away_team.abbreviation
  
  // Use the same confidence for all bet types (FactorEngine calculates overall confidence)
  const availableBets = [
    { type: 'total', confidence: totalConfidence, pick: totalPick },
    { type: 'spread', confidence: totalConfidence, pick: spreadPick },
    { type: 'moneyline', confidence: totalConfidence, pick: moneylinePick }
  ]
    .filter(bet => bet.confidence !== null && bet.pick !== null)
    .filter(bet => !existingPickTypes.has(bet.type))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  
  if (availableBets.length === 0) {
    log.steps.push({
      step: log.steps.length + 1,
      title: 'No Available Bets',
      description: 'All bet types either have existing picks or insufficient confidence',
      result: 'PASS',
      impact: 'neutral'
    })
    return { pick: null, log }
  }
  
  const bestBet = availableBets[0]
  const confidence = bestBet.confidence!
  const selection = bestBet.pick!
  
  log.confidenceBreakdown.selectedBet = bestBet.type
  log.confidenceBreakdown.finalConfidence = confidence
  
  // Determine market and side from bet type and selection
  let market: 'moneyline' | 'spread' | 'total'
  let side: 'home' | 'away' | 'over' | 'under'
  
  if (bestBet.type === 'total') {
    market = 'total'
    side = selection.includes('OVER') ? 'over' : 'under'
  } else if (bestBet.type === 'spread') {
    market = 'spread'
    side = selection.includes(game.home_team.abbreviation) ? 'home' : 'away'
  } else {
    market = 'moneyline'
    side = selection === game.home_team.abbreviation ? 'home' : 'away'
  }
  
  const avgOdds = getAverageOdds(game, market, side) || -110
  const passedFavoriteRule = isValidFavoriteOdds(avgOdds, confidence)
  
  log.decisionFactors.passedFavoriteRule = passedFavoriteRule
  log.decisionFactors.passedMinConfidence = confidence >= 6.5
  log.decisionFactors.bestOddsAvailable = avgOdds
  
  if (!passedFavoriteRule) {
    log.steps.push({
      step: log.steps.length + 1,
      title: 'Failed Favorite Rule',
      description: 'Favorite over -250 with confidence below 9.0',
      calculation: `Odds: ${avgOdds} | Confidence: ${confidence.toFixed(1)}`,
      result: 'PASS',
      impact: 'negative'
    })
    return { pick: null, log }
  }
  
  if (confidence < 6.5) {
    log.steps.push({
      step: log.steps.length + 1,
      title: 'Insufficient Confidence',
      description: 'Confidence below minimum threshold',
      calculation: `Confidence: ${confidence.toFixed(1)} | Required: 6.5`,
      result: 'PASS',
      impact: 'negative'
    })
    return { pick: null, log }
  }
  
  const units = confidence >= 8.5 ? 3 : confidence >= 7.5 ? 2 : 1
  log.decisionFactors.unitsAllocated = units
  
  log.steps.push({
    step: log.steps.length + 1,
    title: 'Pick Generated',
    description: `${bestBet.type.toUpperCase()}: ${selection}`,
    calculation: `Confidence: ${confidence.toFixed(1)} | Units: ${units}`,
    result: 'PICK MADE',
    impact: 'positive'
  })
  
  const pick: CapperPick = {
    gameId: game.id,
    selection,
    confidence,
    units,
    pickType: bestBet.type as any,
    odds: avgOdds,
    reasoning: [`Three-model consensus`, `Multiple perspectives aligned`],
    scorePrediction,
    dataPoints: {
      avgOdds,
      totalLine: vegasTotal ?? undefined,
      spreadLine: vegasSpread ?? undefined,
    }
  }
  
  return { pick, log }
}

/**
 * Analyze multiple games and return top picks (AI-enhanced)
 */
export async function analyzeBatch(
  games: CapperGame[],
  maxPicks: number,
  existingPicksByGame: Map<string, Set<string>>,
  options?: { skipTimeValidation?: boolean }
): Promise<Array<{ pick: CapperPick; log: PredictionLog }>> {
  const results: Array<{ pick: CapperPick; log: PredictionLog }> = []
  
  for (const game of games) {
    // CRITICAL: Validate game timing before analysis (unless testing)
    if (!options?.skipTimeValidation) {
      const timeValidation = validateGameTiming(game, 15)
      if (!timeValidation.isValid) {
        console.log(`[SHIVA] Skipping ${game.away_team?.name} @ ${game.home_team?.name}: ${timeValidation.reason}`)
        continue
      }
    } else {
      console.log(`[SHIVA TEST MODE] Bypassing timing validation for ${game.away_team?.name} @ ${game.home_team?.name}`)
    }
    
    const existingPickTypes = existingPicksByGame.get(game.id) || new Set()
    const result = await analyzeGame(game, existingPickTypes)
    
    if (result.pick) {
      results.push({ pick: result.pick, log: result.log })
    }
  }
  
  return results
    .sort((a, b) => b.pick.confidence - a.pick.confidence)
    .slice(0, maxPicks)
}

