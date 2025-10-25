/**
 * Offensive Form vs League Factor (F2)
 * 
 * Calculates combined team offensive efficiency vs league average
 * Uses smooth tanh scaling with single positive score system
 */

export interface OffensiveFormInput {
  homeORtg: number
  awayORtg: number
  leagueORtg: number
}

export interface OffensiveFormOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    combinedORtg: number
    advantage: number
    reason?: string
  }
}

/**
 * Helper function to clamp a value between min and max
 */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * Helper function to calculate hyperbolic tangent
 */
function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

/**
 * Calculate offensive form factor points using single positive score system
 * Each factor contributes to either Over OR Under, never both
 * 
 * @param input - Team offensive ratings and league average
 * @returns Over/Under scores and debugging metadata
 */
export function calculateOffensiveFormPoints(input: OffensiveFormInput): OffensiveFormOutput {
  const { homeORtg, awayORtg, leagueORtg } = input
  const MAX_POINTS = 5.0
  const SCALE = 10.0

  // Input validation
  if (![homeORtg, awayORtg, leagueORtg].every(v => Number.isFinite(v) && v > 0)) {
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        combinedORtg: 0,
        advantage: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate combined offensive efficiency
  const combinedORtg = (homeORtg + awayORtg) / 2

  // Calculate advantage vs league average
  let advantage = combinedORtg - leagueORtg

  // Safety cap for extreme outliers (prevent mathematical issues)
  advantage = clamp(advantage, -30, 30)

  // Calculate signal using tanh for smooth saturation
  const rawSignal = tanh(advantage / SCALE)
  
  // Apply hard limits to allow full ±1.0 signal for extreme cases
  const signal = clamp(rawSignal, -1, 1)

  // Convert to single positive scores for one direction
  let overScore = 0
  let underScore = 0
  
  if (signal > 0) {
    // Positive signal favors Over (high offense = more points)
    overScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal favors Under (low offense = fewer points)
    underScore = Math.abs(signal) * MAX_POINTS
  }
  // signal = 0 means neutral, both scores remain 0

  return {
    overScore,
    underScore,
    signal,
    meta: {
      combinedORtg,
      advantage
    }
  }
}

/**
 * Calculate expected total impact for logging/debugging
 * 
 * @param advantage - Offensive advantage vs league average
 * @returns Estimated points added to game total
 */
export function estimateOffensiveImpact(advantage: number): number {
  // League average: ~1.0 points per ORtg point difference
  return advantage * 1.0
}

/**
 * Legacy wrapper function for compatibility with existing code
 * This will be replaced when we integrate the new calculation logic
 */
export function computeOffensiveForm(bundle: any, ctx: any): any {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 2,
      key: 'offForm',
      name: 'Offensive Form vs League',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        overScore: 0,
        underScore: 0,
        awayContribution: 0,
        homeContribution: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Get offensive ratings from bundle
  const awayORtg = bundle.awayORtgLast10 || 110.0
  const homeORtg = bundle.homeORtgLast10 || 110.0
  const leagueORtg = bundle.leagueORtg || 110.0
  
  // Calculate combined offensive efficiency vs league
  const combinedORtg = (awayORtg + homeORtg) / 2
  const advantage = combinedORtg - leagueORtg
  
  // Use tanh for smooth saturation (advantage/10 gives good range)
  const signal = Math.tanh(advantage / 10)
  
  // Convert to over/under scores
  const maxPoints = 2.0
  const overScore = signal > 0 ? Math.abs(signal) * maxPoints : 0
  const underScore = signal < 0 ? Math.abs(signal) * maxPoints : 0
  
  return {
    factor_no: 2,
    key: 'offForm',
    name: 'Offensive Form vs League',
    normalized_value: signal,
    raw_values_json: {
      awayORtg,
      homeORtg,
      leagueORtg,
      combinedORtg,
      advantage
    },
    parsed_values_json: {
      overScore,
      underScore,
      awayContribution: Math.max(overScore, underScore) / 2,
      homeContribution: Math.max(overScore, underScore) / 2,
      signal
    },
    caps_applied: false,
    cap_reason: null,
    notes: `ORtg: ${combinedORtg.toFixed(1)} vs ${leagueORtg.toFixed(1)} (Δ${advantage.toFixed(1)})`
  }
}