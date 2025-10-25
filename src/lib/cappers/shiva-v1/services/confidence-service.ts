/**
 * Confidence Service
 * 
 * Business logic for confidence calculation, separated from API routes
 */

import { calculateConfidence, ConfidenceInput } from '../confidence-calculator'

export interface ConfidenceCalculationInput {
  factors: any[]
  factorWeights: Record<string, number>
  confSource?: string
}

export interface ConfidenceCalculationResult {
  edgeRaw: number
  edgePct: number
  confScore: number
  confSource: string
  factorContributions: Array<{
    key: string
    name: string
    z: number
    weight: number
    contribution: number
  }>
}

/**
 * Calculate confidence using the signal-based system
 */
export async function calculateConfidenceScore(input: ConfidenceCalculationInput): Promise<ConfidenceCalculationResult> {
  const { factors, factorWeights, confSource = 'nba_totals_v1' } = input
  
  console.log('[CONFIDENCE_SERVICE:START]', { 
    factorCount: factors.length, 
    confSource,
    totalWeight: Object.values(factorWeights).reduce((sum, w) => sum + w, 0)
  })
  
  const confidenceInput: ConfidenceInput = {
    factors,
    factorWeights,
    confSource
  }
  
  const result = calculateConfidence(confidenceInput)
  
  console.log('[CONFIDENCE_SERVICE:SUCCESS]', { 
    confScore: result.confScore,
    edgeRaw: result.edgeRaw,
    edgePct: result.edgePct
  })
  
  return result
}

/**
 * Apply market edge adjustment to confidence
 */
export function applyMarketEdgeAdjustment(
  baseConfidence: number,
  predictedTotal: number,
  marketTotalLine: number
): {
  adjustedConfidence: number
  marketEdgePts: number
  edgeFactor: number
  adjustment: number
} {
  const marketEdgePts = predictedTotal - marketTotalLine
  const edgeFactor = Math.max(-1, Math.min(1, marketEdgePts / 10))
  const adjustedConfidence = Math.max(0, Math.min(5, baseConfidence + (edgeFactor * 1.0)))
  const adjustment = adjustedConfidence - baseConfidence
  
  console.log('[CONFIDENCE_SERVICE:MARKET_EDGE]', {
    predictedTotal,
    marketTotalLine,
    marketEdgePts,
    edgeFactor,
    baseConfidence,
    adjustedConfidence,
    adjustment
  })
  
  return {
    adjustedConfidence,
    marketEdgePts,
    edgeFactor,
    adjustment
  }
}
