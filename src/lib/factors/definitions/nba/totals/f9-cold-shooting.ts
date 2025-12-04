/**
 * F9: Cold Shooting (NBA TOTALS)
 * 
 * UNDER-BIASED FACTOR: Measures shooting slumps.
 * Cold shooting = fewer points = UNDER signal.
 * 
 * This is the INVERSE of threeEnv's shooting heat component:
 * - threeEnv: Hot shooting = OVER signal
 * - coldShooting: Cold shooting = UNDER signal
 * 
 * Focuses specifically on teams shooting BELOW league average.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.03  // 3% below league avg = strong signal

export const F9_COLD_SHOOTING: FactorDefinition<TotalsFactorResult> = {
  key: 'coldShooting',
  factorNumber: 9,
  name: 'Cold Shooting',
  shortName: 'Cold Shooting',

  sport: 'NBA',
  betType: 'TOTAL',
  category: 'shooting',

  icon: '❄️',
  description: 'Are teams in a shooting slump? Cold shooting = fewer points = UNDER signal.',
  logic: `Analyzes recent 3P% and FG% vs league average.
    - Teams shooting below league avg = cold
    - Both teams cold = low-scoring game
    - UNDER-biased: Cold shooting = negative signal (UNDER)`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['away3PctLast10', 'home3PctLast10', 'league3Pct', 'awayFgPct', 'homeFgPct'],

  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract 3P% data
    const away3Pct = bundle.away3PctLast10 || bundle.away3Pct || 0.35
    const home3Pct = bundle.home3PctLast10 || bundle.home3Pct || 0.35
    const league3Pct = bundle.league3Pct || 0.35

    // Extract FG% data (if available, otherwise estimate from ORtg)
    const awayFgPct = bundle.awayFgPct || 0.46
    const homeFgPct = bundle.homeFgPct || 0.46
    const leagueFgPct = 0.47  // NBA league average FG%

    // Calculate 3P% coldness (negative = cold)
    const away3Cold = away3Pct - league3Pct
    const home3Cold = home3Pct - league3Pct
    const combined3Cold = (away3Cold + home3Cold) / 2

    // Calculate FG% coldness (negative = cold)
    const awayFgCold = awayFgPct - leagueFgPct
    const homeFgCold = homeFgPct - leagueFgPct
    const combinedFgCold = (awayFgCold + homeFgCold) / 2

    // Combined coldness (weight 3P% more as it's more volatile)
    // Negative values = cold shooting
    const combinedColdness = (combined3Cold * 0.7) + (combinedFgCold * 0.3)
    const cappedColdness = clamp(combinedColdness, -0.10, 0.10)

    // Cold shooting (negative coldness) = UNDER signal (negative)
    // We want: cold → negative signal → UNDER
    const signal = clamp(tanh(cappedColdness / SCALE), -1, 1)

    const rawValues = {
      away3Pct,
      home3Pct,
      league3Pct,
      awayFgPct,
      homeFgPct,
      leagueFgPct,
      away3Cold,
      home3Cold,
      combined3Cold,
      combinedFgCold,
      combinedColdness
    }

    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      threePtComponent: combined3Cold * 0.7,
      fgComponent: combinedFgCold * 0.3,
      direction: signal < 0 ? 'UNDER' : signal > 0 ? 'OVER' : 'NEUTRAL'
    }

    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

