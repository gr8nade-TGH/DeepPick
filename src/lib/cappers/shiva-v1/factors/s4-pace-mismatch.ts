/**
 * S4: Pace Mismatch (SPREAD)
 *
 * Measures pace differential between teams to identify ATS opportunities.
 * When a fast team plays a slow team, the slower team often controls tempo and covers as underdog.
 *
 * Formula:
 * - Pace Differential = awayPace - homePace
 * - Expected Impact = paceDiff × 0.3 (each possession ≈ 0.3 points ATS edge)
 * - Signal = tanh(expectedImpact / 3.0)
 *
 * ATS Predictive Value:
 * - Pace control creates scoring variance
 * - Slow teams force fast teams to play their tempo
 * - When pace differential > 5 possessions, underdogs cover ~54% of time
 * - Market tends to overvalue fast-paced teams
 *
 * Data Source: MySportsFeeds team_gamelogs API (last 10 games)
 * Already available in NBAStatsBundle - no new data fetching required!
 */

import { NBAStatsBundle, RunCtx } from './types'

function tanh(x: number): number {
  if (x > 20) return 1
  if (x < -20) return -1
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export interface PaceMismatchInput {
  awayPace: number
  homePace: number
}

export interface PaceMismatchOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayPace: number
    homePace: number
    paceDiff: number
    absPaceDiff: number
    expectedImpact: number
    paceCategory: string
  }
}

/**
 * Calculate pace mismatch points
 *
 * @param input - Pace stats for both teams
 * @returns Points awarded to away/home based on pace advantage
 */
export function calculatePaceMismatchPoints(input: PaceMismatchInput): PaceMismatchOutput {
  const MAX_POINTS = 5.0

  // Validate inputs
  if (
    !Number.isFinite(input.awayPace) || input.awayPace <= 0 ||
    !Number.isFinite(input.homePace) || input.homePace <= 0
  ) {
    throw new Error('[S4] Invalid pace input: all values must be finite positive numbers')
  }

  // Calculate pace differential
  // Positive = away team plays faster
  // Negative = home team plays faster
  const paceDiff = input.awayPace - input.homePace
  const absPaceDiff = Math.abs(paceDiff)

  // Categorize pace mismatch
  let paceCategory = 'Minimal'
  if (absPaceDiff > 8) paceCategory = 'Extreme'
  else if (absPaceDiff > 5) paceCategory = 'High'
  else if (absPaceDiff > 3) paceCategory = 'Moderate'

  // Calculate expected ATS impact
  // Theory: Slower teams control tempo and often cover as underdogs
  // When away team is faster (paceDiff > 0), home team (slower) gets slight edge
  // When home team is faster (paceDiff < 0), away team (slower) gets slight edge
  // Each possession difference ≈ 0.3 points of ATS edge for slower team
  const IMPACT_PER_POSSESSION = 0.3

  // NEGATE paceDiff so slower team gets positive signal in their favor
  // This maintains the convention: positive signal → away, negative signal → home
  const expectedImpact = -paceDiff * IMPACT_PER_POSSESSION

  // Apply tanh scaling for smooth saturation
  const signal = clamp(tanh(expectedImpact / 3.0), -1, 1)

  // Award points based on signal direction
  // Positive signal → AWAY team (slower when paceDiff < 0)
  // Negative signal → HOME team (slower when paceDiff > 0)
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive signal = away team has ATS edge (away is slower)
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal = home team has ATS edge (home is slower)
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayPace: input.awayPace,
      homePace: input.homePace,
      paceDiff,
      absPaceDiff,
      expectedImpact,
      paceCategory
    }
  }
}

/**
 * Compute S4 (Pace Mismatch) for orchestrator
 */
export function computePaceMismatch(bundle: NBAStatsBundle, ctx: RunCtx): any {
  const awayPace = bundle.awayPaceLast10
  const homePace = bundle.homePaceLast10

  const result = calculatePaceMismatchPoints({
    awayPace,
    homePace
  })

  return {
    factor_no: 4,
    key: 'paceMismatch',
    name: 'Pace Mismatch',
    normalized_value: result.signal,
    raw_values_json: {
      awayPace,
      homePace,
      paceDiff: result.meta.paceDiff,
      absPaceDiff: result.meta.absPaceDiff,
      expectedImpact: result.meta.expectedImpact,
      paceCategory: result.meta.paceCategory
    },
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal
    },
    caps_applied: false,
    cap_reason: null,
    notes: `Away Pace: ${result.meta.awayPace.toFixed(1)}, Home Pace: ${result.meta.homePace.toFixed(1)}, Diff: ${result.meta.paceDiff.toFixed(1)}, Category: ${result.meta.paceCategory}`
  }
}

