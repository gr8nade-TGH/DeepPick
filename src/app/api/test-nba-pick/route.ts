import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ShivaNBAEngine } from '@/lib/sports/nba/shiva-nba-engine'
import { adaptCapperGameToGameInput } from '@/lib/sports/adapters/game-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Test endpoint for NBA Sharp Betting System
 * 
 * Flow per spec:
 * 1. Predict score BEFORE seeing market (pre-market)
 * 2. Generate structural factors (lineup, matchup, schedule, etc.)
 * 3. Calculate three prediction heads (spread/total/ML)
 * 4. Compute EV + slippage test + edge attribution
 * 5. Gate on thresholds
 * 6. Fractional Kelly stake sizing
 */
export async function POST() {
  const testSteps: string[] = []
  const startTime = Date.now()
  
  try {
    console.log('🏀 Testing NBA Sharp Betting System...')
    testSteps.push('🏀 Started NBA pick generation test')
    
    // 1. Get Supabase client
    const supabase = getSupabaseAdmin()
    testSteps.push('✅ Connected to database')
    
    // 2. Fetch available NBA games
    testSteps.push('📊 Fetching NBA games...')
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .gte('game_date', now.toISOString().split('T')[0])
      .lte('game_date', tomorrow.toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(10)
    
    if (gamesError) {
      throw new Error(`Failed to fetch games: ${gamesError.message}`)
    }
    
    if (!games || games.length === 0) {
      testSteps.push('⚠️  No NBA games found in next 48 hours')
      return NextResponse.json({
        success: false,
        message: 'No NBA games available to test',
        testSteps,
      }, { status: 404 })
    }
    
    testSteps.push(`✅ Found ${games.length} NBA games`)
    
    // 3. Select first game for testing
    const gameData = games[0] as any
    testSteps.push(`🎯 Selected game: ${gameData.away_team?.name || 'Away'} @ ${gameData.home_team?.name || 'Home'}`)
    testSteps.push(`   Game ID: ${gameData.id}`)
    testSteps.push(`   Date: ${gameData.game_date} ${gameData.game_time}`)
    
    // 4. Convert to GameInput format
    testSteps.push('🔄 Converting game data to sharp betting format...')
    
    // Debug: Log the raw game data structure
    console.log('🔍 Raw game data:', JSON.stringify(gameData, null, 2))
    testSteps.push(`🔍 Raw game data logged to console`)
    
    const gameInput = adaptCapperGameToGameInput(gameData)
    
    // Debug: Log the extracted odds
    console.log('💰 Extracted odds:', {
      spread: gameInput.spread,
      total: gameInput.total,
      homeMoneyline: gameInput.homeMoneyline,
      awayMoneyline: gameInput.awayMoneyline
    })
    testSteps.push(`💰 Extracted odds: Spread=${gameInput.spread}, Total=${gameInput.total}, ML=${gameInput.homeMoneyline}/${gameInput.awayMoneyline}`)
    
    if (!gameInput.spread || !gameInput.total) {
      testSteps.push('⚠️  No market odds available for this game')
      testSteps.push(`🔍 Debug: Raw odds structure: ${JSON.stringify(gameData.odds, null, 2)}`)
      return NextResponse.json({
        success: false,
        message: 'Game has no odds data',
        testSteps,
        game: {
          id: gameData.id,
          matchup: `${gameInput.awayTeam.name} @ ${gameInput.homeTeam.name}`,
          sport: gameInput.sport,
        },
        debug: {
          rawOdds: gameData.odds,
          extractedOdds: {
            spread: gameInput.spread,
            total: gameInput.total,
            homeMoneyline: gameInput.homeMoneyline,
            awayMoneyline: gameInput.awayMoneyline
          }
        }
      }, { status: 400 })
    }
    
    testSteps.push(`✅ Market odds found:`)
    testSteps.push(`   Spread: ${gameInput.spread}`)
    testSteps.push(`   Total: ${gameInput.total}`)
    testSteps.push(`   ML: ${gameInput.homeMoneyline} / ${gameInput.awayMoneyline}`)
    
    // 5. Delete old AI research runs (force fresh analysis)
    testSteps.push('🧹 Cleaning old AI research...')
    const { error: deleteError } = await supabase
      .from('ai_research_runs')
      .delete()
      .eq('game_id', gameData.id)
      .eq('capper', 'shiva')
    
    if (!deleteError) {
      testSteps.push('✅ Old AI runs deleted')
    }
    
    // 6. Initialize Shiva NBA Engine
    testSteps.push('')
    testSteps.push('🚀 INITIALIZING NBA SHARP BETTING ENGINE')
    testSteps.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    testSteps.push('')
    
    const nbaEngine = new ShivaNBAEngine(1000) // $1000 bankroll
    
    // 7. STEP 1: AI Research + StatMuse (Gather Factors)
    testSteps.push('⏳ STEP 1: AI Research & StatMuse Data Gathering')
    testSteps.push('   🤖 Running Perplexity AI research...')
    testSteps.push('   📊 Querying StatMuse for team statistics...')
    testSteps.push('   🔍 Gathering lineup data, recent form, injuries...')
    
    const step1Start = Date.now()
    const step1Result = await nbaEngine.runStep1Research(gameInput)
    const step1Duration = Date.now() - step1Start
    
    testSteps.push(`✅ Step 1 complete in ${(step1Duration / 1000).toFixed(2)}s`)
    testSteps.push(`   🤖 AI Model Used: ${step1Result.aiModel}`)
    testSteps.push(`   📊 StatMuse Queries: ${step1Result.statmuseQueries.length}`)
    testSteps.push(`   💰 Estimated Cost: $${step1Result.estimatedCost.toFixed(4)}`)
    testSteps.push('')
    
    // Display Step 1 results
    testSteps.push('📋 STEP 1 RESULTS:')
    testSteps.push(`   🎯 AI Research Summary: ${step1Result.researchSummary}`)
    testSteps.push(`   📊 StatMuse Data Points: ${step1Result.statmuseQueries.length}`)
    for (const query of step1Result.statmuseQueries) {
      testSteps.push(`      • ${query.question}`)
      testSteps.push(`        → ${query.answer}`)
    }
    testSteps.push('')
    
    // 8. PAUSE: Show Step 1 results and ask for Step 2
    testSteps.push('⏸️  READY FOR STEP 2?')
    testSteps.push('   Step 1 gathered initial data and factors.')
    testSteps.push('   Step 2 will analyze this data and generate final factors.')
    testSteps.push('   Click "Run Step 2" to continue...')
    testSteps.push('')
    
    return NextResponse.json({
      success: true,
      message: 'Step 1 Complete - Ready for Step 2',
      testSteps,
      step1Results: {
        aiModel: step1Result.aiModel,
        researchSummary: step1Result.researchSummary,
        statmuseQueries: step1Result.statmuseQueries,
        estimatedCost: step1Result.estimatedCost,
        duration: step1Duration,
        factorsFound: step1Result.factorsFound,
      },
      game: {
        id: gameInput.id,
        matchup: `${gameInput.awayTeam.name} @ ${gameInput.homeTeam.name}`,
        sport: gameInput.sport,
        date: gameInput.gameDate,
        time: gameInput.gameTime,
      },
      nextStep: 'step2',
      performance: {
        duration_seconds: Number((step1Duration / 1000).toFixed(2)),
        estimated_cost_usd: Number(step1Result.estimatedCost.toFixed(4)),
      },
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ NBA test error:', error)
    testSteps.push(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      testSteps,
      performance: {
        duration_seconds: (duration / 1000).toFixed(2),
      },
    }, { status: 500 })
  }
}

