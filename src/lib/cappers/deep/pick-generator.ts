/**
 * DEEP Pick Generator
 * 
 * Main orchestrator that:
 * 1. Finds games within 4 hours of start
 * 2. Gets picks from eligible cappers for each game
 * 3. Analyzes consensus WITH factor confluence
 * 4. Generates DEEP picks where strong consensus exists
 * 
 * DEEP = Factor Confluence Intelligence
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getEligibleCappers } from './eligibility'
import { getPicksForGame, analyzeConsensus } from './consensus'
import { calculateDeepUnits, formatSelection } from './units-calculator'
import { buildDeepTierSnapshot, type DeepTierInput } from './tier-grading'
import type { DeepResult } from './types'

const HOURS_BEFORE_GAME = 4

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
    console.error('[DEEP] Error fetching upcoming games:', error)
    return []
  }

  return (data || []).map(game => {
    const gameTime = new Date(game.game_start_timestamp)
    const hoursUntilStart = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    const homeTeamAbbr = typeof game.home_team === 'object'
      ? game.home_team?.abbreviation || game.home_team?.name || 'HOME'
      : game.home_team || 'HOME'
    const awayTeamAbbr = typeof game.away_team === 'object'
      ? game.away_team?.abbreviation || game.away_team?.name || 'AWAY'
      : game.away_team || 'AWAY'

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
 * Check if DEEP already has a pick for this game/type
 */
async function hasExistingPick(gameId: string, pickType: string): Promise<boolean> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('picks')
    .select('id')
    .eq('game_id', gameId)
    .or('capper.ilike.deep,capper.ilike.picksmith')  // Check both names
    .ilike('pick_type', `${pickType}%`)
    .limit(1)

  if (error) {
    console.error('[DEEP] Error checking existing picks:', error)
    return true
  }

  return (data?.length || 0) > 0
}

/**
 * Insert a DEEP pick into the database
 */
async function insertPick(
  gameId: string,
  result: DeepResult,
  gameSnapshot: any,
  insightCardSnapshot: any
): Promise<boolean> {
  const admin = getSupabaseAdmin()

  const { error } = await admin.from('picks').insert({
    game_id: gameId,
    capper: 'deep',
    pick_type: result.pickType,
    selection: result.selection,
    units: result.units,
    confidence: result.confidence,
    odds: 0,
    status: 'pending',
    is_system_pick: true,
    reasoning: result.reasoning,
    game_snapshot: gameSnapshot,
    insight_card_snapshot: insightCardSnapshot,
    algorithm_version: 'deep-v1'
  })

  if (error) {
    console.error('[DEEP] Error inserting pick:', error)
    return false
  }

  console.log(`[DEEP] ✅ Pick inserted: ${result.selection} (${result.units}u)`)
  return true
}

/**
 * Main function: Generate DEEP picks for all eligible games
 */
export async function generateDeepPicks(): Promise<{
  success: boolean
  gamesAnalyzed: number
  picksGenerated: DeepResult[]
  errors: string[]
}> {
  const errors: string[] = []
  const picksGenerated: DeepResult[] = []

  console.log('[DEEP] 🧠 Starting Factor Confluence pick generation...')

  // Step 1: Get eligible cappers
  const eligibleCappers = await getEligibleCappers()
  if (eligibleCappers.length < 2) {
    const msg = `Not enough eligible cappers (need 2+, have ${eligibleCappers.length})`
    console.log(`[DEEP] ${msg}`)
    return { success: true, gamesAnalyzed: 0, picksGenerated: [], errors: [msg] }
  }

  console.log(`[DEEP] ${eligibleCappers.length} eligible cappers`)

  // Step 2: Get upcoming games
  const upcomingGames = await getUpcomingGames()
  if (upcomingGames.length === 0) {
    console.log('[DEEP] No games within 4 hours')
    return { success: true, gamesAnalyzed: 0, picksGenerated: [], errors: [] }
  }

  console.log(`[DEEP] ${upcomingGames.length} games within 4 hours`)

  // Step 3: Analyze each game
  for (const game of upcomingGames) {
    console.log(`\n[DEEP] Analyzing: ${game.awayTeam} @ ${game.homeTeam} (${game.hoursUntilStart}h)`)

    const picks = await getPicksForGame(game.id, eligibleCappers)

    if (picks.length < 2) {
      console.log(`[DEEP] Only ${picks.length} picks from eligible cappers, skipping`)
      continue
    }

    console.log(`[DEEP] Found ${picks.length} picks with factor data`)

    // Analyze TOTAL consensus
    const totalConsensus = analyzeConsensus(picks, 'total')
    for (const group of totalConsensus) {
      if (await hasExistingPick(game.id, 'total')) {
        console.log(`[DEEP] Already have TOTAL pick for this game`)
        continue
      }

      const decision = calculateDeepUnits(group)

      if (decision.shouldGenerate) {
        const selection = formatSelection(group)
        const result: DeepResult = {
          gameId: game.id,
          pickType: 'total',
          selection,
          units: decision.calculatedUnits,
          confidence: decision.calculatedConfidence,
          contributingCappers: decision.contributingCappers.map(c => c.name),
          reasoning: `DEEP consensus: ${decision.reason}`,
          factorConfluence: decision.factorConfluence,
          counterThesis: decision.counterThesis
        }

        const tierInput: DeepTierInput = {
          contributingCappers: decision.contributingCappers,
          consensusUnits: decision.calculatedUnits,
          betType: 'total',
          factorConfluence: decision.factorConfluence,
          counterThesis: decision.counterThesis
        }
        const tierGrade = await buildDeepTierSnapshot(tierInput)

        const gameSnapshot = {
          home_team: game.homeTeamFull,
          away_team: game.awayTeamFull,
          game_start_timestamp: game.gameTime,
          tier_grade: tierGrade
        }

        const insightCardSnapshot = {
          factorConfluence: decision.factorConfluence,
          counterThesis: decision.counterThesis,
          contributingCappers: decision.contributingCappers,
          tierWeightedScore: decision.tierWeightedScore
        }

        const inserted = await insertPick(game.id, result, gameSnapshot, insightCardSnapshot)
        if (inserted) picksGenerated.push(result)
      } else {
        console.log(`[DEEP] TOTAL: ${decision.reason}`)
      }
    }

    // Analyze SPREAD consensus
    const spreadConsensus = analyzeConsensus(picks, 'spread')
    for (const group of spreadConsensus) {
      if (await hasExistingPick(game.id, 'spread')) {
        console.log(`[DEEP] Already have SPREAD pick for this game`)
        continue
      }

      const decision = calculateDeepUnits(group)

      if (decision.shouldGenerate) {
        const selection = formatSelection(group, { homeTeam: game.homeTeam, awayTeam: game.awayTeam })
        const result: DeepResult = {
          gameId: game.id,
          pickType: 'spread',
          selection,
          units: decision.calculatedUnits,
          confidence: decision.calculatedConfidence,
          contributingCappers: decision.contributingCappers.map(c => c.name),
          reasoning: `DEEP consensus: ${decision.reason}`,
          factorConfluence: decision.factorConfluence,
          counterThesis: decision.counterThesis
        }

        const tierInput: DeepTierInput = {
          contributingCappers: decision.contributingCappers,
          consensusUnits: decision.calculatedUnits,
          betType: 'spread',
          factorConfluence: decision.factorConfluence,
          counterThesis: decision.counterThesis
        }
        const tierGrade = await buildDeepTierSnapshot(tierInput)

        const gameSnapshot = {
          home_team: game.homeTeamFull,
          away_team: game.awayTeamFull,
          game_start_timestamp: game.gameTime,
          tier_grade: tierGrade
        }

        const insightCardSnapshot = {
          factorConfluence: decision.factorConfluence,
          counterThesis: decision.counterThesis,
          contributingCappers: decision.contributingCappers,
          tierWeightedScore: decision.tierWeightedScore
        }

        const inserted = await insertPick(game.id, result, gameSnapshot, insightCardSnapshot)
        if (inserted) picksGenerated.push(result)
      } else {
        console.log(`[DEEP] SPREAD: ${decision.reason}`)
      }
    }
  }

  console.log(`\n[DEEP] 🧠 Complete: ${picksGenerated.length} picks generated`)

  return {
    success: true,
    gamesAnalyzed: upcomingGames.length,
    picksGenerated,
    errors
  }
}

