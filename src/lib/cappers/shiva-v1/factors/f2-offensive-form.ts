/**
 * F2: Offensive Form vs Opponent Factor
 * 
 * Recent offensive efficiency against opponent defensive strength
 * Max Points: 0.6
 */

import { FactorComputation } from '@/types/factors'
import { StatMuseBundle, RunCtx } from './types'
import { clamp, normalizeToPoints, splitPointsEvenly } from '../factor-registry'

/**
 * Compute F2: Offensive Form vs Opponent
 * 
 * Formula: ORtgAdjA = ORtgA_last10 * (L / DRtgOppB)
 *         ORtgAdjB = ORtgB_last10 * (L / DRtgOppA)
 *         formDeltaPer100 = (ORtgAdjA + ORtgAdjB) - 2*L
 *         z = clamp(formDeltaPer100 / 10, -1, 1)
 *         points = 0.6 * z
 */
export function computeOffensiveForm(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { 
    awayORtgLast10, 
    homeORtgLast10, 
    awayDRtgSeason, 
    homeDRtgSeason, 
    leagueORtg 
  } = bundle
  
  // Adjust offensive ratings for opponent defensive strength
  const awayORtgAdj = awayORtgLast10 * (leagueORtg / homeDRtgSeason)
  const homeORtgAdj = homeORtgLast10 * (leagueORtg / awayDRtgSeason)
  
  // Combined form delta per 100 possessions
  const formDeltaPer100 = (awayORtgAdj + homeORtgAdj) - (2 * leagueORtg)
  
  // Normalize to z-score (-1 to +1)
  const signal = clamp(formDeltaPer100 / 10, -1, 1)
  
  // Convert to points (max 0.6)
  const points = normalizeToPoints(signal, 0.6)
  
  // Split points evenly between teams
  const { away: awayContribution, home: homeContribution } = splitPointsEvenly(points)
  
  return {
    factor_no: 2,
    key: 'offForm',
    name: 'Offensive Form vs Opponent',
    raw_values_json: {
      awayORtgLast10,
      homeORtgLast10,
      awayDRtgSeason,
      homeDRtgSeason,
      awayORtgAdj,
      homeORtgAdj,
      formDeltaPer100,
      leagueORtg
    },
    parsed_values_json: {
      signal,
      points,
      awayContribution,
      homeContribution
    },
    normalized_value: signal,
    caps_applied: Math.abs(signal) >= 1,
    cap_reason: Math.abs(signal) >= 1 ? 'signal clamped to ±1' : null,
    notes: `Adj ORtg: Away ${awayORtgAdj.toFixed(1)}, Home ${homeORtgAdj.toFixed(1)} (Δ${formDeltaPer100.toFixed(1)})`
  }
}
