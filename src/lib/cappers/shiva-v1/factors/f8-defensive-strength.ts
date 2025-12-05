/**
 * Defensive Strength Factor (F8)
 * 
 * UNDER-BIASED: Measures combined defensive strength.
 * Strong defenses = lower totals = UNDER signal.
 * 
 * This is the INVERSE of defErosion:
 * - defErosion: Bad defense (high DRtg) = OVER signal
 * - defStrength: Good defense (low DRtg) = UNDER signal
 */

const MAX_POINTS = 5.0
const SCALE = 5.0  // 5 DRtg below league avg = strong signal

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
 * Compute defensive strength factor
 * Strong defense (low DRtg) = UNDER signal (negative)
 */
export function computeDefensiveStrength(bundle: any, ctx: any): any {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 8,
      key: 'defStrength',
      name: 'Defensive Strength',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        overScore: 0,
        underScore: 0,
        direction: 'NEUTRAL'
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

  // Calculate defensive strength (lower DRtg = better defense = UNDER signal)
  // Positive values mean BETTER than league average
  const awayStrength = leagueDRtg - awayDRtg  // Positive = good D
  const homeStrength = leagueDRtg - homeDRtg  // Positive = good D
  const combinedStrength = (awayStrength + homeStrength) / 2

  const cappedStrength = clamp(combinedStrength, -15, 15)

  // Positive strength (good defense) = UNDER signal (negative)
  // We want: strong D → negative signal → UNDER
  const signal = clamp(-tanh(cappedStrength / SCALE), -1, 1)

  // Convert to over/under scores
  const overScore = signal > 0 ? Math.abs(signal) * MAX_POINTS : 0
  const underScore = signal < 0 ? Math.abs(signal) * MAX_POINTS : 0

  const direction = signal < 0 ? 'UNDER' : signal > 0 ? 'OVER' : 'NEUTRAL'

  return {
    factor_no: 8,
    key: 'defStrength',
    name: 'Defensive Strength',
    normalized_value: signal,
    raw_values_json: {
      awayDRtg,
      homeDRtg,
      leagueDRtg,
      awayStrength,
      homeStrength,
      combinedStrength
    },
    parsed_values_json: {
      overScore,
      underScore,
      awayDefenseStrength: awayStrength,
      homeDefenseStrength: homeStrength,
      direction,
      points: Math.abs(signal) * MAX_POINTS
    },
    caps_applied: false,
    cap_reason: null,
    notes: `${ctx.away} DRtg: ${awayDRtg.toFixed(1)} (${awayStrength > 0 ? '+' : ''}${awayStrength.toFixed(1)}), ${ctx.home} DRtg: ${homeDRtg.toFixed(1)} (${homeStrength > 0 ? '+' : ''}${homeStrength.toFixed(1)}) → ${direction}`
  }
}

