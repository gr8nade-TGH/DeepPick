/**
 * S4: Home/Away Performance Splits (NBA SPREAD)
 * 
 * Analyzes team performance in their current venue context.
 * Some teams perform vastly different home vs away.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.15  // 15% win rate difference = strong signal

export const S4_HOME_AWAY_SPLITS: FactorDefinition<SpreadFactorResult> = {
  key: 'homeAwaySplits',
  factorNumber: 4,
  name: 'Home/Away Performance Splits',
  shortName: 'H/A',
  
  sport: 'NBA',
  betType: 'SPREAD',
  category: 'situational',
  
  icon: '🏠',
  description: 'Team performance in their current game context - away teams road record vs home teams home record',
  logic: `Compares venue-specific performance.
    - Away team's road record
    - Home team's home record
    - Some teams are road warriors
    - Others are home court dependent
    - Creates ATS opportunities when splits diverge`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayRoadWinPct', 'homeHomeWinPct'],
  
  defaultWeight: 15,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data (win percentages as decimals)
    const awayRoadWinPct = bundle.awayRoadWinPct ?? 0.5
    const homeHomeWinPct = bundle.homeHomeWinPct ?? 0.5
    
    // If we don't have split data, use overall records
    const awayWinPct = bundle.awayWinPct ?? awayRoadWinPct
    const homeWinPct = bundle.homeWinPct ?? homeHomeWinPct
    
    // Calculate venue-adjusted differential
    // Away team's road performance vs Home team's home performance
    const venueDiff = awayRoadWinPct - homeHomeWinPct
    
    // Also consider overall record difference
    const overallDiff = awayWinPct - homeWinPct
    
    // Combined signal (weight venue splits more)
    const combinedDiff = (venueDiff * 0.7) + (overallDiff * 0.3)
    
    const cappedDiff = clamp(combinedDiff, -0.5, 0.5)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)
    
    const rawValues = {
      awayRoadWinPct,
      homeHomeWinPct,
      awayWinPct,
      homeWinPct,
      venueDiff,
      overallDiff,
      combinedDiff
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      venueComponent: venueDiff * 0.7,
      overallComponent: overallDiff * 0.3
    }
    
    return createSpreadResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

