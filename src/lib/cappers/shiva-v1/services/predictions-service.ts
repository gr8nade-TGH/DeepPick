/**
 * Predictions Service
 * 
 * Business logic for score prediction generation, separated from API routes
 */

import { calculateConfidenceScore, ConfidenceCalculationInput } from './confidence-service'

export interface PredictionInput {
  factors: any[]
  factorWeights: Record<string, number>
  awayTeam: string
  homeTeam: string
  sport: string
  betType: string
}

export interface PredictionResult {
  paceExp: number
  delta100: number
  spreadPredPoints: number
  totalPredPoints: number
  scores: {
    home: number
    away: number
  }
  winner: string
  conf7Score: number
  confidence: {
    edgeRaw: number
    edgePct: number
    confScore: number
    confSource: string
    factorContributions: any[]
  }
}

/**
 * Generate score predictions and confidence
 */
export async function generatePredictions(input: PredictionInput): Promise<PredictionResult> {
  const { factors, factorWeights, awayTeam, homeTeam, sport, betType } = input
  
  console.log('[PREDICTIONS_SERVICE:START]', { awayTeam, homeTeam, sport, betType })
  
  // Calculate confidence using the signal-based system
  const confidenceInput: ConfidenceCalculationInput = {
    factors,
    factorWeights,
    confSource: 'nba_totals_v1'
  }
  
  const confidence = await calculateConfidenceScore(confidenceInput)
  
  // TODO: Replace with sophisticated prediction model
  // For now, use factor-based calculation instead of simple mock
  console.warn('[PREDICTIONS_SERVICE] Using simplified prediction model - should be enhanced with real prediction algorithms')
  
  // Calculate predicted total based on factor signals and league average
  const leagueAverageTotal = 225.0 // NBA league average
  const factorAdjustment = confidence.edgeRaw * 5.0 // Scale factor adjustment
  const predictedTotal = Math.max(180, Math.min(280, leagueAverageTotal + factorAdjustment))
  
  // Split into home/away with realistic variance
  const homeAdvantage = 2.5 // Typical home court advantage
  const variance = (Math.random() - 0.5) * 6 // ±3 point variance
  const homeScore = Math.round(predictedTotal / 2 + homeAdvantage + variance)
  const awayScore = Math.round(predictedTotal - homeScore)
  const winner = homeScore > awayScore ? homeTeam : awayTeam
  
  const result: PredictionResult = {
    paceExp: 100.0, // Mock pace expectation
    delta100: 0.0, // Mock pace delta
    spreadPredPoints: 0.0, // Mock spread prediction
    totalPredPoints: predictedTotal,
    scores: {
      home: homeScore,
      away: awayScore
    },
    winner,
    conf7Score: confidence.confScore,
    confidence
  }
  
  console.log('[PREDICTIONS_SERVICE:SUCCESS]', { 
    predictedTotal,
    winner,
    confScore: confidence.confScore
  })
  
  return result
}
