/**
 * MANUAL PICK CONFLUENCE SCORING (Pick Power)
 *
 * Pick Power tier system for manual (user-created) picks.
 * Since manual picks don't have AI-generated edge scores or factors,
 * we use alternative quality signals.
 *
 * SIGNALS (max 100 points) - Same weights as SHIVA:
 * 1. Bet Conviction (0-35): Units risked = conviction level (replaces Edge Strength)
 * 2. Specialization Record (0-20): Win rate for this bet type
 * 3. Win Streak (0-10): Current consecutive wins for bet type
 * 4. Quality Signal (0-35): Capper's overall profitability (replaces Factor Alignment)
 *
 * TIERS:
 * - Legendary: ≥90 (exceptional)
 * - Elite: 75-89 (strong)
 * - Rare: 60-74 (solid)
 * - Uncommon: 45-59 (promise)
 * - Common: <45 (majority of picks)
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'

export type ManualConfluenceTier = 'Legendary' | 'Elite' | 'Rare' | 'Uncommon' | 'Common'

export interface ManualConfluenceInput {
  capperId: string
  units: number  // 1-5 units risked
  betType: 'total' | 'spread'
}

export interface ManualConfluenceBreakdown {
  convictionPoints: number   // 0-3 based on units
  specPoints: number         // 0-2 based on win rate
  streakPoints: number       // 0-1 based on win streak
  qualityPoints: number      // 0-2 based on net units
  specWinRate?: number       // For display
  specSampleSize?: number    // For display
  currentStreak?: number     // For display
  netUnits?: number          // For display
}

export interface ManualConfluenceResult {
  confluenceScore: number
  tier: ManualConfluenceTier
  breakdown: ManualConfluenceBreakdown
}

/**
 * SIGNAL 1: Bet Conviction (max 35 points)
 * Higher units = more conviction in the pick
 * Uses continuous scale like SHIVA's Edge Strength
 */
function getConvictionPoints(units: number): number {
  // Map 1-5 units to 0-35 points (linear scale)
  // 1 unit = 7 pts, 2 = 14 pts, 3 = 21 pts, 4 = 28 pts, 5 = 35 pts
  const pts = Math.min(units, 5) * 7
  return Math.round(pts * 10) / 10
}

/**
 * SIGNAL 2: Specialization Record (max 20 points)
 * Same as SHIVA - win rate for this bet type
 * Uses continuous scale for more granularity
 */
function getSpecializationPoints(winRate?: number, sampleSize?: number): number {
  if (winRate === undefined || sampleSize === undefined || sampleSize < 10) {
    return 0
  }
  // Map 45-60% win rate to 0-20 points (continuous)
  const normalizedWR = Math.max(0, Math.min(1, (winRate - 45) / 15))
  return Math.round(normalizedWR * 20 * 10) / 10
}

/**
 * SIGNAL 3: Win Streak (max 10 points)
 * Same as SHIVA - current win streak for bet type
 * Uses continuous scale, caps at 5-game streak
 */
function getStreakPoints(winStreak: number): number {
  // Map 0-5 win streak to 0-10 points (continuous)
  const normalizedStreak = Math.min(winStreak, 5) / 5
  return Math.round(normalizedStreak * 10 * 10) / 10
}

/**
 * SIGNAL 4: Quality Signal (max 35 points)
 * Capper's overall profitability (net units career)
 * Uses continuous scale for more granularity
 */
function getQualityPoints(netUnits: number): number {
  if (netUnits <= 0) return 0  // Negative = no bonus
  // Map 0-50 net units to 0-35 points (continuous, capped)
  const normalizedUnits = Math.min(netUnits, 50) / 50
  return Math.round(normalizedUnits * 35 * 10) / 10
}

/**
 * Get tier from Pick Power score (same thresholds as SHIVA)
 */
function getTierFromScore(score: number): ManualConfluenceTier {
  if (score >= 90) return 'Legendary'
  if (score >= 75) return 'Elite'
  if (score >= 60) return 'Rare'
  if (score >= 45) return 'Uncommon'
  return 'Common'
}

/**
 * Fetch capper stats for confluence calculation
 */
async function getCapperStats(capperId: string, betType: 'total' | 'spread'): Promise<{
  specWinRate?: number
  specSampleSize: number
  currentStreak: number
  netUnits: number
}> {
  const admin = getSupabaseAdmin()

  // Query graded picks for this capper
  const { data: picks, error } = await admin
    .from('picks')
    .select('status, net_units, pick_type, created_at')
    .ilike('capper', capperId)
    .in('status', ['won', 'lost', 'push'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !picks || picks.length === 0) {
    return { specSampleSize: 0, currentStreak: 0, netUnits: 0 }
  }

  // Overall net units
  const netUnits = picks.reduce((sum, p) => sum + (p.net_units || 0), 0)

  // Filter for bet type
  const betTypePicks = picks.filter(p => p.pick_type?.toLowerCase() === betType)

  // Specialization win rate
  const specWins = betTypePicks.filter(p => p.status === 'won').length
  const specLosses = betTypePicks.filter(p => p.status === 'lost').length
  const specTotal = specWins + specLosses
  const specWinRate = specTotal >= 10 ? (specWins / specTotal) * 100 : undefined

  // Current win streak for bet type
  let currentStreak = 0
  for (const p of betTypePicks) {
    if (p.status === 'won') currentStreak++
    else break
  }

  return {
    specWinRate,
    specSampleSize: specTotal,
    currentStreak,
    netUnits
  }
}

/**
 * Calculate confluence score for a manual pick
 */
export async function calculateManualConfluence(
  input: ManualConfluenceInput
): Promise<ManualConfluenceResult> {
  const stats = await getCapperStats(input.capperId, input.betType)

  const convictionPoints = getConvictionPoints(input.units)
  const specPoints = getSpecializationPoints(stats.specWinRate, stats.specSampleSize)
  const streakPoints = getStreakPoints(stats.currentStreak)
  const qualityPoints = getQualityPoints(stats.netUnits)

  const confluenceScore = convictionPoints + specPoints + streakPoints + qualityPoints
  const tier = getTierFromScore(confluenceScore)

  return {
    confluenceScore: Math.round(confluenceScore),  // Whole number for cleaner display
    tier,
    breakdown: {
      convictionPoints: Math.round(convictionPoints * 10) / 10,
      specPoints: Math.round(specPoints * 10) / 10,
      streakPoints: Math.round(streakPoints * 10) / 10,
      qualityPoints: Math.round(qualityPoints * 10) / 10,
      specWinRate: stats.specWinRate,
      specSampleSize: stats.specSampleSize,
      currentStreak: stats.currentStreak,
      netUnits: stats.netUnits
    }
  }
}

