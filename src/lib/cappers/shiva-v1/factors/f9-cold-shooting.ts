/**
 * Cold Shooting Factor (F9)
 * 
 * UNDER-BIASED: Measures shooting slumps.
 * Cold shooting = fewer points = UNDER signal.
 * 
 * This is the INVERSE of threeEnv's shooting heat component:
 * - threeEnv: Hot shooting = OVER signal
 * - coldShooting: Cold shooting = UNDER signal
 */

const MAX_POINTS = 5.0
const SCALE = 0.03  // 3% below league avg = strong signal

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
 * Compute cold shooting factor
 * Cold shooting (below league avg) = UNDER signal (negative)
 */
export function computeColdShooting(bundle: any, ctx: any): any {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 9,
      key: 'coldShooting',
      name: 'Cold Shooting',
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

  // Extract 3P% data
  const away3Pct = bundle.away3PctLast10 || bundle.away3Pct || 0.35
  const home3Pct = bundle.home3PctLast10 || bundle.home3Pct || 0.35
  const league3Pct = bundle.league3Pct || 0.35

  // Extract FG% data (if available, otherwise use defaults)
  const awayFgPct = bundle.awayFgPct || 0.46
  const homeFgPct = bundle.homeFgPct || 0.46
  const leagueFgPct = 0.47  // NBA league average FG%

  // Calculate 3P% coldness (negative = cold)
  const away3Cold = away3Pct - league3Pct
  const home3Cold = home3Pct - league3Pct
  const combined3Cold = (away3Cold + home3Cold) / 2

  // Calculate FG% coldness (negative = cold)
  const awayFgCold = awayFgPct - leagueFgPct
  const homeFgCold = homeFgPct - leagueFgPct
  const combinedFgCold = (awayFgCold + homeFgCold) / 2

  // Combined coldness (weight 3P% more as it's more volatile)
  // Negative values = cold shooting
  const combinedColdness = (combined3Cold * 0.7) + (combinedFgCold * 0.3)
  const cappedColdness = clamp(combinedColdness, -0.10, 0.10)

  // Cold shooting (negative coldness) = UNDER signal (negative)
  const signal = clamp(tanh(cappedColdness / SCALE), -1, 1)

  // Convert to over/under scores
  const overScore = signal > 0 ? Math.abs(signal) * MAX_POINTS : 0
  const underScore = signal < 0 ? Math.abs(signal) * MAX_POINTS : 0

  const direction = signal < 0 ? 'UNDER' : signal > 0 ? 'OVER' : 'NEUTRAL'

  return {
    factor_no: 9,
    key: 'coldShooting',
    name: 'Cold Shooting',
    normalized_value: signal,
    raw_values_json: {
      away3Pct,
      home3Pct,
      league3Pct,
      awayFgPct,
      homeFgPct,
      leagueFgPct,
      away3Cold,
      home3Cold,
      combined3Cold,
      combinedFgCold,
      combinedColdness
    },
    parsed_values_json: {
      overScore,
      underScore,
      threePtComponent: combined3Cold * 0.7,
      fgComponent: combinedFgCold * 0.3,
      direction,
      points: Math.abs(signal) * MAX_POINTS
    },
    caps_applied: false,
    cap_reason: null,
    notes: `3P%: ${ctx.away} ${(away3Pct * 100).toFixed(1)}%, ${ctx.home} ${(home3Pct * 100).toFixed(1)}% (lg avg ${(league3Pct * 100).toFixed(1)}%) → ${direction}`
  }
}

