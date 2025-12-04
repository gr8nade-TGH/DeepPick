/**
 * F8: Defensive Strength (NBA TOTALS)
 * 
 * UNDER-BIASED FACTOR: Measures combined defensive strength.
 * Strong defenses = lower totals = UNDER signal.
 * 
 * This is the INVERSE of defErosion:
 * - defErosion: Bad defense (high DRtg) = OVER signal
 * - defStrength: Good defense (low DRtg) = UNDER signal
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 5.0  // 5 DRtg below league avg = strong signal

export const F8_DEFENSIVE_STRENGTH: FactorDefinition<TotalsFactorResult> = {
  key: 'defStrength',
  factorNumber: 8,
  name: 'Defensive Strength',
  shortName: 'Def Strength',

  sport: 'NBA',
  betType: 'TOTAL',
  category: 'defense',

  icon: '🔒',
  description: 'Are both teams playing elite defense? Strong defenses limit scoring = UNDER signal.',
  logic: `Analyzes combined defensive strength vs league average.
    - Lower DRtg (better defense) = fewer points allowed
    - Both teams with strong D = low-scoring game
    - UNDER-biased: Strong defense = negative signal (UNDER)`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayDRtgSeason', 'homeDRtgSeason', 'leagueDRtg'],

  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract data
    const awayDRtg = bundle.awayDRtgSeason || 110.0
    const homeDRtg = bundle.homeDRtgSeason || 110.0
    const leagueDRtg = bundle.leagueDRtg || 110.0

    // Calculate defensive strength (lower DRtg = better defense = UNDER signal)
    // Negative values mean BETTER than league average
    const awayStrength = leagueDRtg - awayDRtg  // Positive = good D
    const homeStrength = leagueDRtg - homeDRtg  // Positive = good D
    const combinedStrength = (awayStrength + homeStrength) / 2

    const cappedStrength = clamp(combinedStrength, -15, 15)

    // Positive strength (good defense) = UNDER signal (negative)
    // We want: strong D → negative signal → UNDER
    const signal = clamp(-tanh(cappedStrength / SCALE), -1, 1)

    const rawValues = {
      awayDRtg,
      homeDRtg,
      leagueDRtg,
      awayStrength,
      homeStrength,
      combinedStrength
    }

    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayDefenseStrength: awayStrength,
      homeDefenseStrength: homeStrength,
      direction: signal < 0 ? 'UNDER' : signal > 0 ? 'OVER' : 'NEUTRAL'
    }

    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

