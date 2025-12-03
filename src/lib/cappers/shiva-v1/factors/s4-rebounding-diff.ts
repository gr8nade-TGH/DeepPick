/**
 * Rebounding Differential Factor (S4)
 * 
 * Calculates board control advantage based on offensive and defensive rebounding
 * Offensive rebounds = second chance points (worth more)
 * Defensive rebounds = ending opponent possessions
 * 
 * Signal Interpretation:
 * - Positive signal → Favors AWAY team (better rebounding)
 * - Negative signal → Favors HOME team (better rebounding)
 */

import { NBAStatsBundle, RunCtx } from './types'

export interface ReboundingDiffInput {
  awayOffReb: number
  awayDefReb: number
  homeOffReb: number
  homeDefReb: number
}

export interface ReboundingDiffOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayTotalReb: number
    homeTotalReb: number
    awayOrebAdvantage: number
    totalRebDiff: number
    reason?: string
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

export function calculateReboundingDiffPoints(input: ReboundingDiffInput): ReboundingDiffOutput {
  const { awayOffReb, awayDefReb, homeOffReb, homeDefReb } = input
  const MAX_POINTS = 5.0
  const SCALE = 6.0 // Scaling factor for tanh

  // Input validation
  if (![awayOffReb, awayDefReb, homeOffReb, homeDefReb].every(v => Number.isFinite(v) && v >= 0)) {
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayTotalReb: 0,
        homeTotalReb: 0,
        awayOrebAdvantage: 0,
        totalRebDiff: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate totals
  const awayTotalReb = awayOffReb + awayDefReb
  const homeTotalReb = homeOffReb + homeDefReb

  // OREB advantage (worth more - second chance points)
  const awayOrebAdvantage = awayOffReb - homeOffReb

  // Total rebounding differential
  const totalRebDiff = awayTotalReb - homeTotalReb

  // Weighted score: OREB worth 1.1 pts, total reb diff worth 0.3
  const weightedDiff = (awayOrebAdvantage * 1.1) + (totalRebDiff * 0.3)

  // Calculate signal using tanh for smooth saturation
  const rawSignal = tanh(weightedDiff / SCALE)
  const signal = clamp(rawSignal, -1, 1)

  // Convert to scores
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayTotalReb,
      homeTotalReb,
      awayOrebAdvantage,
      totalRebDiff
    }
  }
}

export function computeReboundingDiff(bundle: NBAStatsBundle, ctx: RunCtx): any {
  if (!bundle) {
    return {
      factor_no: 4,
      key: 'reboundingDiff',
      name: 'Rebounding Differential',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: { points: 0, awayScore: 0, homeScore: 0 },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  const result = calculateReboundingDiffPoints({
    awayOffReb: bundle.awayOffReb || 0,
    awayDefReb: bundle.awayDefReb || 0,
    homeOffReb: bundle.homeOffReb || 0,
    homeDefReb: bundle.homeDefReb || 0
  })

  const notes = `Reb: Away ${result.meta.awayTotalReb.toFixed(1)} vs Home ${result.meta.homeTotalReb.toFixed(1)} (OREB Δ${result.meta.awayOrebAdvantage > 0 ? '+' : ''}${result.meta.awayOrebAdvantage.toFixed(1)})`

  return {
    factor_no: 4,
    key: 'reboundingDiff',
    name: 'Rebounding Differential',
    normalized_value: result.signal,
    raw_values_json: {
      awayOffReb: bundle.awayOffReb,
      awayDefReb: bundle.awayDefReb,
      homeOffReb: bundle.homeOffReb,
      homeDefReb: bundle.homeDefReb,
      awayTotalReb: result.meta.awayTotalReb,
      homeTotalReb: result.meta.homeTotalReb,
      awayOrebAdvantage: result.meta.awayOrebAdvantage,
      totalRebDiff: result.meta.totalRebDiff
    },
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal
    },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

