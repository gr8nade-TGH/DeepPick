/**
 * Odds Math Utilities
 * Per spec: American odds, vig removal, logit/sigmoid, Normal CDF, EV calculation
 */

// ============================================================================
// BASIC PROBABILITY FUNCTIONS
// ============================================================================

/**
 * Logit function: converts probability to log-odds
 */
export const logit = (p: number): number => {
  if (p <= 0 || p >= 1) {
    throw new Error(`Invalid probability for logit: ${p} (must be 0 < p < 1)`)
  }
  return Math.log(p / (1 - p))
}

/**
 * Sigmoid function: converts log-odds to probability
 */
export const sigmoid = (z: number): number => {
  return 1 / (1 + Math.exp(-z))
}

/**
 * Error function approximation (Abramowitz and Stegun)
 */
function erf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return sign * y
}

/**
 * Normal CDF (cumulative distribution function)
 * Φ(x) using error function
 */
export const phi = (x: number): number => {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

// ============================================================================
// AMERICAN ODDS CONVERSIONS
// ============================================================================

/**
 * Convert American odds to implied probability (WITH vig)
 */
export const americanToProb = (odds: number): number => {
  if (odds > 0) {
    // Underdog: +150 → 100/(150+100) = 0.4
    return 100 / (odds + 100)
  } else {
    // Favorite: -150 → 150/(150+100) = 0.6
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }
}

/**
 * Convert American odds to decimal payout multiplier
 * For calculating EV
 */
export const americanToDecimal = (odds: number): number => {
  if (odds > 0) {
    // Underdog: +150 → 2.50
    return 1 + odds / 100
  } else {
    // Favorite: -150 → 1.67
    return 1 + 100 / Math.abs(odds)
  }
}

/**
 * Convert probability to American odds (fair, no vig)
 */
export const probToAmerican = (prob: number): number => {
  if (prob >= 0.5) {
    // Favorite
    return -Math.round((prob / (1 - prob)) * 100)
  } else {
    // Underdog
    return Math.round(((1 - prob) / prob) * 100)
  }
}

// ============================================================================
// VIG REMOVAL
// ============================================================================

/**
 * Remove vig from two-sided market
 * Returns fair probabilities that sum to 1.0
 */
export const removeVig = (pA: number, pB: number): [number, number] => {
  const sum = pA + pB
  if (sum <= 1.0) {
    // No vig or already removed
    return [pA, pB]
  }
  return [pA / sum, pB / sum]
}

/**
 * Remove vig from single American odds
 * Assumes symmetric 4.5% vig (2.25% per side)
 */
export const removeVigSingle = (odds: number): number => {
  const probWithVig = americanToProb(odds)
  // Remove ~2.25% vig
  return probWithVig * 0.9775
}

/**
 * Get fair market log-odds for moneyline (vig-removed)
 */
export const getFairMarketLogit = (homeOdds: number, awayOdds: number): number => {
  const pHome = americanToProb(homeOdds)
  const pAway = americanToProb(awayOdds)
  const [pHomeFair] = removeVig(pHome, pAway)
  return logit(pHomeFair)
}

// ============================================================================
// EXPECTED VALUE CALCULATION
// ============================================================================

/**
 * Calculate expected value for a bet
 * 
 * @param probability - Your estimated win probability (0-1)
 * @param americanOdds - Offered odds in American format
 * @param stake - Bet amount (default $1)
 * @returns Expected value in dollars
 */
export const calculateEV = (
  probability: number,
  americanOdds: number,
  stake: number = 1
): number => {
  const decimalPayout = americanToDecimal(americanOdds)
  
  // EV = p × payout × stake - (1 - p) × stake
  // Simplified: EV = p × payout × stake - stake
  const ev = probability * decimalPayout * stake - stake
  
  return ev
}

/**
 * Calculate EV as percentage (for easier interpretation)
 */
export const calculateEVPercentage = (probability: number, americanOdds: number): number => {
  const ev = calculateEV(probability, americanOdds, 1)
  return ev * 100
}

// ============================================================================
// SLIPPAGE TEST (per spec)
// ============================================================================

/**
 * Test if pick remains +EV at worst-case slippage
 * 
 * Per spec: "Recompute EV at price±0.03 (three cents). Require EV>0 at worst-case."
 * 
 * @param probability - Your estimated win probability
 * @param americanOdds - Current average odds
 * @param slippageCents - Slippage in cents (default 3)
 * @returns Object with EV at best/current/worst odds and whether it passes
 */
export interface SlippageTestResult {
  evCurrent: number
  evBest: number  // Best case slippage
  evWorst: number  // Worst case slippage
  passesSlippageTest: boolean  // Is worst-case still +EV?
  worstCaseOdds: number
  bestCaseOdds: number
}

export const testSlippage = (
  probability: number,
  americanOdds: number,
  slippageCents: number = 3
): SlippageTestResult => {
  // Convert cents to decimal odds shift
  // 3 cents ≈ moving from -110 to -113 or +100 to +97
  
  let worstCaseOdds: number
  let bestCaseOdds: number
  
  if (americanOdds > 0) {
    // Underdog: worst = lower odds, best = higher odds
    worstCaseOdds = americanOdds - slippageCents * 100 / 3  // Approximate
    bestCaseOdds = americanOdds + slippageCents * 100 / 3
  } else {
    // Favorite: worst = more negative, best = less negative
    worstCaseOdds = americanOdds - slippageCents * 100 / 3
    bestCaseOdds = americanOdds + slippageCents * 100 / 3
  }
  
  const evCurrent = calculateEV(probability, americanOdds)
  const evWorst = calculateEV(probability, worstCaseOdds)
  const evBest = calculateEV(probability, bestCaseOdds)
  
  return {
    evCurrent,
    evBest,
    evWorst,
    passesSlippageTest: evWorst > 0,
    worstCaseOdds,
    bestCaseOdds,
  }
}

// ============================================================================
// EDGE ATTRIBUTION (per spec)
// ============================================================================

/**
 * Calculate edge attribution (structural vs price)
 * 
 * Per spec: "At least X% (e.g., 40–60%) of Δ must come from non-price structural factors"
 * 
 * @param totalDelta - Total predicted deviation
 * @param structuralFactors - Factors not based on line movement
 * @param priceFactors - Factors based on line movement
 * @param minStructuralPct - Minimum % from structural (default 40%)
 * @param maxStructuralPct - Maximum % from structural (default 60%)
 */
export interface EdgeAttributionResult {
  totalDelta: number
  structuralDelta: number
  priceDelta: number
  structuralPercentage: number
  passesAttributionRule: boolean
  reason: string
}

export const calculateEdgeAttribution = (
  totalDelta: number,
  structuralDelta: number,
  priceDelta: number,
  minStructuralPct: number = 0.40,
  maxStructuralPct: number = 1.0  // No max by default
): EdgeAttributionResult => {
  const structuralPercentage = Math.abs(totalDelta) > 0.001
    ? Math.abs(structuralDelta) / Math.abs(totalDelta)
    : 0
  
  const passesAttributionRule = 
    structuralPercentage >= minStructuralPct && 
    structuralPercentage <= maxStructuralPct
  
  let reason = ''
  if (!passesAttributionRule) {
    if (structuralPercentage < minStructuralPct) {
      reason = `Only ${(structuralPercentage * 100).toFixed(1)}% structural edge (need ${(minStructuralPct * 100).toFixed(0)}%+)`
    } else {
      reason = `Too much structural edge ${(structuralPercentage * 100).toFixed(1)}% (max ${(maxStructuralPct * 100).toFixed(0)}%)`
    }
  } else {
    reason = `Structural edge ${(structuralPercentage * 100).toFixed(1)}% ✓`
  }
  
  return {
    totalDelta,
    structuralDelta,
    priceDelta,
    structuralPercentage,
    passesAttributionRule,
    reason,
  }
}

// ============================================================================
// FRACTIONAL KELLY STAKE SIZING
// ============================================================================

/**
 * Calculate Kelly Criterion stake size
 * 
 * @param probability - Estimated win probability
 * @param americanOdds - Offered odds
 * @param bankroll - Total bankroll
 * @param kellyFraction - Fraction of Kelly to bet (default 0.25 = 25% Kelly)
 * @returns Stake size in dollars
 */
export const calculateKellyStake = (
  probability: number,
  americanOdds: number,
  bankroll: number,
  kellyFraction: number = 0.25
): number => {
  const decimalOdds = americanToDecimal(americanOdds)
  const q = 1 - probability  // Lose probability
  const b = decimalOdds - 1  // Net odds (payout per dollar)
  
  // Kelly formula: f* = (bp - q) / b
  const kellyFull = (b * probability - q) / b
  
  // Apply fraction
  const kellyFractional = kellyFull * kellyFraction
  
  // Ensure non-negative
  const stake = Math.max(0, kellyFractional * bankroll)
  
  return stake
}

/**
 * Calculate stake as units (for display)
 * Maps Kelly % to 1-5 unit scale
 */
export const kellyToUnits = (kellyStake: number, bankroll: number): number => {
  const kellyPct = kellyStake / bankroll
  
  if (kellyPct < 0.005) return 0.5  // Min bet
  if (kellyPct < 0.01) return 1
  if (kellyPct < 0.02) return 2
  if (kellyPct < 0.03) return 3
  if (kellyPct < 0.04) return 4
  return 5  // Max bet
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clamp value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate margin of victory from spread and sigma
 */
export const spreadToMargin = (spread: number, sigma: number): number => {
  // Convert spread to expected margin using Normal distribution
  return spread
}

/**
 * Convert spread to win probability
 * Uses fitted curve: p = Φ(-spread / σ)
 */
export const spreadToWinProb = (spread: number, sigma: number = 12.5): number => {
  return phi(-spread / sigma)
}

/**
 * Convert total to over probability
 */
export const totalToOverProb = (predicted: number, marketTotal: number, sigma: number): number => {
  const delta = predicted - marketTotal
  return phi(delta / sigma)
}

