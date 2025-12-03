/**
 * F7: Rest Advantage (NBA TOTALS)
 * 
 * Analyzes rest differential between teams.
 * Back-to-backs cause fatigue = lower scoring.
 */

import { FactorDefinition, TotalsFactorResult, clamp, tanh, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 3.0  // 3 rest day difference = strong signal

export const F7_REST_ADVANTAGE: FactorDefinition<TotalsFactorResult> = {
  key: 'restAdvantage',
  factorNumber: 7,
  name: 'Rest Advantage',
  shortName: 'Rest',
  
  sport: 'NBA',
  betType: 'TOTAL',
  category: 'situational',
  
  icon: '😴',
  description: 'Rest differential between teams. Back-to-backs cause fatigue and lower scoring.',
  logic: `Calculates rest advantage based on days since last game.
    - Back-to-back (0 days) = significant fatigue penalty
    - 1 day rest = slight fatigue
    - 2+ days = well rested
    - Both teams tired = lower total expected`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayRestDays', 'homeRestDays', 'awayIsBackToBack', 'homeIsBackToBack'],
  
  defaultWeight: 15,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): TotalsFactorResult => {
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract rest data
    const awayRestDays = bundle.awayRestDays ?? 2
    const homeRestDays = bundle.homeRestDays ?? 2
    const awayB2B = bundle.awayIsBackToBack ?? false
    const homeB2B = bundle.homeIsBackToBack ?? false
    
    // Calculate fatigue score
    // Back-to-back is a -2 penalty per team
    let fatigueScore = 0
    if (awayB2B) fatigueScore -= 2
    if (homeB2B) fatigueScore -= 2
    
    // Rest differential (positive = more combined rest = potentially higher scoring)
    const totalRestDays = awayRestDays + homeRestDays
    const avgRestDays = totalRestDays / 2
    const restDiff = avgRestDays - 1.5  // 1.5 is "normal" rest
    
    // Combined signal: fatigue + rest diff
    const combinedScore = restDiff + fatigueScore
    const cappedScore = clamp(combinedScore, -6, 6)
    
    // Positive = well rested = potentially higher scoring (over)
    // Negative = fatigued = lower scoring (under)
    const signal = clamp(tanh(cappedScore / SCALE), -1, 1)
    
    const rawValues = {
      awayRestDays,
      homeRestDays,
      awayIsBackToBack: awayB2B,
      homeIsBackToBack: homeB2B,
      totalRestDays,
      avgRestDays,
      restDiff,
      fatigueScore,
      combinedScore
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      fatigueImpact: fatigueScore,
      restImpact: restDiff
    }
    
    return createTotalsResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

