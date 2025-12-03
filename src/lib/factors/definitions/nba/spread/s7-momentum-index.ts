/**
 * S7: Momentum Index (NBA SPREAD)
 * 
 * Measures team momentum based on win streak and recent record.
 * Hot teams tend to cover spreads.
 */

import { FactorDefinition, SpreadFactorResult, clamp, tanh, createSpreadResult } from '../../../types'

const MAX_POINTS = 5.0
const SCALE = 4.0  // 4 game momentum difference = strong signal

export const S7_MOMENTUM_INDEX: FactorDefinition<SpreadFactorResult> = {
  key: 'momentumIndex',
  factorNumber: 7,
  name: 'Momentum Index',
  shortName: 'Momentum',
  
  sport: 'NBA',
  betType: 'SPREAD',
  category: 'momentum',
  
  icon: '🔥',
  description: 'Team momentum based on win streak and last 10 record. Hot teams cover spreads.',
  logic: `Calculates momentum score from recent performance.
    - Win streak bonus (capped at 5)
    - Last 10 record (weighted)
    - Losing streaks = negative momentum
    - Hot teams cover, cold teams fade`,
  
  dataSource: 'mysportsfeeds',
  dataRequirements: ['awayWinStreak', 'homeWinStreak', 'awayLast10Wins', 'homeLast10Wins'],
  
  defaultWeight: 15,
  maxPoints: MAX_POINTS,
  
  compute: (bundle, ctx): SpreadFactorResult => {
    if (!bundle) {
      return createSpreadResult(0, MAX_POINTS, {}, { reason: 'no_bundle' })
    }
    
    // Extract data
    const awayStreak = bundle.awayWinStreak ?? 0  // Positive = win streak, negative = losing streak
    const homeStreak = bundle.homeWinStreak ?? 0
    const awayLast10 = bundle.awayLast10Wins ?? 5
    const homeLast10 = bundle.homeLast10Wins ?? 5
    
    // Calculate momentum score for each team
    // Streak component (capped at ±5)
    const awayStreakScore = clamp(awayStreak, -5, 5)
    const homeStreakScore = clamp(homeStreak, -5, 5)
    
    // Last 10 component (0-10 wins, normalized to -5 to +5)
    const awayLast10Score = awayLast10 - 5
    const homeLast10Score = homeLast10 - 5
    
    // Combined momentum (weight streak more)
    const awayMomentum = (awayStreakScore * 0.6) + (awayLast10Score * 0.4)
    const homeMomentum = (homeStreakScore * 0.6) + (homeLast10Score * 0.4)
    
    // Momentum differential (positive = away has more momentum)
    const momentumDiff = awayMomentum - homeMomentum
    
    const cappedDiff = clamp(momentumDiff, -10, 10)
    const signal = clamp(tanh(cappedDiff / SCALE), -1, 1)
    
    const rawValues = {
      awayWinStreak: awayStreak,
      homeWinStreak: homeStreak,
      awayLast10Wins: awayLast10,
      homeLast10Wins: homeLast10,
      awayStreakScore,
      homeStreakScore,
      awayLast10Score,
      homeLast10Score,
      awayMomentum,
      homeMomentum,
      momentumDiff
    }
    
    const parsedValues = {
      points: Math.abs(signal) * MAX_POINTS,
      awayMomentumScore: awayMomentum,
      homeMomentumScore: homeMomentum
    }
    
    return createSpreadResult(signal, MAX_POINTS, rawValues, parsedValues)
  }
}

