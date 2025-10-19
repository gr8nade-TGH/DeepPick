import { NextResponse } from 'next/server'
import { AICapperOrchestrator } from '@/lib/ai/ai-capper-orchestrator'
import { CapperGame } from '@/lib/cappers/shared-logic'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { CapperSettings } from '@/types'

export const runtime = 'nodejs' // Force Node.js runtime (not Edge)
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for AI processing

/**
 * Test endpoint for AI-enhanced Shiva
 * 
 * Tests the complete 2-run AI research pipeline:
 * - Run 1: Perplexity + StatMuse (analytical factors)
 * - Run 2: ChatGPT + StatMuse (strategic validation)
 * 
 * Usage: POST http://localhost:3000/api/test-ai-capper
 */
export async function POST() {
  const testSteps: string[] = []
  
  try {
    console.log('🧪 Testing AI-Enhanced Shiva...')
    testSteps.push('Started test')
    
    // 1. Check API keys
    testSteps.push('Checking API keys...')
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'PERPLEXITY_API_KEY not set in environment',
        hint: 'Add it to your .env.local file',
        testSteps
      }, { status: 500 })
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY not set in environment',
        hint: 'Add it to your .env.local file',
        testSteps
      }, { status: 500 })
    }
    
    console.log('✅ API keys found')
    testSteps.push('✅ API keys verified')
    
    // 2. Fetch or create a real scheduled game from database
    testSteps.push('Fetching game data...')
    const supabase = getSupabaseAdmin()
    let { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(1)
      .single()

    if (gameError || !game) {
      console.warn('No scheduled games found, using mock game for test')
      
      // Create a mock game for testing
      const mockGame: CapperGame = {
        id: 'test-game-' + Date.now(),
        sport: 'nba',
        home_team: {
          name: 'Los Angeles Lakers',
          abbreviation: 'LAL'
        },
        away_team: {
          name: 'Boston Celtics',
          abbreviation: 'BOS'
        },
        game_date: new Date().toISOString().split('T')[0],
        game_time: '19:30:00',
        status: 'scheduled',
        odds: {
          draftkings: {
            moneyline: { home: -150, away: +130 },
            spread: { home: -110, away: -110, line: -3.5 },
            total: { over: -110, under: -110, line: 225.5 }
          },
          fanduel: {
            moneyline: { home: -145, away: +125 },
            spread: { home: -110, away: -110, line: -3.5 },
            total: { over: -110, under: -110, line: 225.5 }
          }
        }
      }
      
      // Upsert mock game to DB
      const { error: upsertError } = await supabase
        .from('games')
        .upsert(mockGame, { onConflict: 'id' })
      
      if (upsertError) {
        console.error('Failed to create mock game:', upsertError)
      }
      
      game = mockGame
    }
    
    console.log(`📊 Testing with game: ${game.away_team.name} @ ${game.home_team.name}`)
    
    // 3. Fetch Shiva's capper settings
    let { data: capperSettings, error: settingsError } = await supabase
      .from('capper_settings')
      .select('*')
      .eq('capper_name', 'shiva')
      .single()

    if (settingsError || !capperSettings) {
      console.warn('No settings found for Shiva, using defaults')
      capperSettings = {
        capper_name: 'shiva',
        ai_provider_run1: 'perplexity',
        ai_provider_run2: 'openai',
        ai_model_run1: 'sonar-medium-online',
        ai_model_run2: 'gpt-4o-mini',
        timing_offset_hours: 4,
        timing_offset_nfl_hours: 24,
        min_confidence_to_pick: 7.0,
        weed_out_filters: [],
        factor_weights: {},
        max_statmuse_questions_run1: 2,
        max_statmuse_questions_run2: 2,
      }
    }
    
    console.log('⚙️ Using settings:', capperSettings)
    testSteps.push('✅ Settings loaded')
    
    // 4. Clean up any existing test data for this game
    testSteps.push('Cleaning up old test data...')
    await supabase
      .from('ai_research_runs')
      .delete()
      .eq('game_id', game.id)
      .eq('capper', 'shiva')
    
    console.log('🧹 Cleaned up existing research runs')
    testSteps.push('✅ Old test data cleared')
    
    // 5. Initialize AI Orchestrator
    testSteps.push('Initializing AI orchestrator...')
    const orchestrator = new AICapperOrchestrator({
      capperName: 'shiva',
      game: game as CapperGame,
      capperSettings: capperSettings as CapperSettings,
    })
    testSteps.push('✅ Orchestrator ready')
    
    // 6. Run the full AI research pipeline
    console.log('🤖 Starting AI research pipeline...')
    testSteps.push('🤖 Running AI research (Run 1: Perplexity)...')
    const startTime = Date.now()
    const aiRuns = await orchestrator.runResearchPipeline()
    const duration = Date.now() - startTime
    
    console.log(`✅ AI research complete! (${(duration / 1000).toFixed(2)}s)`)
    testSteps.push(`✅ AI research complete (${(duration / 1000).toFixed(2)}s)`)
    testSteps.push('  - Run 1 (Perplexity): ' + Object.keys(aiRuns[0].factors).length + ' factors')
    testSteps.push('  - Run 2 (ChatGPT): ' + Object.keys(aiRuns[1].factors).length + ' factors')
    
    // 7. Generate AI insight
    console.log('📝 Generating AI insight...')
    testSteps.push('📝 Generating AI insight...')
    const aiInsight = await orchestrator.generateAIInsight(aiRuns)
    testSteps.push('✅ AI insight generated')
    
    testSteps.push('✅ Test complete!')
    
    return NextResponse.json({
      success: true,
      message: `AI-enhanced Shiva test complete for ${game.away_team.name} @ ${game.home_team.name}`,
      testSteps,
      game: {
        id: game.id,
        matchup: `${game.away_team.name} @ ${game.home_team.name}`,
        sport: game.sport,
        date: game.game_date,
        time: game.game_time
      },
      ai_research: {
        run1: {
          provider: 'Perplexity',
          model: capperSettings.ai_model_run1,
          type: aiRuns[0].run_type,
          factors_found: Object.keys(aiRuns[0].factors).length,
          statmuse_queries: aiRuns[0].statmuse_queries?.length || 0,
          duration_ms: aiRuns[0].duration_ms,
          factors: aiRuns[0].factors
        },
        run2: {
          provider: 'ChatGPT',
          model: capperSettings.ai_model_run2,
          type: aiRuns[1].run_type,
          factors_found: Object.keys(aiRuns[1].factors).length,
          statmuse_queries: aiRuns[1].statmuse_queries?.length || 0,
          validation_result: aiRuns[1].validation_result,
          duration_ms: aiRuns[1].duration_ms,
          factors: aiRuns[1].factors
        },
        total_duration_ms: duration
      },
      ai_insight: aiInsight,
      performance: {
        total_duration_seconds: (duration / 1000).toFixed(2),
        estimated_cost_usd: 0.007 // Rough estimate
      },
      next_steps: [
        'Check the ai_research_runs table in your database to see the stored data',
        'Run POST /api/run-shiva to generate actual picks with AI enhancement',
        'Check the picks table to see AI insights stored with picks'
      ]
    })
    
  } catch (error) {
    console.error('❌ AI Capper test failed:', error)
    testSteps.push('❌ Error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'))
    
    // Detailed error logging
    const errorDetails = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      timestamp: new Date().toISOString(),
      testSteps, // Include test steps to see where it failed
      environment: {
        hasPerplexityKey: !!process.env.PERPLEXITY_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV,
        runtime: 'nodejs'
      }
    }
    
    console.error('Full error details:', errorDetails)
    
    return NextResponse.json(errorDetails, { status: 500 })
  }
}

