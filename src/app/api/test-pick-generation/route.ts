import { NextResponse } from 'next/server'
import { analyzeBatch } from '@/lib/cappers/shiva-algorithm'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for full pick generation

/**
 * Test endpoint for full Shiva pick generation
 * 
 * This tests the complete pick generation flow:
 * 1. Fetch available games
 * 2. Check if already analyzed
 * 3. Run Shiva algorithm (baseline + AI + vegas comparison)
 * 4. Generate pick if confidence >= threshold
 * 5. Save to database
 * 
 * Usage: POST /api/test-pick-generation
 */
export async function POST() {
  const testSteps: string[] = []
  
  try {
    console.log('🎯 Testing Shiva Pick Generation...')
    testSteps.push('Started pick generation test')
    
    // 1. Get Supabase client
    const supabase = getSupabaseAdmin()
    testSteps.push('✅ Connected to database')
    
    // 2. Fetch available games (scheduled, with odds, upcoming)
    testSteps.push('Fetching available games...')
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000) // Next 48 hours
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', now.toISOString().split('T')[0])
      .lte('game_date', tomorrow.toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(10)
    
    if (gamesError) {
      throw new Error(`Failed to fetch games: ${gamesError.message}`)
    }
    
    if (!games || games.length === 0) {
      testSteps.push('❌ No available games found')
      return NextResponse.json({
        success: false,
        error: 'No scheduled games found in the next 48 hours',
        testSteps,
        hint: 'Run the odds ingestion to fetch games'
      }, { status: 404 })
    }
    
    testSteps.push(`✅ Found ${games.length} available games`)
    
    // 3. Check which games Shiva has already analyzed
    const gameIds = games.map(g => g.id)
    const { data: existingPicks } = await supabase
      .from('picks')
      .select('game_id')
      .eq('capper', 'shiva')
      .in('game_id', gameIds)
    
    const analyzedGameIds = new Set(existingPicks?.map(p => p.game_id) || [])
    const unanalyzedGames = games.filter(g => !analyzedGameIds.has(g.id))
    
    testSteps.push(`Shiva has already analyzed ${analyzedGameIds.size} games`)
    testSteps.push(`${unanalyzedGames.length} games available for new analysis`)
    
    // 4. Select first unanalyzed game
    const gameToAnalyze = unanalyzedGames[0] || games[0]
    const isReanalysis = analyzedGameIds.has(gameToAnalyze.id)
    
    const awayTeam = typeof gameToAnalyze.away_team === 'string' ? gameToAnalyze.away_team : gameToAnalyze.away_team?.name || 'Away Team'
    const homeTeam = typeof gameToAnalyze.home_team === 'string' ? gameToAnalyze.home_team : gameToAnalyze.home_team?.name || 'Home Team'
    
    if (isReanalysis) {
      testSteps.push('⚠️  Testing with already-analyzed game (for demo purposes)')
      // Clean up old pick for testing
      await supabase
        .from('picks')
        .delete()
        .eq('game_id', gameToAnalyze.id)
        .eq('capper', 'shiva')
      
      testSteps.push('🧹 Cleaned up old pick for testing')
    }
    
    testSteps.push(`📊 Selected game: ${awayTeam} @ ${homeTeam}`)
    
    // 5. Fetch current odds for this game
    testSteps.push('Fetching current odds...')
    const { data: oddsHistory } = await supabase
      .from('odds_history')
      .select('*')
      .eq('game_id', gameToAnalyze.id)
      .order('recorded_at', { ascending: false })
      .limit(5)
    
    if (!oddsHistory || oddsHistory.length === 0) {
      testSteps.push('⚠️  No odds history found for this game')
    } else {
      testSteps.push(`✅ Found ${oddsHistory.length} odds records`)
    }
    
    // 6. Check if Shiva has AI settings configured
    testSteps.push('🔍 Checking Shiva AI configuration...')
    const { data: shivaSettings, error: settingsError } = await supabase
      .from('capper_settings')
      .select('*')
      .eq('capper_name', 'shiva')
      .single()
    
    if (settingsError || !shivaSettings) {
      testSteps.push('❌ WARNING: No capper_settings found for Shiva!')
      testSteps.push('   AI research will be SKIPPED')
      testSteps.push('   Algorithm will run with baseline factors only')
      testSteps.push('   To fix: Run migration 012_ai_capper_system.sql')
      return NextResponse.json({
        success: false,
        error: 'Shiva capper_settings not configured in database',
        testSteps,
        hint: 'Run: supabase/migrations/012_ai_capper_system.sql'
      }, { status: 500 })
    }
    
    testSteps.push(`✅ Shiva AI settings found:`)
    testSteps.push(`   - AI Run 1: ${shivaSettings.ai_provider_run1} (${shivaSettings.ai_model_run1})`)
    testSteps.push(`   - AI Run 2: ${shivaSettings.ai_provider_run2} (${shivaSettings.ai_model_run2})`)
    testSteps.push(`   - Min Confidence: ${shivaSettings.min_confidence_to_pick}/10`)
    testSteps.push(`   - StatMuse Questions: ${shivaSettings.max_statmuse_questions_run1} + ${shivaSettings.max_statmuse_questions_run2}`)
    
    // 7. Run Shiva algorithm
    testSteps.push('🤖 Running Shiva algorithm (with AI enhancement)...')
    testSteps.push('  - Phase 1: Baseline factor analysis')
    testSteps.push('  - Phase 2: AI research (Perplexity + ChatGPT)')
    testSteps.push('  - Phase 3: Vegas comparison')
    testSteps.push('  - Phase 4: Confidence calculation')
    testSteps.push('  ⏳ This may take 30-60 seconds for AI calls...')
    
    // Prepare arguments for analyzeBatch
    const maxPicks = 1 // Only generate 1 pick for testing
    const existingPicksByGame = new Map<string, Set<string>>()
    
    console.log('🎯 About to run analyzeBatch for game:', gameToAnalyze.id)
    testSteps.push(`🎯 Running algorithm for game ID: ${gameToAnalyze.id}`)
    testSteps.push(`⚠️  TEST MODE: Bypassing 15-hour timing validation`)
    testSteps.push(`📅 Game time: ${gameToAnalyze.game_date} ${gameToAnalyze.game_time}`)
    
    const startTime = Date.now()
    let results
    let duration = 0
    
    try {
      testSteps.push(`🔍 Starting detailed game analysis...`)
      
      // Use skipTimeValidation flag for testing
      results = await analyzeBatch([gameToAnalyze], maxPicks, existingPicksByGame, { skipTimeValidation: true })
      duration = Date.now() - startTime
      
      if (results && results.length > 0) {
        testSteps.push(`✅ Algorithm complete - Pick generated! (${(duration / 1000).toFixed(2)}s)`)
      } else {
        testSteps.push(`✅ Algorithm complete - No pick (confidence too low) (${(duration / 1000).toFixed(2)}s)`)
      }
      
      console.log('✅ Algorithm returned:', results)
    } catch (algoError) {
      duration = Date.now() - startTime
      testSteps.push(`❌ Algorithm error: ${algoError instanceof Error ? algoError.message : String(algoError)}`)
      console.error('❌ Algorithm error:', algoError)
      throw algoError
    }
    
    // 7. Check result
    if (!results || results.length === 0) {
      testSteps.push('📊 Result: No pick generated (confidence below threshold or game filtered out)')
      
      return NextResponse.json({
        success: true,
        message: 'Pick generation test complete - No pick generated',
        testSteps,
        game: {
          id: gameToAnalyze.id,
          matchup: `${typeof gameToAnalyze.away_team === 'string' ? gameToAnalyze.away_team : gameToAnalyze.away_team?.name || 'Away Team'} @ ${typeof gameToAnalyze.home_team === 'string' ? gameToAnalyze.home_team : gameToAnalyze.home_team?.name || 'Home Team'}`,
          sport: gameToAnalyze.sport,
          date: gameToAnalyze.game_date,
          time: gameToAnalyze.game_time
        },
        result: {
          pick_generated: false,
          reason: 'Confidence below minimum threshold (< 7.0)',
          factors_analyzed: 0,
          ai_research_runs: 0,
        },
        performance: {
          duration_seconds: (duration / 1000).toFixed(2),
          estimated_cost_usd: 0.007
        },
        next_steps: [
          'The algorithm worked correctly but confidence was too low',
          'Try running on a different game with more favorable conditions',
          'Check the ai_research_runs table to see AI analysis data',
          'Adjust min_confidence_to_pick in capper_settings if needed'
        ]
      })
    }
    
        // 8. Pick was generated!
        const pickResult = results[0]
        const pick = pickResult.pick
        const log = pickResult.log
        
        testSteps.push('✅ Pick generated!')
        testSteps.push(`  - Pick Type: ${pick.pickType}`)
        testSteps.push(`  - Selection: ${pick.selection}`)
        testSteps.push(`  - Confidence: ${pick.confidence}/10`)
        testSteps.push(`  - Units: ${pick.units}`)
        testSteps.push(`  - Odds: ${pick.odds}`)
        testSteps.push(`  - Score Prediction: ${log.finalPrediction.awayScore}-${log.finalPrediction.homeScore}`)
        
        // Show AI research details
        if (log.aiResearch && log.aiResearch.runs > 0) {
          testSteps.push(`📊 AI Research:`)
          testSteps.push(`   - AI Runs: ${log.aiResearch.runs}`)
          testSteps.push(`   - Factors Found: ${log.aiResearch.factorCount}`)
          testSteps.push(`   - Confidence Boost: +${log.aiResearch.confidenceBoost.toFixed(2)}`)
        } else {
          testSteps.push(`⚠️  AI Research: No AI runs (settings missing or error)`)
        }
    
    // 9. Check if it was saved to database
    const { data: savedPick } = await supabase
      .from('picks')
      .select('*')
      .eq('game_id', gameToAnalyze.id)
      .eq('capper', 'shiva')
      .single()
    
    if (savedPick) {
      testSteps.push('✅ Pick saved to database')
    } else {
      testSteps.push('⚠️  Pick not saved (check implementation)')
    }
    
    testSteps.push('✅ Test complete!')
    
    const awayTeamName = typeof gameToAnalyze.away_team === 'string' ? gameToAnalyze.away_team : gameToAnalyze.away_team?.name || 'Away Team'
    const homeTeamName = typeof gameToAnalyze.home_team === 'string' ? gameToAnalyze.home_team : gameToAnalyze.home_team?.name || 'Home Team'
    
    return NextResponse.json({
      success: true,
      message: `Shiva generated a pick for ${awayTeamName} @ ${homeTeamName}`,
      testSteps,
      game: {
        id: gameToAnalyze.id,
        matchup: `${awayTeamName} @ ${homeTeamName}`,
        sport: gameToAnalyze.sport,
        date: gameToAnalyze.game_date,
        time: gameToAnalyze.game_time
      },
      pick: {
        pickType: pick.pickType,
        selection: pick.selection,
        confidence: pick.confidence,
        units: pick.units,
        odds: pick.odds,
        scorePrediction: {
          away: log.finalPrediction.awayScore,
          home: log.finalPrediction.homeScore,
          total: log.finalPrediction.total,
          winner: log.finalPrediction.winner
        },
        reasoning: pick.reasoning,
        vegasComparison: log.vegasComparison,
        // AI Research details for transparency
        aiResearch: log.aiResearch || null,
        // All factors and analysis steps
        analysisSteps: log.steps || []
      },
      database: {
        saved: !!savedPick,
        pick_id: savedPick?.id
      },
      performance: {
        duration_seconds: (duration / 1000).toFixed(2),
        estimated_cost_usd: 0.007
      },
      next_steps: [
        'Check the picks table to see the full pick record',
        'View the ai_research_runs table for detailed AI analysis',
        'Go to the main dashboard to see the pick displayed',
        'Run POST /api/run-shiva to generate picks for all available games'
      ]
    })
    
  } catch (error) {
    console.error('❌ Pick generation test failed:', error)
    testSteps.push('❌ Error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'))
    
    const errorDetails = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      timestamp: new Date().toISOString(),
      testSteps,
      environment: {
        hasPerplexityKey: !!process.env.PERPLEXITY_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    }
    
    console.error('Full error details:', errorDetails)
    return NextResponse.json(errorDetails, { status: 500 })
  }
}

