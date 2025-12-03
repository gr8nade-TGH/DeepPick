/**
 * S11: Scoring Margin (NBA SPREAD)
 *
 * Analyzes raw points per game and points allowed.
 * Simple but powerful - teams that outscore opponents cover spreads.
 * Uses Plus/Minus data when available.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 8.0  // 8 point margin differential = strong signal

export const S11_SCORING_MARGIN: FactorDefinition<SpreadFactorResult> = {
  key: 'scoringMargin',
  factorNumber: 11,
  name: 'Scoring Margin',
  shortName: 'Margin',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'efficiency',

  icon: '📊',
  description: 'Raw scoring differential - points scored vs points allowed',
  logic: `Analyzes scoring margin differential.
    - Points per game = offensive firepower
    - Points allowed = defensive strength
    - Net margin = team quality indicator
    - Simple metric that directly predicts ATS outcomes`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayPpg', 'awayOppPpg', 'homePpg', 'homeOppPpg'],

  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract scoring data
    // NBA averages: ~113 PPG
    const awayPpg = bundle.awayPpg ?? bundle.awayPointsPerGame ?? 113.0
    const awayOppPpg = bundle.awayOppPpg ?? 113.0
    const homePpg = bundle.homePpg ?? bundle.homePointsPerGame ?? 113.0
    const homeOppPpg = bundle.homeOppPpg ?? 113.0

    // Calculate margins
    const awayMargin = awayPpg - awayOppPpg
    const homeMargin = homePpg - homeOppPpg

    // Net margin differential
    const marginDiff = awayMargin - homeMargin

    const cappedDiff = clamp(marginDiff, -20, 20)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const edge = signal > 0 ? 'Away' : 'Home'
    const awayMarginStr = awayMargin >= 0 ? `+${awayMargin.toFixed(1)}` : awayMargin.toFixed(1)
    const homeMarginStr = homeMargin >= 0 ? `+${homeMargin.toFixed(1)}` : homeMargin.toFixed(1)
    const notes = `${edge} margin: ${awayMarginStr} vs ${homeMarginStr}`

    return createSpreadResult(signal, MAX_POINTS,
      { awayPpg, awayOppPpg, awayMargin, homePpg, homeOppPpg, homeMargin, marginDiff },
      { notes }
    )
  }
}

