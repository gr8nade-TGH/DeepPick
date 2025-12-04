/**
 * DEEP TIER GRADING (Enhanced Confluence System)
 *
 * DEEP uses an enhanced 5-signal system (max 12 points):
 * 
 * 1. Consensus Strength (0-3): How many cappers agree
 * 2. Tier Quality (0-3): Average tier of contributing picks
 * 3. Factor Alignment (0-3): Do cappers share the same TOP factors?
 * 4. Counter-Thesis Weakness (0-2): How weak is the disagreeing case?
 * 5. DEEP's Record (0-1): Historical performance on this bet type
 *
 * TIERS (Enhanced for 12-point scale):
 * - Legendary: ≥10.0 (exceptional - unanimous, high-tier, aligned factors)
 * - Elite: 8.0-9.9 (strong)
 * - Rare: 6.0-7.9 (solid)
 * - Uncommon: 4.0-5.9 (promise)
 * - Common: <4.0 (basic consensus)
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { FactorConfluence, CounterThesisAnalysis } from './types'
import { calculateFactorAlignmentPoints } from './factor-confluence'

export type DeepConfluenceTier = 'Legendary' | 'Elite' | 'Rare' | 'Uncommon' | 'Common'

export interface DeepTierInput {
  contributingCappers: {
    name: string
    units: number
    netUnits: number
    tierScore?: number
    tier?: string
    topFactor?: string
  }[]
  consensusUnits: number
  betType?: 'total' | 'spread'
  factorConfluence: FactorConfluence[]
  counterThesis: CounterThesisAnalysis | null
}

export interface DeepConfluenceBreakdown {
  consensusPoints: number      // 0-3 based on capper count
  tierQualityPoints: number    // 0-3 based on avg tier of picks
  factorAlignmentPoints: number // 0-3 based on factor confluence
  counterThesisPoints: number  // 0-2 based on weakness of counter
  recordPoints: number         // 0-1 based on DEEP's record
  // For display
  capperCount?: number
  avgTierScore?: number
  topAlignedFactor?: string
  counterStrength?: string
  deepWinRate?: number
}

export interface DeepConfluenceResult {
  confluenceScore: number
  tier: DeepConfluenceTier
  breakdown: DeepConfluenceBreakdown
}

/**
 * SIGNAL 1: Consensus Strength (max +3 points)
 */
function getConsensusStrengthPoints(capperCount: number): number {
  if (capperCount >= 4) return 3.0
  if (capperCount === 3) return 2.0
  if (capperCount === 2) return 1.0
  return 0.5
}

/**
 * SIGNAL 2: Tier Quality (max +3 points)
 * Average tier score of contributing picks
 */
function getTierQualityPoints(cappers: { tierScore?: number }[]): number {
  if (cappers.length === 0) return 0

  const avgTierScore = cappers.reduce((sum, c) => sum + (c.tierScore || 0), 0) / cappers.length

  if (avgTierScore >= 7) return 3.0  // Avg is Legendary
  if (avgTierScore >= 6) return 2.5  // Avg is Elite
  if (avgTierScore >= 5) return 2.0  // Avg is Rare
  if (avgTierScore >= 4) return 1.0  // Avg is Uncommon
  return 0.5                          // Avg is Common
}

/**
 * SIGNAL 4: Counter-Thesis Weakness (max +2 points)
 * Weaker counter = more points (means less risk)
 */
function getCounterThesisPoints(counter: CounterThesisAnalysis | null): number {
  if (!counter) return 2.0  // No disagreement = full points

  switch (counter.counterStrength) {
    case 'WEAK': return 1.5     // Weak counter = low risk
    case 'MODERATE': return 1.0 // Moderate counter = some risk
    case 'STRONG': return 0     // Strong counter = high risk
    default: return 1.0
  }
}

/**
 * SIGNAL 5: DEEP's Historical Record (max +1 point)
 */
async function getDeepRecordPoints(betType: 'total' | 'spread'): Promise<{
  points: number
  winRate?: number
  sampleSize: number
}> {
  const admin = getSupabaseAdmin()

  const { data: picks, error } = await admin
    .from('picks')
    .select('status, pick_type')
    .or('capper.ilike.deep,capper.ilike.picksmith')  // Include legacy picksmith picks
    .in('status', ['won', 'lost'])
    .limit(100)

  if (error || !picks || picks.length === 0) {
    return { points: 0, sampleSize: 0 }
  }

  const betTypePicks = picks.filter(p => p.pick_type?.toLowerCase() === betType)
  const wins = betTypePicks.filter(p => p.status === 'won').length
  const total = betTypePicks.length

  if (total < 10) return { points: 0, sampleSize: total }

  const winRate = (wins / total) * 100

  if (winRate >= 55) return { points: 1.0, winRate, sampleSize: total }
  if (winRate >= 52) return { points: 0.5, winRate, sampleSize: total }
  return { points: 0, winRate, sampleSize: total }
}

/**
 * Get tier from confluence score (Enhanced 12-point scale)
 */
function getTierFromScore(score: number): DeepConfluenceTier {
  if (score >= 10.0) return 'Legendary'
  if (score >= 8.0) return 'Elite'
  if (score >= 6.0) return 'Rare'
  if (score >= 4.0) return 'Uncommon'
  return 'Common'
}

/**
 * Calculate confluence score for a DEEP pick
 */
export async function calculateDeepConfluence(
  input: DeepTierInput
): Promise<DeepConfluenceResult> {
  const betType = input.betType || 'total'
  const capperCount = input.contributingCappers.length

  // Calculate all 5 signals
  const consensusPoints = getConsensusStrengthPoints(capperCount)
  const tierQualityPoints = getTierQualityPoints(input.contributingCappers)
  const factorAlignmentPoints = calculateFactorAlignmentPoints(input.factorConfluence, capperCount)
  const counterThesisPoints = getCounterThesisPoints(input.counterThesis)
  const recordData = await getDeepRecordPoints(betType)

  const confluenceScore = consensusPoints + tierQualityPoints + factorAlignmentPoints +
    counterThesisPoints + recordData.points
  const tier = getTierFromScore(confluenceScore)

  const avgTierScore = capperCount > 0
    ? input.contributingCappers.reduce((sum, c) => sum + (c.tierScore || 0), 0) / capperCount
    : 0

  console.log(`[DEEP:Tier] Confluence:`, {
    capperCount, consensusPoints, tierQualityPoints, factorAlignmentPoints,
    counterThesisPoints, recordPoints: recordData.points, total: confluenceScore, tier
  })

  return {
    confluenceScore: Math.round(confluenceScore * 10) / 10,
    tier,
    breakdown: {
      consensusPoints, tierQualityPoints, factorAlignmentPoints,
      counterThesisPoints, recordPoints: recordData.points,
      capperCount, avgTierScore: Math.round(avgTierScore * 10) / 10,
      topAlignedFactor: input.factorConfluence[0]?.factorName,
      counterStrength: input.counterThesis?.counterStrength,
      deepWinRate: recordData.winRate
    }
  }
}

/**
 * Build tier_grade object for storage in game_snapshot
 * Format matches confluence system used by other cappers
 */
export async function buildDeepTierSnapshot(
  input: DeepTierInput
): Promise<{
  tier: string
  tierScore: number
  breakdown: any
  inputs: any
  format: 'confluence'
}> {
  const result = await calculateDeepConfluence(input)

  return {
    tier: result.tier,
    tierScore: result.confluenceScore,
    breakdown: result.breakdown,
    inputs: {
      contributingCappers: input.contributingCappers.length,
      avgCapperTierScore: result.breakdown.avgTierScore,
      consensusUnits: input.consensusUnits,
      betType: input.betType,
      topAlignedFactor: result.breakdown.topAlignedFactor,
      counterStrength: result.breakdown.counterStrength
    },
    format: 'confluence'
  }
}

