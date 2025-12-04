/**
 * F4: Three-Point Environment (NBA TOTALS)
 * 
 * Analyzes 3-point attempt rates and shooting variance.
 * High 3PAR + hot shooting = scoring volatility.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.05  // 5% 3PAR difference = strong signal

export const F4_THREE_POINT_ENV: FactorDefinition<TotalsFactorResult> = {
  key: 'threeEnv',
  factorNumber: 4,
  name: '3-Point Environment',
  shortName: '3-Point Environment',

  sport: 'NBA',
  betType: 'TOTAL',
  category: 'shooting',

  icon: '🏹',
  description: 'Are teams shooting a lot of threes? High-volume 3PT games have more scoring variance.',
  logic: `Combines 3-point attempt rate with recent shooting trends.
    - High 3PAR teams = more variance
    - Hot 3P shooting (last 10) = scoring boost
    - Cold 3P shooting = scoring drag`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['away3PAR', 'home3PAR', 'away3PctLast10', 'home3PctLast10', 'league3PAR', 'league3Pct'],

  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract data
    const away3PAR = bundle.away3PAR || 0.39
    const home3PAR = bundle.home3PAR || 0.39
    const away3Pct = bundle.away3PctLast10 || bundle.away3Pct || 0.35
    const home3Pct = bundle.home3PctLast10 || bundle.home3Pct || 0.35
    const league3PAR = bundle.league3PAR || 0.39
    const league3Pct = bundle.league3Pct || 0.35

    // Calculate 3PAR differential
    const combined3PAR = (away3PAR + home3PAR) / 2
    const parDiff = combined3PAR - league3PAR

    // Calculate shooting heat
    const combined3Pct = (away3Pct + home3Pct) / 2
    const shootingHeat = combined3Pct - league3Pct

    // Combined 3P environment (weight PAR more than shooting)
    const threeEnvScore = (parDiff * 0.6) + (shootingHeat * 0.4)
    const cappedScore = clamp(threeEnvScore, -0.15, 0.15)

    const signal = clamp(tanh(cappedScore / SCALE), -1, 1)

    const rawValues = {
      away3PAR,
      home3PAR,
      away3Pct,
      home3Pct,
      league3PAR,
      league3Pct,
      combined3PAR,
      parDiff,
      shootingHeat,
      threeEnvScore
    }

    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      parComponent: parDiff * 0.6,
      shootingComponent: shootingHeat * 0.4
    }

    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

