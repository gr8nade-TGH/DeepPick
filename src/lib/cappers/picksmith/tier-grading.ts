/**
 * PICKSMITH TIER GRADING
 * 
 * Custom tier grading logic for consensus picks.
 * Unlike AI cappers, Picksmith's tier is based on:
 * 1. Consensus strength (how many cappers agree)
 * 2. Capper quality (average net units of contributing cappers)
 * 3. Agreement weight (total units backing the consensus)
 * 4. Picksmith's own historical performance
 */

import { calculateTierGrade, type TierGradeInput, type TierGradeResult } from '@/lib/tier-grading'
import { getCapperTierInputs } from '@/lib/capper-tier-inputs'

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

/**
 * Calculate Picksmith base confidence from consensus factors
 *
 * RECALIBRATED to match AI pick distribution (avg ~65-75):
 * - Base: 45 (minimum for any consensus)
 * - +8 per additional capper beyond 2 (cap at +16 for 4+ cappers)
 * - +4 for every +10 net units average among cappers (cap at +12)
 * - +4 for every 2 units of consensus bet size (cap at +12)
 *
 * Max base: 45 + 16 + 12 + 12 = 85 (just barely Legendary with perfect consensus)
 *
 * Expected distributions:
 * - Weak consensus (2 cappers, 2U): 45 + 0 + 4 + 4 = 53 → Uncommon
 * - Medium consensus (3 cappers, 3U): 45 + 8 + 8 + 6 = 67 → Rare
 * - Strong consensus (4+ cappers, 4U): 45 + 16 + 12 + 8 = 81 → Epic
 */
export function calculatePicksmithBaseConfidence(input: PicksmithTierInput): number {
  const capperCount = input.contributingCappers.length

  // Base confidence for any consensus
  let confidence = 45

  // Bonus for more cappers agreeing (max +16)
  const extraCappers = Math.max(0, capperCount - 2)
  confidence += Math.min(extraCappers * 8, 16)

  // Bonus for high-quality cappers (average net units)
  const avgNetUnits = input.contributingCappers.reduce((sum, c) => sum + c.netUnits, 0) / capperCount
  const qualityBonus = Math.min(Math.floor(avgNetUnits / 10) * 4, 12)
  confidence += Math.max(0, qualityBonus) // Only add if positive

  // Bonus for strong bet sizing
  const betSizeBonus = Math.min(Math.floor(input.consensusUnits / 2) * 4, 12)
  confidence += betSizeBonus

  console.log(`[PicksmithTier] Base confidence: ${confidence}`, {
    capperCount,
    extraCapperBonus: Math.min(extraCappers * 8, 16),
    avgNetUnits: avgNetUnits.toFixed(1),
    qualityBonus,
    betSizeBonus
  })

  return confidence
}

/**
 * Calculate full tier grade for Picksmith pick
 */
export async function calculatePicksmithTierGrade(
  input: PicksmithTierInput
): Promise<TierGradeResult> {
  // Get Picksmith's own historical performance
  const picksmithInputs = await getCapperTierInputs(
    'picksmith',
    input.teamAbbrev,
    input.betType
  )

  // Calculate base confidence from consensus factors
  const baseConfidence = calculatePicksmithBaseConfidence(input)

  // Build tier grade input
  const tierInput: TierGradeInput = {
    baseConfidence: baseConfidence / 10, // Scale to 0-10 for tier-grading.ts
    unitsRisked: input.consensusUnits,
    // Picksmith doesn't have edge vs market (no prediction)
    edgeVsMarket: undefined,
    // Use Picksmith's own team record
    teamRecord: picksmithInputs.teamRecord || undefined,
    // Use Picksmith's recent form
    recentForm: picksmithInputs.recentForm || undefined,
    // Use Picksmith's current streak
    currentLosingStreak: picksmithInputs.currentLosingStreak
  }

  console.log(`[PicksmithTier] Tier input:`, {
    baseConfidence,
    units: input.consensusUnits,
    teamRecord: picksmithInputs.teamRecord,
    recentForm: picksmithInputs.recentForm,
    losingStreak: picksmithInputs.currentLosingStreak
  })

  return calculateTierGrade(tierInput)
}

/**
 * Build tier_grade object for storage in game_snapshot
 */
export async function buildPicksmithTierSnapshot(
  input: PicksmithTierInput
): Promise<{
  tier: string
  tierScore: number
  breakdown: any
  inputs: any
}> {
  const tierGrade = await calculatePicksmithTierGrade(input)

  return {
    tier: tierGrade.tier,
    tierScore: tierGrade.tierScore,
    breakdown: tierGrade.breakdown,
    inputs: {
      baseConfidence: calculatePicksmithBaseConfidence(input) / 10,
      unitsRisked: input.consensusUnits,
      contributingCappers: input.contributingCappers.length,
      avgCapperNetUnits: input.contributingCappers.reduce((s, c) => s + c.netUnits, 0) / input.contributingCappers.length
    }
  }
}

