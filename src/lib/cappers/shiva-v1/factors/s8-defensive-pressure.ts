/**
 * Defensive Pressure Factor (S8)
 * 
 * Calculates defensive disruption through steals and blocks
 * High pressure defense creates transition opportunities and bad shots
 * 
 * Signal Interpretation:
 * - Positive signal → Favors AWAY team (more disruptive defense)
 * - Negative signal → Favors HOME team (more disruptive defense)
 */

import { NBAStatsBundle, RunCtx } from './types'

export interface DefensivePressureInput {
  awaySteals: number
  awayBlocks: number
  homeSteals: number
  homeBlocks: number
}

export interface DefensivePressureOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayDisruption: number
    homeDisruption: number
    disruptionDiff: number
    reason?: string
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

export function calculateDefensivePressurePoints(input: DefensivePressureInput): DefensivePressureOutput {
  const { awaySteals, awayBlocks, homeSteals, homeBlocks } = input
  const MAX_POINTS = 5.0
  const SCALE = 4.0 // Scaling factor for tanh

  // Input validation
  if (![awaySteals, awayBlocks, homeSteals, homeBlocks].every(v => Number.isFinite(v) && v >= 0)) {
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayDisruption: 0,
        homeDisruption: 0,
        disruptionDiff: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate disruption scores (steals worth more than blocks for transition)
  // Steals = 1.5 pts (leads to fast breaks)
  // Blocks = 0.8 pts (ends possession but ball may stay with offense)
  const awayDisruption = (awaySteals * 1.5) + (awayBlocks * 0.8)
  const homeDisruption = (homeSteals * 1.5) + (homeBlocks * 0.8)

  const disruptionDiff = awayDisruption - homeDisruption

  // Calculate signal using tanh for smooth saturation
  const rawSignal = tanh(disruptionDiff / SCALE)
  const signal = clamp(rawSignal, -1, 1)

  // Convert to scores
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayDisruption,
      homeDisruption,
      disruptionDiff
    }
  }
}

export function computeDefensivePressure(bundle: NBAStatsBundle, ctx: RunCtx): any {
  if (!bundle) {
    return {
      factor_no: 8,
      key: 'defensivePressure',
      name: 'Defensive Pressure',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: { points: 0, awayScore: 0, homeScore: 0 },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  const result = calculateDefensivePressurePoints({
    awaySteals: bundle.awaySteals || 0,
    awayBlocks: bundle.awayBlocks || 0,
    homeSteals: bundle.homeSteals || 0,
    homeBlocks: bundle.homeBlocks || 0
  })

  const notes = `Def: Away STL ${bundle.awaySteals?.toFixed(1) || 0}/BLK ${bundle.awayBlocks?.toFixed(1) || 0} vs Home STL ${bundle.homeSteals?.toFixed(1) || 0}/BLK ${bundle.homeBlocks?.toFixed(1) || 0}`

  return {
    factor_no: 8,
    key: 'defensivePressure',
    name: 'Defensive Pressure',
    normalized_value: result.signal,
    raw_values_json: {
      awaySteals: bundle.awaySteals,
      awayBlocks: bundle.awayBlocks,
      homeSteals: bundle.homeSteals,
      homeBlocks: bundle.homeBlocks,
      awayDisruption: result.meta.awayDisruption,
      homeDisruption: result.meta.homeDisruption,
      disruptionDiff: result.meta.disruptionDiff
    },
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal
    },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

