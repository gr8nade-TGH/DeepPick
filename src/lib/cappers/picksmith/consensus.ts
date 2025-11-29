/**
 * PICKSMITH Consensus Module
 * 
 * Groups picks by game/type/side and detects consensus vs conflicts.
 * Core logic for determining when PICKSMITH should generate a pick.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getEligibleCappers } from './eligibility'
import type {
  CapperPick,
  ConsensusGroup,
  ConflictAnalysis,
  EligibleCapper,
  GameConsensusOpportunity
} from './types'

/**
 * Parse a pick selection to extract the "side"
 * - TOTAL: 'OVER' or 'UNDER'
 * - SPREAD: Team abbreviation (e.g., 'LAL', 'MEM')
 */
export function parseSide(selection: string, pickType: string): { side: string; line?: number } {
  const selectionUpper = selection.toUpperCase()

  if (pickType === 'total' || pickType === 'total_over' || pickType === 'total_under') {
    // Parse totals: "OVER 225.5" or "UNDER 225.5"
    const isOver = selectionUpper.includes('OVER')
    const isUnder = selectionUpper.includes('UNDER')
    const lineMatch = selection.match(/(\d+\.?\d*)/)
    const line = lineMatch ? parseFloat(lineMatch[1]) : undefined

    return {
      side: isOver ? 'OVER' : isUnder ? 'UNDER' : 'UNKNOWN',
      line
    }
  } else if (pickType === 'spread') {
    // Parse spreads: "LAL -4.5" or "MEM +4.5"
    const parts = selection.split(/\s+/)
    const teamAbbrev = parts[0]?.toUpperCase() || 'UNKNOWN'
    const lineMatch = selection.match(/([+-]?\d+\.?\d*)$/)
    const line = lineMatch ? parseFloat(lineMatch[1]) : undefined

    return {
      side: teamAbbrev,
      line
    }
  } else if (pickType === 'moneyline') {
    // Moneyline: Just the team name
    return { side: selection.toUpperCase() }
  }

  return { side: 'UNKNOWN' }
}

/**
 * Determine if two picks are on opposite sides
 */
export function areOppositeSides(side1: string, side2: string, pickType: string): boolean {
  if (pickType === 'total' || pickType === 'total_over' || pickType === 'total_under') {
    return (side1 === 'OVER' && side2 === 'UNDER') || (side1 === 'UNDER' && side2 === 'OVER')
  }
  // For spread/moneyline, different team = opposite side
  return side1 !== side2
}

/**
 * Fetch all picks from eligible cappers for a specific game
 */
export async function getPicksForGame(
  gameId: string,
  eligibleCappers: EligibleCapper[]
): Promise<CapperPick[]> {
  const admin = getSupabaseAdmin()

  const eligibleIds = eligibleCappers.map(c => c.id)

  const { data, error } = await admin
    .from('picks')
    .select('id, capper, game_id, pick_type, selection, units, confidence')
    .eq('game_id', gameId)
    .in('capper', eligibleIds)
    .eq('status', 'pending') // Only pending picks (not graded yet)

  if (error) {
    console.error('[PICKSMITH:Consensus] Error fetching picks for game:', error)
    return []
  }

  // Map to CapperPick with side parsing
  const capperMap = new Map(eligibleCappers.map(c => [c.id, c]))

  return (data || []).map(pick => {
    const capper = capperMap.get(pick.capper)
    const { side, line } = parseSide(pick.selection, pick.pick_type)

    return {
      id: pick.id,
      capperId: pick.capper,
      capperName: capper?.name || pick.capper.toUpperCase(),
      gameId: pick.game_id,
      pickType: pick.pick_type,
      selection: pick.selection,
      units: pick.units || 1,
      confidence: pick.confidence || 0,
      side,
      line,
      capperNetUnits: capper?.netUnits || 0
    }
  })
}

/**
 * Group picks by pick type and side to find consensus
 */
export function groupPicksBySide(picks: CapperPick[]): Map<string, ConsensusGroup> {
  const groups = new Map<string, ConsensusGroup>()

  for (const pick of picks) {
    const key = `${pick.gameId}_${pick.pickType}_${pick.side}`

    if (!groups.has(key)) {
      groups.set(key, {
        gameId: pick.gameId,
        pickType: pick.pickType,
        side: pick.side,
        line: pick.line,
        agreeing: [],
        disagreeing: []
      })
    }

    groups.get(key)!.agreeing.push(pick)
  }

  return groups
}

/**
 * Analyze consensus groups and identify conflicts
 * Returns groups with agreeing and disagreeing picks populated
 */
export function analyzeConsensus(
  picks: CapperPick[],
  pickType: 'total' | 'spread'
): ConsensusGroup[] {
  // First, group by side
  const groups = groupPicksBySide(picks.filter(p =>
    p.pickType === pickType ||
    p.pickType === `${pickType}_over` ||
    p.pickType === `${pickType}_under`
  ))

  // For each group, find the opposite side and populate disagreeing
  const result: ConsensusGroup[] = []
  const processedKeys = new Set<string>()

  for (const [key, group] of groups) {
    if (processedKeys.has(key)) continue

    // Find opposite side
    let oppositeKey: string | null = null

    if (pickType === 'total') {
      const oppositeSide = group.side === 'OVER' ? 'UNDER' : 'OVER'
      oppositeKey = `${group.gameId}_${pickType}_${oppositeSide}`
    } else {
      // For spread, any other team is the opposite
      for (const [otherKey, otherGroup] of groups) {
        if (otherKey !== key &&
          otherGroup.gameId === group.gameId &&
          otherGroup.pickType === group.pickType) {
          oppositeKey = otherKey
          break
        }
      }
    }

    // Populate disagreeing from opposite group
    if (oppositeKey && groups.has(oppositeKey)) {
      group.disagreeing = groups.get(oppositeKey)!.agreeing
      processedKeys.add(oppositeKey)
    }

    processedKeys.add(key)
    result.push(group)
  }

  return result
}

/**
 * Analyze if a consensus group can generate a pick
 * Rules:
 * - 1v1 = NO PICK (blocked)
 * - 2v0 = PICK
 * - 2v1 = BORDERLINE (skip for now)
 * - 3v1 = PICK with penalty
 * - 2v2 = NO PICK (split)
 */
export function analyzeConflict(group: ConsensusGroup): ConflictAnalysis {
  const agreeing = group.agreeing.length
  const disagreeing = group.disagreeing.length

  // Must have at least 2 agreeing
  if (agreeing < 2) {
    return {
      hasConflict: disagreeing > 0,
      agreementCount: agreeing,
      disagreementCount: disagreeing,
      canGeneratePick: false,
      reason: `Need at least 2 cappers agreeing, only have ${agreeing}`
    }
  }

  // 1v1 blocks
  if (agreeing === 1 && disagreeing >= 1) {
    return {
      hasConflict: true,
      agreementCount: agreeing,
      disagreementCount: disagreeing,
      canGeneratePick: false,
      reason: `1v${disagreeing} split - blocked`
    }
  }

  // 2v1 - borderline, skip for conservative approach
  if (agreeing === 2 && disagreeing === 1) {
    return {
      hasConflict: true,
      agreementCount: agreeing,
      disagreementCount: disagreeing,
      canGeneratePick: false, // Conservative: skip 2v1
      reason: `2v1 split - too close, skipping`
    }
  }

  // 2v2+ - split consensus, no pick
  if (agreeing <= disagreeing) {
    return {
      hasConflict: true,
      agreementCount: agreeing,
      disagreementCount: disagreeing,
      canGeneratePick: false,
      reason: `${agreeing}v${disagreeing} split consensus - blocked`
    }
  }

  // 3v1, 4v1, etc. - can generate with penalty
  if (disagreeing > 0) {
    return {
      hasConflict: true,
      agreementCount: agreeing,
      disagreementCount: disagreeing,
      canGeneratePick: true,
      reason: `${agreeing}v${disagreeing} - consensus with conflict penalty`
    }
  }

  // No disagreement - clean consensus
  return {
    hasConflict: false,
    agreementCount: agreeing,
    disagreementCount: 0,
    canGeneratePick: true,
    reason: `${agreeing}v0 - clean consensus`
  }
}

