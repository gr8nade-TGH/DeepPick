/**
 * S12: Perimeter Defense (NBA SPREAD)
 *
 * Analyzes opponent 3-point shooting allowed.
 * In the modern NBA, stopping the 3-ball is crucial.
 * Teams that contest perimeter shots win more games.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 4.0  // 4% difference in opp 3P% = strong signal

export const S12_PERIMETER_DEFENSE: FactorDefinition<SpreadFactorResult> = {
  key: 'perimeterDefense',
  factorNumber: 12,
  name: 'Perimeter Defense',
  shortName: 'PerimD',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'defense',

  icon: '🏰',
  description: 'Opponent 3-point shooting allowed - critical in modern NBA',
  logic: `Analyzes perimeter defense quality.
    - Opp 3P% = perimeter defense effectiveness
    - Opp FG% = overall defensive quality
    - Lower opponent shooting = better defense
    - 3-point defense especially important in modern NBA`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayOpp3Pct', 'awayOppFgPct', 'homeOpp3Pct', 'homeOppFgPct'],

  defaultWeight: 15,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract opponent shooting data (lower is better for defense)
    // NBA averages: ~36% 3P, ~46% FG
    const awayOpp3Pct = bundle.awayOpp3Pct ?? 36.0
    const awayOppFgPct = bundle.awayOppFgPct ?? 46.0
    const homeOpp3Pct = bundle.homeOpp3Pct ?? 36.0
    const homeOppFgPct = bundle.homeOppFgPct ?? 46.0

    // Calculate defensive differentials (negative = better defense)
    // We flip signs so that LOWER opponent shooting = positive signal for that team
    const away3PctAllowed = awayOpp3Pct
    const home3PctAllowed = homeOpp3Pct
    const awayFgPctAllowed = awayOppFgPct
    const homeFgPctAllowed = homeOppFgPct

    // Defensive advantage: lower opponent shooting = better
    // Away advantage if home allows MORE than away
    const threePctDiff = home3PctAllowed - away3PctAllowed  // Positive = away better defense
    const fgPctDiff = homeFgPctAllowed - awayFgPctAllowed

    // Combined: 3P% weighted higher (more impactful)
    const combinedDiff = (threePctDiff * 1.5) + (fgPctDiff * 0.8)

    const cappedDiff = clamp(combinedDiff, -10, 10)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const edge = signal > 0 ? 'Away' : 'Home'
    const notes = `${edge} perimeter D: Opp 3P% ${away3PctAllowed.toFixed(1)} vs ${home3PctAllowed.toFixed(1)}`

    return createSpreadResult(signal, MAX_POINTS,
      { awayOpp3Pct, awayOppFgPct, homeOpp3Pct, homeOppFgPct, threePctDiff, fgPctDiff, combinedDiff },
      { notes }
    )
  }
}

