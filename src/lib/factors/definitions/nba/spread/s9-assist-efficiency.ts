/**
 * S9: Assist Efficiency (NBA SPREAD)
 * 
 * Analyzes ball movement quality and team chemistry.
 * High assist teams create better shots and play unselfishly.
 * AST/TOV ratio measures smart vs sloppy play.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.5  // 0.5 AST/TOV ratio difference = strong signal

export const S9_ASSIST_EFFICIENCY: FactorDefinition<SpreadFactorResult> = {
  key: 'assistEfficiency',
  factorNumber: 9,
  name: 'Assist Efficiency',
  shortName: 'Ast',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'offense',

  icon: '🤝',
  description: 'Ball movement quality and team chemistry (AST/TOV ratio)',
  logic: `Analyzes assist efficiency differential.
    - High assists = unselfish play, better shots
    - AST/TOV ratio = smart decision making
    - Teams with good ball movement beat ISO-heavy teams
    - Chemistry and execution advantage`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayAssists', 'awayTurnovers', 'homeAssists', 'homeTurnovers'],

  defaultWeight: 15,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract assist and turnover data
    // NBA averages: ~25 assists, ~14 turnovers per game, ~1.8 AST/TOV ratio
    const awayAssists = bundle.awayAssists ?? 25.0
    const awayTurnovers = bundle.awayTurnovers ?? bundle.awayTOVLast10 ?? 14.0
    const homeAssists = bundle.homeAssists ?? 25.0
    const homeTurnovers = bundle.homeTurnovers ?? bundle.homeTOVLast10 ?? 14.0

    // Calculate AST/TOV ratios (higher is better)
    const awayAstTovRatio = awayTurnovers > 0 ? awayAssists / awayTurnovers : 1.8
    const homeAstTovRatio = homeTurnovers > 0 ? homeAssists / homeTurnovers : 1.8

    // Raw differentials
    const assistsDiff = awayAssists - homeAssists
    const astTovRatioDiff = awayAstTovRatio - homeAstTovRatio

    // Combined score: AST/TOV ratio is primary, raw assists secondary
    // AST/TOV ratio matters more - shows efficiency not just volume
    const combinedDiff = (astTovRatioDiff * 2.0) + (assistsDiff * 0.05)

    const cappedDiff = clamp(combinedDiff, -2, 2)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const edge = signal > 0 ? 'Away' : 'Home'
    const notes = `${edge} ball movement: AST/TO ${awayAstTovRatio.toFixed(2)} vs ${homeAstTovRatio.toFixed(2)}`

    return createSpreadResult(signal, MAX_POINTS,
      { awayAssists, awayTurnovers, awayAstTovRatio, homeAssists, homeTurnovers, homeAstTovRatio, astTovRatioDiff },
      { notes }
    )
  }
}

