import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeBatch } from '@/lib/cappers/nexus-algorithm'
import type { CapperGame } from '@/lib/cappers/shared-logic'
import { getExistingPicksByGame } from '@/lib/cappers/duplicate-checker'
import { startRunLog, completeRunLog, errorRunLog, noGamesRunLog, calculateDuration } from '@/lib/cappers/run-logger'

export const dynamic = 'force-dynamic'

/**
 * Run Nexus's algorithm on current games and generate picks
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const triggerType = url.searchParams.get('trigger') as 'manual' | 'cron' | 'api' || 'manual'
  
  let runId: string | null = null
  try {
    runId = await startRunLog('nexus', triggerType)
  } catch (logError) {
    console.warn('⚠️ Could not create run log (table may not exist yet):', logError)
  }
  
  try {
    console.log(`🔷 Running Nexus algorithm...${runId ? ` (Run ID: ${runId})` : ''}`)
    
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(50)

    if (gamesError) {
      if (runId) {
        try { await errorRunLog(runId, gamesError.message) } catch (e) { console.warn('Log error:', e) }
      }
      return NextResponse.json({
        success: false,
        error: gamesError.message,
        runId
      }, { status: 500 })
    }

    if (!games || games.length === 0) {
      if (runId) {
        try { 
          await noGamesRunLog(runId)
          await calculateDuration(runId)
        } catch (e) { console.warn('Log error:', e) }
      }
      return NextResponse.json({
        success: true,
        message: 'No scheduled games available',
        picks: [],
        runId
      })
    }

    console.log(`📊 Analyzing ${games.length} games...`)

    const gamesWithOdds = games.filter(g => g.odds && Object.keys(g.odds).length > 0).length
    const gamesWithoutOdds = games.length - gamesWithOdds

    const existingPicks = await getExistingPicksByGame('nexus')
    console.log(`🔍 Found existing picks on ${existingPicks.size} games`)

    const results = analyzeBatch(games as CapperGame[], 5, existingPicks)

    console.log(`✅ Nexus generated ${results.length} picks`)

    const passedGames: Array<{ game: string; reason: string }> = []
    const generatedPicks: Array<{ game: string; pickType: string; confidence: number; selection: string }> = []
    const skippedGames: Array<{ game: string; reason: string; existingPickType: string }> = []
    const errors: string[] = []

    const storedPicks = []
    for (const result of results) {
      const pick = result.pick
      const log = result.log
      
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
          algorithm_version: 'nexus-v1-statistical',
          capper: 'nexus',
          result: { prediction_log: log },
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

    const picksSkipped = games.length - results.length

    if (runId) {
      try {
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
      } catch (e) { console.warn('Log error:', e) }
    }

    return NextResponse.json({
      success: true,
      message: `Nexus generated ${results.length} picks`,
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
    console.error('❌ Error running Nexus:', error)
    if (runId) {
      try {
        await errorRunLog(runId, error instanceof Error ? error : new Error(String(error)))
        await calculateDuration(runId)
      } catch (e) { console.warn('Log error:', e) }
    }
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      runId
    }, { status: 500 })
  }
}

