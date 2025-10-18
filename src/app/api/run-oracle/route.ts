import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { analyzeBatch } from '@/lib/cappers/oracle-algorithm'
import type { CapperGame } from '@/lib/cappers/shared-logic'
import { getExistingPicksByGame } from '@/lib/cappers/duplicate-checker'
import { startRunLog, completeRunLog, errorRunLog, noGamesRunLog, calculateDuration } from '@/lib/cappers/run-logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes - AI research takes time

export async function POST(request: Request) {
  const url = new URL(request.url)
  const triggerType = url.searchParams.get('trigger') as 'manual' | 'cron' | 'api' || 'manual'
  
  let runId: string | null = null
  try {
    runId = await startRunLog('oracle', triggerType)
  } catch (logError) {
    console.warn('⚠️ Could not create run log (table may not exist yet):', logError)
  }
  
  try {
    console.log(`🔮 Running Oracle AI capper...${runId ? ` (Run ID: ${runId})` : ''}`)
    
    // Check if Perplexity API key is set
    if (!process.env.PERPLEXITY_API_KEY) {
      const errorMsg = 'PERPLEXITY_API_KEY not set. Oracle requires Perplexity API access.'
      console.error(`❌ ${errorMsg}`)
      if (runId) {
        try { await errorRunLog(runId, errorMsg) } catch (e) { console.warn('Log error:', e) }
      }
      return NextResponse.json({
        success: false,
        error: errorMsg,
        note: 'Get your API key at https://www.perplexity.ai/settings/api',
        runId
      }, { status: 500 })
    }
    
    const { data: games, error: gamesError } = await getSupabaseAdmin()
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(20) // Limit to save API costs

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

    console.log(`📊 Oracle analyzing ${games.length} games with AI...`)

    const gamesWithOdds = games.filter(g => g.odds && Object.keys(g.odds).length > 0).length
    const gamesWithoutOdds = games.length - gamesWithOdds

    const existingPicks = await getExistingPicksByGame('oracle')
    console.log(`🔍 Found existing Oracle picks on ${existingPicks.size} games`)

    // AI analysis (this will take time!)
    const results = await analyzeBatch(games as CapperGame[], 3, existingPicks) // Max 3 picks to control costs

    console.log(`✅ Oracle generated ${results.length} AI-powered picks`)

    const generatedPicks: Array<{ game: string; pickType: string; confidence: number; selection: string }> = []
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

      // Build comprehensive AI insight
      const aiInsight = `${log.aiDecision.reasoning}

KEY INSIGHTS:
${log.research.keyInsights.map(i => `• ${i}`).join('\n')}

FACTOR ANALYSIS:
${Object.entries(log.aiDecision.factors).map(([name, data]) => 
  `${name.toUpperCase()} (Weight: ${data.weight}%): ${data.value}/100 - ${data.impact}`
).join('\n')}

PREDICTION vs VEGAS:
• Our Total: ${log.vegasComparison.ourPredictedTotal} | Vegas: ${log.vegasComparison.totalLine}
• Our Spread: ${log.vegasComparison.ourPredictedSpread > 0 ? '+' : ''}${log.vegasComparison.ourPredictedSpread.toFixed(1)} | Vegas: ${log.vegasComparison.spreadLine}

Sources:
${log.research.sources.slice(0, 3).map(s => `• ${s.title}: ${s.url}`).join('\n')}`

      const { data: insertedPick, error: insertError } = await getSupabaseAdmin()
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
          reasoning: pick.reasoning.join('\n'),
          algorithm_version: 'oracle-v1-ai',
          capper: 'oracle',
          result: { prediction_log: log },
          // AI-specific columns
          ai_insight: aiInsight,
          ai_research: {
            summary: log.research.summary,
            insights: log.research.keyInsights,
            injuries: log.research.injuries,
            sources: log.research.sources
          },
          factors_analyzed: log.aiDecision.factors,
          ai_model_version: 'perplexity-sonar-pro'
        })
        .select()
        .single()

      if (insertError) {
        console.error(`❌ Error storing Oracle pick:`, insertError.message)
        errors.push(`Failed to store pick for ${log.game}: ${insertError.message}`)
      } else {
        storedPicks.push(insertedPick)
        generatedPicks.push({
          game: log.game,
          pickType: pick.pickType,
          confidence: pick.confidence,
          selection: pick.selection
        })
        console.log(`✅ Stored AI pick: ${pick.selection} (${pick.confidence}/10 confidence)`)
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
            generatedPicks,
            errors,
            aiModel: 'perplexity-sonar-pro',
            note: 'AI-powered picks with web research'
          }
        })
        await calculateDuration(runId)
      } catch (e) { console.warn('Log error:', e) }
    }

    return NextResponse.json({
      success: true,
      message: `Oracle generated ${results.length} AI-powered picks`,
      picks: storedPicks,
      runId,
      analysis: results.map(r => ({
        selection: r.pick.selection,
        confidence: r.pick.confidence,
        units: r.pick.units,
        aiInsight: r.log.aiDecision.reasoning,
        research: r.log.research,
        factors: r.log.aiDecision.factors,
        sources: r.log.research.sources
      })),
    })

  } catch (error) {
    console.error('❌ Error running Oracle:', error)
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

