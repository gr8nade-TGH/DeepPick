/**
 * S3: Shooting Efficiency (NBA SPREAD)
 *
 * Analyzes shooting efficiency (eFG% + FTr) differential.
 * Teams with better shooting efficiency tend to cover spreads.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.05  // 5% efficiency difference = strong signal

export const S3_SHOOTING_EFFICIENCY: FactorDefinition<SpreadFactorResult> = {
  key: 'shootingEfficiencyMomentum',
  factorNumber: 3,
  name: 'Shooting Efficiency',
  shortName: 'Shooting',

  sport: 'NBA',
  betType: 'SPREAD',
  category: 'shooting',

  icon: '🎯',
  description: 'Shooting efficiency (eFG% + FTr) differential between teams',
  logic: `Analyzes shooting efficiency differential.
    - eFG% = effective field goal percentage (weights 3s)
    - FTr = free throw rate (bonus points for getting to the line)
    - Better shooters = ATS value`,

  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayEfg', 'homeEfg', 'awayFtr', 'homeFtr'],

  defaultWeight: 20,
  maxPoints: MAX_POINTS,

  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }

    // Extract data
    const awayEfg = bundle.awayEfg || 0.53
    const homeEfg = bundle.homeEfg || 0.53
    const awayFtr = bundle.awayFtr || bundle.awayFTr || 0.22
    const homeFtr = bundle.homeFtr || bundle.homeFTr || 0.22

    // Calculate composite shooting efficiency
    // eFG% is main component, FTr adds bonus
    const awayEfficiency = awayEfg + (awayFtr * 0.1)
    const homeEfficiency = homeEfg + (homeFtr * 0.1)

    // Efficiency differential (positive = away shooting better)
    const efficiencyDiff = awayEfficiency - homeEfficiency

    const cappedDiff = clamp(efficiencyDiff, -0.15, 0.15)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)

    const rawValues = {
      awayEfg,
      homeEfg,
      awayFtr,
      homeFtr,
      awayEfficiency,
      homeEfficiency,
      efficiencyDiff
    }

    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayShootingScore: awayEfficiency,
      homeShootingScore: homeEfficiency
    }

    return createSpreadResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

