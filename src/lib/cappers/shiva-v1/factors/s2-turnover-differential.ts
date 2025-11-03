/**
 * Turnover Differential Factor (S2)
 * 
 * Analyzes ball security and defensive pressure through turnover differential
 * Turnovers = extra possessions = significant ATS impact
 * 
 * Research shows:
 * - Each turnover ≈ 1.1 points (league avg ORtg × possession value)
 * - Teams with +3 TOV differential cover spread ~58% of time
 * - Turnover differential in close games is highly predictive
 * 
 * Signal Interpretation:
 * - Positive signal → Favors AWAY team (home commits more turnovers)
 * - Negative signal → Favors HOME team (away commits more turnovers)
 */

import { NBAStatsBundle, RunCtx } from './types'

export interface TurnoverDiffInput {
  awayTOV: number // Average turnovers per game (last 10 games)
  homeTOV: number // Average turnovers per game (last 10 games)
}

export interface TurnoverDiffOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayTOV: number
    homeTOV: number
    turnoverDifferential: number
    expectedPointImpact: number
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
 * Calculate turnover differential points
 * 
 * Formula:
 * - Turnover Differential = Home TOV - Away TOV
 * - Expected Point Impact = Differential × 1.1 (points per turnover)
 * - Signal = tanh(Point Impact / 5.0) for smooth saturation
 * 
 * @param input - Turnover differential input data
 * @returns Turnover differential output with scores and metadata
 */
export function calculateTurnoverDiffPoints(input: TurnoverDiffInput): TurnoverDiffOutput {
  const MAX_POINTS = 5.0
  const POINTS_PER_TURNOVER = 1.1 // League average ORtg × possession value

  // Validate inputs
  if (!Number.isFinite(input.awayTOV) || input.awayTOV < 0) {
    throw new Error(`Invalid awayTOV: ${input.awayTOV}`)
  }
  if (!Number.isFinite(input.homeTOV) || input.homeTOV < 0) {
    throw new Error(`Invalid homeTOV: ${input.homeTOV}`)
  }

  // Positive = away advantage (home commits more TOV)
  // Negative = home advantage (away commits more TOV)
  const turnoverDifferential = input.homeTOV - input.awayTOV
  const expectedPointImpact = turnoverDifferential * POINTS_PER_TURNOVER

  // Calculate signal using tanh for smooth saturation
  // Divide by 5.0 to normalize (max expected differential is ~5 TOV)
  const signal = clamp(tanh(expectedPointImpact / 5.0), -1, 1)

  // Convert signal to scores
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive signal → Away team has advantage
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal → Home team has advantage
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  const reason = turnoverDifferential > 0
    ? `Away advantage: Home commits ${Math.abs(turnoverDifferential).toFixed(1)} more TOV/game (${expectedPointImpact.toFixed(1)} pts)`
    : turnoverDifferential < 0
      ? `Home advantage: Away commits ${Math.abs(turnoverDifferential).toFixed(1)} more TOV/game (${Math.abs(expectedPointImpact).toFixed(1)} pts)`
      : 'No turnover differential'

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayTOV: input.awayTOV,
      homeTOV: input.homeTOV,
      turnoverDifferential,
      expectedPointImpact,
      reason
    }
  }
}

/**
 * Compute Turnover Differential factor for NBA spread picks
 * 
 * @param bundle - NBA stats bundle with turnover data
 * @param ctx - Run context with team names
 * @returns Factor result for orchestrator
 */
export function computeTurnoverDifferential(bundle: NBAStatsBundle, ctx: RunCtx): any {
  console.log('[S2:TURNOVER_DIFF] Computing turnover differential...')

  // Extract turnover data from bundle
  if (!bundle.awayTOVLast10 || !bundle.homeTOVLast10) {
    throw new Error('[S2:TURNOVER_DIFF] Missing turnover data in bundle')
  }

  const awayTOV = bundle.awayTOVLast10
  const homeTOV = bundle.homeTOVLast10

  console.log(`[S2:TURNOVER_DIFF] Away TOV: ${awayTOV.toFixed(1)}, Home TOV: ${homeTOV.toFixed(1)}`)

  // Calculate turnover differential
  const result = calculateTurnoverDiffPoints({ awayTOV, homeTOV })

  console.log('[S2:TURNOVER_DIFF] Result:', {
    signal: result.signal.toFixed(3),
    awayScore: result.awayScore.toFixed(2),
    homeScore: result.homeScore.toFixed(2),
    differential: result.meta.turnoverDifferential.toFixed(1),
    pointImpact: result.meta.expectedPointImpact.toFixed(1)
  })

  // Return factor in orchestrator format
  return {
    factor_no: 2,
    key: 'turnoverDiff',
    name: 'Turnover Differential',
    normalized_value: result.signal,
    raw_values_json: JSON.stringify({
      awayTOV: result.meta.awayTOV,
      homeTOV: result.meta.homeTOV,
      turnoverDifferential: result.meta.turnoverDifferential
    }),
    parsed_values_json: {
      signal: result.signal,
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      points: Math.max(result.awayScore, result.homeScore),
      expectedPointImpact: result.meta.expectedPointImpact,
      awayTOV: result.meta.awayTOV,
      homeTOV: result.meta.homeTOV,
      differential: result.meta.turnoverDifferential
    },
    caps_applied: false,
    cap_reason: null,
    notes: result.meta.reason
  }
}

