import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fetchScoreboard } from '@/lib/data-sources/mysportsfeeds-api'
import { resolveTeamName } from '@/lib/data-sources/team-mappings'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'

/**
 * GAME SCORES SYNC CRON
 * 
 * Runs every 10 minutes to check for completed games and update final scores
 * This triggers automatic pick grading via database trigger
 * 
 * What it does:
 * 1. Fetches today's NBA games scoreboard from MySportsFeeds
 * 2. Identifies games with status 'COMPLETED' or 'COMPLETED_PENDING_REVIEW'
 * 3. Updates games table with final scores and status='final'
 * 4. Database trigger automatically grades all pending picks for completed games
 */

export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🏀 [GAME-SCORES-SYNC] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    const startTime = Date.now()
    const supabase = getSupabaseAdmin()

    // Get today's date in YYYYMMDD format
    const today = new Date()
    const dateStr = formatDateForAPI(today)
    
    console.log(`📅 [GAME-SCORES-SYNC] Fetching scoreboard for date: ${dateStr}`)

    // Fetch scoreboard from MySportsFeeds
    let scoreboardData
    try {
      scoreboardData = await fetchScoreboard(dateStr)
      console.log(`✅ [GAME-SCORES-SYNC] API Response received`)
      console.log(`📊 [GAME-SCORES-SYNC] Games found: ${scoreboardData.games?.length || 0}`)
    } catch (apiError) {
      console.error('❌ [GAME-SCORES-SYNC] MySportsFeeds API error:', apiError)
      return NextResponse.json({
        success: false,
        error: 'MySportsFeeds API error',
        details: apiError instanceof Error ? apiError.message : String(apiError),
        timestamp: executionTime
      }, { status: 500 })
    }

    const games = scoreboardData.games || []
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const game of games) {
      try {
        const gameId = game.schedule?.id?.toString()
        const homeTeamAbbrev = game.schedule?.homeTeam?.abbreviation
        const awayTeamAbbrev = game.schedule?.awayTeam?.abbreviation
        const playedStatus = game.schedule?.playedStatus

        if (!gameId || !homeTeamAbbrev || !awayTeamAbbrev) {
          errors.push(`Skipping game ${gameId} - missing required fields`)
          continue
        }

        // Only process completed games
        if (playedStatus !== 'COMPLETED' && playedStatus !== 'COMPLETED_PENDING_REVIEW') {
          skipped++
          continue
        }

        // Extract final scores
        const homeScore = game.score?.homeScoreTotal
        const awayScore = game.score?.awayScoreTotal

        if (homeScore === undefined || awayScore === undefined) {
          errors.push(`Game ${gameId} is completed but missing scores`)
          continue
        }

        // Resolve team names
        let homeTeamInfo, awayTeamInfo
        try {
          homeTeamInfo = resolveTeamName(homeTeamAbbrev)
          awayTeamInfo = resolveTeamName(awayTeamAbbrev)
        } catch (teamError) {
          errors.push(`Skipping game ${gameId} - ${teamError instanceof Error ? teamError.message : String(teamError)}`)
          continue
        }

        console.log(`🏁 [GAME-SCORES-SYNC] Completed game found: ${awayTeamInfo.full} ${awayScore} @ ${homeTeamInfo.full} ${homeScore}`)

        // Update game in database with final score and status
        // This will trigger the grade_picks_for_game() database trigger
        const { error } = await supabase
          .from('games')
          .update({
            status: 'final',
            final_score: {
              home: homeScore,
              away: awayScore,
              winner: homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie'
            },
            home_score: homeScore,
            away_score: awayScore,
            updated_at: new Date().toISOString()
          })
          .eq('api_event_id', `msf_${gameId}`)

        if (error) {
          errors.push(`Error updating game ${gameId}: ${error.message}`)
        } else {
          updated++
          console.log(`✅ [GAME-SCORES-SYNC] Updated: ${awayTeamInfo.full} ${awayScore} @ ${homeTeamInfo.full} ${homeScore}`)
          
          // Log that picks will be auto-graded by database trigger
          const { data: pendingPicks } = await supabase
            .from('picks')
            .select('id, capper, selection')
            .eq('game_id', (await supabase
              .from('games')
              .select('id')
              .eq('api_event_id', `msf_${gameId}`)
              .single()).data?.id || '')
            .eq('status', 'pending')

          if (pendingPicks && pendingPicks.length > 0) {
            console.log(`🎯 [GAME-SCORES-SYNC] Auto-grading ${pendingPicks.length} pending pick(s) for this game`)
          }
        }
      } catch (error) {
        errors.push(`Error processing game: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ [GAME-SCORES-SYNC] EXECUTION COMPLETE: ${duration}ms`)
    console.log(`📊 [GAME-SCORES-SYNC] Updated: ${updated}, Skipped (not final): ${skipped}`)
    if (errors.length > 0) {
      console.log(`⚠️ [GAME-SCORES-SYNC] Errors: ${errors.length}`)
    }
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      message: `Game scores sync completed`,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [GAME-SCORES-SYNC] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST() {
  return GET()
}

