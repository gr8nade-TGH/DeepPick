/**
 * Momentum Index Factor (S7) - SPREAD
 * 
 * Analyzes team momentum based on win streak and recent record (last 10 games).
 * Hot teams tend to cover spreads, cold teams tend to fail.
 * 
 * Signal: Positive = Away team has momentum advantage
 *         Negative = Home team has momentum advantage
 */

import { NBAStatsBundle, RunCtx } from './types'

export interface MomentumInput {
  awayWinStreak: number  // Positive = wins, Negative = losses
  homeWinStreak: number
  awayLast10: { wins: number; losses: number }
  homeLast10: { wins: number; losses: number }
}

export interface MomentumOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayMomentum: number
    homeMomentum: number
    momentumDiff: number
    awayStreakType: 'WIN' | 'LOSS' | 'NEUTRAL'
    homeStreakType: 'WIN' | 'LOSS' | 'NEUTRAL'
    reason: string
  }
}

/**
 * Helper function to clamp a value between min and max
 */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * Helper function to calculate hyperbolic tangent
 */
function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

/**
 * Calculate momentum score for a team
 * Combines streak impact with recent record
 * 
 * Streak: +3 win streak = strong momentum, -3 loss streak = negative momentum
 * Last10: 7-3 record = positive, 3-7 = negative
 */
function calculateTeamMomentum(streak: number, last10: { wins: number; losses: number }): number {
  // Streak component (capped at ±5)
  const streakScore = clamp(streak, -5, 5) * 0.5  // Max ±2.5 from streak

  // Last 10 component: (wins - losses) / 10 gives -1 to +1
  const last10Diff = last10.wins - last10.losses
  const last10Score = (last10Diff / 10) * 2.5  // Max ±2.5 from L10

  // Combined momentum (max ±5)
  return streakScore + last10Score
}

/**
 * Calculate momentum differential between teams
 */
export function calculateMomentumIndex(input: MomentumInput): MomentumOutput {
  const { awayWinStreak, homeWinStreak, awayLast10, homeLast10 } = input
  const MAX_POINTS = 5.0

  // Input validation
  if (!awayLast10 || !homeLast10) {
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayMomentum: 0,
        homeMomentum: 0,
        momentumDiff: 0,
        awayStreakType: 'NEUTRAL',
        homeStreakType: 'NEUTRAL',
        reason: 'invalid_input'
      }
    }
  }

  // Calculate momentum for each team
  const awayMomentum = calculateTeamMomentum(awayWinStreak, awayLast10)
  const homeMomentum = calculateTeamMomentum(homeWinStreak, homeLast10)

  // Momentum differential (positive = away advantage)
  const momentumDiff = awayMomentum - homeMomentum

  // Scale and convert to signal
  const SCALE = 4.0
  const signal = clamp(tanh(momentumDiff / SCALE), -1, 1)

  // Determine streak types
  const getStreakType = (streak: number): 'WIN' | 'LOSS' | 'NEUTRAL' => {
    if (streak >= 2) return 'WIN'
    if (streak <= -2) return 'LOSS'
    return 'NEUTRAL'
  }

  const awayStreakType = getStreakType(awayWinStreak)
  const homeStreakType = getStreakType(homeWinStreak)

  // Convert to scores
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  // Build reason string
  const awayL10Str = `${awayLast10.wins}-${awayLast10.losses}`
  const homeL10Str = `${homeLast10.wins}-${homeLast10.losses}`
  const awayStreakStr = awayWinStreak > 0 ? `W${awayWinStreak}` : awayWinStreak < 0 ? `L${Math.abs(awayWinStreak)}` : 'Even'
  const homeStreakStr = homeWinStreak > 0 ? `W${homeWinStreak}` : homeWinStreak < 0 ? `L${Math.abs(homeWinStreak)}` : 'Even'

  let reason = `Away: ${awayStreakStr} (${awayL10Str}) vs Home: ${homeStreakStr} (${homeL10Str})`

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayMomentum,
      homeMomentum,
      momentumDiff,
      awayStreakType,
      homeStreakType,
      reason
    }
  }
}

/**
 * Orchestrator-compatible wrapper function
 */
export function computeMomentumIndex(bundle: NBAStatsBundle | null, ctx: RunCtx): any {
  // Handle case where bundle is null (factor disabled or no data)
  if (!bundle) {
    return {
      factor_no: 7,
      key: 'momentumIndex',
      name: 'Momentum Index',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        points: 0,
        awayScore: 0,
        homeScore: 0,
        signal: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Get momentum data from bundle (with defaults for missing data)
  const awayWinStreak = bundle.awayWinStreak ?? 0
  const homeWinStreak = bundle.homeWinStreak ?? 0
  const awayLast10 = bundle.awayLast10Record ?? { wins: 5, losses: 5 }
  const homeLast10 = bundle.homeLast10Record ?? { wins: 5, losses: 5 }

  const result = calculateMomentumIndex({
    awayWinStreak,
    homeWinStreak,
    awayLast10,
    homeLast10
  })

  return {
    factor_no: 7,
    key: 'momentumIndex',
    name: 'Momentum Index',
    normalized_value: result.signal,
    raw_values_json: {
      awayWinStreak,
      homeWinStreak,
      awayLast10,
      homeLast10,
      awayMomentum: result.meta.awayMomentum,
      homeMomentum: result.meta.homeMomentum,
      momentumDiff: result.meta.momentumDiff
    },
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal,
      awayStreakType: result.meta.awayStreakType,
      homeStreakType: result.meta.homeStreakType
    },
    caps_applied: false,
    cap_reason: null,
    notes: result.meta.reason
  }
}

