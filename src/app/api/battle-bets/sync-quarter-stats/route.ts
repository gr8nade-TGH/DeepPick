import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull/nba'

/**
 * Calculate Base64 encoded Basic Auth credentials for MySportsFeeds API v2.x
 */
function getAuthHeader(): string | null {
  if (!MYSPORTSFEEDS_API_KEY) {
    console.warn('[MySportsFeeds] MYSPORTSFEEDS_API_KEY environment variable not set')
    return null
  }

  // v2.x uses "MYSPORTSFEEDS" as the password
  const credentials = `${MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`
  const encoded = Buffer.from(credentials).toString('base64')

  return `Basic ${encoded}`
}

/**
 * Estimate quarter end times based on game start time
 * NBA quarters are ~12 minutes of game time, but with timeouts/breaks they take longer
 * 
 * Estimates:
 * - Q1 ends: ~18 minutes after start
 * - Q2 ends (Halftime): ~36 minutes after start
 * - Q3 ends: ~54 minutes after start
 * - Q4 ends: ~72 minutes after start (2 hours 12 minutes)
 */
function estimateQuarterEndTime(gameStartTime: Date, quarter: number): Date {
  const minutesPerQuarter = 18 // Real-time minutes per quarter (including breaks)
  const estimatedMinutes = quarter * minutesPerQuarter

  const endTime = new Date(gameStartTime)
  endTime.setMinutes(endTime.getMinutes() + estimatedMinutes)

  return endTime
}

/**
 * Check if a quarter should be complete based on estimated time
 */
function isQuarterLikelyComplete(gameStartTime: Date, quarter: number): boolean {
  const now = new Date()
  const estimatedEndTime = estimateQuarterEndTime(gameStartTime, quarter)

  // Add 5-minute buffer to ensure quarter is actually complete
  estimatedEndTime.setMinutes(estimatedEndTime.getMinutes() + 5)

  return now >= estimatedEndTime
}

/**
 * Fetch boxscore from MySportsFeeds DETAILED API
 */
async function fetchBoxscore(gameId: string): Promise<any> {
  const authHeader = getAuthHeader()
  if (!authHeader) {
    throw new Error('MYSPORTSFEEDS_API_KEY not configured')
  }

  const url = `${MYSPORTSFEEDS_BASE_URL}/current/games/${gameId}/boxscore.json`
  console.log('[Quarter Stats Sync] Fetching boxscore:', url)

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MySportsFeeds API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

/**
 * Extract quarter stats from boxscore data
 * 
 * Returns stats for a specific quarter including:
 * - Team scores for the quarter
 * - Player stats (PTS, REB, AST, BLK, 3PT) for the quarter
 */
function extractQuarterStats(boxscore: any, quarter: number, leftTeam: string, rightTeam: string): any {
  const periodSummary = boxscore.periodSummary
  if (!periodSummary || !periodSummary.period) {
    throw new Error('No period summary in boxscore')
  }

  // Find the period for this quarter
  const period = periodSummary.period.find((p: any) => p['@number'] === quarter)
  if (!period) {
    throw new Error(`Quarter ${quarter} not found in boxscore`)
  }

  // Determine which team is home/away
  const awayTeamAbbrev = boxscore.game?.awayTeam?.abbreviation
  const homeTeamAbbrev = boxscore.game?.homeTeam?.abbreviation

  const leftIsHome = leftTeam === homeTeamAbbrev
  const rightIsHome = rightTeam === homeTeamAbbrev

  // Extract team scores for this quarter
  const leftScore = leftIsHome ? period.homeScore : period.awayScore
  const rightScore = rightIsHome ? period.homeScore : period.awayScore

  // Extract player stats for this quarter
  // Note: MySportsFeeds boxscore provides cumulative stats, not per-quarter
  // We'll need to calculate quarter stats by subtracting previous quarter totals
  // For now, we'll store the cumulative stats and calculate deltas later

  const awayPlayers = boxscore.awayTeam?.awayPlayers?.playerEntry || []
  const homePlayers = boxscore.homeTeam?.homePlayers?.playerEntry || []

  const leftPlayers = leftIsHome ? homePlayers : awayPlayers
  const rightPlayers = rightIsHome ? homePlayers : awayPlayers

  // Extract relevant stats for each player
  const extractPlayerStats = (players: any[]) => {
    return players.map((entry: any) => ({
      name: entry.player?.lastName || 'Unknown',
      points: entry.stats?.fieldGoals?.['2PtMade'] * 2 + entry.stats?.fieldGoals?.['3PtMade'] * 3 + entry.stats?.freeThrows?.ftMade || 0,
      rebounds: entry.stats?.rebounds?.reb || 0,
      assists: entry.stats?.offense?.ast || 0,
      blocks: entry.stats?.defense?.blk || 0,
      threePointers: entry.stats?.fieldGoals?.['3PtMade'] || 0
    }))
  }

  return {
    quarter,
    leftScore,
    rightScore,
    leftPlayers: extractPlayerStats(leftPlayers),
    rightPlayers: extractPlayerStats(rightPlayers),
    timestamp: new Date().toISOString()
  }
}

/**
 * Sync quarter stats for all active battle matchups
 * 
 * This endpoint:
 * 1. Finds all battle matchups that are in progress
 * 2. Estimates which quarters should be complete based on game start time
 * 3. Fetches boxscore data from MySportsFeeds
 * 4. Extracts quarter stats and updates the battle_matchups table
 * 5. Triggers quarter simulation if stats are available
 * 
 * Should be called every 10 minutes via cron job
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Quarter Stats Sync] Starting sync...')

    const supabase = getSupabaseAdmin()

    // Find all battle matchups that are in progress (not complete)
    const { data: battles, error: battlesError } = await supabase
      .from('battle_matchups')
      .select('*')
      .neq('status', 'complete')
      .order('created_at', { ascending: false })

    if (battlesError) {
      console.error('[Quarter Stats Sync] Error fetching battles:', battlesError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${battlesError.message}`
      }, { status: 500 })
    }

    if (!battles || battles.length === 0) {
      console.log('[Quarter Stats Sync] No active battles found')
      return NextResponse.json({
        success: true,
        message: 'No active battles to sync',
        battlesProcessed: 0
      })
    }

    console.log(`[Quarter Stats Sync] Found ${battles.length} active battles`)

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const battle of battles) {
      try {
        // Get game info
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', battle.game_id)
          .single()

        if (gameError || !game) {
          console.error(`[Quarter Stats Sync] Game not found for battle ${battle.id}`)
          errorCount++
          continue
        }

        // Construct MySportsFeeds game ID: YYYYMMDD-AWAY-HOME
        const gameDate = game.game_date.replace(/-/g, '')
        const awayAbbrev = game.away_team.abbreviation
        const homeAbbrev = game.home_team.abbreviation
        const gameId = `${gameDate}-${awayAbbrev}-${homeAbbrev}`

        // Determine game start time
        const gameStartTime = game.game_start_timestamp
          ? new Date(game.game_start_timestamp)
          : new Date(`${game.game_date}T${game.game_time}Z`)

        // Check which quarters should be complete
        const quartersToCheck = []
        if (!battle.q1_complete && isQuarterLikelyComplete(gameStartTime, 1)) {
          quartersToCheck.push(1)
        }
        if (!battle.q2_complete && isQuarterLikelyComplete(gameStartTime, 2)) {
          quartersToCheck.push(2)
        }
        if (!battle.q3_complete && isQuarterLikelyComplete(gameStartTime, 3)) {
          quartersToCheck.push(3)
        }
        if (!battle.q4_complete && isQuarterLikelyComplete(gameStartTime, 4)) {
          quartersToCheck.push(4)
        }

        if (quartersToCheck.length === 0) {
          console.log(`[Quarter Stats Sync] No quarters ready for battle ${battle.id}`)
          continue
        }

        console.log(`[Quarter Stats Sync] Checking quarters ${quartersToCheck.join(', ')} for battle ${battle.id}`)

        // Fetch boxscore
        const boxscore = await fetchBoxscore(gameId)

        // Process each quarter
        for (const quarter of quartersToCheck) {
          try {
            const quarterStats = extractQuarterStats(boxscore, quarter, battle.left_team, battle.right_team)

            // Update battle with quarter stats
            const updateData: any = {}
            updateData[`q${quarter}_stats`] = quarterStats
            updateData[`q${quarter}_complete`] = true
            updateData[`q${quarter}_end_time`] = new Date().toISOString()
            updateData.current_quarter = quarter

            const { error: updateError } = await supabase
              .from('battle_matchups')
              .update(updateData)
              .eq('id', battle.id)

            if (updateError) {
              console.error(`[Quarter Stats Sync] Error updating battle ${battle.id} Q${quarter}:`, updateError)
              errorCount++
            } else {
              console.log(`[Quarter Stats Sync] ✅ Updated battle ${battle.id} Q${quarter}`)
              successCount++

              // Auto-trigger quarter simulation
              try {
                console.log(`[Quarter Stats Sync] 🎮 Auto-triggering simulation for Q${quarter}...`)
                const simulateResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/battle-bets/${battle.id}/simulate-quarter`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ quarter })
                })

                if (simulateResponse.ok) {
                  const simulateData = await simulateResponse.json()
                  console.log(`[Quarter Stats Sync] ✅ Simulation complete:`, simulateData)
                } else {
                  console.error(`[Quarter Stats Sync] ❌ Simulation failed:`, await simulateResponse.text())
                }
              } catch (simulateError) {
                console.error(`[Quarter Stats Sync] ❌ Simulation error:`, simulateError)
              }
            }
          } catch (quarterError) {
            console.error(`[Quarter Stats Sync] Error processing Q${quarter} for battle ${battle.id}:`, quarterError)
            errorCount++
          }
        }

        results.push({
          battleId: battle.id,
          gameId,
          quartersProcessed: quartersToCheck.length,
          success: true
        })
      } catch (battleError) {
        console.error(`[Quarter Stats Sync] Error processing battle ${battle.id}:`, battleError)
        results.push({
          battleId: battle.id,
          error: battleError instanceof Error ? battleError.message : String(battleError),
          success: false
        })
        errorCount++
      }
    }

    console.log(`[Quarter Stats Sync] ✅ Complete! Success: ${successCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      success: true,
      battlesProcessed: battles.length,
      successCount,
      errorCount,
      results
    })
  } catch (error) {
    console.error('[Quarter Stats Sync] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

