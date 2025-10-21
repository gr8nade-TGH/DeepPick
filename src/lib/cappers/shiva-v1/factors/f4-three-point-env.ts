/**
 * F4: 3-Point Environment & Volatility Factor
 * 
 * 3-point environment & volatility
 * Max Points: 0.4
 */

import { FactorComputation } from '@/types/factors'
import { StatMuseBundle, RunCtx } from './types'
import { clamp, normalizeToPoints, splitPointsEvenly } from '../factor-registry'

/**
 * Compute F4: 3-Point Environment & Volatility
 * 
 * Formula: envRate = mean(A_3PAR, B_3PAR, oppA_opp3PAR, oppB_opp3PAR)
 *         rateDelta = envRate - league3PAR
 *         hotVar = max(0, stdev([A_3P%10, B_3P%10]) - league3Pstdev)
 *         z = clamp((2*rateDelta + hotVar), -1, 1)
 *         points = 0.4 * z
 */
export function computeThreePointEnv(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { 
    away3PAR, 
    home3PAR, 
    awayOpp3PAR, 
    homeOpp3PAR, 
    away3PctLast10, 
    home3PctLast10, 
    league3PAR, 
    league3Pstdev 
  } = bundle
  
  // Calculate environment rate (average 3P attempt rate)
  const envRate = (away3PAR + home3PAR + awayOpp3PAR + homeOpp3PAR) / 4
  
  // Rate delta vs league average
  const rateDelta = envRate - league3PAR
  
  // Calculate hot shooting variance
  const threePctVariance = Math.abs(away3PctLast10 - home3PctLast10)
  const hotVar = Math.max(0, threePctVariance - league3Pstdev)
  
  // Combine rate delta and volatility
  const combinedSignal = (2 * rateDelta) + hotVar
  
  // Normalize to z-score (-1 to +1)
  const signal = clamp(combinedSignal, -1, 1)
  
  // Convert to points (max 0.4)
  const points = normalizeToPoints(signal, 0.4)
  
  // Split points evenly between teams
  const { away: awayContribution, home: homeContribution } = splitPointsEvenly(points)
  
  return {
    factor_no: 4,
    key: 'threeEnv',
    name: '3-Point Environment & Volatility',
    raw_values_json: {
      away3PAR,
      home3PAR,
      awayOpp3PAR,
      homeOpp3PAR,
      away3PctLast10,
      home3PctLast10,
      envRate,
      rateDelta,
      threePctVariance,
      hotVar,
      combinedSignal,
      league3PAR,
      league3Pstdev
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
    notes: `3P Env: ${envRate.toFixed(3)} vs ${league3PAR.toFixed(3)} (Δ${rateDelta.toFixed(3)}), Hot: ${hotVar.toFixed(3)}`
  }
}
