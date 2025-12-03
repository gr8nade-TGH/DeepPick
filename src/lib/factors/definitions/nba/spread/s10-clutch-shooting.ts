/**
 * S10: Clutch Shooting (NBA SPREAD)
 *
 * Analyzes free throw shooting - critical in close games.
 * Teams that convert from the line in crunch time cover spreads.
 * Also incorporates FG% as baseline shooting efficiency.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 6.0  // 6% FT difference = strong signal

export const S10_CLUTCH_SHOOTING: FactorDefinition<SpreadFactorResult> = {
  key: 'clutchShooting',
  factorNumber: 10,
  name: 'Clutch Shooting',
  shortName: 'Clutch',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'offense',

  icon: '🎯',
  description: 'Free throw and field goal efficiency - crucial in close games',
  logic: `Analyzes clutch shooting ability.
    - Free throw % = points in crunch time
    - Field goal % = baseline efficiency
    - Good FT teams win close games and cover spreads
    - Combined metric weights FT% higher for ATS value`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayFtPct', 'awayFgPct', 'homeFtPct', 'homeFgPct'],

  defaultWeight: 15,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract shooting data
    // NBA averages: ~77% FT, ~46% FG
    const awayFtPct = bundle.awayFtPct ?? 77.0
    const awayFgPct = bundle.awayFgPct ?? 46.0
    const homeFtPct = bundle.homeFtPct ?? 77.0
    const homeFgPct = bundle.homeFgPct ?? 46.0

    // Calculate differentials
    const ftPctDiff = awayFtPct - homeFtPct
    const fgPctDiff = awayFgPct - homeFgPct

    // Combined score: FT% weighted 1.5x (more critical in close games)
    const combinedDiff = (ftPctDiff * 1.5) + (fgPctDiff * 0.8)

    const cappedDiff = clamp(combinedDiff, -15, 15)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const edge = signal > 0 ? 'Away' : 'Home'
    const notes = `${edge} clutch: FT% ${awayFtPct.toFixed(1)} vs ${homeFtPct.toFixed(1)}`

    return createSpreadResult(signal, MAX_POINTS,
      { awayFtPct, awayFgPct, homeFtPct, homeFgPct, ftPctDiff, fgPctDiff, combinedDiff },
      { notes }
    )
  }
}

