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
 * 1. Fetches NBA games scoreboard from MySportsFeeds (today + past 2 days)
 * 2. Identifies games with status 'COMPLETED' or 'COMPLETED_PENDING_REVIEW'
 * 3. Updates games table with final scores and status='final'
 * 4. Database trigger automatically grades all pending picks for completed games
 * 5. Handles postponed/cancelled games
 */

export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🏀 [GAME-SCORES-SYNC] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    const startTime = Date.now()
    const supabase = getSupabaseAdmin()

    // Fetch scores for today + past 7 days (to catch late-finishing games and missed updates)
    const datesToCheck: string[] = []
    for (let i = 0; i <= 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      datesToCheck.push(formatDateForAPI(date))
    }

    console.log(`📅 [GAME-SCORES-SYNC] Checking dates: ${datesToCheck.join(', ')}`)

    let totalUpdated = 0
    let totalSkipped = 0
    let totalPostponed = 0
    const allErrors: string[] = []

    // Process each date
    for (const dateStr of datesToCheck) {
      console.log(`\n📅 [GAME-SCORES-SYNC] Processing date: ${dateStr}`)

      // Fetch scoreboard from MySportsFeeds
      let scoreboardData
      try {
        scoreboardData = await fetchScoreboard(dateStr)
        console.log(`✅ [GAME-SCORES-SYNC] API Response received for ${dateStr}`)
        console.log(`📊 [GAME-SCORES-SYNC] Games found: ${scoreboardData.games?.length || 0}`)
      } catch (apiError) {
        console.error(`❌ [GAME-SCORES-SYNC] MySportsFeeds API error for ${dateStr}:`, apiError)
        allErrors.push(`API error for ${dateStr}: ${apiError instanceof Error ? apiError.message : String(apiError)}`)
        continue // Skip this date but continue with others
      }

      const games = scoreboardData.games || []
      let updated = 0
      let skipped = 0
      let postponed = 0

      for (const game of games) {
        try {
          const gameId = game.schedule?.id?.toString()
          const homeTeamAbbrev = game.schedule?.homeTeam?.abbreviation
          const awayTeamAbbrev = game.schedule?.awayTeam?.abbreviation
          const playedStatus = game.schedule?.playedStatus

          if (!gameId || !homeTeamAbbrev || !awayTeamAbbrev) {
            allErrors.push(`Skipping game ${gameId} - missing required fields`)
            continue
          }

          // Handle postponed/cancelled games
          if (playedStatus === 'POSTPONED' || playedStatus === 'CANCELLED') {
            postponed++

            // Update game status in database
            await supabase
              .from('games')
              .update({
                status: playedStatus.toLowerCase(),
                updated_at: new Date().toISOString()
              })
              .eq('api_event_id', `msf_${gameId}`)

            console.log(`⏸️  [GAME-SCORES-SYNC] Game ${gameId} is ${playedStatus}`)
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
            allErrors.push(`Game ${gameId} is completed but missing scores`)
            continue
          }

          // Resolve team names
          let homeTeamInfo, awayTeamInfo
          try {
            homeTeamInfo = resolveTeamName(homeTeamAbbrev)
            awayTeamInfo = resolveTeamName(awayTeamAbbrev)
          } catch (teamError) {
            allErrors.push(`Skipping game ${gameId} - ${teamError instanceof Error ? teamError.message : String(teamError)}`)
            continue
          }

          console.log(`🏁 [GAME-SCORES-SYNC] Completed game found: ${awayTeamInfo.full} ${awayScore} @ ${homeTeamInfo.full} ${homeScore}`)

          // Check if game is already marked as final (avoid duplicate grading)
          const { data: existingGame } = await supabase
            .from('games')
            .select('id, status')
            .eq('api_event_id', `msf_${gameId}`)
            .single()

          if (existingGame?.status === 'final') {
            console.log(`⏭️  [GAME-SCORES-SYNC] Game ${gameId} already graded, skipping`)
            skipped++
            continue
          }

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
            allErrors.push(`Error updating game ${gameId}: ${error.message}`)
          } else {
            updated++
            console.log(`✅ [GAME-SCORES-SYNC] Updated: ${awayTeamInfo.full} ${awayScore} @ ${homeTeamInfo.full} ${homeScore}`)

            // Log that picks will be auto-graded by database trigger
            if (existingGame?.id) {
              const { data: pendingPicks } = await supabase
                .from('picks')
                .select('id, pick_type, selection')
                .eq('game_id', existingGame.id)
                .eq('status', 'pending')

              if (pendingPicks && pendingPicks.length > 0) {
                console.log(`🎯 [GAME-SCORES-SYNC] Auto-grading ${pendingPicks.length} pending pick(s) for this game`)
                pendingPicks.forEach(pick => {
                  console.log(`   - ${pick.pick_type}: ${pick.selection}`)
                })
              }
            }
          }
        } catch (error) {
          allErrors.push(`Error processing game: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      totalUpdated += updated
      totalSkipped += skipped
      totalPostponed += postponed

      console.log(`📊 [GAME-SCORES-SYNC] Date ${dateStr} summary: Updated=${updated}, Skipped=${skipped}, Postponed=${postponed}`)
    }

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ [GAME-SCORES-SYNC] EXECUTION COMPLETE: ${duration}ms`)
    console.log(`📊 [GAME-SCORES-SYNC] TOTALS: Updated=${totalUpdated}, Skipped=${totalSkipped}, Postponed=${totalPostponed}`)
    if (allErrors.length > 0) {
      console.log(`⚠️ [GAME-SCORES-SYNC] Errors: ${allErrors.length}`)
      allErrors.forEach(err => console.log(`   - ${err}`))
    }
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      message: `Game scores sync completed`,
      updated: totalUpdated,
      skipped: totalSkipped,
      postponed: totalPostponed,
      errors: allErrors.length > 0 ? allErrors : undefined,
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

