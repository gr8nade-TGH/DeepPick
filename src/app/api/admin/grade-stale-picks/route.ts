import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * ADMIN ENDPOINT: Manually grade stale picks
 * 
 * This endpoint finds all picks for games that should be completed
 * (game_start_timestamp > 3 hours ago) but are still marked as "pending",
 * then attempts to fetch the final score and grade them.
 * 
 * This is a one-time cleanup tool for picks that weren't graded automatically.
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

        // If game is already final, just grade the pick
        if (game.status === 'final' && game.home_score !== null && game.away_score !== null) {
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
        } else {
          // Game is not final yet - try to fetch the score from MySportsFeeds
          console.log(`   ⚠️  Game not final, attempting to fetch score...`)
          
          // For now, just log it - we'll need to implement MySportsFeeds lookup
          errors.push(`Pick ${pick.id}: Game ${game.id} not marked as final (status: ${game.status})`)
          failed++
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

