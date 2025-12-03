/**
 * MANUAL PICK CONFLUENCE SCORING
 *
 * Confluence-based tier system for manual (user-created) picks.
 * Since manual picks don't have AI-generated edge scores or factors,
 * we use alternative quality signals.
 *
 * SIGNALS (max 8 points):
 * 1. Bet Conviction (0-3): Units risked = conviction level
 * 2. Specialization Record (0-2): Win rate for this bet type
 * 3. Win Streak (0-1): Current consecutive wins for bet type
 * 4. Quality Signal (0-2): Capper's overall profitability (net units)
 *
 * TIERS (same as SHIVA confluence):
 * - Legendary: ≥7.0 (exceptional)
 * - Elite: 6.0-6.9 (strong)
 * - Rare: 5.0-5.9 (solid)
 * - Uncommon: 4.0-4.9 (promise)
 * - Common: <4.0 (40-60% of picks)
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
 * SIGNAL 1: Bet Conviction (max +3 points)
 * Higher units = more conviction in the pick
 */
function getConvictionPoints(units: number): number {
  if (units >= 5) return 3.0
  if (units >= 4) return 2.5
  if (units >= 3) return 2.0
  if (units >= 2) return 1.0
  return 0.5  // 1 unit = minimal conviction
}

/**
 * SIGNAL 2: Specialization Record (max +2 points)
 * Same as SHIVA - win rate for this bet type
 */
function getSpecializationPoints(winRate?: number, sampleSize?: number): number {
  if (winRate === undefined || sampleSize === undefined || sampleSize < 10) {
    return 0
  }
  if (winRate >= 58) return 2.0
  if (winRate >= 54) return 1.0
  return 0
}

/**
 * SIGNAL 3: Win Streak (max +1 point)
 * Same as SHIVA - current win streak for bet type
 */
function getStreakPoints(winStreak: number): number {
  if (winStreak >= 4) return 1.0
  if (winStreak >= 2) return 0.5
  return 0
}

/**
 * SIGNAL 4: Quality Signal (max +2 points)
 * Capper's overall profitability (net units career)
 */
function getQualityPoints(netUnits: number): number {
  if (netUnits >= 20) return 2.0
  if (netUnits >= 10) return 1.5
  if (netUnits >= 5) return 1.0
  if (netUnits >= 0) return 0.5
  return 0  // Negative = no bonus
}

/**
 * Get tier from confluence score (same thresholds as SHIVA)
 */
function getTierFromScore(score: number): ManualConfluenceTier {
  if (score >= 7.0) return 'Legendary'
  if (score >= 6.0) return 'Elite'
  if (score >= 5.0) return 'Rare'
  if (score >= 4.0) return 'Uncommon'
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
    confluenceScore: Math.round(confluenceScore * 10) / 10,
    tier,
    breakdown: {
      convictionPoints,
      specPoints,
      streakPoints,
      qualityPoints,
      specWinRate: stats.specWinRate,
      specSampleSize: stats.specSampleSize,
      currentStreak: stats.currentStreak,
      netUnits: stats.netUnits
    }
  }
}

