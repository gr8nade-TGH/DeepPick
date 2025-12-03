/**
 * PICKSMITH TIER GRADING (CONFLUENCE SYSTEM)
 *
 * Confluence-based tier system for PICKSMITH consensus picks.
 * Uses 4 signals similar to manual picks, but with consensus-specific inputs.
 *
 * SIGNALS (max 8 points):
 * 1. Consensus Strength (0-3): How many cappers agree
 * 2. Specialization Record (0-2): PICKSMITH's win rate for this bet type
 * 3. Win Streak (0-1): PICKSMITH's current win streak for bet type
 * 4. Quality Signal (0-2): Average net units of contributing cappers
 *
 * TIERS (same as SHIVA/Manual):
 * - Legendary: ≥7.0 (exceptional)
 * - Elite: 6.0-6.9 (strong)
 * - Rare: 5.0-5.9 (solid)
 * - Uncommon: 4.0-4.9 (promise)
 * - Common: <4.0 (40-60% of picks)
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'

export type PicksmithConfluenceTier = 'Legendary' | 'Elite' | 'Rare' | 'Uncommon' | 'Common'

export interface PicksmithTierInput {
  contributingCappers: {
    name: string
    units: number
    netUnits: number  // Career net units
  }[]
  consensusUnits: number  // Picksmith's calculated units for the pick
  teamAbbrev?: string
  betType?: 'total' | 'spread'
}

export interface PicksmithConfluenceBreakdown {
  consensusPoints: number    // 0-3 based on capper count
  specPoints: number         // 0-2 based on win rate
  streakPoints: number       // 0-1 based on win streak
  qualityPoints: number      // 0-2 based on avg net units
  capperCount?: number       // For display
  specWinRate?: number       // For display
  specSampleSize?: number    // For display
  currentStreak?: number     // For display
  avgNetUnits?: number       // For display
}

export interface PicksmithConfluenceResult {
  confluenceScore: number
  tier: PicksmithConfluenceTier
  breakdown: PicksmithConfluenceBreakdown
}

/**
 * SIGNAL 1: Consensus Strength (max +3 points)
 * More cappers agreeing = stronger consensus
 */
function getConsensusStrengthPoints(capperCount: number): number {
  if (capperCount >= 4) return 3.0
  if (capperCount === 3) return 2.0
  if (capperCount === 2) return 1.0
  return 0.5  // Should never happen (need 2+ for consensus)
}

/**
 * SIGNAL 2: Specialization Record (max +2 points)
 * PICKSMITH's historical win rate for this bet type
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
 * PICKSMITH's current win streak for bet type
 */
function getStreakPoints(winStreak: number): number {
  if (winStreak >= 4) return 1.0
  if (winStreak >= 2) return 0.5
  return 0
}

/**
 * SIGNAL 4: Quality Signal (max +2 points)
 * Average net units of contributing cappers
 */
function getQualityPoints(avgNetUnits: number): number {
  if (avgNetUnits >= 15) return 2.0
  if (avgNetUnits >= 8) return 1.0
  if (avgNetUnits >= 3) return 0.5
  return 0
}

/**
 * Get tier from confluence score (same thresholds as SHIVA)
 */
function getTierFromScore(score: number): PicksmithConfluenceTier {
  if (score >= 7.0) return 'Legendary'
  if (score >= 6.0) return 'Elite'
  if (score >= 5.0) return 'Rare'
  if (score >= 4.0) return 'Uncommon'
  return 'Common'
}

/**
 * Fetch PICKSMITH stats for confluence calculation
 */
async function getPicksmithStats(betType: 'total' | 'spread'): Promise<{
  specWinRate?: number
  specSampleSize: number
  currentStreak: number
}> {
  const admin = getSupabaseAdmin()

  // Query graded picks for PICKSMITH
  const { data: picks, error } = await admin
    .from('picks')
    .select('status, pick_type, created_at')
    .ilike('capper', 'picksmith')
    .in('status', ['won', 'lost', 'push'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !picks || picks.length === 0) {
    return { specSampleSize: 0, currentStreak: 0 }
  }

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
    currentStreak
  }
}

/**
 * Calculate confluence score for a PICKSMITH pick
 */
export async function calculatePicksmithConfluence(
  input: PicksmithTierInput
): Promise<PicksmithConfluenceResult> {
  const betType = input.betType || 'total'
  const stats = await getPicksmithStats(betType)

  const capperCount = input.contributingCappers.length
  const avgNetUnits = capperCount > 0
    ? input.contributingCappers.reduce((sum, c) => sum + c.netUnits, 0) / capperCount
    : 0

  const consensusPoints = getConsensusStrengthPoints(capperCount)
  const specPoints = getSpecializationPoints(stats.specWinRate, stats.specSampleSize)
  const streakPoints = getStreakPoints(stats.currentStreak)
  const qualityPoints = getQualityPoints(avgNetUnits)

  const confluenceScore = consensusPoints + specPoints + streakPoints + qualityPoints
  const tier = getTierFromScore(confluenceScore)

  console.log(`[PicksmithTier] Confluence:`, {
    capperCount,
    consensusPoints,
    specPoints,
    streakPoints,
    qualityPoints,
    total: confluenceScore,
    tier
  })

  return {
    confluenceScore: Math.round(confluenceScore * 10) / 10,
    tier,
    breakdown: {
      consensusPoints,
      specPoints,
      streakPoints,
      qualityPoints,
      capperCount,
      specWinRate: stats.specWinRate,
      specSampleSize: stats.specSampleSize,
      currentStreak: stats.currentStreak,
      avgNetUnits: Math.round(avgNetUnits * 10) / 10
    }
  }
}

/**
 * Build tier_grade object for storage in game_snapshot
 * Format matches the confluence system used by SHIVA and Manual picks
 */
export async function buildPicksmithTierSnapshot(
  input: PicksmithTierInput
): Promise<{
  tier: string
  tierScore: number
  breakdown: any
  inputs: any
  format: 'confluence'
}> {
  const result = await calculatePicksmithConfluence(input)

  return {
    tier: result.tier,
    tierScore: result.confluenceScore,
    breakdown: result.breakdown,
    inputs: {
      contributingCappers: input.contributingCappers.length,
      avgCapperNetUnits: result.breakdown.avgNetUnits,
      consensusUnits: input.consensusUnits,
      betType: input.betType
    },
    format: 'confluence'
  }
}

