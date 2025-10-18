import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeBatch } from '@/lib/cappers/ifrit-algorithm'
import type { CapperGame } from '@/lib/cappers/shared-logic'
import { getExistingPicksByGame } from '@/lib/cappers/duplicate-checker'
import { startRunLog, completeRunLog, errorRunLog, noGamesRunLog, calculateDuration } from '@/lib/cappers/run-logger'

export const dynamic = 'force-dynamic'

/**
 * Run Ifrit's algorithm on current games and generate picks
 */
export async function POST(request: Request) {
  // Determine trigger type
  const url = new URL(request.url)
  const triggerType = url.searchParams.get('trigger') as 'manual' | 'cron' | 'api' || 'manual'
  
  // Start run log
  const runId = await startRunLog('ifrit', triggerType)
  
  try {
    console.log(`🔥 Running Ifrit algorithm... (Run ID: ${runId})`)
    
    // 1. Fetch scheduled games
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(50)

    if (gamesError) {
      await errorRunLog(runId, gamesError.message)
      return NextResponse.json({
        success: false,
        error: gamesError.message,
        runId
      }, { status: 500 })
    }

    if (!games || games.length === 0) {
      await noGamesRunLog(runId)
      await calculateDuration(runId)
      return NextResponse.json({
        success: true,
        message: 'No scheduled games available',
        picks: [],
        runId
      })
    }

    console.log(`📊 Analyzing ${games.length} games...`)

    // Count games with odds
    const gamesWithOdds = games.filter(g => g.odds && Object.keys(g.odds).length > 0).length
    const gamesWithoutOdds = games.length - gamesWithOdds

    // 2. Get existing picks to prevent duplicates
    const existingPicks = await getExistingPicksByGame('ifrit')
    console.log(`🔍 Found existing picks on ${existingPicks.size} games`)

    // 3. Run Ifrit's algorithm with duplicate prevention
    const results = analyzeBatch(games as CapperGame[], 5, existingPicks) // Top 5 picks

    console.log(`✅ Ifrit generated ${results.length} picks`)

    // Build summary data for logging
    const passedGames: Array<{ game: string; reason: string }> = []
    const generatedPicks: Array<{ game: string; pickType: string; confidence: number; selection: string }> = []
    const skippedGames: Array<{ game: string; reason: string; existingPickType: string }> = []
    const errors: string[] = []

    // 4. Store picks in database
    const storedPicks = []
    for (const result of results) {
      const pick = result.pick
      const log = result.log
      
      // Get game snapshot
      const game = games.find(g => g.id === pick.gameId)
      if (!game) continue

      const gameSnapshot = {
        sport: game.sport,
        league: game.league || game.sport.toUpperCase(),
        home_team: game.home_team,
        away_team: game.away_team,
        game_date: game.game_date,
        game_time: game.game_time,
      }

      // Prepare reasoning with score prediction and detailed log
      const fullReasoning = [
        `SCORE PREDICTION: ${game.home_team.name} ${pick.scorePrediction.homeScore}, ${game.away_team.name} ${pick.scorePrediction.awayScore}`,
        `Total: ${pick.scorePrediction.totalPoints} | Margin: ${pick.scorePrediction.marginOfVictory > 0 ? '+' : ''}${pick.scorePrediction.marginOfVictory}`,
        '',
        ...pick.reasoning,
        '',
        '=== DETAILED PREDICTION LOG ===',
        `Timestamp: ${log.timestamp}`,
        `Capper: ${log.capper}`,
        `Game: ${log.game}`,
        '',
        ...log.steps.map(step => 
          `STEP ${step.step}: ${step.title}\n${step.description}${step.calculation ? `\nCalculation: ${step.calculation}` : ''}\nResult: ${step.result}\nImpact: ${step.impact}`
        )
      ].join('\n')

      // Insert pick with prediction log in result field
      const { data: insertedPick, error: insertError } = await supabaseAdmin
        .from('picks')
        .insert({
          game_id: pick.gameId,
          pick_type: pick.pickType,
          selection: pick.selection,
          odds: pick.odds,
          units: pick.units,
          game_snapshot: gameSnapshot,
          is_system_pick: true,
          confidence: pick.confidence,
          reasoning: fullReasoning,
          algorithm_version: 'ifrit-v3-detailed-log',
          capper: 'ifrit',
          result: { prediction_log: log }, // Store full log in result field
        })
        .select()
        .single()

      if (insertError) {
        console.error(`❌ Error storing pick:`, insertError.message)
        errors.push(`Failed to store pick for ${log.game}: ${insertError.message}`)
      } else {
        storedPicks.push(insertedPick)
        generatedPicks.push({
          game: log.game,
          pickType: pick.pickType,
          confidence: pick.confidence,
          selection: pick.selection
        })
        console.log(`✅ Stored pick: ${pick.selection} (${pick.confidence}% confidence)`)
      }
    }

    // Count skipped games (games that were passed on)
    const picksSkipped = games.length - results.length

    // Complete run log with summary
    await completeRunLog(runId, {
      gamesAnalyzed: games.length,
      picksGenerated: storedPicks.length,
      picksSkipped,
      summary: {
        gamesWithOdds,
        gamesWithoutOdds,
        existingPicksFound: existingPicks.size,
        passedGames,
        generatedPicks,
        skippedGames,
        errors
      }
    })

    await calculateDuration(runId)

    return NextResponse.json({
      success: true,
      message: `Ifrit generated ${results.length} picks`,
      picks: storedPicks,
      runId,
      analysis: results.map(r => ({
        selection: r.pick.selection,
        confidence: r.pick.confidence,
        units: r.pick.units,
        reasoning: r.pick.reasoning,
        predictionLog: r.log,
      })),
    })

  } catch (error) {
    console.error('❌ Error running Ifrit:', error)
    await errorRunLog(runId, error instanceof Error ? error : new Error(String(error)))
    await calculateDuration(runId)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      runId
    }, { status: 500 })
  }
}

