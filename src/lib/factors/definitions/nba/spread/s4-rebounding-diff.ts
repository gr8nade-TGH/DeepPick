/**
 * S4: Rebounding Differential (NBA SPREAD)
 * 
 * Analyzes rebounding advantage between teams.
 * Offensive rebounds = extra possessions = more points
 * Defensive rebounds = denying opponent possessions
 * Board control directly affects scoring margin and ATS outcomes.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 5.0  // 5 rebound differential = strong signal

export const S4_REBOUNDING_DIFF: FactorDefinition<SpreadFactorResult> = {
  key: 'reboundingDiff',
  factorNumber: 4,
  name: 'Rebounding Differential',
  shortName: 'Reb',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'efficiency',

  icon: '🏀',
  description: 'Board control advantage - offensive and defensive rebounding differential',
  logic: `Analyzes rebounding differential between teams.
    - Offensive rebounds = second chance points
    - Defensive rebounds = end opponent possessions
    - ~1.1 pts per offensive rebound (league avg)
    - Net rebound advantage = extra possessions = ATS value`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayOffReb', 'awayDefReb', 'homeOffReb', 'homeDefReb'],

  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract rebounding data (per game averages)
    const awayOffReb = bundle.awayOffReb ?? bundle.avgOffReb ?? 10.5
    const awayDefReb = bundle.awayDefReb ?? bundle.avgDefReb ?? 33.0
    const homeOffReb = bundle.homeOffReb ?? 10.5
    const homeDefReb = bundle.homeDefReb ?? 33.0

    // Total rebounds for each team
    const awayTotalReb = awayOffReb + awayDefReb
    const homeTotalReb = homeOffReb + homeDefReb

    // Offensive rebound differential (more impactful - second chance pts)
    // Away's OREB vs Home's DREB ability, and vice versa
    const awayOrebAdvantage = awayOffReb - (homeDefReb * 0.25)  // OREB vs opponent's DREB contest
    const homeOrebAdvantage = homeOffReb - (awayDefReb * 0.25)
    const orebDiff = awayOrebAdvantage - homeOrebAdvantage

    // Total rebounding differential
    const totalRebDiff = awayTotalReb - homeTotalReb

    // Weighted combination: OREB worth more (second chance pts)
    // ~1.1 pts per OREB, ~0.5 pts per DREB advantage
    const weightedDiff = (orebDiff * 1.1) + (totalRebDiff * 0.3)

    const cappedDiff = clamp(weightedDiff, -15, 15)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const edge = signal > 0 ? 'Away' : 'Home'
    const rebDiffStr = totalRebDiff > 0 ? `+${totalRebDiff.toFixed(1)}` : totalRebDiff.toFixed(1)
    const notes = `${edge} boards: ${rebDiffStr} reb/g (OREB: ${awayOffReb.toFixed(1)} vs ${homeOffReb.toFixed(1)})`

    return createSpreadResult(signal, MAX_POINTS,
      { awayOffReb, awayDefReb, homeOffReb, homeDefReb, totalRebDiff, orebDiff, weightedDiff },
      { notes }
    )
  }
}

