/**
 * S3: Rebounding Differential (SPREAD)
 *
 * Measures rebounding dominance through offensive and defensive rebounding percentages.
 * Teams that control the boards get extra possessions (OREB) and deny opponent possessions (DREB).
 *
 * Formula:
 * - OREB% = offReb / (offReb + oppDefReb)
 * - DREB% = defReb / (defReb + oppOffReb)
 * - TotalREB% = OREB% + DREB%
 * - Differential = homeTotalREB% - awayTotalREB%
 * - Expected Point Impact = differential × 100
 * - Signal = tanh(expectedPointImpact / 10.0)
 *
 * ATS Predictive Value:
 * - Rebounding = possession control
 * - Extra possessions = more scoring opportunities
 * - Teams with +5% rebounding differential cover spread ~56% of time
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

export interface ReboundingDiffInput {
  awayOffReb: number
  awayDefReb: number
  awayOppOffReb: number
  awayOppDefReb: number
  homeOffReb: number
  homeDefReb: number
  homeOppOffReb: number
  homeOppDefReb: number
}

export interface ReboundingDiffOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayOrebPct: number
    awayDrebPct: number
    awayTotalRebPct: number
    homeOrebPct: number
    homeDrebPct: number
    homeTotalRebPct: number
    differential: number
    expectedPointImpact: number
  }
}

/**
 * Calculate rebounding differential points
 *
 * @param input - Rebounding stats for both teams
 * @returns Points awarded to away/home based on rebounding advantage
 */
export function calculateReboundingDiffPoints(input: ReboundingDiffInput): ReboundingDiffOutput {
  const MAX_POINTS = 5.0

  // Validate inputs
  if (
    !Number.isFinite(input.awayOffReb) || input.awayOffReb < 0 ||
    !Number.isFinite(input.awayDefReb) || input.awayDefReb < 0 ||
    !Number.isFinite(input.awayOppOffReb) || input.awayOppOffReb < 0 ||
    !Number.isFinite(input.awayOppDefReb) || input.awayOppDefReb < 0 ||
    !Number.isFinite(input.homeOffReb) || input.homeOffReb < 0 ||
    !Number.isFinite(input.homeDefReb) || input.homeDefReb < 0 ||
    !Number.isFinite(input.homeOppOffReb) || input.homeOppOffReb < 0 ||
    !Number.isFinite(input.homeOppDefReb) || input.homeOppDefReb < 0
  ) {
    throw new Error('[S3] Invalid rebounding input: all values must be finite positive numbers')
  }

  // Calculate rebounding percentages for away team
  const awayOrebPct = (input.awayOffReb + input.awayOppDefReb) > 0
    ? input.awayOffReb / (input.awayOffReb + input.awayOppDefReb)
    : 0.24 // League average OREB%
  
  const awayDrebPct = (input.awayDefReb + input.awayOppOffReb) > 0
    ? input.awayDefReb / (input.awayDefReb + input.awayOppOffReb)
    : 0.76 // League average DREB%
  
  const awayTotalRebPct = awayOrebPct + awayDrebPct

  // Calculate rebounding percentages for home team
  const homeOrebPct = (input.homeOffReb + input.homeOppDefReb) > 0
    ? input.homeOffReb / (input.homeOffReb + input.homeOppDefReb)
    : 0.24 // League average OREB%
  
  const homeDrebPct = (input.homeDefReb + input.homeOppOffReb) > 0
    ? input.homeDefReb / (input.homeDefReb + input.homeOppOffReb)
    : 0.76 // League average DREB%
  
  const homeTotalRebPct = homeOrebPct + homeDrebPct

  // Calculate differential (positive = home advantage, negative = away advantage)
  const differential = homeTotalRebPct - awayTotalRebPct

  // Convert to expected point impact
  // Rebounding differential of 0.05 (5%) ≈ 2-3 extra possessions ≈ 5 points
  const expectedPointImpact = differential * 100

  // Apply tanh scaling for smooth saturation
  const signal = clamp(tanh(expectedPointImpact / 10.0), -1, 1)

  // Award points based on signal direction
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive signal = home team has rebounding advantage
    homeScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal = away team has rebounding advantage
    awayScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayOrebPct,
      awayDrebPct,
      awayTotalRebPct,
      homeOrebPct,
      homeDrebPct,
      homeTotalRebPct,
      differential,
      expectedPointImpact
    }
  }
}

/**
 * Compute S3 (Rebounding Differential) for orchestrator
 */
export function computeReboundingDifferential(bundle: NBAStatsBundle, ctx: RunCtx): any {
  const awayOffReb = bundle.awayOffReb
  const awayDefReb = bundle.awayDefReb
  const awayOppOffReb = bundle.awayOppOffReb
  const awayOppDefReb = bundle.awayOppDefReb
  const homeOffReb = bundle.homeOffReb
  const homeDefReb = bundle.homeDefReb
  const homeOppOffReb = bundle.homeOppOffReb
  const homeOppDefReb = bundle.homeOppDefReb

  const result = calculateReboundingDiffPoints({
    awayOffReb,
    awayDefReb,
    awayOppOffReb,
    awayOppDefReb,
    homeOffReb,
    homeDefReb,
    homeOppOffReb,
    homeOppDefReb
  })

  return {
    factor_no: 3,
    key: 'reboundingDiff',
    name: 'Rebounding Differential',
    normalized_value: result.signal,
    raw_values_json: JSON.stringify({
      awayOffReb,
      awayDefReb,
      awayOppOffReb,
      awayOppDefReb,
      homeOffReb,
      homeDefReb,
      homeOppOffReb,
      homeOppDefReb
    }),
    parsed_values_json: JSON.stringify({
      awayOrebPct: (result.meta.awayOrebPct * 100).toFixed(1) + '%',
      awayDrebPct: (result.meta.awayDrebPct * 100).toFixed(1) + '%',
      awayTotalRebPct: (result.meta.awayTotalRebPct * 100).toFixed(1) + '%',
      homeOrebPct: (result.meta.homeOrebPct * 100).toFixed(1) + '%',
      homeDrebPct: (result.meta.homeDrebPct * 100).toFixed(1) + '%',
      homeTotalRebPct: (result.meta.homeTotalRebPct * 100).toFixed(1) + '%',
      differential: (result.meta.differential * 100).toFixed(1) + '%',
      expectedPointImpact: result.meta.expectedPointImpact.toFixed(2),
      signal: result.signal.toFixed(3),
      awayScore: result.awayScore.toFixed(2),
      homeScore: result.homeScore.toFixed(2)
    }),
    caps_applied: 0,
    cap_reason: null,
    notes: `Away REB%: ${(result.meta.awayTotalRebPct * 100).toFixed(1)}%, Home REB%: ${(result.meta.homeTotalRebPct * 100).toFixed(1)}%, Diff: ${(result.meta.differential * 100).toFixed(1)}%, Impact: ${result.meta.expectedPointImpact.toFixed(1)} pts`
  }
}

