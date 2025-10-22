/**
 * Matchup Pace Index Factor (F1)
 * 
 * Calculates expected game pace based on both teams' pace interaction
 * Uses smooth tanh scaling with hard limits for realistic point distribution
 */

export interface PaceFactorInput {
  homePace: number
  awayPace: number
  leaguePace: number
}

export interface PaceFactorOutput {
  points: number
  signal: number
  meta: {
    expPace: number
    paceDelta: number
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
 * Calculate pace factor points using smooth tanh scaling with hard limits
 * 
 * @param input - Team pace data and league average
 * @returns Points awarded and debugging metadata
 */
export function calculatePaceFactorPoints(input: PaceFactorInput): PaceFactorOutput {
  const { homePace, awayPace, leaguePace } = input
  const MAX_POINTS = 2.0

  // Input validation
  if (![homePace, awayPace, leaguePace].every(v => Number.isFinite(v) && v > 0)) {
    return {
      points: 0,
      signal: 0,
      meta: {
        expPace: 0,
        paceDelta: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate expected game pace
  const expPace = (homePace + awayPace) / 2

  // Calculate pace difference vs league
  let paceDelta = expPace - leaguePace

  // Safety cap for extreme outliers (prevent mathematical issues)
  paceDelta = clamp(paceDelta, -30, 30)

  // Calculate signal using tanh for smooth saturation
  const rawSignal = tanh(paceDelta / 8.0)
  
  // Apply hard limits to allow full ±2.0 points for extreme cases
  const signal = clamp(rawSignal, -1, 1)

  // Calculate final points
  const points = signal * MAX_POINTS

  return {
    points,
    signal,
    meta: {
      expPace,
      paceDelta
    }
  }
}

/**
 * Calculate expected total impact for logging/debugging
 * 
 * @param paceDelta - Possession difference vs league average
 * @returns Estimated points added to game total
 */
export function estimateTotalImpact(paceDelta: number): number {
  // League average: ~2.29 points per extra possession (both teams)
  return paceDelta * 2.29
}

/**
 * Legacy wrapper function for compatibility with existing code
 * This will be replaced when we integrate the new calculation logic
 */
export function computePaceIndex(bundle: any, ctx: any): any {
  // TODO: Integrate with the new calculatePaceFactorPoints function
  // For now, return a placeholder that matches the expected interface
  return {
    key: 'paceIndex',
    name: 'Matchup Pace Index',
    normalized_value: 0,
    parsed_values_json: {
      points: 0,
      awayContribution: 0,
      homeContribution: 0
    },
    caps_applied: false,
    cap_reason: null,
    notes: 'Placeholder - new implementation pending'
  }
}