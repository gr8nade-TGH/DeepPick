/**
 * S13: Home/Away Splits - SHIVA Factor Implementation
 *
 * Analyzes how teams perform at home vs away
 * Some teams have dramatic home/away splits that create ATS value
 */

import { NBAStatsBundle, RunCtx } from './types'

const MAX_POINTS = 5.0
const SCALE = 6.0

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function tanh(x: number): number {
  return Math.tanh(x)
}

export function computeHomeAwaySplits(bundle: NBAStatsBundle, ctx: RunCtx): any {
  console.log('[S13:HomeAwaySplits] Computing...')

  if (!bundle) {
    return {
      factor_no: 13,
      key: 'homeAwaySplits',
      name: 'Home/Away Splits',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: { points: 0, awayScore: 0, homeScore: 0 },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Extract home/away performance data
  // Away team's AWAY performance vs Home team's HOME performance
  // Fall back to overall win% derived from last 10 record if specific splits not available
  const awayLast10 = bundle.awayLast10Record ?? { wins: 5, losses: 5 }
  const homeLast10 = bundle.homeLast10Record ?? { wins: 5, losses: 5 }
  const awayOverallWinPct = awayLast10.wins / (awayLast10.wins + awayLast10.losses)
  const homeOverallWinPct = homeLast10.wins / (homeLast10.wins + homeLast10.losses)

  const awayTeamAwayWinPct = bundle.awayTeamAwayWinPct ?? awayOverallWinPct
  const awayTeamAwayNetRtg = bundle.awayTeamAwayNetRtg ?? (bundle.awayORtgLast10 - bundle.awayDRtgSeason)
  const homeTeamHomeWinPct = bundle.homeTeamHomeWinPct ?? homeOverallWinPct
  const homeTeamHomeNetRtg = bundle.homeTeamHomeNetRtg ?? (bundle.homeORtgLast10 - bundle.homeDRtgSeason)

  // Calculate home/away advantage differential
  // Positive = away team performs well on road, negative = home team dominates at home
  const winPctDiff = awayTeamAwayWinPct - homeTeamHomeWinPct
  const netRtgDiff = awayTeamAwayNetRtg - homeTeamHomeNetRtg

  // Combine both signals (win% and net rating)
  const combinedDiff = (winPctDiff * 10) + (netRtgDiff * 0.5)

  const cappedDiff = clamp(combinedDiff, -15, 15)
  const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

  const points = Math.abs(signal) * MAX_POINTS
  const awayScore = signal > 0 ? points : 0
  const homeScore = signal < 0 ? points : 0

  const edge = signal > 0 ? 'Away' : 'Home'
  const awayPctStr = (awayTeamAwayWinPct * 100).toFixed(0)
  const homePctStr = (homeTeamHomeWinPct * 100).toFixed(0)
  const notes = `${edge} edge: Away team ${awayPctStr}% on road vs Home team ${homePctStr}% at home`

  console.log(`[S13:HomeAwaySplits] Signal=${signal.toFixed(3)}, Points=${points.toFixed(2)}`)

  return {
    factor_no: 13,
    key: 'homeAwaySplits',
    name: 'Home/Away Splits',
    normalized_value: signal,
    raw_values_json: {
      awayTeamAwayWinPct,
      awayTeamAwayNetRtg,
      homeTeamHomeWinPct,
      homeTeamHomeNetRtg,
      winPctDiff,
      netRtgDiff,
      combinedDiff
    },
    parsed_values_json: { points, awayScore, homeScore, signal },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

