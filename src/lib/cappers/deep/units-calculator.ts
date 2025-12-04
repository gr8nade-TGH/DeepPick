/**
 * DEEP Units Calculator
 * 
 * ENHANCED: Uses TIER as the primary weight, not just net units.
 * A Legendary pick from a +5u capper has more influence than
 * a Common pick from a +20u capper.
 * 
 * Weight Formula: (tierWeight * 2) + (netUnitsWeight * 1)
 * - Tier accounts for 2/3 of the weight
 * - Net units accounts for 1/3 of the weight
 */

import type { ConsensusGroup, DeepDecision, FactorConfluence, CounterThesisAnalysis } from './types'
import { getTierWeight } from './types'
import { analyzeConflict } from './consensus'
import { analyzeFactorConfluence, analyzeCounterThesis } from './factor-confluence'

/**
 * Get consensus multiplier based on number of agreeing cappers
 */
function getConsensusMultiplier(agreeingCount: number): number {
  if (agreeingCount >= 4) return 1.5
  if (agreeingCount === 3) return 1.25
  return 1.0 // 2 cappers
}

/**
 * Get conflict penalty based on counter-thesis strength
 * ENHANCED: Uses counter-thesis analysis instead of simple count
 */
function getConflictPenalty(counterThesis: CounterThesisAnalysis | null): number {
  if (!counterThesis) return 0

  switch (counterThesis.counterStrength) {
    case 'STRONG': return 2    // Legendary/Elite dissenter
    case 'MODERATE': return 1  // Rare dissenter
    case 'WEAK': return 0.5    // Common/Uncommon dissenter
    default: return 1
  }
}

/**
 * Calculate TIER-WEIGHTED average units
 * ENHANCED: Tier is the PRIMARY weight (2x), net units is secondary (1x)
 */
function calculateTierWeightedUnits(
  agreeing: Array<{ units: number; capperNetUnits: number; tierScore?: number; tier?: string }>
): { weightedUnits: number; tierWeightedScore: number } {
  if (agreeing.length === 0) return { weightedUnits: 1, tierWeightedScore: 0 }

  let totalWeight = 0
  let weightedUnitsSum = 0
  let weightedTierSum = 0

  for (const pick of agreeing) {
    // Tier weight: 5 for Legendary, 4 for Elite, etc.
    const tierWeight = getTierWeight(pick.tier)

    // Normalize net units to 0-5 scale (cap at 20 units for weighting)
    const normalizedNetUnits = Math.min(pick.capperNetUnits, 20) / 4

    // Combined weight: tier is 2x more important than net units
    const combinedWeight = (tierWeight * 2) + normalizedNetUnits

    totalWeight += combinedWeight
    weightedUnitsSum += pick.units * combinedWeight
    weightedTierSum += (pick.tierScore || 0) * combinedWeight
  }

  const weightedUnits = totalWeight > 0 ? weightedUnitsSum / totalWeight : 1
  const tierWeightedScore = totalWeight > 0 ? weightedTierSum / totalWeight : 0

  return { weightedUnits, tierWeightedScore }
}

/**
 * Calculate TIER-WEIGHTED average confidence
 */
function calculateTierWeightedConfidence(
  agreeing: Array<{ confidence: number; tierScore?: number; tier?: string }>
): number {
  if (agreeing.length === 0) return 5.0

  let totalWeight = 0
  let weightedSum = 0

  for (const pick of agreeing) {
    const tierWeight = getTierWeight(pick.tier)
    totalWeight += tierWeight
    weightedSum += pick.confidence * tierWeight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 5.0
}

/**
 * Main function: Calculate DEEP decision for a consensus group
 * ENHANCED: Includes factor confluence and counter-thesis analysis
 */
export function calculateDeepUnits(group: ConsensusGroup): DeepDecision {
  const conflict = analyzeConflict(group)

  // Analyze factor confluence (the DEEP part)
  const factorConfluence = analyzeFactorConfluence(group.agreeing)
  const counterThesis = analyzeCounterThesis(group.disagreeing)

  if (!conflict.canGeneratePick) {
    return {
      shouldGenerate: false,
      reason: conflict.reason || 'Cannot generate pick',
      consensus: group,
      calculatedUnits: 0,
      calculatedConfidence: 0,
      contributingCappers: [],
      factorConfluence,
      counterThesis,
      tierWeightedScore: 0
    }
  }

  // Calculate tier-weighted units
  const { weightedUnits, tierWeightedScore } = calculateTierWeightedUnits(group.agreeing)

  // Apply consensus multiplier
  const multiplier = getConsensusMultiplier(group.agreeing.length)
  const multipliedUnits = weightedUnits * multiplier

  // Apply conflict penalty based on counter-thesis strength
  const penalty = getConflictPenalty(counterThesis)
  const finalUnits = Math.max(1, Math.min(5, Math.round(multipliedUnits - penalty)))

  // Calculate tier-weighted confidence
  const confidence = calculateTierWeightedConfidence(group.agreeing)

  // Build contributing cappers list with tier info
  const contributingCappers = group.agreeing.map(p => ({
    id: p.capperId,
    name: p.capperName,
    units: p.units,
    netUnits: p.capperNetUnits,
    tierScore: p.tierScore,
    tier: p.tier,
    topFactor: p.topFactors?.[0]?.name
  }))

  // Build reason with factor confluence insight
  const topAlignedFactor = factorConfluence[0]
  const capperNames = group.agreeing.map(p => p.capperName).join(', ')
  let reason = conflict.hasConflict
    ? `${group.agreeing.length}v${group.disagreeing.length} consensus from ${capperNames}`
    : `Clean ${group.agreeing.length}v0 consensus from ${capperNames}`

  if (topAlignedFactor && topAlignedFactor.totalMentions >= 2) {
    reason += ` | Factor alignment: ${topAlignedFactor.factorName} (${topAlignedFactor.totalMentions}/${group.agreeing.length} cappers)`
  }

  return {
    shouldGenerate: true,
    reason,
    consensus: group,
    calculatedUnits: finalUnits,
    calculatedConfidence: confidence,
    contributingCappers,
    factorConfluence,
    counterThesis,
    tierWeightedScore
  }
}

/**
 * Format the selection string for DEEP pick
 * Uses the most common line among agreeing cappers
 */
export function formatSelection(
  group: ConsensusGroup,
  gameContext?: { homeTeam: string; awayTeam: string }
): string {
  // For totals
  if (group.pickType === 'total' || group.pickType.startsWith('total_')) {
    const line = group.line || group.agreeing[0]?.line || 220
    return `${group.side} ${line}`
  }

  // For spreads - use correct team abbreviation from game context
  if (group.pickType === 'spread') {
    const line = group.line || group.agreeing[0]?.line || 0
    const sign = line >= 0 ? '+' : ''

    let teamAbbrev = group.side.toUpperCase()
    if (gameContext) {
      const sideUpper = group.side.toUpperCase()
      const homeUpper = gameContext.homeTeam.toUpperCase()
      const awayUpper = gameContext.awayTeam.toUpperCase()

      if (sideUpper === homeUpper ||
        homeUpper.startsWith(sideUpper.slice(0, 3)) ||
        sideUpper.startsWith(homeUpper.slice(0, 3))) {
        teamAbbrev = gameContext.homeTeam
      } else if (sideUpper === awayUpper ||
        awayUpper.startsWith(sideUpper.slice(0, 3)) ||
        sideUpper.startsWith(awayUpper.slice(0, 3))) {
        teamAbbrev = gameContext.awayTeam
      }
    }

    return `${teamAbbrev} ${sign}${line}`
  }

  return group.side
}

