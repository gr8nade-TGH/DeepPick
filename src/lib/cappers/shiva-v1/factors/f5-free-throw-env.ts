/**
 * F5: Free-Throw / Whistle Environment Factor
 * 
 * Free throw rate environment based on NBA Stats API data
 * Max Points: 5.0 (scaled by weight)
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx } from './types'

export interface FreeThrowEnvInput {
  homeFTr: number      // Home team free throw rate
  awayFTr: number      // Away team free throw rate
  leagueFTr: number    // League average free throw rate
}

export interface FreeThrowEnvOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    ftrEnv: number
    ftrDelta: number
    reason: string
  }
}

/**
 * Calculate free throw environment factor points using single positive score system
 * Each factor contributes to either Over OR Under, never both
 * 
 * @param input - Team FT data and league averages
 * @returns Over/Under scores and debugging metadata
 */
export function calculateFreeThrowEnvPoints(input: FreeThrowEnvInput): FreeThrowEnvOutput {
  const { homeFTr, awayFTr, leagueFTr } = input
  const MAX_POINTS = 5.0

  // Input validation
  if (![homeFTr, awayFTr, leagueFTr].every(v => Number.isFinite(v) && v >= 0)) {
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        ftrEnv: 0,
        ftrDelta: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate FT environment rate (average free throw rate)
  const ftrEnv = (homeFTr + awayFTr) / 2

  // Calculate rate delta vs league average
  const ftrDelta = ftrEnv - leagueFTr

  // Normalize using tanh for smooth saturation
  // Higher FT rate = more points scored (more free throws = more scoring opportunities)
  const signal = Math.tanh(ftrDelta / 0.06) // Scale factor for sensitivity

  // Convert to over/under scores
  const overScore = signal > 0 ? Math.abs(signal) * MAX_POINTS : 0
  const underScore = signal < 0 ? Math.abs(signal) * MAX_POINTS : 0

  return {
    overScore,
    underScore,
    signal,
    meta: {
      ftrEnv,
      ftrDelta,
      reason: `FT Env: ${ftrEnv.toFixed(3)} vs ${leagueFTr.toFixed(3)} (Δ${ftrDelta.toFixed(3)})`
    }
  }
}

/**
 * Compute F5: Free-Throw / Whistle Environment
 * 
 * Formula: ftrEnv = (homeFTr + awayFTr) / 2
 *         ftrDelta = ftrEnv - leagueFTr
 *         signal = tanh(ftrDelta / 0.06)
 *         if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0
 */
export function computeWhistleEnv(bundle: any, ctx: RunCtx): FactorComputation {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 5,
      key: 'whistleEnv',
      name: 'Free-Throw / Whistle Environment',
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
  // 2024-25 NBA league average FTr is ~0.26
  const homeFTr = bundle.homeFTr || 0.26
  const awayFTr = bundle.awayFTr || 0.26
  const leagueFTr = bundle.leagueFTr || 0.26

  // Calculate FT environment points
  const result = calculateFreeThrowEnvPoints({
    homeFTr,
    awayFTr,
    leagueFTr
  })

  return {
    factor_no: 5,
    key: 'whistleEnv',
    name: 'Free-Throw / Whistle Environment',
    raw_values_json: {
      homeFTr,
      awayFTr,
      leagueFTr,
      ftrEnv: result.meta.ftrEnv,
      ftrDelta: result.meta.ftrDelta
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
