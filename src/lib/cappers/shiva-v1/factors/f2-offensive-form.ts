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
  const MAX_POINTS = 2.0
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
      key: 'offForm',
      name: 'Offensive Form vs League',
      normalized_value: 0,
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

  // TODO: Integrate with the new calculateOffensiveFormPoints function
  // For now, return a placeholder that matches the expected interface
  return {
    key: 'offForm',
    name: 'Offensive Form vs League',
    normalized_value: 0,
    parsed_values_json: {
      overScore: 0,
      underScore: 0,
      awayContribution: 0,
      homeContribution: 0
    },
    caps_applied: false,
    cap_reason: null,
    notes: 'Placeholder - new implementation pending'
  }
}