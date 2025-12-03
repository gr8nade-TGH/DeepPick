/**
 * S8: Defensive Pressure (NBA SPREAD)
 * 
 * Analyzes defensive disruption through steals and blocks.
 * Teams that force turnovers and alter shots create transition opportunities
 * and demoralize opponents - key for covering spreads.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 4.0  // 4 combined steals+blocks differential = strong signal

export const S8_DEFENSIVE_PRESSURE: FactorDefinition<SpreadFactorResult> = {
  key: 'defensivePressure',
  factorNumber: 8,
  name: 'Defensive Pressure',
  shortName: 'Def',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'defense',

  icon: '🛡️',
  description: 'Defensive disruption through steals and blocks',
  logic: `Analyzes defensive pressure differential.
    - Steals = transition points + opponent demoralization
    - Blocks = altered shots + psychological impact
    - High pressure defense creates scoring opportunities
    - Disruption leads to opponent frustration and poor decisions`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awaySteals', 'awayBlocks', 'homeSteals', 'homeBlocks'],

  defaultWeight: 15,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract defensive stats (per game averages)
    // NBA averages: ~7.5 steals, ~5 blocks per game
    const awaySteals = bundle.awaySteals ?? 7.5
    const awayBlocks = bundle.awayBlocks ?? 5.0
    const homeSteals = bundle.homeSteals ?? 7.5
    const homeBlocks = bundle.homeBlocks ?? 5.0

    // Calculate disruption scores
    // Steals worth more - lead directly to fast break points (~1.5 pts per steal)
    // Blocks valuable but don't always lead to possession change (~0.8 pts impact)
    const awayDisruption = (awaySteals * 1.5) + (awayBlocks * 0.8)
    const homeDisruption = (homeSteals * 1.5) + (homeBlocks * 0.8)

    // Raw differentials
    const stealsDiff = awaySteals - homeSteals
    const blocksDiff = awayBlocks - homeBlocks
    const disruptionDiff = awayDisruption - homeDisruption

    const cappedDiff = clamp(disruptionDiff, -12, 12)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const edge = signal > 0 ? 'Away' : 'Home'
    const awayTotal = (awaySteals + awayBlocks).toFixed(1)
    const homeTotal = (homeSteals + homeBlocks).toFixed(1)
    const notes = `${edge} pressure: STL+BLK ${awayTotal} vs ${homeTotal}`

    return createSpreadResult(signal, MAX_POINTS,
      { awaySteals, awayBlocks, homeSteals, homeBlocks, stealsDiff, blocksDiff, disruptionDiff },
      { notes }
    )
  }
}

