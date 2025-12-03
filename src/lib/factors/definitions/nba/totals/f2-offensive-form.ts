/**
 * F2: Offensive Form (NBA TOTALS)
 * 
 * Measures recent offensive efficiency vs opponent's defensive rating.
 * Hot offenses facing weak defenses = higher totals.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 6.0  // 6 ORtg difference = strong signal

export const F2_OFFENSIVE_FORM: FactorDefinition<TotalsFactorResult> = {
  key: 'offForm',
  factorNumber: 2,
  name: 'Offensive Form',
  shortName: 'ORtg Form',
  
  sport: 'NBA',
  betType: 'TOTAL',
  category: 'offense',
  
  icon: '🔥',
  description: 'Recent offensive efficiency vs opponent defense',
  logic: `Compares each team's recent offensive rating (last 10) to opponent's defensive rating.
    - High ORtg vs weak DRtg = scoring boost
    - Low ORtg vs strong DRtg = scoring drag
    - Combined impact from both matchups`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayORtgLast10', 'homeORtgLast10', 'awayDRtgSeason', 'homeDRtgSeason', 'leagueORtg'],
  
  defaultWeight: 20,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data with defaults
    const awayORtg = bundle.awayORtgLast10 || 110.0
    const homeORtg = bundle.homeORtgLast10 || 110.0
    const awayDRtg = bundle.awayDRtgSeason || 110.0
    const homeDRtg = bundle.homeDRtgSeason || 110.0
    const leagueAvg = bundle.leagueORtg || 110.0
    
    // Calculate offensive edge for each matchup
    // Away team's offense vs Home team's defense
    const awayOffEdge = awayORtg - homeDRtg
    // Home team's offense vs Away team's defense  
    const homeOffEdge = homeORtg - awayDRtg
    
    // Combined offensive environment
    const combinedEdge = (awayOffEdge + homeOffEdge) / 2
    const cappedEdge = clamp(combinedEdge, -20, 20)
    
    // Calculate signal
    const signal = clamp(tanh(cappedEdge / SCALE), -1, 1)
    
    const rawValues = {
      awayORtg,
      homeORtg,
      awayDRtg,
      homeDRtg,
      leagueAvg,
      awayOffEdge,
      homeOffEdge,
      combinedEdge
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayContribution: (awayOffEdge / 2) * (MAX_POINTS / 10),
      homeContribution: (homeOffEdge / 2) * (MAX_POINTS / 10)
    }
    
    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

