/**
 * S11: Scoring Margin - SHIVA Factor Implementation
 *
 * Raw points per game and points allowed differential
 */

import { NBAStatsBundle, RunCtx } from './types'

const MAX_POINTS = 5.0
const SCALE = 8.0

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function tanh(x: number): number {
  return Math.tanh(x)
}

export function computeScoringMargin(bundle: NBAStatsBundle, ctx: RunCtx): any {
  console.log('[S11:ScoringMargin] Computing...')

  if (!bundle) {
    return {
      factor_no: 11,
      key: 'scoringMargin',
      name: 'Scoring Margin',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: { points: 0, awayScore: 0, homeScore: 0 },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Extract scoring data - NBA average ~113 PPG
  const awayPpg = bundle.awayPpg ?? bundle.awayPointsPerGame ?? 113.0
  const awayOppPpg = bundle.awayOppPpg ?? 113.0
  const homePpg = bundle.homePpg ?? bundle.homePointsPerGame ?? 113.0
  const homeOppPpg = bundle.homeOppPpg ?? 113.0

  // Calculate margins
  const awayMargin = awayPpg - awayOppPpg
  const homeMargin = homePpg - homeOppPpg

  // Net margin differential
  const marginDiff = awayMargin - homeMargin

  const cappedDiff = clamp(marginDiff, -20, 20)
  const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

  const points = Math.abs(signal) * MAX_POINTS
  const awayScore = signal > 0 ? points : 0
  const homeScore = signal < 0 ? points : 0

  const edge = signal > 0 ? 'Away' : 'Home'
  const awayMarginStr = awayMargin >= 0 ? `+${awayMargin.toFixed(1)}` : awayMargin.toFixed(1)
  const homeMarginStr = homeMargin >= 0 ? `+${homeMargin.toFixed(1)}` : homeMargin.toFixed(1)
  const notes = `${edge} margin: ${awayMarginStr} vs ${homeMarginStr}`

  console.log(`[S11:ScoringMargin] Signal=${signal.toFixed(3)}, Points=${points.toFixed(2)}`)

  return {
    factor_no: 11,
    key: 'scoringMargin',
    name: 'Scoring Margin',
    normalized_value: signal,
    raw_values_json: { awayPpg, awayOppPpg, awayMargin, homePpg, homeOppPpg, homeMargin, marginDiff },
    parsed_values_json: { points, awayScore, homeScore, signal },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

