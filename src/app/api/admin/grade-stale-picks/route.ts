import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fetchScoreboard } from '@/lib/data-sources/mysportsfeeds-api'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'

/**
 * ADMIN ENDPOINT: Manually grade stale picks
 *
 * This endpoint finds all picks for games that should be completed
 * (game_start_timestamp > 3 hours ago) but are still marked as "pending",
 * then attempts to fetch the final score from MySportsFeeds and grade them.
 *
 * KEY FIX: Now fetches scores from MySportsFeeds for games not yet marked as final
 */
export async function POST(request: Request) {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🔧 [GRADE-STALE-PICKS] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'

    // Find all pending picks for games that started more than 3 hours ago
    const threeHoursAgo = new Date()
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3)

    const { data: stalePicks, error: picksError } = await supabase
      .from('picks')
      .select(`
        id,
        game_id,
        capper,
        pick_type,
        selection,
        units,
        confidence,
        status,
        created_at,
        game_snapshot,
        games (
          id,
          api_event_id,
          status,
          home_score,
          away_score,
          final_score,
          game_start_timestamp,
          home_team,
          away_team
        )
      `)
      .eq('status', 'pending')
      .lt('games.game_start_timestamp', threeHoursAgo.toISOString())

    if (picksError) {
      console.error('[GRADE-STALE-PICKS] Error fetching stale picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch stale picks',
        details: picksError.message
      }, { status: 500 })
    }

    console.log(`📊 [GRADE-STALE-PICKS] Found ${stalePicks?.length || 0} stale picks`)

    if (!stalePicks || stalePicks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stale picks found',
        graded: 0,
        dryRun
      })
    }

    let graded = 0
    let failed = 0
    const errors: string[] = []

    for (const pick of stalePicks) {
      try {
        const game = pick.games as any

        if (!game) {
          errors.push(`Pick ${pick.id}: No game found`)
          failed++
          continue
        }

        console.log(`\n🎯 [GRADE-STALE-PICKS] Processing pick ${pick.id}`)
        console.log(`   Game: ${game.away_team?.name || 'Away'} @ ${game.home_team?.name || 'Home'}`)
        console.log(`   Pick: ${pick.pick_type} - ${pick.selection}`)
        console.log(`   Game Status: ${game.status}`)

        // If game is NOT final, fetch score from MySportsFeeds first
        if (game.status !== 'final' || game.home_score === null || game.away_score === null) {
          console.log(`   ⚠️  Game not final (status: ${game.status}), fetching from MySportsFeeds...`)

          // Extract game date from game_start_timestamp
          const gameDate = new Date(game.game_start_timestamp)
          const dateStr = formatDateForAPI(gameDate)

          try {
            const scoreboardData = await fetchScoreboard(dateStr)
            const msfGameId = game.api_event_id?.replace('msf_', '')

            // Find this game in the scoreboard
            const msfGame = scoreboardData.games?.find((g: any) =>
              g.schedule?.id?.toString() === msfGameId
            )

            if (msfGame) {
              const playedStatus = msfGame.schedule?.playedStatus
              const homeScore = msfGame.score?.homeScoreTotal
              const awayScore = msfGame.score?.awayScoreTotal

              console.log(`   📡 MySportsFeeds status: ${playedStatus}, Score: ${awayScore}-${homeScore}`)

              if ((playedStatus === 'COMPLETED' || playedStatus === 'COMPLETED_PENDING_REVIEW') &&
                homeScore !== undefined && awayScore !== undefined) {
                // Update the game in database
                if (!dryRun) {
                  const { error: updateError } = await supabase
                    .from('games')
                    .update({
                      status: 'final',
                      final_score: { home: homeScore, away: awayScore, winner: homeScore > awayScore ? 'home' : 'away' },
                      home_score: homeScore,
                      away_score: awayScore,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', game.id)

                  if (updateError) {
                    errors.push(`Pick ${pick.id}: Failed to update game - ${updateError.message}`)
                    failed++
                    continue
                  }
                  console.log(`   ✅ Game updated to final: ${awayScore}-${homeScore}`)
                }
                // Update local game object for grading
                game.status = 'final'
                game.home_score = homeScore
                game.away_score = awayScore
              } else {
                errors.push(`Pick ${pick.id}: Game not completed in MySportsFeeds (status: ${playedStatus})`)
                failed++
                continue
              }
            } else {
              errors.push(`Pick ${pick.id}: Game ${msfGameId} not found in MySportsFeeds for ${dateStr}`)
              failed++
              continue
            }
          } catch (apiError) {
            errors.push(`Pick ${pick.id}: MySportsFeeds API error - ${apiError instanceof Error ? apiError.message : String(apiError)}`)
            failed++
            continue
          }
        }

        // Now game should be final, grade the pick
        console.log(`   ✅ Game is final: ${game.away_score} - ${game.home_score}`)

        if (!dryRun) {
          // Call the grading API
          const gradeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/picks/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pick_id: pick.id })
          })

          if (gradeResponse.ok) {
            graded++
            console.log(`   ✅ Pick graded successfully`)
          } else {
            const errorData = await gradeResponse.json()
            errors.push(`Pick ${pick.id}: ${errorData.error || 'Grading failed'}`)
            failed++
            console.log(`   ❌ Grading failed: ${errorData.error}`)
          }
        } else {
          graded++
          console.log(`   🔍 [DRY RUN] Would grade this pick`)
        }
      } catch (error) {
        errors.push(`Pick ${pick.id}: ${error instanceof Error ? error.message : String(error)}`)
        failed++
        console.error(`   ❌ Error processing pick ${pick.id}:`, error)
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔧 [GRADE-STALE-PICKS] EXECUTION COMPLETE`)
    console.log(`   Total Stale Picks: ${stalePicks.length}`)
    console.log(`   Graded: ${graded}`)
    console.log(`   Failed: ${failed}`)
    console.log(`   Dry Run: ${dryRun}`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      message: `Stale picks processing complete`,
      total: stalePicks.length,
      graded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      dryRun,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [GRADE-STALE-PICKS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

// Also allow GET for testing
export async function GET(request: Request) {
  return POST(request)
}

