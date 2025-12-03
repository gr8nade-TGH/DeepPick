/**
 * S5: Four Factors Differential (NBA SPREAD)
 * 
 * Dean Oliver's Four Factors of basketball success:
 * 1. eFG% - Shooting efficiency
 * 2. TOV% - Turnover rate
 * 3. ORB% - Offensive rebounding
 * 4. FTr - Free throw rate
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 0.08  // 8% composite difference = strong signal

export const S5_FOUR_FACTORS_DIFF: FactorDefinition<SpreadFactorResult> = {
  key: 'fourFactorsDiff',
  factorNumber: 5,
  name: 'Four Factors Differential',
  shortName: '4F',
  
  sport: 'NBA',
  betType: 'SPREAD',
  category: 'efficiency',
  
  icon: '📊',
  description: 'Dean Oliver\'s Four Factors: eFG%, TOV%, ORB%, FTr',
  logic: `Combines the four key factors of basketball success.
    - eFG% (40% weight) - Shooting efficiency
    - TOV% (25% weight) - Ball security
    - ORB% (20% weight) - Second chance points
    - FTr (15% weight) - Free throw generation
    - Composite score predicts ATS performance`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayEfg', 'homeEfg', 'awayTOVPct', 'homeTOVPct', 'awayORBPct', 'homeORBPct', 'awayFtr', 'homeFtr'],
  
  defaultWeight: 25,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data with defaults
    const awayEfg = bundle.awayEfg || 0.53
    const homeEfg = bundle.homeEfg || 0.53
    const awayTOVPct = bundle.awayTOVPct || 0.13
    const homeTOVPct = bundle.homeTOVPct || 0.13
    const awayORBPct = bundle.awayORBPct || 0.25
    const homeORBPct = bundle.homeORBPct || 0.25
    const awayFtr = bundle.awayFtr || bundle.awayFTr || 0.22
    const homeFtr = bundle.homeFtr || bundle.homeFTr || 0.22
    
    // Calculate each factor differential (positive = away advantage)
    const efgDiff = awayEfg - homeEfg
    const tovDiff = homeTOVPct - awayTOVPct  // Inverted: lower is better
    const orbDiff = awayORBPct - homeORBPct
    const ftrDiff = awayFtr - homeFtr
    
    // Weighted composite (Dean Oliver weights)
    const composite = (efgDiff * 0.40) + (tovDiff * 0.25) + (orbDiff * 0.20) + (ftrDiff * 0.15)
    
    const cappedComposite = clamp(composite, -0.25, 0.25)
    const signal = clamp(tanh(cappedComposite / SCALE), -1, 1)
    
    const rawValues = {
      awayEfg, homeEfg, efgDiff,
      awayTOVPct, homeTOVPct, tovDiff,
      awayORBPct, homeORBPct, orbDiff,
      awayFtr, homeFtr, ftrDiff,
      composite
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      efgComponent: efgDiff * 0.40,
      tovComponent: tovDiff * 0.25,
      orbComponent: orbDiff * 0.20,
      ftrComponent: ftrDiff * 0.15
    }
    
    return createSpreadResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

