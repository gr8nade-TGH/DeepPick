/**
 * F1: Matchup Pace Index (NBA TOTALS)
 * 
 * Calculates expected game pace based on both teams' pace interaction.
 * Fast pace = more possessions = higher totals.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 8.0  // 8 pace points = strong signal

export const F1_PACE_INDEX: FactorDefinition<TotalsFactorResult> = {
  // Identity
  key: 'paceIndex',
  factorNumber: 1,
  name: 'Matchup Pace Index',
  shortName: 'Pace',

  // Classification
  sport: 'NBA',
  betType: 'TOTAL',
  category: 'pace',

  // UI Display
  icon: '⏱️',
  description: 'How fast will this game be played? Faster games mean more possessions and more points.',
  logic: `Compares combined team pace to league average.
    - Fast teams = more possessions = higher scoring potential
    - Slow teams = fewer possessions = lower scoring
    - Uses tanh scaling for smooth signal saturation
    - Scale: ±8 pace difference = strong signal`,

  // Data Requirements
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayPaceLast10', 'awayPaceSeason', 'homePaceLast10', 'homePaceSeason', 'leaguePace'],

  // Configuration
  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  // Computation
  compute: (bundle, ctx): TotalsFactorResult => {
    // Handle null bundle
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract data
    const awayPace = bundle.awayPaceLast10 || bundle.awayPaceSeason || 100.1
    const homePace = bundle.homePaceLast10 || bundle.homePaceSeason || 100.1
    const leaguePace = bundle.leaguePace || 100.1

    // Validate
    if (![awayPace, homePace, leaguePace].every(v => Number.isFinite(v) && v > 0)) {
      return createTotalsResult(0, MAX_POINTS, { awayPace, homePace, leaguePace }, { reason: 'bad_input' })
    }

    // Calculate expected game pace
    const expPace = (homePace + awayPace) / 2

    // Calculate pace difference vs league
    let paceDelta = expPace - leaguePace
    paceDelta = clamp(paceDelta, -30, 30)  // Safety cap

    // Calculate signal using tanh for smooth saturation
    const rawSignal = tanh(paceDelta / SCALE)
    const signal = clamp(rawSignal, -1, 1)

    // Build result
    const rawValues = {
      homePace,
      awayPace,
      leaguePace,
      expPace,
      paceDelta
    }

    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayContribution: Math.abs(signal) * MAX_POINTS / 2,
      homeContribution: Math.abs(signal) * MAX_POINTS / 2
    }

    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

