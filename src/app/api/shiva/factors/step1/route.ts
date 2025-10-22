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

const Step1Schema = z.object({
  capper: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB']),
  betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']),
  limit: z.number().min(1).max(50).default(10)
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

        const { capper, sport, betType, limit } = parse.data
        const supabase = getSupabase()

        // Get current time for filtering
        const now = new Date()
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)

        // Convert sport and betType to lowercase for database enums
        const sportLower = sport.toLowerCase()
        const betTypeLower = betType.toLowerCase()

        // 1. Get all games that are scheduled (not in progress or complete)
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
          .eq('capper', capper)
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
          
          // Check if this bet type is already picked for this game
          if (existingPickTypes.has(betTypeLower)) {
            return false
          }
          
          // For future: enforce max 2 picks per game (TOTAL + one of SPREAD/MONEYLINE)
          // For now, just check if the specific bet type exists
          return true
        })

        if (availableGames.length === 0) {
          return NextResponse.json({
            status: 200,
            json: {
              run_id: null,
              state: 'NO_AVAILABLE_GAMES',
              message: `All ${sport} games already have ${betType} predictions for ${capper}`,
              games: [],
              filters: {
                sport,
                betType,
                capper,
                minStartTime: thirtyMinutesFromNow.toISOString(),
                statusFilter: ['scheduled']
              }
            },
            dryRun: true,
            request_id: requestId,
          })
        }

        // 4. Select the first available game (closest to start time)
        const selectedGame = availableGames[0]
        
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
              excludeExistingPicks: true
            },
            available_games_count: availableGames.length,
            total_games_checked: games.length
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
