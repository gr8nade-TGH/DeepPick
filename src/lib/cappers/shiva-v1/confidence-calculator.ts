/**
 * Confidence Calculator
 * 
 * Calculates confidence scores using factor weights from Configure Factors modal
 * and implements the sigmoid edge-percent model for better calibration.
 */

import { FactorComputation } from '@/types/factors'

export interface ConfidenceInput {
  factors: FactorComputation[]
  factorWeights: Record<string, number> // weight percentages (0-100)
  confSource?: string
}

export interface ConfidenceOutput {
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
 * Calculate confidence using Over/Under score model
 *
 * Logic (per factor chart examples):
 * 1. Each factor has overScore and underScore (both positive or 0)
 * 2. Sum all overScore values across factors
 * 3. Sum all underScore values across factors
 * 4. Pick direction = whichever total is higher
 * 5. Confidence = the higher total
 *
 * Example: If total overScore = 8.5 and total underScore = 3.2
 *   → Pick OVER with confidence 8.5
 */
export function calculateConfidence(input: ConfidenceInput): ConfidenceOutput {
  const { factors, factorWeights, confSource = 'nba_totals_v1' } = input

  // Normalize weights to sum to 1.0
  const totalWeight = Object.values(factorWeights).reduce((sum, w) => sum + w, 0)
  const normalizedWeights = totalWeight > 0
    ? Object.fromEntries(Object.entries(factorWeights).map(([k, v]) => [k, v / totalWeight]))
    : {}

  console.log('[ConfidenceCalculator] Weight normalization:', {
    factorWeights,
    totalWeight,
    normalizedWeights
  })

  // Sum overScore and underScore across all factors
  // NOTE: The factors already return WEIGHTED scores (overScore/underScore are pre-multiplied by weight)
  // So we just sum them directly without multiplying by weight again
  let totalOverScore = 0
  let totalUnderScore = 0
  const factorContributions: ConfidenceOutput['factorContributions'] = []

  for (const factor of factors) {
    const weight = normalizedWeights[factor.key] || 0
    const parsedValues = factor.parsed_values_json || {}

    // Get overScore and underScore from parsed_values_json
    // These are ALREADY weighted by the factor computation
    const overScore = parsedValues.overScore || 0
    const underScore = parsedValues.underScore || 0

    // Sum directly - DO NOT multiply by weight again (would be double-weighting)
    totalOverScore += overScore
    totalUnderScore += underScore

    factorContributions.push({
      key: factor.key,
      name: factor.name,
      z: factor.normalized_value || 0, // Keep signal for reference
      weight,
      contribution: overScore - underScore // Net contribution (already weighted)
    })
  }

  // Determine pick direction and confidence
  const pickOver = totalOverScore > totalUnderScore
  const confScore = pickOver ? totalOverScore : totalUnderScore
  const edgeRaw = totalOverScore - totalUnderScore // Positive = OVER, Negative = UNDER

  console.log('[ConfidenceCalculator] Score calculation:', {
    totalOverScore,
    totalUnderScore,
    pickDirection: pickOver ? 'OVER' : 'UNDER',
    confScore,
    edgeRaw
  })

  return {
    edgeRaw, // Positive = OVER bias, Negative = UNDER bias
    edgePct: Math.abs(edgeRaw), // Magnitude of the edge
    confScore, // Always positive - the confidence in the pick
    confSource,
    factorContributions
  }
}

/**
 * Sigmoid function: 1 / (1 + e^(-x))
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Get factor weights from a capper profile
 */
export function getFactorWeightsFromProfile(profile: any): Record<string, number> {
  if (!profile?.factors) return {}

  const weights: Record<string, number> = {}
  for (const factor of profile.factors) {
    if (factor.enabled) {
      weights[factor.key] = factor.weight
    }
  }

  return weights
}

/**
 * Validate that weights sum to 250%
 */
export function validateWeights(weights: Record<string, number>): {
  isValid: boolean
  totalWeight: number
  remainingWeight: number
} {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const remainingWeight = 250 - totalWeight
  const isValid = Math.abs(remainingWeight) < 0.01 // Allow tiny floating point errors

  return { isValid, totalWeight, remainingWeight }
}
