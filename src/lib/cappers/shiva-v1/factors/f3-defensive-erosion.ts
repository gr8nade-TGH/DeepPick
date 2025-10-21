/**
 * F3: Defensive Erosion Factor
 * 
 * Defensive rating decline + injury impact
 * Max Points: 0.5
 */

import { FactorComputation } from '@/types/factors'
import { StatMuseBundle, RunCtx, InjuryImpact } from './types'
import { clamp, normalizeToPoints, splitPointsEvenly } from '../factor-registry'

/**
 * Compute F3: Defensive Erosion
 * 
 * Formula: drDeltaA = (DRtgA_last10 - Ld) / 8
 *         drDeltaB = (DRtgB_last10 - Ld) / 8
 *         erosionA = 0.7*drDeltaA + 0.3*injA
 *         erosionB = 0.7*drDeltaB + 0.3*injB
 *         erosion = (erosionA + erosionB)/2
 *         z = clamp(erosion, -1, 1)
 *         points = 0.5 * z
 */
export function computeDefensiveErosion(
  bundle: StatMuseBundle, 
  injuryImpact: InjuryImpact, 
  ctx: RunCtx
): FactorComputation {
  const { 
    awayDRtgSeason, 
    homeDRtgSeason, 
    leagueDRtg 
  } = bundle
  
  const { defenseImpactA, defenseImpactB } = injuryImpact
  
  // Calculate defensive rating deltas
  const awayDrDelta = (awayDRtgSeason - leagueDRtg) / 8
  const homeDrDelta = (homeDRtgSeason - leagueDRtg) / 8
  
  // Combine defensive decline with injury impact
  const awayErosion = 0.7 * awayDrDelta + 0.3 * defenseImpactA
  const homeErosion = 0.7 * homeDrDelta + 0.3 * defenseImpactB
  
  // Average erosion for both teams
  const erosion = (awayErosion + homeErosion) / 2
  
  // Normalize to z-score (-1 to +1)
  const signal = clamp(erosion, -1, 1)
  
  // Convert to points (max 0.5)
  const points = normalizeToPoints(signal, 0.5)
  
  // Split points evenly between teams
  const { away: awayContribution, home: homeContribution } = splitPointsEvenly(points)
  
  return {
    factor_no: 3,
    key: 'defErosion',
    name: 'Defensive Erosion',
    raw_values_json: {
      awayDRtgSeason,
      homeDRtgSeason,
      awayDrDelta,
      homeDrDelta,
      defenseImpactA,
      defenseImpactB,
      awayErosion,
      homeErosion,
      erosion,
      leagueDRtg
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
    notes: `Erosion: Away ${awayErosion.toFixed(2)}, Home ${homeErosion.toFixed(2)} (inj: ${defenseImpactA.toFixed(2)}, ${defenseImpactB.toFixed(2)})`
  }
}
