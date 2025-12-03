/**
 * F6: Key Injuries & Availability (NBA TOTALS)
 * 
 * Analyzes impact of injured/out players on game total.
 * This is an ASYNC factor that calls external injury analysis.
 * 
 * NOTE: This factor wraps the existing async injury computation.
 * The actual implementation is in the legacy file for now.
 */

import { FactorDefinition, TotalsFactorResult, clamp, createTotalsResult } from '../../../types'

const MAX_POINTS = 5.0

export const F6_INJURY_AVAILABILITY_TOTALS: FactorDefinition<TotalsFactorResult> = {
  key: 'injuryAvailability',
  factorNumber: 6,
  name: 'Key Injuries & Availability - Totals',
  shortName: 'Injuries',
  
  sport: 'NBA',
  betType: 'TOTAL',
  category: 'injury',
  
  icon: '🏥',
  description: 'AI analysis of key player injuries and availability',
  logic: `Analyzes injury reports to estimate scoring impact.
    - Missing scorers = lower totals
    - Missing defenders = higher totals
    - Uses PPG and minutes data to weight impact
    - Considers both teams' injury situations`,
  
  dataSource: 'mysportsfeeds',  // Uses MySportsFeeds injury data
  dataRequirements: ['awayInjuries', 'homeInjuries'],
  
  defaultWeight: 15,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): TotalsFactorResult => {
    // NOTE: Injury factor is computed async in orchestrator
    // This definition is for registry/UI purposes
    // The actual computation is handled separately
    
    if (!bundle) {
      return createTotalsResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // If injury data was pre-computed and attached to bundle
    if (bundle.injuryImpact) {
      const impact = bundle.injuryImpact
      const totalImpact = (impact.awayImpact || 0) + (impact.homeImpact || 0)
      
      // Negative impact = missing scorers = under
      // Positive impact = missing defenders = over (rare)
      const signal = clamp(totalImpact / 10, -1, 1)
      
      return createTotalsResult(signal, MAX_POINTS, {
        awayImpact: impact.awayImpact,
        homeImpact: impact.homeImpact,
        totalImpact,
        awayInjuries: impact.awayInjuries || [],
        homeInjuries: impact.homeInjuries || []
      }, {
        points: Math.abs(signal) * MAX_POINTS
      })
    }
    
    // No injury data available
    return createTotalsResult(0, MAX_POINTS, {
      note: 'Injury data computed async in orchestrator'
    }, {
      points: 0
    })
  }
}

