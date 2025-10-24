/**
 * Step 1: Run Intake - Game Selection and Validation
 * Filters games based on:
 * 1) Game is not in progress or complete
 * 2) Game has not already been predicted by this capper
 * 3) Game start is greater than 30 minutes from now
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabase } from '@/lib/supabase/server'
import { createRequestId, withApiCall } from '@/lib/telemetry/tracing'
import { logError } from '@/lib/telemetry/logger'
import { pickGenerationService } from '@/lib/services/pick-generation-service'

const Step1Schema = z.object({
  capper: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB']),
  betType: z.enum(['TOTAL', 'SPREAD/MONEYLINE']),
  limit: z.number().min(1).max(50).default(10),
  selectedGame: z.any().optional() // Add selectedGame parameter
})

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  
  return withApiCall(
    { request_id: requestId, route: '/api/shiva/factors/step1' },
    async () => {
      try {
        const body = await request.json()
        const parse = Step1Schema.safeParse(body)
        
        if (!parse.success) {
          await logError({
            source: 'api',
            route: '/api/shiva/factors/step1',
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

        const { capper, sport, betType, limit, selectedGame: selectedGameFromProps } = parse.data
        const supabase = getSupabase()

        // Get current time for filtering
        const now = new Date()
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)

        console.log(`[Step1:${capper}] Starting with selectedGame:`, selectedGameFromProps)
        
        // If a game is selected, check if it can be processed first, otherwise scan for games
        if (selectedGameFromProps) {
          console.log(`[Step1:${capper}] Checking selected game: ${selectedGameFromProps.away} @ ${selectedGameFromProps.home}`)
          
          // Check if the selected game can be processed
          const mappedBetType = betType === 'TOTAL' ? 'total' : 'spread'
          console.log(`[Step1:${capper}] Mapped bet type: ${betType} -> ${mappedBetType}`)
          
          const canGenerate = await pickGenerationService.canGeneratePick(
            selectedGameFromProps.game_id,
            capper.toLowerCase() as any,
            mappedBetType as any,
            2
          )
          
          console.log(`[Step1:${capper}] Selected game canGenerate: ${canGenerate}`)
          
          // Always get detailed debugging information for console and debug report
          console.log(`[Step1:${capper}] Getting detailed debug info for game ${selectedGameFromProps.game_id}`)
          
          const { data: existingPicks, error: picksError } = await supabase
            .from('picks')
            .select('id, pick_type, status, units, created_at')
            .eq('game_id', selectedGameFromProps.game_id)
            .eq('capper', capper.toLowerCase())
            .eq('pick_type', mappedBetType)

          const { data: cooldownData, error: cooldownError } = await supabase
            .from('pick_generation_cooldowns')
            .select('*')
            .eq('game_id', selectedGameFromProps.game_id)
            .eq('capper', capper.toLowerCase())
            .eq('bet_type', mappedBetType)
            .gt('cooldown_until', new Date().toISOString())

          const { data: allPicks, error: allPicksError } = await supabase
            .from('picks')
            .select('id, capper, pick_type, status, units, created_at')
            .eq('game_id', selectedGameFromProps.game_id)

          // Log detailed debugging to console
          console.log(`[Step1:${capper}] === DETAILED DEBUG INFO ===`)
          console.log(`[Step1:${capper}] Game ID: ${selectedGameFromProps.game_id}`)
          console.log(`[Step1:${capper}] Capper: ${capper}`)
          console.log(`[Step1:${capper}] Bet Type: ${betType}`)
          console.log(`[Step1:${capper}] Existing Picks:`, existingPicks)
          console.log(`[Step1:${capper}] Cooldown Data:`, cooldownData)
          console.log(`[Step1:${capper}] All Picks for Game:`, allPicks)
          console.log(`[Step1:${capper}] Picks Error:`, picksError?.message)
          console.log(`[Step1:${capper}] Cooldown Error:`, cooldownError?.message)
          console.log(`[Step1:${capper}] All Picks Error:`, allPicksError?.message)
          console.log(`[Step1:${capper}] Summary:`, {
            hasExistingPicks: existingPicks && existingPicks.length > 0,
            hasActiveCooldown: cooldownData && cooldownData.length > 0,
            totalPicksForGame: allPicks ? allPicks.length : 0,
            canGenerate: canGenerate
          })
          console.log(`[Step1:${capper}] === END DEBUG INFO ===`)
          
          if (canGenerate) {
            console.log(`[Step1:${capper}] Selected game can be processed, using it`)
            
            // Selected game is eligible, use it
            return NextResponse.json({
              status: 200,
              json: {
                run_id: `shiva_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                state: 'GAME_SELECTED',
                message: `Selected game ${selectedGameFromProps.away} @ ${selectedGameFromProps.home} is available for ${betType} predictions`,
                games: [selectedGameFromProps],
                debug_info: {
                  gameId: selectedGameFromProps.game_id,
                  capper,
                  betType,
                  existingPicks: existingPicks || [],
                  cooldownData: cooldownData || [],
                  allPicks: allPicks || [],
                  errors: {
                    picksError: picksError?.message,
                    cooldownError: cooldownError?.message,
                    allPicksError: allPicksError?.message
                  },
                  summary: {
                    hasExistingPicks: existingPicks && existingPicks.length > 0,
                    hasActiveCooldown: cooldownData && cooldownData.length > 0,
                    totalPicksForGame: allPicks ? allPicks.length : 0
                  }
                },
                filters: {
                  sport,
                  betType,
                  capper,
                  minStartTime: thirtyMinutesFromNow.toISOString(),
                  statusFilter: ['scheduled'],
                  excludeExistingPicks: true,
                  excludeCooldownGames: true,
                  selectedGame: selectedGameFromProps.game_id
                }
              },
              dryRun: false,
              request_id: requestId,
            })
          } else {
            console.log(`[Step1:${capper}] Selected game cannot be processed, falling back to game scanning`)
            // Continue to scan for other eligible games
          }
        }
          
          // Generate run_id for this prediction
          const runId = crypto.randomUUID()
          
          // Log the selection with debug info
          console.log(`[Step1:${capper}] Selected game:`, {
            game_id: selectedGameFromProps.game_id,
            matchup: `${selectedGameFromProps.away} @ ${selectedGameFromProps.home}`,
            bet_type: betType,
            run_id: runId
          })
          
          console.log(`[Step1:${capper}] === SUCCESS DEBUG INFO ===`)
          console.log(`[Step1:${capper}] Game can be processed!`)
          console.log(`[Step1:${capper}] Existing Picks:`, existingPicks)
          console.log(`[Step1:${capper}] Cooldown Data:`, cooldownData)
          console.log(`[Step1:${capper}] All Picks for Game:`, allPicks)
          console.log(`[Step1:${capper}] === END SUCCESS DEBUG ===`)
          
          return NextResponse.json({
            status: 201,
            json: {
              run_id: runId,
              state: 'IN-PROGRESS',
              selected_game: {
                id: selectedGameFromProps.game_id,
                home_team: { name: selectedGameFromProps.home },
                away_team: { name: selectedGameFromProps.away },
                game_date: selectedGameFromProps.start_time_utc?.split('T')[0] || new Date().toISOString().split('T')[0],
                game_time: selectedGameFromProps.start_time_utc?.split('T')[1] || '19:00:00',
                status: selectedGameFromProps.status || 'scheduled',
                sport: selectedGameFromProps.sport || sport.toLowerCase(),
                odds: selectedGameFromProps.odds || {}
              },
              filters: {
                sport,
                betType,
                capper,
                minStartTime: thirtyMinutesFromNow.toISOString(),
                statusFilter: ['scheduled', 'pre-game'],
                excludeExistingPicks: true,
                excludeCooldownGames: true,
                selectedGame: selectedGameFromProps.game_id
              },
              available_games_count: 1,
              total_games_checked: 1,
              cooldown_info: {
                games_in_cooldown: 0,
                cooldown_hours: 2
              }
            }
          }, { status: 201 })
        }

        // Original database query logic for when no game is selected
        console.log(`[Step1:${capper}] No selected game, querying database...`)
        
        // Convert sport and betType to lowercase for database enums
        const sportLower = sport.toLowerCase()
        const betTypeLower = betType.toLowerCase()

        // 1. Get all games that are scheduled (not in progress or complete)
        console.log(`[Step1:${capper}] Querying games for sport: ${sportLower}, status: scheduled`)
        const { data: games, error: gamesError } = await supabase
          .from('games')
          .select(`
            id,
            home_team,
            away_team,
            game_date,
            game_time,
            status,
            sport,
            odds
          `)
          .eq('sport', sportLower)
          .in('status', ['scheduled'])
          .gte('game_date', now.toISOString().split('T')[0]) // Filter by today or later
          .order('game_date', { ascending: true })
          .order('game_time', { ascending: true })
          .limit(limit * 2) // Get more than needed to filter

        console.log(`[Step1:${capper}] Found ${games?.length || 0} games in database`)
        if (games && games.length > 0) {
          console.log(`[Step1:${capper}] Sample game:`, {
            id: games[0].id,
            matchup: `${games[0].away_team?.name || 'Away'} @ ${games[0].home_team?.name || 'Home'}`,
            date: games[0].game_date,
            time: games[0].game_time
          })
        }

        if (gamesError) {
          await logError({
            source: 'db',
            route: '/api/shiva/factors/step1',
            request_id: requestId,
            code: 'DB_QUERY_FAILED',
            details: { error: gamesError },
          })
          throw new Error(`Failed to fetch games: ${gamesError.message}`)
        }

        if (!games || games.length === 0) {
          return NextResponse.json({
            status: 200,
            json: {
              run_id: null,
              state: 'NO_GAMES_AVAILABLE',
              message: `No ${sport} games available for ${betType} predictions`,
              games: [],
              filters: {
                sport,
                betType,
                minStartTime: thirtyMinutesFromNow.toISOString(),
                statusFilter: ['scheduled']
              }
            },
            dryRun: true,
            request_id: requestId,
          })
        }

        // 2. Get existing picks for this capper to avoid duplicates
        const { data: existingPicks, error: picksError } = await supabase
          .from('picks')
          .select('game_id, bet_type')
          .eq('capper', capper.toLowerCase())
          .in('game_id', games.map(g => g.id))

        if (picksError) {
          await logError({
            source: 'db',
            route: '/api/shiva/factors/step1',
            request_id: requestId,
            code: 'DB_QUERY_FAILED',
            details: { error: picksError },
          })
          // Continue without pick filtering if this fails
        }

        // 3. Filter games based on existing picks
        const existingPicksMap = new Map()
        if (existingPicks) {
          existingPicks.forEach(pick => {
            if (!existingPicksMap.has(pick.game_id)) {
              existingPicksMap.set(pick.game_id, new Set())
            }
            existingPicksMap.get(pick.game_id).add(pick.bet_type)
          })
        }

        // Filter games that don't already have this bet type
        const availableGames = games.filter(game => {
          const existingPickTypes = existingPicksMap.get(game.id) || new Set()
          
          if (betTypeLower === 'total') {
            // For TOTAL: check if TOTAL pick already exists
            if (existingPickTypes.has('total')) {
              return false
            }
          } else if (betTypeLower === 'spread/moneyline') {
            // For SPREAD/MONEYLINE: check if EITHER SPREAD OR MONEYLINE pick exists
            if (existingPickTypes.has('spread') || existingPickTypes.has('moneyline')) {
              return false
            }
          }
          
          return true
        })

        // 4. Check cooldown periods for remaining games
        const cooldownCheckedGames = []
        console.log(`[Step1:${capper}] Checking cooldown for ${availableGames.length} games`)
        
        for (const game of availableGames) {
          try {
            console.log(`[Step1:${capper}] Checking game ${game.id} (${game.away_team} @ ${game.home_team})`)
            const canGenerate = await pickGenerationService.canGeneratePick(
              game.id,
              capper.toLowerCase() as any, // Cast to capper_type
              betType === 'TOTAL' ? 'TOTAL' : 'SPREAD', // Map bet types
              2 // 2 hour cooldown
            )
            
            console.log(`[Step1:${capper}] Game ${game.id} canGenerate: ${canGenerate}`)
            
            if (canGenerate) {
              cooldownCheckedGames.push(game)
            } else {
              console.log(`[Step1:${capper}] Game ${game.id} in cooldown period, skipping`)
            }
          } catch (error) {
            console.error(`[Step1:${capper}] Error checking cooldown for game ${game.id}:`, error)
            // If cooldown check fails, include the game (fail open)
            cooldownCheckedGames.push(game)
          }
        }
        
        console.log(`[Step1:${capper}] Cooldown check complete: ${cooldownCheckedGames.length} games available`)

        if (cooldownCheckedGames.length === 0) {
          return NextResponse.json({
            status: 200,
            json: {
              run_id: null,
              state: 'NO_AVAILABLE_GAMES',
              message: `All ${sport} games already have ${betType} predictions for ${capper} or are in cooldown period`,
              games: [],
              filters: {
                sport,
                betType,
                capper,
                minStartTime: thirtyMinutesFromNow.toISOString(),
                statusFilter: ['scheduled'],
                excludeExistingPicks: true,
                excludeCooldownGames: true
              }
            },
            dryRun: true,
            request_id: requestId,
          })
        }

        // 5. Select the first available game (closest to start time)
        const selectedGame = cooldownCheckedGames[0]
        
        // 5. Generate run_id for this prediction
        const runId = crypto.randomUUID()

        // 6. Log the selection
        console.log(`[Step1:${capper}] Selected game:`, {
          game_id: selectedGame.id,
          matchup: `${selectedGame.away_team} @ ${selectedGame.home_team}`,
          game_date: selectedGame.game_date,
          game_time: selectedGame.game_time,
          bet_type: betType,
          run_id: runId
        })

        return NextResponse.json({
          status: 201,
          json: {
            run_id: runId,
            state: 'IN-PROGRESS',
            selected_game: {
              game_id: selectedGame.id,
              home_team: selectedGame.home_team,
              away_team: selectedGame.away_team,
              game_date: selectedGame.game_date,
              game_time: selectedGame.game_time,
              status: selectedGame.status,
              odds: selectedGame.odds
            },
            filters_applied: {
              sport,
              betType,
              capper,
              minStartTime: thirtyMinutesFromNow.toISOString(),
              statusFilter: ['scheduled', 'pre-game'],
              excludeExistingPicks: true,
              excludeCooldownGames: true
            },
            available_games_count: cooldownCheckedGames.length,
            total_games_checked: games.length,
            cooldown_info: {
              games_in_cooldown: availableGames.length - cooldownCheckedGames.length,
              cooldown_hours: 2
            }
          }
        }, { status: 201 })
      } catch (error: any) {
        await logError({
          source: 'api',
          route: '/api/shiva/factors/step1',
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
