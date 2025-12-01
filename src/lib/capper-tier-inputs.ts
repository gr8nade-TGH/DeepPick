/**
 * CAPPER TIER INPUTS
 * 
 * Shared utility to fetch tier grading inputs for any capper.
 * Used by both manual picks and Picksmith to calculate tier grades.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { TierGradeInput } from '@/lib/tier-grading'

export interface CapperTierInputs {
  teamRecord: { wins: number; losses: number; netUnits: number } | null
  recentForm: { wins: number; losses: number; netUnits: number } | null
  currentLosingStreak: number
}

/**
 * Get tier grading inputs for a capper
 * 
 * @param capperId - The capper's ID
 * @param teamAbbrev - Optional team abbreviation for team-specific record
 * @param betType - Optional bet type filter ('total' or 'spread')
 */
export async function getCapperTierInputs(
  capperId: string,
  teamAbbrev?: string,
  betType?: 'total' | 'spread'
): Promise<CapperTierInputs> {
  const admin = getSupabaseAdmin()

  // Build base query for graded picks
  let query = admin
    .from('picks')
    .select('status, units, net_units, game_snapshot, created_at')
    .eq('capper', capperId.toLowerCase())
    .in('status', ['won', 'lost', 'push'])
    .order('created_at', { ascending: false })

  // Filter by bet type if specified
  if (betType) {
    query = query.eq('pick_type', betType)
  }

  const { data: picks, error } = await query.limit(100)

  if (error || !picks || picks.length === 0) {
    console.log(`[CapperTierInputs] No graded picks found for ${capperId}`)
    return {
      teamRecord: null,
      recentForm: null,
      currentLosingStreak: 0
    }
  }

  // Calculate recent form (last 10 picks)
  const last10 = picks.slice(0, 10)
  const recentForm = calculateRecord(last10)

  // Calculate team-specific record if team provided
  let teamRecord: CapperTierInputs['teamRecord'] = null
  if (teamAbbrev) {
    const teamPicks = picks.filter(p => {
      const snapshot = p.game_snapshot as any
      const homeAbbr = snapshot?.home_team?.abbreviation || ''
      const awayAbbr = snapshot?.away_team?.abbreviation || ''
      return homeAbbr === teamAbbrev || awayAbbr === teamAbbrev
    })

    if (teamPicks.length >= 3) {
      teamRecord = calculateRecord(teamPicks)
    }
  }

  // Calculate current losing streak
  let currentLosingStreak = 0
  for (const pick of picks) {
    if (pick.status === 'lost') {
      currentLosingStreak++
    } else if (pick.status === 'won') {
      break // Streak broken
    }
    // pushes don't break streaks
  }

  return {
    teamRecord,
    recentForm,
    currentLosingStreak
  }
}

/**
 * Calculate wins, losses, netUnits from a set of picks
 */
function calculateRecord(picks: any[]): { wins: number; losses: number; netUnits: number } {
  let wins = 0
  let losses = 0
  let netUnits = 0

  for (const pick of picks) {
    if (pick.status === 'won') {
      wins++
      netUnits += pick.net_units || pick.units * 0.91 // Assume -110 odds
    } else if (pick.status === 'lost') {
      losses++
      netUnits += pick.net_units || -pick.units
    }
    // pushes don't count toward W-L
  }

  return { wins, losses, netUnits: Math.round(netUnits * 10) / 10 }
}

/**
 * Calculate base confidence from units for manual picks
 *
 * Formula: 40 + (units × 8) - similar range to AI picks (50-80)
 * 1U = 48, 2U = 56, 3U = 64, 4U = 72, 5U = 80
 *
 * This makes the distribution similar to AI picks:
 * - AI typically generates 50-80 base confidence
 * - 5U manual pick = 80 (needs bonuses for Legendary 85+)
 * - Average 3U pick = 64 (Rare territory, same as average AI pick)
 */
export function getManualPickBaseConfidence(units: number): number {
  return 40 + (units * 8)
}

/**
 * Build full tier grade input for manual picks
 */
export async function buildManualPickTierInput(
  capperId: string,
  units: number,
  teamAbbrev?: string,
  betType?: 'total' | 'spread'
): Promise<TierGradeInput> {
  const capperInputs = await getCapperTierInputs(capperId, teamAbbrev, betType)

  return {
    baseConfidence: getManualPickBaseConfidence(units) / 10, // Scale to 0-10 for tier-grading.ts
    unitsRisked: units,
    teamRecord: capperInputs.teamRecord || undefined,
    recentForm: capperInputs.recentForm || undefined,
    currentLosingStreak: capperInputs.currentLosingStreak
  }
}

