/**
 * S12: Perimeter Defense - SHIVA Factor Implementation
 *
 * Opponent 3-point and field goal shooting allowed
 */

import { NBAStatsBundle, RunCtx } from './types'

const MAX_POINTS = 5.0
const SCALE = 4.0

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function tanh(x: number): number {
  return Math.tanh(x)
}

export function computePerimeterDefense(bundle: NBAStatsBundle, ctx: RunCtx): any {
  console.log('[S12:PerimeterDefense] Computing...')

  // Extract opponent shooting data - NBA averages: ~36% 3P, ~46% FG
  const awayOpp3Pct = bundle.awayOpp3Pct ?? 36.0
  const awayOppFgPct = bundle.awayOppFgPct ?? 46.0
  const homeOpp3Pct = bundle.homeOpp3Pct ?? 36.0
  const homeOppFgPct = bundle.homeOppFgPct ?? 46.0

  // Defensive advantage: lower opponent shooting = better
  // Away advantage if home allows MORE than away
  const threePctDiff = homeOpp3Pct - awayOpp3Pct  // Positive = away better defense
  const fgPctDiff = homeOppFgPct - awayOppFgPct

  // Combined: 3P% weighted higher (more impactful in modern NBA)
  const combinedDiff = (threePctDiff * 1.5) + (fgPctDiff * 0.8)

  const cappedDiff = clamp(combinedDiff, -10, 10)
  const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

  const points = Math.abs(signal) * MAX_POINTS
  const awayScore = signal > 0 ? points : 0
  const homeScore = signal < 0 ? points : 0

  const edge = signal > 0 ? 'Away' : 'Home'
  const notes = `${edge} perimeter D: Opp 3P% ${awayOpp3Pct.toFixed(1)} vs ${homeOpp3Pct.toFixed(1)}`

  console.log(`[S12:PerimeterDefense] Signal=${signal.toFixed(3)}, Points=${points.toFixed(2)}`)

  return {
    signal,
    awayScore,
    homeScore,
    meta: {
      raw_values_json: { awayOpp3Pct, awayOppFgPct, homeOpp3Pct, homeOppFgPct, threePctDiff, fgPctDiff, combinedDiff },
      parsed_values_json: { notes }
    }
  }
}

