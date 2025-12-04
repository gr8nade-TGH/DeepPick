/**
 * F5: Free-Throw/Whistle Environment (NBA TOTALS)
 * 
 * Analyzes free throw rate environment for both teams.
 * High FTr = more trips to the line = more points.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.08  // 8% FTr difference = strong signal

export const F5_WHISTLE_ENV: FactorDefinition<TotalsFactorResult> = {
  key: 'whistleEnv',
  factorNumber: 5,
  name: 'Free Throw Environment',
  shortName: 'Free Throws',

  sport: 'NBA',
  betType: 'TOTAL',
  category: 'efficiency',

  icon: '⛹️‍♂️',
  description: 'Will the refs blow the whistle? Physical games with lots of fouls mean easy points at the line.',
  logic: `Combines each team's free throw rate with opponent's tendency to foul.
    - High FTr = more free points
    - Physical teams draw more fouls
    - Increases total scoring potential`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayFTr', 'homeFTr', 'awayOppFTr', 'homeOppFTr', 'leagueFTr'],

  defaultWeight: 5,  // Lower weight as secondary factor
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract data
    const awayFTr = bundle.awayFTr || 0.22
    const homeFTr = bundle.homeFTr || 0.22
    const awayOppFTr = bundle.awayOppFTr || 0.22
    const homeOppFTr = bundle.homeOppFTr || 0.22
    const leagueFTr = bundle.leagueFTr || 0.22

    // Calculate effective FTr for each team
    // Team's FTr + opponent's tendency to allow FTs
    const awayEffectiveFTr = (awayFTr + homeOppFTr) / 2
    const homeEffectiveFTr = (homeFTr + awayOppFTr) / 2

    // Combined whistle environment
    const combinedFTr = (awayEffectiveFTr + homeEffectiveFTr) / 2
    const ftrDiff = combinedFTr - leagueFTr

    const cappedDiff = clamp(ftrDiff, -0.15, 0.15)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const rawValues = {
      awayFTr,
      homeFTr,
      awayOppFTr,
      homeOppFTr,
      leagueFTr,
      awayEffectiveFTr,
      homeEffectiveFTr,
      combinedFTr,
      ftrDiff
    }

    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayFTrContribution: awayEffectiveFTr - leagueFTr,
      homeFTrContribution: homeEffectiveFTr - leagueFTr
    }

    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

