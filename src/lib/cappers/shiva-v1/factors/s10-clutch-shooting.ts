/**
 * S10: Clutch Shooting - SHIVA Factor Implementation
 *
 * Free throw and field goal efficiency for close games
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

export function computeClutchShooting(bundle: NBAStatsBundle, ctx: RunCtx): any {
  console.log('[S10:ClutchShooting] Computing...')

  // Extract shooting data - NBA averages: ~77% FT, ~46% FG
  const awayFtPct = bundle.awayFtPct ?? 77.0
  const awayFgPct = bundle.awayFgPct ?? 46.0
  const homeFtPct = bundle.homeFtPct ?? 77.0
  const homeFgPct = bundle.homeFgPct ?? 46.0

  // Calculate differentials
  const ftPctDiff = awayFtPct - homeFtPct
  const fgPctDiff = awayFgPct - homeFgPct

  // Combined score: FT% weighted 1.5x (more critical in close games)
  const combinedDiff = (ftPctDiff * 1.5) + (fgPctDiff * 0.8)

  const cappedDiff = clamp(combinedDiff, -15, 15)
  const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

  const points = Math.abs(signal) * MAX_POINTS
  const awayScore = signal > 0 ? points : 0
  const homeScore = signal < 0 ? points : 0

  const edge = signal > 0 ? 'Away' : 'Home'
  const notes = `${edge} clutch: FT% ${awayFtPct.toFixed(1)} vs ${homeFtPct.toFixed(1)}`

  console.log(`[S10:ClutchShooting] Signal=${signal.toFixed(3)}, Points=${points.toFixed(2)}`)

  return {
    signal,
    awayScore,
    homeScore,
    meta: {
      raw_values_json: { awayFtPct, awayFgPct, homeFtPct, homeFgPct, ftPctDiff, fgPctDiff, combinedDiff },
      parsed_values_json: { notes }
    }
  }
}

