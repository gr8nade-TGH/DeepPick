/**
 * SHIVA Step 1: Game Scanner
 * 
 * This is a clean, fresh implementation specifically for SHIVA pick generation.
 * It scans for eligible games and returns the first available game for processing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabase } from '@/lib/supabase/server'
import { createRequestId, withApiCall } from '@/lib/telemetry/tracing'
import { logError } from '@/lib/telemetry/logger'

const ScannerSchema = z.object({
  sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
  betType: z.enum(['TOTAL', 'SPREAD/MONEYLINE']).default('TOTAL'),
  limit: z.number().min(1).max(50).default(10),
  selectedGame: z.any().optional() // Optional selected game to check first
})

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  
  return withApiCall(
    { request_id: requestId, route: '/api/shiva/step1-scanner' },
    async () => {
      try {
        const body = await request.json()
        const parse = ScannerSchema.safeParse(body)
        
        if (!parse.success) {
          await logError({
            source: 'api',
            route: '/api/shiva/step1-scanner',
            request_id: requestId,
            code: 'VALIDATION_FAILED',
            details: { errors: parse.error.issues, body },
          })
          
          return NextResponse.json({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Invalid request body',
              details: parse.error.issues,
            },
            request_id: requestId,
          }, { status: 400 })
        }

        const { sport, betType, limit, selectedGame } = parse.data
        const supabase = getSupabase()
        
        console.log(`[SHIVA_SCANNER] Starting scan for ${sport} ${betType} games`)
        console.log(`[SHIVA_SCANNER] Selected game:`, selectedGame)

        // If a specific game is selected, check if it's eligible first
        if (selectedGame) {
          console.log(`[SHIVA_SCANNER] Checking selected game: ${selectedGame.away} @ ${selectedGame.home}`)
          
          // Check if this game can be processed
          const canProcess = await checkGameEligibility(selectedGame, sport, betType, supabase)
          
          if (canProcess) {
            console.log(`[SHIVA_SCANNER] Selected game is eligible, using it`)
            return NextResponse.json({
              success: true,
              run_id: `shiva_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              state: 'GAME_SELECTED',
              message: `Selected game ${selectedGame.away} @ ${selectedGame.home} is available for ${betType} predictions`,
              selected_game: {
                id: selectedGame.game_id,
                home_team: { name: selectedGame.home },
                away_team: { name: selectedGame.away },
                game_time: selectedGame.game_time,
                total_line: selectedGame.total_line,
                spread_line: selectedGame.spread_line
              },
              filters: {
                sport,
                betType,
                capper: 'SHIVA',
                selectedGame: selectedGame.game_id
              }
            })
          } else {
            console.log(`[SHIVA_SCANNER] Selected game is not eligible, falling back to scanning`)
          }
        }

        // Scan for eligible games
        console.log(`[SHIVA_SCANNER] Scanning for eligible ${sport} ${betType} games`)
        
        const eligibleGames = await scanForEligibleGames(sport, betType, limit, supabase)
        
        if (eligibleGames.length === 0) {
          console.log(`[SHIVA_SCANNER] No eligible games found`)
          return NextResponse.json({
            success: false,
            state: 'NO_AVAILABLE_GAMES',
            message: `No ${sport} games available for ${betType} predictions`,
            games: [],
            filters: {
              sport,
              betType,
              capper: 'SHIVA'
            }
          })
        }

        // Select the first eligible game
        const selectedGame = eligibleGames[0]
        console.log(`[SHIVA_SCANNER] Selected game: ${selectedGame.away_team} @ ${selectedGame.home_team}`)

        return NextResponse.json({
          success: true,
          run_id: `shiva_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          state: 'GAME_SELECTED',
          message: `Selected game ${selectedGame.away_team} @ ${selectedGame.home_team} for ${betType} predictions`,
          selected_game: {
            id: selectedGame.id,
            home_team: { name: selectedGame.home_team },
            away_team: { name: selectedGame.away_team },
            game_time: selectedGame.game_time,
            total_line: selectedGame.total_line,
            spread_line: selectedGame.spread_line
          },
          filters: {
            sport,
            betType,
            capper: 'SHIVA'
          },
          available_games_count: eligibleGames.length
        })

      } catch (error: any) {
        await logError({
          source: 'api',
          route: '/api/shiva/step1-scanner',
          request_id: requestId,
          code: 'UNHANDLED_ERROR',
          details: { message: error.message, stack: error.stack },
        })
        
        return NextResponse.json({
          error: {
            code: 'UNHANDLED_ERROR',
            message: 'An unexpected error occurred',
            details: error.message,
          },
          request_id: requestId,
        }, { status: 500 })
      }
    }
  )
}

/**
 * Check if a specific game is eligible for pick generation
 */
async function checkGameEligibility(
  game: any, 
  sport: string, 
  betType: string, 
  supabase: any
): Promise<boolean> {
  try {
    const sportLower = sport.toLowerCase()
    const betTypeLower = betType === 'TOTAL' ? 'total' : 'spread'
    
    // Check if game exists and is scheduled
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('id, status, game_time')
      .eq('id', game.game_id)
      .eq('sport', sportLower)
      .eq('status', 'scheduled')
      .single()

    if (gameError || !gameData) {
      console.log(`[SHIVA_SCANNER] Game not found or not scheduled:`, gameError?.message)
      return false
    }

    // Check if game is in the future (at least 30 minutes from now)
    const now = new Date()
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)
    const gameTime = new Date(gameData.game_time)
    
    if (gameTime <= thirtyMinutesFromNow) {
      console.log(`[SHIVA_SCANNER] Game is too soon: ${gameTime.toISOString()}`)
      return false
    }

    // Check if there are existing picks for this game/bet type
    const { data: existingPicks, error: picksError } = await supabase
      .from('picks')
      .select('id, pick_type, status')
      .eq('game_id', game.game_id)
      .eq('capper', 'shiva')
      .eq('pick_type', betTypeLower)
      .in('status', ['pending', 'won', 'lost', 'push'])

    if (picksError) {
      console.log(`[SHIVA_SCANNER] Error checking existing picks:`, picksError.message)
      return false
    }

    if (existingPicks && existingPicks.length > 0) {
      console.log(`[SHIVA_SCANNER] Game already has ${betType} picks:`, existingPicks.length)
      return false
    }

    // Check cooldown period
    const { data: cooldownData, error: cooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .select('cooldown_until')
      .eq('game_id', game.game_id)
      .eq('capper', 'shiva')
      .eq('bet_type', betTypeLower)
      .gt('cooldown_until', new Date().toISOString())
      .single()

    if (cooldownError && cooldownError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.log(`[SHIVA_SCANNER] Error checking cooldown:`, cooldownError.message)
      return false
    }

    if (cooldownData) {
      console.log(`[SHIVA_SCANNER] Game is in cooldown until:`, cooldownData.cooldown_until)
      return false
    }

    console.log(`[SHIVA_SCANNER] Game is eligible for processing`)
    return true

  } catch (error) {
    console.error(`[SHIVA_SCANNER] Error checking game eligibility:`, error)
    return false
  }
}

/**
 * Scan for eligible games
 */
async function scanForEligibleGames(
  sport: string, 
  betType: string, 
  limit: number, 
  supabase: any
): Promise<any[]> {
  try {
    const sportLower = sport.toLowerCase()
    const betTypeLower = betType === 'TOTAL' ? 'total' : 'spread'
    
    // Get games that are scheduled and in the future
    const now = new Date()
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        home_team,
        away_team,
        game_date,
        game_time,
        total_line,
        spread_line,
        status
      `)
      .eq('sport', sportLower)
      .eq('status', 'scheduled')
      .gte('game_time', thirtyMinutesFromNow.toISOString())
      .order('game_time', { ascending: true })
      .limit(limit * 2) // Get more games to filter from

    if (gamesError) {
      console.error(`[SHIVA_SCANNER] Error fetching games:`, gamesError)
      return []
    }

    if (!games || games.length === 0) {
      console.log(`[SHIVA_SCANNER] No games found`)
      return []
    }

    console.log(`[SHIVA_SCANNER] Found ${games.length} potential games`)

    // Filter out games that already have picks
    const gameIds = games.map(game => game.id)
    
    const { data: existingPicks, error: picksError } = await supabase
      .from('picks')
      .select('game_id, pick_type, status')
      .in('game_id', gameIds)
      .eq('capper', 'shiva')
      .eq('pick_type', betTypeLower)
      .in('status', ['pending', 'won', 'lost', 'push'])

    if (picksError) {
      console.error(`[SHIVA_SCANNER] Error fetching existing picks:`, picksError)
      return []
    }

    // Create a set of game IDs that already have picks
    const gamesWithPicks = new Set()
    if (existingPicks) {
      existingPicks.forEach(pick => {
        gamesWithPicks.add(pick.game_id)
      })
    }

    // Filter out games with existing picks
    const availableGames = games.filter(game => !gamesWithPicks.has(game.id))
    console.log(`[SHIVA_SCANNER] After filtering existing picks: ${availableGames.length} games`)

    if (availableGames.length === 0) {
      console.log(`[SHIVA_SCANNER] No games available after filtering existing picks`)
      return []
    }

    // Check cooldown periods for remaining games
    const { data: cooldownData, error: cooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .select('game_id, cooldown_until')
      .in('game_id', availableGames.map(g => g.id))
      .eq('capper', 'shiva')
      .eq('bet_type', betTypeLower)
      .gt('cooldown_until', new Date().toISOString())

    if (cooldownError) {
      console.error(`[SHIVA_SCANNER] Error fetching cooldown data:`, cooldownError)
      return []
    }

    // Create a set of game IDs in cooldown
    const gamesInCooldown = new Set()
    if (cooldownData) {
      cooldownData.forEach(cooldown => {
        gamesInCooldown.add(cooldown.game_id)
      })
    }

    // Filter out games in cooldown
    const finalGames = availableGames.filter(game => !gamesInCooldown.has(game.id))
    console.log(`[SHIVA_SCANNER] After filtering cooldown: ${finalGames.length} games`)

    return finalGames.slice(0, limit) // Return up to the requested limit

  } catch (error) {
    console.error(`[SHIVA_SCANNER] Error scanning for eligible games:`, error)
    return []
  }
}
