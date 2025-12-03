/**
 * Assist Efficiency Factor (S9)
 * 
 * Calculates ball movement quality and team chemistry
 * High AST/TOV ratio = smart decision making = better shots
 * 
 * Signal Interpretation:
 * - Positive signal → Favors AWAY team (better ball movement)
 * - Negative signal → Favors HOME team (better ball movement)
 */

import { NBAStatsBundle, RunCtx } from './types'

export interface AssistEfficiencyInput {
  awayAssists: number
  awayTurnovers: number
  homeAssists: number
  homeTurnovers: number
}

export interface AssistEfficiencyOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayAstTov: number
    homeAstTov: number
    astTovDiff: number
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

export function calculateAssistEfficiencyPoints(input: AssistEfficiencyInput): AssistEfficiencyOutput {
  const { awayAssists, awayTurnovers, homeAssists, homeTurnovers } = input
  const MAX_POINTS = 5.0
  const SCALE = 0.5 // Scaling factor for tanh (AST/TOV ratios are typically 1.0-2.5)

  // Input validation
  if (![awayAssists, awayTurnovers, homeAssists, homeTurnovers].every(v => Number.isFinite(v) && v >= 0)) {
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayAstTov: 0,
        homeAstTov: 0,
        astTovDiff: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate AST/TOV ratios (avoid division by zero)
  const awayAstTov = awayTurnovers > 0 ? awayAssists / awayTurnovers : awayAssists > 0 ? 3.0 : 1.0
  const homeAstTov = homeTurnovers > 0 ? homeAssists / homeTurnovers : homeAssists > 0 ? 3.0 : 1.0

  const astTovDiff = awayAstTov - homeAstTov

  // Calculate signal using tanh for smooth saturation
  const rawSignal = tanh(astTovDiff / SCALE)
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
      awayAstTov,
      homeAstTov,
      astTovDiff
    }
  }
}

export function computeAssistEfficiency(bundle: NBAStatsBundle, ctx: RunCtx): any {
  if (!bundle) {
    return {
      factor_no: 9,
      key: 'assistEfficiency',
      name: 'Assist Efficiency',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: { points: 0, awayScore: 0, homeScore: 0 },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  const result = calculateAssistEfficiencyPoints({
    awayAssists: bundle.awayAssists || 0,
    awayTurnovers: bundle.awayTurnovers || bundle.awayTOVLast10 || 0,
    homeAssists: bundle.homeAssists || 0,
    homeTurnovers: bundle.homeTurnovers || bundle.homeTOVLast10 || 0
  })

  const notes = `AST/TOV: Away ${result.meta.awayAstTov.toFixed(2)} vs Home ${result.meta.homeAstTov.toFixed(2)} (Δ${result.meta.astTovDiff > 0 ? '+' : ''}${result.meta.astTovDiff.toFixed(2)})`

  return {
    factor_no: 9,
    key: 'assistEfficiency',
    name: 'Assist Efficiency',
    normalized_value: result.signal,
    raw_values_json: {
      awayAssists: bundle.awayAssists,
      awayTurnovers: bundle.awayTurnovers || bundle.awayTOVLast10,
      homeAssists: bundle.homeAssists,
      homeTurnovers: bundle.homeTurnovers || bundle.homeTOVLast10,
      awayAstTov: result.meta.awayAstTov,
      homeAstTov: result.meta.homeAstTov,
      astTovDiff: result.meta.astTovDiff
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

