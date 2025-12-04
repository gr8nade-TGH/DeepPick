/**
 * CONFLUENCE SCORING SYSTEM (v2 - 1-100 Scale)
 *
 * A quality-based tier system where picks earn tiers through confluence of signals.
 * Units risked do NOT affect tier - only quality signals matter.
 *
 * SIGNALS (continuous scoring for unique outcomes):
 * 1. Edge Strength (35%): Primary driver - uses actual edge score (0-10 → 0-35)
 * 2. Specialization Record (20%): Capper's win rate for this bet type (0-100% → 0-20)
 * 3. Streak Bonus (10%): Current win streak for this bet type (0-10 → 0-10)
 * 4. Factor Alignment (35%): What % of factors agree with the pick (0-100% → 0-35)
 *
 * TIERS (1-100 scale, designed for ~40-50% Common picks):
 * - Legendary: ≥80 (exceptional confluence, <5% of picks)
 * - Elite: 65-79 (strong confluence)
 * - Rare: 50-64 (solid confluence)
 * - Uncommon: 35-49 (showing promise)
 * - Common: <35 (new cappers, average picks)
 */

export type ConfluenceTier = 'Legendary' | 'Elite' | 'Rare' | 'Uncommon' | 'Common'

export interface ConfluenceInput {
  // Signal 1: Edge Strength
  edgeScore: number  // 0-10 scale (the confidence score)

  // Signal 2: Specialization Record
  betType: 'total' | 'spread'
  specializationWinRate?: number  // 0-100 percentage
  specializationSampleSize?: number  // How many picks in history

  // Signal 3: Streak
  currentWinStreak: number  // Current consecutive wins for this bet type

  // Signal 4: Factor Alignment
  factorsOnPickSide: number  // How many factors agree with pick
  totalFactors: number  // Total factors used in this pick
}

export interface ConfluenceBreakdown {
  edgePoints: number        // 0-35 (continuous)
  specPoints: number        // 0-20 (continuous)
  streakPoints: number      // 0-10 (continuous)
  alignmentPoints: number   // 0-35 (continuous)
  alignmentPct: number      // 0-100 (for display)
}

export interface ConfluenceResult {
  confluenceScore: number
  tier: ConfluenceTier
  breakdown: ConfluenceBreakdown
}

// Weight constants for the 1-100 scale
const WEIGHTS = {
  EDGE_STRENGTH: 35,      // 35% weight (max 35 points)
  SPECIALIZATION: 20,     // 20% weight (max 20 points)
  STREAK: 10,             // 10% weight (max 10 points)
  FACTOR_ALIGNMENT: 35    // 35% weight (max 35 points)
} as const

/**
 * SIGNAL 1: Edge Strength (max 35 points)
 * Continuous scoring based on edge score (0-10 scale)
 * Uses smooth curve to reward higher edges more
 */
function getEdgeStrengthPoints(edgeScore: number): number {
  // Clamp to 0-10 range
  const clamped = Math.max(0, Math.min(10, edgeScore))
  // Linear scale: 0-10 → 0-35
  return (clamped / 10) * WEIGHTS.EDGE_STRENGTH
}

/**
 * SIGNAL 2: Specialization Record (max 20 points)
 * Continuous scoring based on win rate percentage
 * Requires minimum 10 graded picks to qualify
 * Win rates 45-60% map to 0-20 points (below 45% = 0, above 60% = 20)
 */
function getSpecializationPoints(winRate?: number, sampleSize?: number): number {
  // No history or insufficient sample = 0 points
  if (winRate === undefined || sampleSize === undefined || sampleSize < 10) {
    return 0
  }

  // Map win rate 45-60% to 0-20 points
  // Below 45% = 0, Above 60% = 20
  const MIN_RATE = 45
  const MAX_RATE = 60

  if (winRate <= MIN_RATE) return 0
  if (winRate >= MAX_RATE) return WEIGHTS.SPECIALIZATION

  // Linear interpolation between 45-60%
  const normalized = (winRate - MIN_RATE) / (MAX_RATE - MIN_RATE)
  return normalized * WEIGHTS.SPECIALIZATION
}

/**
 * SIGNAL 3: Streak Bonus (max 10 points)
 * Continuous scoring based on win streak count
 * 0 streak = 0 points, 5+ streak = max 10 points
 */
function getStreakPoints(winStreak: number): number {
  if (winStreak <= 0) return 0

  // Cap at 5 wins for max points
  const capped = Math.min(winStreak, 5)
  return (capped / 5) * WEIGHTS.STREAK
}

/**
 * SIGNAL 4: Factor Alignment (max 35 points)
 * Continuous scoring based on alignment percentage
 * 50% = 0 points (split decision)
 * 100% = 35 points (perfect alignment)
 * Below 50% = 0 points (no penalty in new system)
 */
function getFactorAlignmentPoints(factorsOnSide: number, totalFactors: number): { points: number, pct: number } {
  if (totalFactors === 0) {
    return { points: 0, pct: 0 }
  }

  const alignmentPct = factorsOnSide / totalFactors
  const displayPct = Math.round(alignmentPct * 100)

  if (alignmentPct <= 0.5) {
    // At or below 50% = 0 points (split or worse)
    return { points: 0, pct: displayPct }
  }

  // Scale 50-100% to 0-35 points
  // (alignmentPct - 0.5) / 0.5 gives 0-1 range for 50-100%
  const normalized = (alignmentPct - 0.5) / 0.5
  const points = normalized * WEIGHTS.FACTOR_ALIGNMENT

  return { points, pct: displayPct }
}

/**
 * Map Pick Power score to tier (1-100 scale)
 *
 * TIER THRESHOLDS:
 * - Legendary: 90+ (exceptional - near max signals, <5% of picks)
 * - Elite: 75-89 (strong confluence)
 * - Rare: 60-74 (solid confluence)
 * - Uncommon: 45-59 (showing promise)
 * - Common: 0-44 (new cappers, average picks)
 */
function getTierFromScore(score: number): ConfluenceTier {
  if (score >= 90) return 'Legendary'
  if (score >= 75) return 'Elite'
  if (score >= 60) return 'Rare'
  if (score >= 45) return 'Uncommon'
  return 'Common'
}

/**
 * Calculate confluence score and tier
 */
export function calculateConfluenceScore(input: ConfluenceInput): ConfluenceResult {
  const edgePoints = getEdgeStrengthPoints(input.edgeScore)
  const specPoints = getSpecializationPoints(input.specializationWinRate, input.specializationSampleSize)
  const streakPoints = getStreakPoints(input.currentWinStreak)
  const { points: alignmentPoints, pct: alignmentPct } = getFactorAlignmentPoints(
    input.factorsOnPickSide,
    input.totalFactors
  )

  const confluenceScore = edgePoints + specPoints + streakPoints + alignmentPoints
  const tier = getTierFromScore(confluenceScore)

  return {
    confluenceScore: Math.round(confluenceScore * 10) / 10, // Round to 1 decimal
    tier,
    breakdown: {
      edgePoints: Math.round(edgePoints * 10) / 10,
      specPoints: Math.round(specPoints * 10) / 10,
      streakPoints: Math.round(streakPoints * 10) / 10,
      alignmentPoints: Math.round(alignmentPoints * 10) / 10,
      alignmentPct
    }
  }
}

/**
 * Calculate factor alignment from factor contributions
 *
 * For TOTALS: a factor agrees with the pick if its net contribution matches pick direction
 *   - Pick OVER: factors with (overScore > underScore) agree
 *   - Pick UNDER: factors with (underScore > overScore) agree
 *
 * For SPREAD: a factor agrees with the pick if its net contribution matches pick direction
 *   - Pick AWAY: factors with (awayScore > homeScore) agree
 *   - Pick HOME: factors with (homeScore > awayScore) agree
 *
 * @returns { factorsOnSide, totalFactors }
 */
export function calculateFactorAlignment(
  factorContributions: Array<{
    weighted_contributions?: {
      overScore?: number
      underScore?: number
      awayScore?: number
      homeScore?: number
      net: number
    }
  }>,
  pickDirection: 'OVER' | 'UNDER' | 'AWAY' | 'HOME' | string
): { factorsOnSide: number, totalFactors: number } {
  if (!factorContributions || factorContributions.length === 0) {
    return { factorsOnSide: 0, totalFactors: 0 }
  }

  let factorsOnSide = 0
  let totalFactors = 0

  const isPickPositive = pickDirection === 'OVER' || pickDirection === 'AWAY'

  for (const factor of factorContributions) {
    const wc = factor.weighted_contributions
    if (!wc) continue

    // Skip neutral factors (net === 0) - they don't lean either way
    // This prevents neutral factors from artificially lowering alignment %
    if (wc.net === 0) continue

    totalFactors++

    // Net > 0 means OVER/AWAY bias, Net < 0 means UNDER/HOME bias
    const factorBias = wc.net > 0

    // Factor agrees if its bias matches the pick direction
    if (isPickPositive && factorBias) {
      factorsOnSide++
    } else if (!isPickPositive && !factorBias) {
      factorsOnSide++
    }
  }

  return { factorsOnSide, totalFactors }
}

