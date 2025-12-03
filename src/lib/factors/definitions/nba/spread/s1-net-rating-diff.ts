/**
 * S1: Net Rating Differential (NBA SPREAD)
 * 
 * Calculates expected point margin based on net rating differential.
 * Compares to spread line to determine edge.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 8.0  // 8 point edge = strong signal

export const S1_NET_RATING_DIFF: FactorDefinition<SpreadFactorResult> = {
  key: 'netRatingDiff',
  factorNumber: 1,
  name: 'Net Rating Differential',
  shortName: 'NetRtg',
  
  sport: 'NBA',
  betType: 'SPREAD',
  category: 'efficiency',
  
  icon: '📈',
  description: 'Expected point margin based on offensive/defensive ratings vs spread',
  logic: `Compares each team's net rating (ORtg - DRtg) to expected margin.
    - Net Rating = Offensive Rating - Defensive Rating
    - Expected Margin adjusted for pace
    - Compares to spread line for edge calculation
    - Positive signal = Away team value, Negative = Home team value`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayORtgLast10', 'awayDRtgSeason', 'homeORtgLast10', 'homeDRtgSeason', 'leaguePace'],
  
  defaultWeight: 30,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data
    const awayORtg = bundle.awayORtgLast10 || 110.0
    const awayDRtg = bundle.awayDRtgSeason || 110.0
    const homeORtg = bundle.homeORtgLast10 || 110.0
    const homeDRtg = bundle.homeDRtgSeason || 110.0
    const pace = bundle.leaguePace || 100.1
    
    // Calculate net ratings
    const awayNetRtg = awayORtg - awayDRtg
    const homeNetRtg = homeORtg - homeDRtg
    
    // Net rating differential (positive = away advantage)
    const netRatingDiff = awayNetRtg - homeNetRtg
    
    // Calculate expected margin (adjusted for pace)
    const expectedMargin = netRatingDiff * (pace / 100)
    
    // Calculate spread edge if available
    const spreadLine = ctx?.spreadLine
    let spreadEdge = expectedMargin
    if (spreadLine !== undefined) {
      spreadEdge = expectedMargin - spreadLine
    }
    
    const cappedEdge = clamp(spreadEdge, -20, 20)
    const signal = clamp(tanh(cappedEdge / SCALE), -1, 1)
    
    const rawValues = {
      awayORtg,
      awayDRtg,
      homeORtg,
      homeDRtg,
      awayNetRtg,
      homeNetRtg,
      netRatingDiff,
      expectedMargin,
      spreadLine,
      spreadEdge,
      pace
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS
    }
    
    return createSpreadResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

