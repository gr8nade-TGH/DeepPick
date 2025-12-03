/**
 * Rest Advantage Factor (F7) - TOTALS
 * 
 * Analyzes rest differential between teams to predict scoring impact.
 * Back-to-back games typically result in lower scoring due to fatigue.
 * Well-rested teams tend to score more efficiently.
 * 
 * Signal: Positive = OVER (both teams rested), Negative = UNDER (fatigue present)
 */

import { NBAStatsBundle, RunCtx } from './types'

export interface RestAdvantageInput {
  awayRestDays: number
  homeRestDays: number
  awayIsBackToBack: boolean
  homeIsBackToBack: boolean
}

export interface RestAdvantageOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    awayRestDays: number
    homeRestDays: number
    awayIsBackToBack: boolean
    homeIsBackToBack: boolean
    restDiff: number
    fatigueLevel: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'
    reason: string
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
 * Calculate rest advantage factor
 * 
 * Logic:
 * - Back-to-back games (0 rest days) = significant fatigue penalty → UNDER
 * - 1 rest day = normal (neutral)
 * - 2+ rest days = well rested → slight OVER lean
 * - Both teams on B2B = strong UNDER signal
 * - One team B2B, other rested = depends on context
 */
export function calculateRestAdvantage(input: RestAdvantageInput): RestAdvantageOutput {
  const { awayRestDays, homeRestDays, awayIsBackToBack, homeIsBackToBack } = input
  const MAX_POINTS = 5.0

  // Input validation
  if (!Number.isFinite(awayRestDays) || !Number.isFinite(homeRestDays)) {
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        awayRestDays: 0,
        homeRestDays: 0,
        awayIsBackToBack: false,
        homeIsBackToBack: false,
        restDiff: 0,
        fatigueLevel: 'NONE',
        reason: 'invalid_input'
      }
    }
  }

  // Calculate fatigue impact
  // B2B = -2 points per team, 1 rest day = 0, 2 rest days = +0.5, 3+ = +1
  const getRestScore = (days: number): number => {
    if (days === 0) return -2.0  // Back-to-back = severe fatigue
    if (days === 1) return 0     // Normal rest
    if (days === 2) return 0.5   // Well rested
    return 1.0                   // Very well rested (3+ days)
  }

  const awayRestScore = getRestScore(awayRestDays)
  const homeRestScore = getRestScore(homeRestDays)

  // Combined rest impact (positive = over, negative = under)
  // Both teams rested → more energy → higher scoring (OVER)
  // Both teams fatigued → lower efficiency → lower scoring (UNDER)
  const combinedRestImpact = awayRestScore + homeRestScore

  // Determine fatigue level for display
  let fatigueLevel: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE' = 'NONE'
  if (awayIsBackToBack && homeIsBackToBack) {
    fatigueLevel = 'SEVERE'
  } else if (awayIsBackToBack || homeIsBackToBack) {
    fatigueLevel = 'MODERATE'
  } else if (awayRestDays <= 1 || homeRestDays <= 1) {
    fatigueLevel = 'MILD'
  }

  // Scale factor - adjust sensitivity
  const SCALE = 2.0
  const signal = clamp(tanh(combinedRestImpact / SCALE), -1, 1)

  // Convert to scores
  let overScore = 0
  let underScore = 0

  if (signal > 0) {
    overScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    underScore = Math.abs(signal) * MAX_POINTS
  }

  // Build reason string
  let reason = ''
  if (awayIsBackToBack && homeIsBackToBack) {
    reason = 'Both teams on back-to-back → UNDER'
  } else if (awayIsBackToBack) {
    reason = `Away team B2B (${awayRestDays}d), Home rested (${homeRestDays}d)`
  } else if (homeIsBackToBack) {
    reason = `Away rested (${awayRestDays}d), Home team B2B (${homeRestDays}d)`
  } else if (awayRestDays >= 2 && homeRestDays >= 2) {
    reason = `Both teams well rested (${awayRestDays}d/${homeRestDays}d) → OVER`
  } else {
    reason = `Normal rest (${awayRestDays}d/${homeRestDays}d)`
  }

  return {
    overScore,
    underScore,
    signal,
    meta: {
      awayRestDays,
      homeRestDays,
      awayIsBackToBack,
      homeIsBackToBack,
      restDiff: awayRestDays - homeRestDays,
      fatigueLevel,
      reason
    }
  }
}

/**
 * Orchestrator-compatible wrapper function
 */
export function computeRestAdvantage(bundle: NBAStatsBundle | null, ctx: RunCtx): any {
  // Handle case where bundle is null (factor disabled or no data)
  if (!bundle) {
    return {
      factor_no: 7,
      key: 'restAdvantage',
      name: 'Rest Advantage',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        points: 0,
        overScore: 0,
        underScore: 0,
        signal: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Get rest data from bundle (with defaults for missing data)
  const awayRestDays = bundle.awayRestDays ?? 1
  const homeRestDays = bundle.homeRestDays ?? 1
  const awayIsBackToBack = bundle.awayIsBackToBack ?? false
  const homeIsBackToBack = bundle.homeIsBackToBack ?? false

  const result = calculateRestAdvantage({
    awayRestDays,
    homeRestDays,
    awayIsBackToBack,
    homeIsBackToBack
  })

  return {
    factor_no: 7,
    key: 'restAdvantage',
    name: 'Rest Advantage',
    normalized_value: result.signal,
    raw_values_json: {
      awayRestDays,
      homeRestDays,
      awayIsBackToBack,
      homeIsBackToBack,
      restDiff: result.meta.restDiff,
      fatigueLevel: result.meta.fatigueLevel
    },
    parsed_values_json: {
      points: Math.max(result.overScore, result.underScore),
      overScore: result.overScore,
      underScore: result.underScore,
      signal: result.signal,
      awayRestDays,
      homeRestDays
    },
    caps_applied: false,
    cap_reason: null,
    notes: result.meta.reason
  }
}

