/**
 * PICKSMITH Pick Generator
 * 
 * Main orchestrator that:
 * 1. Finds games within 4 hours of start
 * 2. Gets picks from eligible cappers for each game
 * 3. Analyzes consensus
 * 4. Generates PICKSMITH picks where consensus exists
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getEligibleCappers } from './eligibility'
import { getPicksForGame, analyzeConsensus, analyzeConflict } from './consensus'
import { calculatePicksmithUnits, formatSelection } from './units-calculator'
import { buildPicksmithTierSnapshot, type PicksmithTierInput } from './tier-grading'
import type { PicksmithResult, GameConsensusOpportunity } from './types'

const HOURS_BEFORE_GAME = 4 // Only consider games within 4 hours

/**
 * Get games that are within 4 hours of starting
 */
export async function getUpcomingGames(): Promise<Array<{
  id: string
  homeTeam: string
  awayTeam: string
  homeTeamFull: { name?: string; abbreviation?: string }
  awayTeamFull: { name?: string; abbreviation?: string }
  gameTime: string
  hoursUntilStart: number
}>> {
  const admin = getSupabaseAdmin()
  const now = new Date()
  const fourHoursFromNow = new Date(now.getTime() + HOURS_BEFORE_GAME * 60 * 60 * 1000)

  const { data, error } = await admin
    .from('games')
    .select('id, home_team, away_team, game_start_timestamp, status')
    .eq('sport', 'nba')
    .eq('status', 'scheduled')
    .gte('game_start_timestamp', now.toISOString())
    .lte('game_start_timestamp', fourHoursFromNow.toISOString())
    .order('game_start_timestamp', { ascending: true })

  if (error) {
    console.error('[PICKSMITH] Error fetching upcoming games:', error)
    return []
  }

  return (data || []).map(game => {
    const gameTime = new Date(game.game_start_timestamp)
    const hoursUntilStart = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Handle both object and string formats for team data
    // Extract abbreviation for selection formatting
    const homeTeamAbbr = typeof game.home_team === 'object'
      ? game.home_team?.abbreviation || game.home_team?.name || 'HOME'
      : game.home_team || 'HOME'
    const awayTeamAbbr = typeof game.away_team === 'object'
      ? game.away_team?.abbreviation || game.away_team?.name || 'AWAY'
      : game.away_team || 'AWAY'

    // Store full team objects for game_snapshot (needed for matchup display)
    const homeTeamFull = typeof game.home_team === 'object' ? game.home_team : { name: game.home_team, abbreviation: game.home_team }
    const awayTeamFull = typeof game.away_team === 'object' ? game.away_team : { name: game.away_team, abbreviation: game.away_team }

    return {
      id: game.id,
      homeTeam: homeTeamAbbr,
      awayTeam: awayTeamAbbr,
      homeTeamFull,
      awayTeamFull,
      gameTime: game.game_start_timestamp,
      hoursUntilStart: Math.round(hoursUntilStart * 10) / 10
    }
  })
}

/**
 * Check if PICKSMITH already has a pick for this game/type
 */
async function hasExistingPick(gameId: string, pickType: string): Promise<boolean> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('picks')
    .select('id')
    .eq('game_id', gameId)
    .eq('capper', 'picksmith')
    .ilike('pick_type', `${pickType}%`)
    .limit(1)

  if (error) {
    console.error('[PICKSMITH] Error checking existing picks:', error)
    return true // Assume exists to be safe
  }

  return (data?.length || 0) > 0
}

/**
 * Insert a PICKSMITH pick into the database
 */
async function insertPick(
  gameId: string,
  result: PicksmithResult,
  gameSnapshot: any
): Promise<boolean> {
  const admin = getSupabaseAdmin()

  const { error } = await admin.from('picks').insert({
    game_id: gameId,
    capper: 'picksmith',
    pick_type: result.pickType,
    selection: result.selection,
    units: result.units,
    confidence: result.confidence,
    odds: 0,
    status: 'pending',
    is_system_pick: true,
    reasoning: result.reasoning,
    game_snapshot: gameSnapshot,
    algorithm_version: 'picksmith-v1'
  })

  if (error) {
    console.error('[PICKSMITH] Error inserting pick:', error)
    return false
  }

  console.log(`[PICKSMITH] ✅ Pick inserted: ${result.selection} (${result.units}u)`)
  return true
}

/**
 * Main function: Generate PICKSMITH picks for all eligible games
 */
export async function generatePicksmithPicks(): Promise<{
  success: boolean
  gamesAnalyzed: number
  picksGenerated: PicksmithResult[]
  errors: string[]
}> {
  const errors: string[] = []
  const picksGenerated: PicksmithResult[] = []

  console.log('[PICKSMITH] Starting pick generation...')

  // Step 1: Get eligible cappers
  const eligibleCappers = await getEligibleCappers()
  if (eligibleCappers.length < 2) {
    const msg = `Not enough eligible cappers (need 2+, have ${eligibleCappers.length})`
    console.log(`[PICKSMITH] ${msg}`)
    return { success: true, gamesAnalyzed: 0, picksGenerated: [], errors: [msg] }
  }

  console.log(`[PICKSMITH] ${eligibleCappers.length} eligible cappers:`,
    eligibleCappers.map(c => `${c.name}(+${c.netUnits.toFixed(1)}u)`).join(', '))

  // Step 2: Get upcoming games (within 4 hours)
  const upcomingGames = await getUpcomingGames()
  if (upcomingGames.length === 0) {
    console.log('[PICKSMITH] No games within 4 hours')
    return { success: true, gamesAnalyzed: 0, picksGenerated: [], errors: [] }
  }

  console.log(`[PICKSMITH] ${upcomingGames.length} games within 4 hours`)

  // Step 3: Analyze each game
  for (const game of upcomingGames) {
    console.log(`\n[PICKSMITH] Analyzing: ${game.awayTeam} @ ${game.homeTeam} (${game.hoursUntilStart}h)`)

    // Get picks from eligible cappers for this game
    const picks = await getPicksForGame(game.id, eligibleCappers)

    if (picks.length < 2) {
      console.log(`[PICKSMITH] Only ${picks.length} picks from eligible cappers, skipping`)
      continue
    }

    console.log(`[PICKSMITH] Found ${picks.length} picks:`,
      picks.map(p => `${p.capperName}:${p.selection}`).join(', '))

    // Analyze TOTAL consensus
    const totalConsensus = analyzeConsensus(picks, 'total')
    for (const group of totalConsensus) {
      // Skip if PICKSMITH already has a pick for this
      if (await hasExistingPick(game.id, 'total')) {
        console.log(`[PICKSMITH] Already have TOTAL pick for this game`)
        continue
      }

      const decision = calculatePicksmithUnits(group)

      if (decision.shouldGenerate) {
        const selection = formatSelection(group)
        const result: PicksmithResult = {
          gameId: game.id,
          pickType: 'total',
          selection,
          units: decision.calculatedUnits,
          confidence: decision.calculatedConfidence,
          contributingCappers: decision.contributingCappers.map(c => c.name),
          reasoning: `PICKSMITH consensus: ${decision.reason}. Contributing cappers: ${decision.contributingCappers.map(c => `${c.name}(${c.units}u, +${c.netUnits.toFixed(1)}u record)`).join(', ')}`
        }

        // Calculate tier grade for Picksmith
        const tierInput: PicksmithTierInput = {
          contributingCappers: decision.contributingCappers.map(c => ({
            name: c.name,
            units: c.units,
            netUnits: c.netUnits
          })),
          consensusUnits: decision.calculatedUnits,
          teamAbbrev: game.homeTeam,
          betType: 'total'
        }
        const tierGrade = await buildPicksmithTierSnapshot(tierInput)

        const gameSnapshot = {
          home_team: game.homeTeamFull,
          away_team: game.awayTeamFull,
          game_start_timestamp: game.gameTime,
          tier_grade: tierGrade
        }

        const inserted = await insertPick(game.id, result, gameSnapshot)
        if (inserted) {
          picksGenerated.push(result)
        }
      } else {
        console.log(`[PICKSMITH] TOTAL: ${decision.reason}`)
      }
    }

    // Analyze SPREAD consensus
    const spreadConsensus = analyzeConsensus(picks, 'spread')
    for (const group of spreadConsensus) {
      // Skip if PICKSMITH already has a pick for this
      if (await hasExistingPick(game.id, 'spread')) {
        console.log(`[PICKSMITH] Already have SPREAD pick for this game`)
        continue
      }

      const decision = calculatePicksmithUnits(group)

      if (decision.shouldGenerate) {
        // Pass game context to get correct team abbreviations
        const selection = formatSelection(group, { homeTeam: game.homeTeam, awayTeam: game.awayTeam })
        const result: PicksmithResult = {
          gameId: game.id,
          pickType: 'spread',
          selection,
          units: decision.calculatedUnits,
          confidence: decision.calculatedConfidence,
          contributingCappers: decision.contributingCappers.map(c => c.name),
          reasoning: `PICKSMITH consensus: ${decision.reason}. Contributing cappers: ${decision.contributingCappers.map(c => `${c.name}(${c.units}u, +${c.netUnits.toFixed(1)}u record)`).join(', ')}`
        }

        // Calculate tier grade for Picksmith
        const tierInput: PicksmithTierInput = {
          contributingCappers: decision.contributingCappers.map(c => ({
            name: c.name,
            units: c.units,
            netUnits: c.netUnits
          })),
          consensusUnits: decision.calculatedUnits,
          teamAbbrev: game.homeTeam,
          betType: 'spread'
        }
        const tierGrade = await buildPicksmithTierSnapshot(tierInput)

        const gameSnapshot = {
          home_team: game.homeTeamFull,
          away_team: game.awayTeamFull,
          game_start_timestamp: game.gameTime,
          tier_grade: tierGrade
        }

        const inserted = await insertPick(game.id, result, gameSnapshot)
        if (inserted) {
          picksGenerated.push(result)
        }
      } else {
        console.log(`[PICKSMITH] SPREAD: ${decision.reason}`)
      }
    }
  }

  console.log(`\n[PICKSMITH] Complete: ${picksGenerated.length} picks generated`)

  return {
    success: true,
    gamesAnalyzed: upcomingGames.length,
    picksGenerated,
    errors
  }
}
