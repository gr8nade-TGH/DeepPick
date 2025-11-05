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
    // Weighted scores for run log display (supports both TOTALS and SPREAD)
    weighted_contributions?: {
      overScore?: number  // TOTALS
      underScore?: number // TOTALS
      awayScore?: number  // SPREAD
      homeScore?: number  // SPREAD
      net: number
    }
    // Add weight percentage for display
    weight_percentage?: number
    // Parsed values for fallback (supports both TOTALS and SPREAD)
    parsed_values_json?: {
      overScore?: number  // TOTALS
      underScore?: number // TOTALS
      awayScore?: number  // SPREAD
      homeScore?: number  // SPREAD
      signal: number
      points: number
    }
  }>
}

/**
 * Calculate confidence using Over/Under score model (TOTALS) or Away/Home score model (SPREAD/MONEYLINE)
 *
 * TOTALS Logic:
 * 1. Each factor has overScore and underScore (both positive or 0)
 * 2. Sum all overScore values across factors
 * 3. Sum all underScore values across factors
 * 4. Pick direction = whichever total is higher
 * 5. Confidence = the higher total
 *
 * SPREAD/MONEYLINE Logic:
 * 1. Each factor has awayScore and homeScore (both positive or 0)
 * 2. Sum all awayScore values across factors
 * 3. Sum all homeScore values across factors
 * 4. Pick direction = whichever total is higher (away or home)
 * 5. Confidence = the higher total
 *
 * Example (TOTALS): If total overScore = 8.5 and total underScore = 3.2
 *   → Pick OVER with confidence 8.5
 * Example (SPREAD): If total awayScore = 8.5 and total homeScore = 3.2
 *   → Pick AWAY with confidence 8.5
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

  // Detect bet type from confSource or first factor
  // For TOTALS: parsed_values_json has overScore/underScore
  // For SPREAD: parsed_values_json has awayScore/homeScore
  const isTotals = confSource.includes('totals') || factors.some(f => f.parsed_values_json?.overScore !== undefined)
  const isSpread = confSource.includes('spread') || factors.some(f => f.parsed_values_json?.awayScore !== undefined)

  console.log('[ConfidenceCalculator] Bet type detection:', { isTotals, isSpread, confSource })

  // Sum scores across all factors (TOTALS: over/under, SPREAD: away/home)
  // NOTE: Factors return scores based on MAX_POINTS = 5.0
  // We need to scale by (weight / 100) to get effective max points
  // Example: Pace Index with weight=70% → Effective max = 5.0 × 0.70 = 3.5 points
  let totalOverScore = 0
  let totalUnderScore = 0
  let totalAwayScore = 0
  let totalHomeScore = 0
  const factorContributions: ConfidenceOutput['factorContributions'] = []

  for (const factor of factors) {
    const weightPct = factorWeights[factor.key] || 0 // Weight percentage (0-100)
    const weightDecimal = weightPct / 100 // Convert to decimal (0-1)
    const parsedValues = factor.parsed_values_json || {}

    if (isTotals) {
      // TOTALS: Use overScore and underScore
      const rawOverScore = parsedValues.overScore || 0
      const rawUnderScore = parsedValues.underScore || 0

      // Scale by weight to get effective contribution
      const effectiveOverScore = rawOverScore * weightDecimal
      const effectiveUnderScore = rawUnderScore * weightDecimal

      totalOverScore += effectiveOverScore
      totalUnderScore += effectiveUnderScore

      factorContributions.push({
        key: factor.key,
        name: factor.name,
        z: factor.normalized_value || 0,
        weight: weightDecimal,
        contribution: effectiveOverScore - effectiveUnderScore,
        weighted_contributions: {
          overScore: effectiveOverScore,
          underScore: effectiveUnderScore,
          net: effectiveOverScore - effectiveUnderScore
        },
        weight_percentage: weightPct,
        parsed_values_json: {
          overScore: rawOverScore,
          underScore: rawUnderScore,
          signal: parsedValues.signal || 0,
          points: parsedValues.points || 0
        }
      })
    } else if (isSpread) {
      // SPREAD/MONEYLINE: Use awayScore and homeScore from parsed_values_json
      const rawAwayScore = parsedValues.awayScore || 0
      const rawHomeScore = parsedValues.homeScore || 0

      // Scale by weight to get effective contribution
      const effectiveAwayScore = rawAwayScore * weightDecimal
      const effectiveHomeScore = rawHomeScore * weightDecimal

      totalAwayScore += effectiveAwayScore
      totalHomeScore += effectiveHomeScore

      factorContributions.push({
        key: factor.key,
        name: factor.name,
        z: factor.normalized_value || 0,
        weight: weightDecimal,
        contribution: effectiveAwayScore - effectiveHomeScore,
        // SPREAD: Use awayScore/homeScore (NOT overScore/underScore)
        weighted_contributions: {
          awayScore: effectiveAwayScore,
          homeScore: effectiveHomeScore,
          net: effectiveAwayScore - effectiveHomeScore
        },
        weight_percentage: weightPct,
        // SPREAD: Use awayScore/homeScore (NOT overScore/underScore)
        parsed_values_json: {
          awayScore: rawAwayScore,
          homeScore: rawHomeScore,
          signal: parsedValues.signal || 0,
          points: parsedValues.points || 0
        }
      })
    }
  }

  // Determine pick direction and confidence based on bet type
  let pickDirection: string
  let confScore: number
  let edgeRaw: number

  if (isTotals) {
    const pickOver = totalOverScore > totalUnderScore
    confScore = pickOver ? totalOverScore : totalUnderScore
    edgeRaw = totalOverScore - totalUnderScore // Positive = OVER, Negative = UNDER
    pickDirection = pickOver ? 'OVER' : 'UNDER'

    console.log('[ConfidenceCalculator] TOTALS Score calculation:', {
      totalOverScore,
      totalUnderScore,
      pickDirection,
      confScore,
      edgeRaw
    })
  } else {
    const pickAway = totalAwayScore > totalHomeScore
    confScore = pickAway ? totalAwayScore : totalHomeScore
    edgeRaw = totalAwayScore - totalHomeScore // Positive = AWAY, Negative = HOME
    pickDirection = pickAway ? 'AWAY' : 'HOME'

    console.log('[ConfidenceCalculator] SPREAD Score calculation:', {
      totalAwayScore,
      totalHomeScore,
      pickDirection,
      confScore,
      edgeRaw
    })
  }

  return {
    edgeRaw, // Positive = OVER/AWAY bias, Negative = UNDER/HOME bias
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
