/**
 * F5: Free-Throw / Whistle Environment Factor
 * 
 * Free throw rate environment
 * Max Points: 0.3
 */

import { FactorComputation } from '@/types/factors'
import { StatMuseBundle, RunCtx } from './types'
import { clamp, normalizeToPoints, splitPointsEvenly } from '../factor-registry'

/**
 * Compute F5: Free-Throw / Whistle Environment
 * 
 * Formula: ftrEnv = mean(A_FTr, B_FTr, oppA_oppFTr, oppB_oppFTr)
 *         ftrDelta = ftrEnv - leagueFTr
 *         z = clamp(ftrDelta / 0.06, -1, 1)
 *         points = 0.3 * z
 */
export function computeWhistleEnv(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { 
    awayFTr, 
    homeFTr, 
    awayOppFTr, 
    homeOppFTr, 
    leagueFTr 
  } = bundle
  
  // Calculate free throw rate environment
  const ftrEnv = (awayFTr + homeFTr + awayOppFTr + homeOppFTr) / 4
  
  // Rate delta vs league average
  const ftrDelta = ftrEnv - leagueFTr
  
  // Normalize to z-score (-1 to +1)
  const signal = clamp(ftrDelta / 0.06, -1, 1)
  
  // Convert to points (max 0.3)
  const points = normalizeToPoints(signal, 0.3)
  
  // Split points evenly between teams
  const { away: awayContribution, home: homeContribution } = splitPointsEvenly(points)
  
  return {
    factor_no: 5,
    key: 'whistleEnv',
    name: 'Free-Throw / Whistle Environment',
    raw_values_json: {
      awayFTr,
      homeFTr,
      awayOppFTr,
      homeOppFTr,
      ftrEnv,
      ftrDelta,
      leagueFTr
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
    notes: `FT Env: ${ftrEnv.toFixed(3)} vs ${leagueFTr.toFixed(3)} (Δ${ftrDelta.toFixed(3)})`
  }
}
