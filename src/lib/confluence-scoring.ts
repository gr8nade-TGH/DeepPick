/**
 * CONFLUENCE SCORING SYSTEM
 *
 * A quality-based tier system where picks earn tiers through confluence of signals.
 * Units risked do NOT affect tier - only quality signals matter.
 *
 * SIGNALS (max 8 points):
 * 1. Edge Strength (0-3): Primary driver - how strong is the edge score?
 * 2. Specialization Record (0-2): Capper's win rate for this bet type
 * 3. Streak Bonus (0-1): Current win streak for this bet type
 * 4. Factor Alignment (-0.5 to +2): What % of factors agree with the pick?
 *
 * TIERS (designed so Common is 40-60% of picks):
 * - Legendary: ≥7.0 (exceptional - near max signals, <5% of picks)
 * - Elite: 6.0-6.9 (strong confluence)
 * - Rare: 5.0-5.9 (solid confluence)
 * - Uncommon: 4.0-4.9 (showing promise)
 * - Common: <4.0 (new cappers, average picks - 40-60% of picks)
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
  edgePoints: number        // 0-3
  specPoints: number        // 0-2
  streakPoints: number      // 0-1
  alignmentPoints: number   // -0.5 to +2
  alignmentPct: number      // 0-100 (for display)
}

export interface ConfluenceResult {
  confluenceScore: number
  tier: ConfluenceTier
  breakdown: ConfluenceBreakdown
}

/**
 * SIGNAL 1: Edge Strength (max +3 points)
 * The primary quality driver - higher edge score = better pick
 */
function getEdgeStrengthPoints(edgeScore: number): number {
  if (edgeScore >= 8.0) return 3.0
  if (edgeScore >= 6.0) return 2.0
  if (edgeScore >= 4.0) return 1.0
  return 0
}

/**
 * SIGNAL 2: Specialization Record (max +2 points)
 * Capper's historical win rate for this specific bet type
 * Requires minimum 10 graded picks to qualify
 */
function getSpecializationPoints(winRate?: number, sampleSize?: number): number {
  // No history or insufficient sample = no bonus
  if (winRate === undefined || sampleSize === undefined || sampleSize < 10) {
    return 0
  }

  if (winRate >= 58) return 2.0
  if (winRate >= 54) return 1.0
  return 0
}

/**
 * SIGNAL 3: Streak Bonus (max +1 point)
 * Current win streak for this bet type
 * No penalty for losing streaks - just no bonus
 */
function getStreakPoints(winStreak: number): number {
  if (winStreak >= 4) return 1.0
  if (winStreak >= 2) return 0.5
  return 0
}

/**
 * SIGNAL 4: Factor Alignment (range: -0.5 to +2 points)
 * What percentage of factors agree with the final pick direction?
 * 
 * Formula: Linear scale from 50% to 100%
 * - 100% alignment → +2.0 (perfect confluence)
 * - 75% alignment → +1.0
 * - 50% alignment → +0.0 (split decision)
 * - <50% alignment → -0.5 (most factors disagree - penalty)
 */
function getFactorAlignmentPoints(factorsOnSide: number, totalFactors: number): { points: number, pct: number } {
  if (totalFactors === 0) {
    return { points: 0, pct: 0 }
  }

  const alignmentPct = factorsOnSide / totalFactors
  const displayPct = Math.round(alignmentPct * 100)

  if (alignmentPct >= 0.5) {
    // Linear scale: 50% → 0 points, 100% → 2 points
    const points = (alignmentPct - 0.5) * 4
    return { points: Math.round(points * 10) / 10, pct: displayPct }
  }

  // Below 50% = conflicting signals penalty
  return { points: -0.5, pct: displayPct }
}

/**
 * Map confluence score to tier
 *
 * Thresholds designed so Common is the majority (40-60% of picks):
 * - Common: <4 (new cappers, average picks)
 * - Uncommon: 4-4.9 (showing promise)
 * - Rare: 5-5.9 (solid confluence)
 * - Elite: 6-6.9 (strong confluence)
 * - Legendary: ≥7 (exceptional - near max signals)
 */
function getTierFromScore(score: number): ConfluenceTier {
  if (score >= 7.0) return 'Legendary'
  if (score >= 6.0) return 'Elite'
  if (score >= 5.0) return 'Rare'
  if (score >= 4.0) return 'Uncommon'
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
    confluenceScore: Math.round(confluenceScore * 10) / 10,
    tier,
    breakdown: {
      edgePoints,
      specPoints,
      streakPoints,
      alignmentPoints,
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

