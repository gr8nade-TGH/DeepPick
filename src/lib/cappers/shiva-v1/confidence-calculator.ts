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
    // Add weighted scores for run log display
    weighted_contributions?: {
      overScore: number
      underScore: number
      net: number
    }
    // Add weight percentage for display
    weight_percentage?: number
    // Add parsed values for fallback
    parsed_values_json?: {
      overScore: number
      underScore: number
      signal: number
      points: number
    }
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

  // DO NOT normalize weights - they are already percentages (0-100)
  // Edge vs Market is always 100%, other factors sum to 250%
  // Total weight budget = 350% (100% + 250%)
  console.log('[ConfidenceCalculator] Using raw weight percentages:', {
    factorWeights,
    totalWeight: Object.values(factorWeights).reduce((sum, w) => sum + w, 0)
  })

  // Sum overScore and underScore across all factors
  // NOTE: Factors return scores based on MAX_POINTS = 5.0
  // We need to scale by (weight / 100) to get effective max points
  // Example: Pace Index with weight=70% → Effective max = 5.0 × 0.70 = 3.5 points
  let totalOverScore = 0
  let totalUnderScore = 0
  const factorContributions: ConfidenceOutput['factorContributions'] = []

  for (const factor of factors) {
    const weightPct = factorWeights[factor.key] || 0 // Weight percentage (0-100)
    const weightDecimal = weightPct / 100 // Convert to decimal (0-1)
    const parsedValues = factor.parsed_values_json || {}

    // Get overScore and underScore from parsed_values_json
    // These are based on MAX_POINTS = 5.0, so we scale by weight to get effective contribution
    const rawOverScore = parsedValues.overScore || 0
    const rawUnderScore = parsedValues.underScore || 0

    // Scale by weight to get effective contribution
    // Example: rawOverScore = 3.5 (from signal 0.7 × 5.0), weight = 70% → effective = 3.5 × 0.70 = 2.45
    const effectiveOverScore = rawOverScore * weightDecimal
    const effectiveUnderScore = rawUnderScore * weightDecimal

    totalOverScore += effectiveOverScore
    totalUnderScore += effectiveUnderScore

    factorContributions.push({
      key: factor.key,
      name: factor.name,
      z: factor.normalized_value || 0, // Keep signal for reference
      weight: weightDecimal,
      contribution: effectiveOverScore - effectiveUnderScore, // Net contribution
      // Add weighted scores for run log display
      weighted_contributions: {
        overScore: effectiveOverScore,
        underScore: effectiveUnderScore,
        net: effectiveOverScore - effectiveUnderScore
      },
      // Add weight percentage for display
      weight_percentage: weightPct,
      // Add parsed values for fallback
      parsed_values_json: {
        overScore: rawOverScore,
        underScore: rawUnderScore,
        signal: parsedValues.signal || 0,
        points: parsedValues.points || 0
      }
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
