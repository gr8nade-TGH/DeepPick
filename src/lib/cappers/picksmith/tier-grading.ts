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
 * Formula:
 * - Base: 30 (minimum for any consensus)
 * - +10 per additional capper beyond 2 (cap at +20 for 4+ cappers)
 * - +5 for every +10 net units average among cappers (cap at +15)
 * - +5 for every 2 units of consensus bet size (cap at +15)
 * 
 * Max base: 30 + 20 + 15 + 15 = 80
 */
export function calculatePicksmithBaseConfidence(input: PicksmithTierInput): number {
  const capperCount = input.contributingCappers.length
  
  // Base confidence for any consensus
  let confidence = 30
  
  // Bonus for more cappers agreeing (max +20)
  const extraCappers = Math.max(0, capperCount - 2)
  confidence += Math.min(extraCappers * 10, 20)
  
  // Bonus for high-quality cappers (average net units)
  const avgNetUnits = input.contributingCappers.reduce((sum, c) => sum + c.netUnits, 0) / capperCount
  const qualityBonus = Math.min(Math.floor(avgNetUnits / 10) * 5, 15)
  confidence += Math.max(0, qualityBonus) // Only add if positive
  
  // Bonus for strong bet sizing
  const betSizeBonus = Math.min(Math.floor(input.consensusUnits / 2) * 5, 15)
  confidence += betSizeBonus
  
  console.log(`[PicksmithTier] Base confidence: ${confidence}`, {
    capperCount,
    extraCapperBonus: Math.min(extraCappers * 10, 20),
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

