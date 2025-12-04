/**
 * DEEP Consensus Module
 *
 * Enhanced consensus analysis that includes:
 * 1. Standard vote counting (3v1, 2v0, etc.)
 * 2. Tier-weighted voting (Legendary pick > Common pick)
 * 3. Factor confluence detection (which factors AGREE across cappers)
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type {
  CapperPick,
  ConsensusGroup,
  ConflictAnalysis,
  EligibleCapper,
  FactorContribution
} from './types'

// Team abbreviation normalization
const ABBREV_NORMALIZE: Record<string, string> = {
  'BRK': 'BKN', 'CHO': 'CHA', 'GS': 'GSW', 'LOS': 'LAC',
  'NOR': 'NOP', 'NO': 'NOP', 'NY': 'NYK', 'PHO': 'PHX',
  'SAN': 'SAS', 'SA': 'SAS',
}

function normalizeTeamAbbrev(abbrev: string): string {
  const upper = abbrev.toUpperCase()
  return ABBREV_NORMALIZE[upper] || upper
}

/**
 * Parse a pick selection to extract the "side"
 */
export function parseSide(selection: string, pickType: string): { side: string; line?: number } {
  const selectionUpper = selection.toUpperCase()

  if (pickType === 'total' || pickType === 'total_over' || pickType === 'total_under') {
    const isOver = selectionUpper.includes('OVER')
    const isUnder = selectionUpper.includes('UNDER')
    const lineMatch = selection.match(/(\d+\.?\d*)/)
    const line = lineMatch ? parseFloat(lineMatch[1]) : undefined
    return { side: isOver ? 'OVER' : isUnder ? 'UNDER' : 'UNKNOWN', line }
  } else if (pickType === 'spread') {
    const parts = selection.split(/\s+/)
    const rawAbbrev = parts[0]?.toUpperCase() || 'UNKNOWN'
    const teamAbbrev = normalizeTeamAbbrev(rawAbbrev)
    const lineMatch = selection.match(/([+-]?\d+\.?\d*)$/)
    const line = lineMatch ? parseFloat(lineMatch[1]) : undefined
    return { side: teamAbbrev, line }
  } else if (pickType === 'moneyline') {
    return { side: normalizeTeamAbbrev(selection.toUpperCase()) }
  }
  return { side: 'UNKNOWN' }
}

/**
 * Parse factor data from insight_card_snapshot
 */
function parseFactors(insightCardSnapshot: any): FactorContribution[] {
  if (!insightCardSnapshot?.factors) return []

  try {
    const factors = insightCardSnapshot.factors
    if (!Array.isArray(factors)) return []

    // Sort by absolute contribution and take top 3
    return factors
      .filter((f: any) => f && f.key && typeof f.normalized_value === 'number')
      .sort((a: any, b: any) => Math.abs(b.normalized_value) - Math.abs(a.normalized_value))
      .slice(0, 3)
      .map((f: any) => ({
        key: f.key,
        name: f.name || f.key,
        normalizedValue: f.normalized_value,
        weight: f.weight || 1
      }))
  } catch (e) {
    console.error('[DEEP:Consensus] Error parsing factors:', e)
    return []
  }
}

/**
 * Parse tier data from game_snapshot
 */
function parseTierData(gameSnapshot: any): { tierScore: number; tier: string } {
  const tierGrade = gameSnapshot?.tier_grade
  if (!tierGrade) return { tierScore: 0, tier: 'Common' }

  return {
    tierScore: tierGrade.tierScore || tierGrade.confluenceScore || 0,
    tier: tierGrade.tier || 'Common'
  }
}

/**
 * Fetch all picks from eligible cappers for a specific game
 * ENHANCED: Also fetches tier and factor data for DEEP analysis
 */
export async function getPicksForGame(
  gameId: string,
  eligibleCappers: EligibleCapper[]
): Promise<CapperPick[]> {
  const admin = getSupabaseAdmin()
  const eligibleIds = eligibleCappers.map(c => c.id)

  // Fetch picks WITH insight_card_snapshot and game_snapshot for tier/factor data
  const { data, error } = await admin
    .from('picks')
    .select('id, capper, game_id, pick_type, selection, units, confidence, insight_card_snapshot, game_snapshot')
    .eq('game_id', gameId)
    .in('capper', eligibleIds)
    .eq('status', 'pending')

  if (error) {
    console.error('[DEEP:Consensus] Error fetching picks for game:', error)
    return []
  }

  const capperMap = new Map(eligibleCappers.map(c => [c.id, c]))

  return (data || []).map(pick => {
    const capper = capperMap.get(pick.capper)
    const { side, line } = parseSide(pick.selection, pick.pick_type)
    const { tierScore, tier } = parseTierData(pick.game_snapshot)
    const topFactors = parseFactors(pick.insight_card_snapshot)

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
      capperNetUnits: capper?.netUnits || 0,
      tierScore,
      tier,
      topFactors
    }
  })
}

/**
 * Group picks by pick type and side
 */
export function groupPicksBySide(picks: CapperPick[]): Map<string, ConsensusGroup> {
  const groups = new Map<string, ConsensusGroup>()

  for (const pick of picks) {
    const key = `${pick.gameId}_${pick.pickType}_${pick.side}`
    if (!groups.has(key)) {
      groups.set(key, {
        gameId: pick.gameId, pickType: pick.pickType, side: pick.side,
        line: pick.line, agreeing: [], disagreeing: []
      })
    }
    groups.get(key)!.agreeing.push(pick)
  }
  return groups
}

/**
 * Analyze consensus groups and identify conflicts
 */
export function analyzeConsensus(
  picks: CapperPick[],
  pickType: 'total' | 'spread'
): ConsensusGroup[] {
  const groups = groupPicksBySide(picks.filter(p =>
    p.pickType === pickType ||
    p.pickType === `${pickType}_over` ||
    p.pickType === `${pickType}_under`
  ))

  const result: ConsensusGroup[] = []
  const processedKeys = new Set<string>()

  for (const [key, group] of groups) {
    if (processedKeys.has(key)) continue

    let oppositeKey: string | null = null

    if (pickType === 'total') {
      const oppositeSide = group.side === 'OVER' ? 'UNDER' : 'OVER'
      oppositeKey = `${group.gameId}_${pickType}_${oppositeSide}`
    } else {
      for (const [otherKey, otherGroup] of groups) {
        if (otherKey !== key && otherGroup.gameId === group.gameId && otherGroup.pickType === group.pickType) {
          oppositeKey = otherKey
          break
        }
      }
    }

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
 * Rules: 1v1=blocked, 2v0=pick, 2v1=skip, 3v1=pick with penalty, 2v2=blocked
 */
export function analyzeConflict(group: ConsensusGroup): ConflictAnalysis {
  const agreeing = group.agreeing.length
  const disagreeing = group.disagreeing.length

  if (agreeing < 2) {
    return {
      hasConflict: disagreeing > 0, agreementCount: agreeing, disagreementCount: disagreeing,
      canGeneratePick: false, reason: `Need at least 2 cappers agreeing, only have ${agreeing}`
    }
  }

  if (agreeing === 1 && disagreeing >= 1) {
    return {
      hasConflict: true, agreementCount: agreeing, disagreementCount: disagreeing,
      canGeneratePick: false, reason: `1v${disagreeing} split - blocked`
    }
  }

  if (agreeing === 2 && disagreeing === 1) {
    return {
      hasConflict: true, agreementCount: agreeing, disagreementCount: disagreeing,
      canGeneratePick: false, reason: `2v1 split - too close, skipping`
    }
  }

  if (agreeing <= disagreeing) {
    return {
      hasConflict: true, agreementCount: agreeing, disagreementCount: disagreeing,
      canGeneratePick: false, reason: `${agreeing}v${disagreeing} split consensus - blocked`
    }
  }

  if (disagreeing > 0) {
    return {
      hasConflict: true, agreementCount: agreeing, disagreementCount: disagreeing,
      canGeneratePick: true, reason: `${agreeing}v${disagreeing} - consensus with conflict penalty`
    }
  }

  return {
    hasConflict: false, agreementCount: agreeing, disagreementCount: 0,
    canGeneratePick: true, reason: `${agreeing}v0 - clean consensus`
  }
}

