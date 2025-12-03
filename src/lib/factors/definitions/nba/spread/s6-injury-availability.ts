/**
 * S6: Key Injuries & Availability (NBA SPREAD)
 * 
 * Analyzes impact of injured/out players on spread coverage.
 * Missing key players = ATS disadvantage.
 * 
 * NOTE: This factor wraps the existing async injury computation.
 */

import { FactorDefinition, SpreadFactorResult, clamp, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0

export const S6_INJURY_AVAILABILITY_SPREAD: FactorDefinition<SpreadFactorResult> = {
  key: 'injuryAvailabilitySpread',
  factorNumber: 6,
  name: 'Key Injuries & Availability - Spread',
  shortName: 'Injuries',
  
  sport: 'NBA',
  betType: 'SPREAD',
  category: 'injury',
  
  icon: '🏥',
  description: 'AI analysis of key player injuries and their impact on spread coverage',
  logic: `Analyzes injury reports to estimate ATS impact.
    - Missing stars = significant ATS disadvantage
    - Role player injuries = minor impact
    - Uses PPG, minutes, and plus/minus data
    - Compares injury situations between teams`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayInjuries', 'homeInjuries'],
  
  defaultWeight: 15,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): SpreadFactorResult => {
    // NOTE: Injury factor is computed async in orchestrator
    // This definition is for registry/UI purposes
    
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // If injury data was pre-computed and attached to bundle
    if (bundle.injuryImpact) {
      const impact = bundle.injuryImpact
      
      // Calculate net injury advantage (positive = away has healthier roster)
      const awayImpact = impact.awayImpact || 0
      const homeImpact = impact.homeImpact || 0
      const netImpact = homeImpact - awayImpact  // Positive = away advantage
      
      const signal = clamp(netImpact / 10, -1, 1)
      
      return createSpreadResult(signal, MAX_POINTS, {
        awayImpact,
        homeImpact,
        netImpact,
        awayInjuries: impact.awayInjuries || [],
        homeInjuries: impact.homeInjuries || []
      }, {
        points: Math.abs(signal) * MAX_POINTS
      })
    }
    
    // No injury data available
    return createSpreadResult(0, MAX_POINTS, {
      note: 'Injury data computed async in orchestrator'
    }, {
      points: 0
    })
  }
}

