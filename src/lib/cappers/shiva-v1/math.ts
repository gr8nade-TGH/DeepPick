/**
 * SHIVA v1 Math Engine - Deterministic Core
 * All constants and calculations for NBA pick generation
 */

// ============================================================================
// CONSTANTS (Single Source of Truth)
// ============================================================================

export const HOME_EDGE_100 = 1.5 // Home court advantage per 100 possessions
export const H2H_CAP_100 = 6 // Cap for head-to-head matchup edge (±6)
export const SIDE_CAP = 6 // Cap for side factors (point spread)
export const TOTAL_CAP = 12 // Cap for total factors (point total)
export const LEAGUE_ORtg = 114.0 // League average offensive rating
export const MARKET_ADJ_MAX = 1.2 // Maximum market adjustment multiplier

// Unit thresholds based on final confidence
export const UNIT_THRESHOLDS = {
  PASS: 2.5, // Below this, pass on the game
  ONE_UNIT: 3.0, // 2.5 - 3.0 = 1 unit
  TWO_UNITS: 4.0, // 3.01 - 4.0 = 2 units
  // Above 4.0 = 3 units
} as const

// ============================================================================
// CORE MATH FUNCTIONS
// ============================================================================

/**
 * Calculate expected pace using harmonic mean
 * @param paceA Team A pace
 * @param paceB Team B pace
 * @returns Expected pace for the game
 */
export function paceHarmonic(paceA: number, paceB: number): number {
  if (paceA <= 0 || paceB <= 0) return 0
  return (2 * paceA * paceB) / (paceA + paceB)
}

/**
 * Calculate delta per 100 possessions from weighted factors
 * @param f1 Factor 1 contribution (per 100)
 * @param f2 Factor 2 contribution (per 100)
 * @param f3 Factor 3 contribution (per 100)
 * @param f4 Factor 4 contribution (per 100)
 * @param f5 Factor 5 contribution (per 100)
 * @param f6 Factor 6 (home court) contribution (per 100)
 * @param f7 Factor 7 (3PT environment) contribution (per 100)
 * @param weights Object with weights for each factor (as decimals, e.g., 0.21)
 * @returns Delta per 100 possessions (positive = home team favored)
 */
export function delta100(
  f1: number,
  f2: number,
  f3: number,
  f4: number,
  f5: number,
  f6: number,
  f7: number,
  weights: {
    f1: number
    f2: number
    f3: number
    f4: number
    f5: number
    f6: number
    f7: number
  }
): number {
  return (
    f1 * weights.f1 +
    f2 * weights.f2 +
    f3 * weights.f3 +
    f4 * weights.f4 +
    f5 * weights.f5 +
    f6 * weights.f6 +
    f7 * weights.f7
  )
}

/**
 * Convert delta per 100 to actual point spread prediction
 * @param delta100Val Delta per 100 possessions
 * @param pace Expected pace for the game
 * @returns Predicted point spread (positive = home team favored)
 */
export function spreadFromDelta(delta100Val: number, pace: number): number {
  if (pace <= 0) return 0
  return (delta100Val * pace) / 100
}

/**
 * Calculate predicted total points from offensive ratings and pace
 * @param ortgA Team A offensive rating
 * @param ortgB Team B offensive rating
 * @param pace Expected pace
 * @returns Predicted total points
 */
export function totalFromORtgs(ortgA: number, ortgB: number, pace: number): number {
  if (pace <= 0) return 0
  return ((ortgA + ortgB) * pace) / 100
}

/**
 * Calculate individual team scores from spread and total
 * @param spread Predicted spread (positive = home favored)
 * @param total Predicted total points
 * @returns Object with home_pts and away_pts
 */
export function scoresFromSpreadTotal(
  spread: number,
  total: number
): { home_pts: number; away_pts: number } {
  const home_pts = (total + spread) / 2
  const away_pts = (total - spread) / 2
  return {
    home_pts: Math.round(home_pts),
    away_pts: Math.round(away_pts),
  }
}

/**
 * Calculate Conf7 (confidence after 7 factors, before market adjustment)
 * Based on spread prediction magnitude
 * @param spreadPred Predicted spread (absolute value used)
 * @returns Conf7 score (1.0 + normalized spread component)
 */
export function conf7(spreadPred: number): number {
  const absPred = Math.abs(spreadPred)
  // Formula: 1.0 + 4.0 * (spread / 6.0)
  // At spread=6, Conf7=5.0; at spread=0, Conf7=1.0
  const normalized = Math.min(absPred / 6.0, 1.0) // Cap at 1.0
  return 1.0 + 4.0 * normalized
}

/**
 * Calculate market adjustment based on edge magnitudes
 * @param edgeSidePts Edge on side (points)
 * @param edgeTotalPts Edge on total (points)
 * @returns Market adjustment value (can be positive or negative)
 */
export function marketAdj(edgeSidePts: number, edgeTotalPts: number): number {
  // Normalize edges
  const edgeSideNorm = edgeSidePts / 6.0 // Normalize by SIDE_CAP
  const edgeTotalNorm = edgeTotalPts / 12.0 // Normalize by TOTAL_CAP

  // Determine dominant edge
  const absEdgeSide = Math.abs(edgeSideNorm)
  const absEdgeTotal = Math.abs(edgeTotalNorm)

  // Use the dominant edge for adjustment
  const dominantEdge = absEdgeSide > absEdgeTotal ? edgeSideNorm : edgeTotalNorm

  // Apply market adjustment with max cap
  const adjustment = MARKET_ADJ_MAX * dominantEdge

  // Cap the adjustment at ±1.2
  return Math.max(-MARKET_ADJ_MAX, Math.min(MARKET_ADJ_MAX, adjustment))
}

/**
 * Calculate final confidence (Conf_final) after market adjustment
 * @param conf7Val Conf7 value (pre-market)
 * @param marketAdjVal Market adjustment value
 * @returns Final confidence score
 */
export function confFinal(conf7Val: number, marketAdjVal: number): number {
  return conf7Val + marketAdjVal
}

/**
 * Determine units to bet based on final confidence
 * @param confFinalVal Final confidence score
 * @returns Units to bet (0 = pass, 1-3 = units)
 */
export function unitsFromConfidence(confFinalVal: number): number {
  if (confFinalVal < UNIT_THRESHOLDS.PASS) return 0 // Pass
  if (confFinalVal < UNIT_THRESHOLDS.ONE_UNIT) return 1 // 1 unit
  if (confFinalVal < UNIT_THRESHOLDS.TWO_UNITS) return 2 // 2 units
  return 3 // 3 units
}

/**
 * Apply cap to a value with optional reason
 * @param value Raw value
 * @param cap Maximum absolute value
 * @returns Object with capped value, whether cap was applied, and reason
 */
export function applyCap(
  value: number,
  cap: number
): { value: number; capped: boolean; reason: string | null } {
  const absValue = Math.abs(value)
  if (absValue > cap) {
    const sign = value >= 0 ? 1 : -1
    return {
      value: sign * cap,
      capped: true,
      reason: `Capped at ±${cap} (was ${value.toFixed(2)})`,
    }
  }
  return {
    value,
    capped: false,
    reason: null,
  }
}

/**
 * Determine pick type based on edges and confidence
 * @param edgeSidePts Edge on side (points)
 * @param edgeTotalPts Edge on total (points)
 * @param confFinalVal Final confidence
 * @param marketSpread Market spread line
 * @param marketTotal Market total line
 * @returns Pick type recommendation ('SPREAD' | 'MONEYLINE' | 'TOTAL' | 'PASS')
 */
export function determinePickType(
  edgeSidePts: number,
  edgeTotalPts: number,
  confFinalVal: number,
  marketSpread: number,
  marketTotal: number
): 'SPREAD' | 'MONEYLINE' | 'TOTAL' | 'PASS' {
  // Check if we should pass
  if (confFinalVal < UNIT_THRESHOLDS.PASS) return 'PASS'

  // Determine dominant edge
  const absEdgeSide = Math.abs(edgeSidePts)
  const absEdgeTotal = Math.abs(edgeTotalPts)

  if (absEdgeTotal > absEdgeSide) {
    return 'TOTAL'
  }

  // For side picks, check if we should use moneyline instead of spread
  const isFavorite = marketSpread < 0
  const isUnderdog = marketSpread > 0

  // Favorite logic: if model edge on spread ≤ 2.5, consider ML only if implied price ≤ −250
  if (isFavorite && absEdgeSide <= 2.5) {
    // For now, default to spread (ML price check would require odds data)
    return 'SPREAD'
  }

  // Underdog logic: if model win prob ≥ 40% and ML ≥ +150, allow ML
  if (isUnderdog) {
    // For now, default to spread (win prob calc would require more context)
    return 'SPREAD'
  }

  return 'SPREAD'
}
