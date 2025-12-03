/**
 * F3: Defensive Erosion (NBA TOTALS)
 * 
 * Measures defensive vulnerability based on recent DRtg trends.
 * Eroding defenses = higher totals.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 5.0  // 5 DRtg erosion = strong signal

export const F3_DEFENSIVE_EROSION: FactorDefinition<TotalsFactorResult> = {
  key: 'defErosion',
  factorNumber: 3,
  name: 'Defensive Erosion',
  shortName: 'DRtg/Avail',
  
  sport: 'NBA',
  betType: 'TOTAL',
  category: 'defense',
  
  icon: '🛡️',
  description: 'Defensive rating decline + injury impact',
  logic: `Analyzes each team's defensive vulnerability.
    - Higher DRtg (worse defense) = more points allowed
    - Recent defensive struggles = scoring boost
    - Combines both teams' defensive weaknesses`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayDRtgSeason', 'homeDRtgSeason', 'leagueDRtg'],
  
  defaultWeight: 20,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data
    const awayDRtg = bundle.awayDRtgSeason || 110.0
    const homeDRtg = bundle.homeDRtgSeason || 110.0
    const leagueDRtg = bundle.leagueDRtg || 110.0
    
    // Calculate defensive erosion (higher DRtg = worse defense = over signal)
    const awayErosion = awayDRtg - leagueDRtg
    const homeErosion = homeDRtg - leagueDRtg
    const combinedErosion = (awayErosion + homeErosion) / 2
    
    const cappedErosion = clamp(combinedErosion, -15, 15)
    
    // Positive erosion (bad defense) = over signal
    const signal = clamp(tanh(cappedErosion / SCALE), -1, 1)
    
    const rawValues = {
      awayDRtg,
      homeDRtg,
      leagueDRtg,
      awayErosion,
      homeErosion,
      combinedErosion
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayDefenseImpact: awayErosion,
      homeDefenseImpact: homeErosion
    }
    
    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

