/**
 * F4: 3-Point Environment & Volatility Factor
 * 
 * 3-point environment & volatility based on NBA Stats API data
 * Max Points: 5.0 (scaled by weight)
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx } from './types'

export interface ThreePointEnvInput {
  home3PAR: number      // Home team 3P attempt rate
  away3PAR: number      // Away team 3P attempt rate
  home3Pct: number      // Home team 3P percentage (last 10 games)
  away3Pct: number      // Away team 3P percentage (last 10 games)
  league3PAR: number    // League average 3P attempt rate
  league3Pct: number    // League average 3P percentage
}

export interface ThreePointEnvOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    envRate: number
    rateDelta: number
    shootingVariance: number
    combinedSignal: number
    reason: string
  }
}

/**
 * Calculate 3-point environment factor points using single positive score system
 * Each factor contributes to either Over OR Under, never both
 * 
 * @param input - Team 3P data and league averages
 * @returns Over/Under scores and debugging metadata
 */
export function calculateThreePointEnvPoints(input: ThreePointEnvInput): ThreePointEnvOutput {
  const { home3PAR, away3PAR, home3Pct, away3Pct, league3PAR, league3Pct } = input
  const MAX_POINTS = 5.0

  // Input validation
  if (![home3PAR, away3PAR, home3Pct, away3Pct, league3PAR, league3Pct].every(v => Number.isFinite(v) && v >= 0)) {
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        envRate: 0,
        rateDelta: 0,
        shootingVariance: 0,
        combinedSignal: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate 3P environment rate (average attempt rate)
  const envRate = (home3PAR + away3PAR) / 2

  // Calculate rate delta vs league average
  const rateDelta = envRate - league3PAR

  // Calculate shooting variance (difference in 3P% between teams)
  const shootingVariance = Math.abs(home3Pct - away3Pct)

  // Calculate league shooting variance (using a reasonable estimate)
  const leagueShootingVariance = 0.05 // 5% typical variance between teams

  // Hot shooting factor (teams with very different 3P% performance)
  const hotShootingFactor = Math.max(0, shootingVariance - leagueShootingVariance)

  // Combine rate delta and shooting variance
  // Higher 3P attempt rate + hot shooting = more points scored
  const combinedSignal = (2 * rateDelta) + (hotShootingFactor * 10)

  // Normalize using tanh for smooth saturation
  const signal = Math.tanh(combinedSignal / 0.1) // Scale factor for sensitivity

  // Convert to over/under scores
  const overScore = signal > 0 ? Math.abs(signal) * MAX_POINTS : 0
  const underScore = signal < 0 ? Math.abs(signal) * MAX_POINTS : 0

  return {
    overScore,
    underScore,
    signal,
    meta: {
      envRate,
      rateDelta,
      shootingVariance,
      combinedSignal,
      reason: `3P Env: ${envRate.toFixed(3)} vs ${league3PAR.toFixed(3)} (Δ${rateDelta.toFixed(3)}), Hot: ${hotShootingFactor.toFixed(3)}`
    }
  }
}

/**
 * Compute F4: 3-Point Environment & Volatility
 * 
 * Formula: envRate = (home3PAR + away3PAR) / 2
 *         rateDelta = envRate - league3PAR
 *         shootingVariance = |home3Pct - away3Pct|
 *         hotShootingFactor = max(0, shootingVariance - leagueVariance)
 *         combinedSignal = (2 * rateDelta) + (hotShootingFactor * 10)
 *         signal = tanh(combinedSignal / 0.1)
 *         if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0
 */
export function computeThreePointEnv(bundle: any, ctx: RunCtx): FactorComputation {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 4,
      key: 'threeEnv',
      name: '3-Point Environment & Volatility',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        signal: 0,
        overScore: 0,
        underScore: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Extract data from NBA Stats API bundle
  // 2024-25 NBA league averages: 3PAR ~0.42, 3P% ~0.365
  const home3PAR = bundle.home3PAR || 0.42
  const away3PAR = bundle.away3PAR || 0.42
  const home3Pct = bundle.home3Pct || 0.365
  const away3Pct = bundle.away3Pct || 0.365
  const league3PAR = bundle.league3PAR || 0.42
  const league3Pct = bundle.league3Pct || 0.365

  // Calculate 3P environment points
  const result = calculateThreePointEnvPoints({
    home3PAR,
    away3PAR,
    home3Pct,
    away3Pct,
    league3PAR,
    league3Pct
  })

  return {
    factor_no: 4,
    key: 'threeEnv',
    name: '3-Point Environment & Volatility',
    raw_values_json: {
      home3PAR,
      away3PAR,
      home3Pct,
      away3Pct,
      league3PAR,
      league3Pct,
      envRate: result.meta.envRate,
      rateDelta: result.meta.rateDelta,
      shootingVariance: result.meta.shootingVariance,
      combinedSignal: result.meta.combinedSignal
    },
    parsed_values_json: {
      signal: result.signal,
      overScore: result.overScore,
      underScore: result.underScore
    },
    normalized_value: result.signal,
    caps_applied: Math.abs(result.signal) >= 0.99,
    cap_reason: Math.abs(result.signal) >= 0.99 ? 'signal saturated' : null,
    notes: result.meta.reason
  }
}
