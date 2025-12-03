/**
 * S2: Turnover Differential (NBA SPREAD)
 * 
 * Analyzes ball security and defensive pressure.
 * Teams that protect the ball and force turnovers cover spreads.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 3.0  // 3 turnover diff = strong signal

export const S2_TURNOVER_DIFF: FactorDefinition<SpreadFactorResult> = {
  key: 'turnoverDiff',
  factorNumber: 2,
  name: 'Turnover Differential',
  shortName: 'TD',
  
  sport: 'NBA',
  betType: 'SPREAD',
  category: 'efficiency',
  
  icon: '🏀',
  description: 'Ball security and defensive pressure (turnovers forced vs committed)',
  logic: `Compares each team's turnover tendencies.
    - Lower TOV% = better ball security
    - Higher steals = more transition opportunities
    - Net turnover advantage = extra possessions = ATS value`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayTOVLast10', 'homeTOVLast10', 'awaySteals', 'homeSteals'],
  
  defaultWeight: 25,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data
    const awayTOV = bundle.awayTOVLast10 || 14.0
    const homeTOV = bundle.homeTOVLast10 || 14.0
    
    // Lower turnovers = better
    // awayAdvantage = how much fewer turnovers away commits vs home
    const tovDiff = homeTOV - awayTOV  // Positive = away protects ball better
    
    const cappedDiff = clamp(tovDiff, -8, 8)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)
    
    const rawValues = {
      awayTOV,
      homeTOV,
      tovDiff
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayBallSecurity: -awayTOV,
      homeBallSecurity: -homeTOV
    }
    
    return createSpreadResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

