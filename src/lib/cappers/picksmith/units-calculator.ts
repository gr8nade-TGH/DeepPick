/**
 * PICKSMITH Units Calculator
 * 
 * Calculates bet size based on:
 * 1. Number of agreeing cappers
 * 2. Units each capper is betting
 * 3. Each capper's overall unit record (weighting)
 * 4. Conflict penalties
 */

import type { ConsensusGroup, ConflictAnalysis, PicksmithDecision } from './types'
import { analyzeConflict } from './consensus'

/**
 * Calculate consensus multiplier based on number of agreeing cappers
 * More cappers = higher multiplier
 */
function getConsensusMultiplier(agreeingCount: number): number {
  if (agreeingCount >= 4) return 1.5
  if (agreeingCount === 3) return 1.25
  return 1.0 // 2 cappers
}

/**
 * Calculate conflict penalty based on number of disagreeing cappers
 */
function getConflictPenalty(disagreingCount: number): number {
  if (disagreingCount === 0) return 0
  if (disagreingCount === 1) return 1
  return 2 // 2+ disagreeing (shouldn't happen due to conflict rules, but safety)
}

/**
 * Calculate weighted average units from agreeing cappers
 * Weight by each capper's overall unit record
 */
function calculateWeightedUnits(
  agreeing: Array<{ units: number; capperNetUnits: number }>
): number {
  if (agreeing.length === 0) return 1
  
  // Calculate total weight (sum of net units)
  const totalWeight = agreeing.reduce((sum, p) => sum + Math.max(p.capperNetUnits, 0.1), 0)
  
  if (totalWeight === 0) {
    // Fallback to simple average if no weight
    return agreeing.reduce((sum, p) => sum + p.units, 0) / agreeing.length
  }
  
  // Weighted average: sum(units * weight) / totalWeight
  const weightedSum = agreeing.reduce((sum, p) => {
    const weight = Math.max(p.capperNetUnits, 0.1)
    return sum + (p.units * weight)
  }, 0)
  
  return weightedSum / totalWeight
}

/**
 * Calculate weighted average confidence from agreeing cappers
 */
function calculateWeightedConfidence(
  agreeing: Array<{ confidence: number; capperNetUnits: number }>
): number {
  if (agreeing.length === 0) return 5.0
  
  const totalWeight = agreeing.reduce((sum, p) => sum + Math.max(p.capperNetUnits, 0.1), 0)
  
  if (totalWeight === 0) {
    return agreeing.reduce((sum, p) => sum + p.confidence, 0) / agreeing.length
  }
  
  const weightedSum = agreeing.reduce((sum, p) => {
    const weight = Math.max(p.capperNetUnits, 0.1)
    return sum + (p.confidence * weight)
  }, 0)
  
  return weightedSum / totalWeight
}

/**
 * Main function: Calculate PICKSMITH units for a consensus group
 */
export function calculatePicksmithUnits(group: ConsensusGroup): PicksmithDecision {
  const conflict = analyzeConflict(group)
  
  // If can't generate pick, return early
  if (!conflict.canGeneratePick) {
    return {
      shouldGenerate: false,
      reason: conflict.reason || 'Cannot generate pick',
      consensus: group,
      calculatedUnits: 0,
      calculatedConfidence: 0,
      contributingCappers: []
    }
  }
  
  // Calculate base units (weighted average of agreeing cappers)
  const baseUnits = calculateWeightedUnits(group.agreeing)
  
  // Apply consensus multiplier
  const multiplier = getConsensusMultiplier(group.agreeing.length)
  const multipliedUnits = baseUnits * multiplier
  
  // Apply conflict penalty
  const penalty = getConflictPenalty(group.disagreeing.length)
  const finalUnits = Math.max(1, Math.min(5, Math.round(multipliedUnits - penalty)))
  
  // Calculate confidence (weighted average)
  const confidence = calculateWeightedConfidence(group.agreeing)
  
  // Build contributing cappers list
  const contributingCappers = group.agreeing.map(p => ({
    id: p.capperId,
    name: p.capperName,
    units: p.units,
    netUnits: p.capperNetUnits
  }))
  
  // Build reason string
  const capperNames = group.agreeing.map(p => p.capperName).join(', ')
  const reason = conflict.hasConflict
    ? `${group.agreeing.length}v${group.disagreeing.length} consensus from ${capperNames} (penalty applied)`
    : `Clean ${group.agreeing.length}v0 consensus from ${capperNames}`
  
  return {
    shouldGenerate: true,
    reason,
    consensus: group,
    calculatedUnits: finalUnits,
    calculatedConfidence: confidence,
    contributingCappers
  }
}

/**
 * Format the selection string for PICKSMITH pick
 * Uses the most common line among agreeing cappers
 */
export function formatSelection(group: ConsensusGroup): string {
  // For totals
  if (group.pickType === 'total' || group.pickType.startsWith('total_')) {
    const line = group.line || group.agreeing[0]?.line || 220
    return `${group.side} ${line}`
  }
  
  // For spreads
  if (group.pickType === 'spread') {
    const line = group.line || group.agreeing[0]?.line || 0
    const sign = line >= 0 ? '+' : ''
    return `${group.side} ${sign}${line}`
  }
  
  // Moneyline or unknown
  return group.side
}

