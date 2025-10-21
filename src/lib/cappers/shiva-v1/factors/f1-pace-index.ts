/**
 * F1: Matchup Pace Index Factor
 * 
 * Expected game pace vs league average
 * Max Points: 0.6
 */

import { FactorComputation } from '@/types/factors'
import { StatMuseBundle, RunCtx } from './types'
import { clamp, normalizeToPoints, splitPointsEvenly } from '../factor-registry'

/**
 * Compute F1: Matchup Pace Index
 * 
 * Formula: paceTeam = 0.6*seasonPace + 0.4*last10Pace
 *         expPace = (paceAway + paceHome)/2
 *         paceDelta = expPace - leaguePace
 *         z = clamp(paceDelta / 6, -1, 1)
 *         points = 0.6 * z
 */
export function computePaceIndex(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { awayPaceSeason, awayPaceLast10, homePaceSeason, homePaceLast10, leaguePace } = bundle
  
  // Calculate expected pace for each team
  const awayPaceTeam = 0.6 * awayPaceSeason + 0.4 * awayPaceLast10
  const homePaceTeam = 0.6 * homePaceSeason + 0.4 * homePaceLast10
  
  // Expected game pace
  const expPace = (awayPaceTeam + homePaceTeam) / 2
  
  // Pace delta vs league average
  const paceDelta = expPace - leaguePace
  
  // Normalize to z-score (-1 to +1)
  const signal = clamp(paceDelta / 6, -1, 1)
  
  // Convert to points (max 0.6)
  const points = normalizeToPoints(signal, 0.6)
  
  // Split points evenly between teams
  const { away: awayContribution, home: homeContribution } = splitPointsEvenly(points)
  
  return {
    factor_no: 1,
    key: 'paceIndex',
    name: 'Matchup Pace Index',
    raw_values_json: {
      awayPaceSeason,
      awayPaceLast10,
      homePaceSeason,
      homePaceLast10,
      awayPaceTeam,
      homePaceTeam,
      expPace,
      paceDelta,
      leaguePace
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
    notes: `Expected pace: ${expPace.toFixed(1)} vs league ${leaguePace.toFixed(1)} (Δ${paceDelta.toFixed(1)})`
  }
}
