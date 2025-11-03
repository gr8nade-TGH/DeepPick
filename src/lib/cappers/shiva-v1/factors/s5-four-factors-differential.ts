/**
 * S5: Four Factors Differential (SPREAD)
 *
 * Dean Oliver's Four Factors measure overall team efficiency across all key areas:
 * 1. eFG% (Effective Field Goal %) - Shooting efficiency
 * 2. TOV% (Turnover %) - Ball security
 * 3. OREB% (Offensive Rebound %) - Extra possessions
 * 4. FTR (Free Throw Rate) - Getting to the line
 *
 * Formula (Dean Oliver's weights):
 * - Rating = (0.50 × eFG%) - (0.30 × TOV%) + (0.15 × OREB%) + (0.05 × FTR)
 * - Differential = awayRating - homeRating
 * - Expected Margin = differential × 120 (scale to points)
 * - Signal = tanh(expectedMargin / 8.0)
 *
 * ATS Predictive Value:
 * - Four Factors have 95% correlation to team wins
 * - Comprehensive efficiency measure
 * - Proven predictive value for game outcomes
 *
 * Data Source: MySportsFeeds team_gamelogs API (last 10 games)
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

export interface FourFactorsInput {
  awayEfg: number
  awayTovPct: number
  awayOrebPct: number
  awayFtr: number
  homeEfg: number
  homeTovPct: number
  homeOrebPct: number
  homeFtr: number
}

export interface FourFactorsOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayRating: number
    homeRating: number
    differential: number
    expectedMargin: number
  }
}

/**
 * Calculate Four Factors differential points
 *
 * @param input - Four Factors stats for both teams
 * @returns Points awarded to away/home based on efficiency advantage
 */
export function calculateFourFactorsPoints(input: FourFactorsInput): FourFactorsOutput {
  const MAX_POINTS = 5.0

  // Validate inputs
  if (
    !Number.isFinite(input.awayEfg) || input.awayEfg < 0 ||
    !Number.isFinite(input.awayTovPct) || input.awayTovPct < 0 ||
    !Number.isFinite(input.awayOrebPct) || input.awayOrebPct < 0 ||
    !Number.isFinite(input.awayFtr) || input.awayFtr < 0 ||
    !Number.isFinite(input.homeEfg) || input.homeEfg < 0 ||
    !Number.isFinite(input.homeTovPct) || input.homeTovPct < 0 ||
    !Number.isFinite(input.homeOrebPct) || input.homeOrebPct < 0 ||
    !Number.isFinite(input.homeFtr) || input.homeFtr < 0
  ) {
    throw new Error('[S5] Invalid Four Factors input: all values must be finite positive numbers')
  }

  // Dean Oliver's Four Factors weights
  const EFG_WEIGHT = 0.50
  const TOV_WEIGHT = 0.30
  const OREB_WEIGHT = 0.15
  const FTR_WEIGHT = 0.05

  // Calculate composite rating for away team
  const awayRating =
    (EFG_WEIGHT * input.awayEfg) -
    (TOV_WEIGHT * input.awayTovPct) +
    (OREB_WEIGHT * input.awayOrebPct) +
    (FTR_WEIGHT * input.awayFtr)

  // Calculate composite rating for home team
  const homeRating =
    (EFG_WEIGHT * input.homeEfg) -
    (TOV_WEIGHT * input.homeTovPct) +
    (OREB_WEIGHT * input.homeOrebPct) +
    (FTR_WEIGHT * input.homeFtr)

  // Calculate differential (positive = away advantage, negative = home advantage)
  const differential = awayRating - homeRating

  // Convert to expected point margin
  // Rating differential of 0.10 ≈ 12 point margin
  const expectedMargin = differential * 120

  // Apply tanh scaling for smooth saturation
  const signal = clamp(tanh(expectedMargin / 8.0), -1, 1)

  // Award points based on signal direction
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive signal = away team has efficiency advantage
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal = home team has efficiency advantage
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayRating,
      homeRating,
      differential,
      expectedMargin
    }
  }
}

/**
 * Compute S5 (Four Factors Differential) for orchestrator
 */
export function computeFourFactorsDifferential(bundle: NBAStatsBundle, ctx: RunCtx): any {
  if (!bundle.awayEfg || !bundle.awayTovPct || !bundle.awayOrebPct || !bundle.awayFtr ||
    !bundle.homeEfg || !bundle.homeTovPct || !bundle.homeOrebPct || !bundle.homeFtr) {
    throw new Error('[S5:FOUR_FACTORS] Missing Four Factors data in bundle')
  }

  const awayEfg = bundle.awayEfg
  const awayTovPct = bundle.awayTovPct
  const awayOrebPct = bundle.awayOrebPct
  const awayFtr = bundle.awayFtr
  const homeEfg = bundle.homeEfg
  const homeTovPct = bundle.homeTovPct
  const homeOrebPct = bundle.homeOrebPct
  const homeFtr = bundle.homeFtr

  const result = calculateFourFactorsPoints({
    awayEfg,
    awayTovPct,
    awayOrebPct,
    awayFtr,
    homeEfg,
    homeTovPct,
    homeOrebPct,
    homeFtr
  })

  return {
    factor_no: 5,
    key: 'fourFactorsDiff',
    name: 'Four Factors Differential',
    normalized_value: result.signal,
    raw_values_json: JSON.stringify({
      awayEfg,
      awayTovPct,
      awayOrebPct,
      awayFtr,
      homeEfg,
      homeTovPct,
      homeOrebPct,
      homeFtr
    }),
    parsed_values_json: JSON.stringify({
      awayEfg: (awayEfg * 100).toFixed(1) + '%',
      awayTovPct: (awayTovPct * 100).toFixed(1) + '%',
      awayOrebPct: (awayOrebPct * 100).toFixed(1) + '%',
      awayFtr: (awayFtr * 100).toFixed(1) + '%',
      awayRating: result.meta.awayRating.toFixed(3),
      homeEfg: (homeEfg * 100).toFixed(1) + '%',
      homeTovPct: (homeTovPct * 100).toFixed(1) + '%',
      homeOrebPct: (homeOrebPct * 100).toFixed(1) + '%',
      homeFtr: (homeFtr * 100).toFixed(1) + '%',
      homeRating: result.meta.homeRating.toFixed(3),
      differential: result.meta.differential.toFixed(3),
      expectedMargin: result.meta.expectedMargin.toFixed(1),
      signal: result.signal.toFixed(3),
      awayScore: result.awayScore.toFixed(2),
      homeScore: result.homeScore.toFixed(2)
    }),
    caps_applied: 0,
    cap_reason: null,
    notes: `Away Rating: ${result.meta.awayRating.toFixed(3)}, Home Rating: ${result.meta.homeRating.toFixed(3)}, Diff: ${result.meta.differential.toFixed(3)}, Margin: ${result.meta.expectedMargin.toFixed(1)} pts`
  }
}

