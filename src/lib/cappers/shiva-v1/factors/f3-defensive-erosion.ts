/**
 * Defensive Erosion Factor (F3)
 * 
 * Calculates defensive rating decline + injury impact
 * Uses smooth tanh scaling with single positive score system
 */

export interface DefensiveErosionInput {
  homeDRtg: number
  awayDRtg: number
  leagueDRtg: number
  injuryImpact: {
    defenseImpactA: number // -1 to +1, negative = worse defense
    defenseImpactB: number // -1 to +1, negative = worse defense
  }
}

export interface DefensiveErosionOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    combinedDRtg: number
    drtgDelta: number
    injuryImpact: number
    totalErosion: number
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
 * Calculate defensive erosion factor points using single positive score system
 * Each factor contributes to either Over OR Under, never both
 * 
 * @param input - Team defensive ratings, league average, and injury impact
 * @returns Over/Under scores and debugging metadata
 */
export function calculateDefensiveErosionPoints(input: DefensiveErosionInput): DefensiveErosionOutput {
  const { homeDRtg, awayDRtg, leagueDRtg, injuryImpact } = input
  const MAX_POINTS = 5.0
  const SCALE = 8.0

  // Input validation
  if (![homeDRtg, awayDRtg, leagueDRtg].every(v => Number.isFinite(v) && v > 0)) {
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        combinedDRtg: 0,
        drtgDelta: 0,
        injuryImpact: 0,
        totalErosion: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate combined defensive rating
  const combinedDRtg = (homeDRtg + awayDRtg) / 2

  // Calculate defensive rating delta vs league (higher DRtg = worse defense)
  let drtgDelta = combinedDRtg - leagueDRtg

  // Safety cap for extreme outliers
  drtgDelta = clamp(drtgDelta, -20, 20)

  // Calculate injury impact (negative values = worse defense)
  const injuryImpactAvg = (injuryImpact.defenseImpactA + injuryImpact.defenseImpactB) / 2

  // Combine defensive erosion: 70% DRtg decline + 30% injury impact
  const totalErosion = (0.7 * drtgDelta) + (0.3 * injuryImpactAvg * 10) // Scale injury impact

  // Calculate signal using tanh for smooth saturation
  const rawSignal = tanh(totalErosion / SCALE)

  // Apply hard limits to allow full ±1.0 signal for extreme cases
  const signal = clamp(rawSignal, -1, 1)

  // Convert to single positive scores for one direction
  let overScore = 0
  let underScore = 0

  if (signal > 0) {
    // Positive signal favors Over (worse defense = more points allowed)
    overScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal favors Under (better defense = fewer points allowed)
    underScore = Math.abs(signal) * MAX_POINTS
  }
  // signal = 0 means neutral, both scores remain 0

  return {
    overScore,
    underScore,
    signal,
    meta: {
      combinedDRtg,
      drtgDelta,
      injuryImpact: injuryImpactAvg,
      totalErosion
    }
  }
}

/**
 * Calculate expected total impact for logging/debugging
 * 
 * @param totalErosion - Combined defensive erosion score
 * @returns Estimated points added to game total
 */
export function estimateDefensiveImpact(totalErosion: number): number {
  // League average: ~1.0 points per DRtg point difference
  return totalErosion * 1.0
}

/**
 * Legacy wrapper function for compatibility with existing orchestrator
 * TODO: Integrate with the new calculateDefensiveErosionPoints function
 */
export function computeDefensiveErosion(bundle: any, ctx: any): any {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 3,
      key: 'defErosion',
      name: 'Defensive Erosion',
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

  // Get defensive ratings from bundle
  const awayDRtg = bundle.awayDRtgSeason || 114.5  // 2024-25 league avg
  const homeDRtg = bundle.homeDRtgSeason || 114.5  // 2024-25 league avg
  const leagueDRtg = bundle.leagueDRtg || 114.5   // 2024-25 league avg

  // Calculate combined defensive rating vs league
  const combinedDRtg = (awayDRtg + homeDRtg) / 2
  const drtgDelta = combinedDRtg - leagueDRtg

  // Get injury impact from context (if available)
  const injuryImpact = ctx.injuryImpact || { defenseImpactA: 0, defenseImpactB: 0 }
  const totalInjuryImpact = (injuryImpact.defenseImpactA + injuryImpact.defenseImpactB) / 2

  // Combine defensive decline with injury impact
  // 70% defensive rating, 30% injury impact
  const totalErosion = 0.7 * drtgDelta + 0.3 * (totalInjuryImpact * 10)

  // Use tanh for smooth saturation
  const signal = Math.tanh(totalErosion / 8)

  // Convert to over/under scores
  const maxPoints = 2.0
  const overScore = signal > 0 ? Math.abs(signal) * maxPoints : 0
  const underScore = signal < 0 ? Math.abs(signal) * maxPoints : 0

  return {
    factor_no: 3,
    key: 'defErosion',
    name: 'Defensive Erosion',
    normalized_value: signal,
    raw_values_json: {
      awayDRtg,
      homeDRtg,
      leagueDRtg,
      combinedDRtg,
      drtgDelta,
      injuryImpact: totalInjuryImpact,
      totalErosion
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
    notes: `DRtg: ${combinedDRtg.toFixed(1)} vs ${leagueDRtg.toFixed(1)} (Δ${drtgDelta.toFixed(1)}), Injury: ${totalInjuryImpact.toFixed(2)}`
  }
}