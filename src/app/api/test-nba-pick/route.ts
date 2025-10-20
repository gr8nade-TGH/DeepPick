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
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { step } = body
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
    
    // Handle Step 2 if requested
    if (step === 'step2') {
      testSteps.push('')
      testSteps.push('⏳ STEP 2: Pick Generation & Analysis')
      testSteps.push('   🎯 Running full NBA analysis...')
      testSteps.push('   📊 Generating structural factors...')
      testSteps.push('   🧮 Calculating prediction heads...')
      testSteps.push('   💰 Computing expected value...')
      
      const step2Start = Date.now()
      const step2Result = await nbaEngine.runStep2PickGeneration(gameInput)
      const step2Duration = Date.now() - step2Start
      
      testSteps.push(`✅ Step 2 complete in ${(step2Duration / 1000).toFixed(2)}s`)
      testSteps.push('')
      
      // Display Step 2 results
      testSteps.push('📋 STEP 2 RESULTS:')
      testSteps.push(`   🎯 Score Prediction: ${gameInput.homeTeam.abbreviation} ${step2Result.scorePrediction.homeScore.toFixed(1)} - ${gameInput.awayTeam.abbreviation} ${step2Result.scorePrediction.awayScore.toFixed(1)}`)
      testSteps.push(`   📊 True Spread: ${step2Result.scorePrediction.trueSpread.toFixed(2)} (Market: ${gameInput.spread})`)
      testSteps.push(`   📊 True Total: ${step2Result.scorePrediction.trueTotal.toFixed(1)} (Market: ${gameInput.total})`)
      testSteps.push(`   💎 Factors Generated: ${step2Result.factors.length}`)
      testSteps.push('')
      
      // Display factors
      for (const factor of step2Result.factors) {
        const sign = factor.contribution >= 0 ? '+' : ''
        testSteps.push(`   • ${factor.name}: ${sign}${factor.contribution.toFixed(3)} ${factor.unit}`)
        testSteps.push(`     (Effect: ${sign}${factor.effectSize.toFixed(3)}, Reliability: ${factor.reliability.toFixed(2)})`)
      }
      testSteps.push('')
      
      // Display prediction heads
      testSteps.push('📊 PREDICTION HEADS:')
      testSteps.push(`   Spread: Δ=${step2Result.predictionHeads.spreadHead.predictedDeviation.toFixed(2)}, EV=${step2Result.predictionHeads.spreadHead.evPercentage.toFixed(2)}% ${step2Result.predictionHeads.spreadHead.overallThresholdMet ? '✅' : '❌'}`)
      testSteps.push(`   Total:  Δ=${step2Result.predictionHeads.totalHead.predictedDeviation.toFixed(2)}, EV=${step2Result.predictionHeads.totalHead.evPercentage.toFixed(2)}% ${step2Result.predictionHeads.totalHead.overallThresholdMet ? '✅' : '❌'}`)
      testSteps.push(`   ML:     Δ=${step2Result.predictionHeads.moneylineHead.predictedDeviation.toFixed(3)}, EV=${step2Result.predictionHeads.moneylineHead.evPercentage.toFixed(2)}% ${step2Result.predictionHeads.moneylineHead.overallThresholdMet ? '✅' : '❌'}`)
      testSteps.push('')
      
      const totalDuration = Date.now() - startTime
      
      if (step2Result.predictionHeads.recommendedBetType) {
        const selectedHead = step2Result.predictionHeads[`${step2Result.predictionHeads.recommendedBetType}Head` as keyof typeof step2Result.predictionHeads] as any
        testSteps.push('🎉 PICK GENERATED!')
        testSteps.push(`   Bet Type: ${step2Result.predictionHeads.recommendedBetType.toUpperCase()}`)
        testSteps.push(`   Expected Value: ${selectedHead.evPercentage.toFixed(2)}%`)
        testSteps.push(`   Win Probability: ${(selectedHead.winProbability * 100).toFixed(1)}%`)
        testSteps.push(`   True Line: ${selectedHead.trueLine.toFixed(2)}`)
        testSteps.push(`   Market Line: ${selectedHead.marketLine}`)
        testSteps.push(`   Deviation: ${selectedHead.predictedDeviation.toFixed(2)}`)
        
        return NextResponse.json({
          success: true,
          message: 'NBA pick generated successfully',
          testSteps,
          game: {
            id: gameInput.id,
            matchup: `${gameInput.awayTeam.name} @ ${gameInput.homeTeam.name}`,
            sport: gameInput.sport,
            date: gameInput.gameDate,
            time: gameInput.gameTime,
          },
          scorePrediction: {
            awayScore: step2Result.scorePrediction.awayScore,
            homeScore: step2Result.scorePrediction.homeScore,
            trueSpread: step2Result.scorePrediction.trueSpread,
            trueTotal: step2Result.scorePrediction.trueTotal,
            winProbTrue: step2Result.scorePrediction.winProbTrue,
            sigmaSpread: step2Result.scorePrediction.sigmaSpread,
            sigmaTotal: step2Result.scorePrediction.sigmaTotal,
          },
          factors: step2Result.factors.map(f => ({
            name: f.name,
            category: f.category,
            unit: f.unit,
            effectSize: f.effectSize,
            contribution: f.contribution,
            reliability: f.reliability,
            reasoning: f.reasoning,
            rawData: f.rawData,
            sources: f.sources,
          })),
          predictionHeads: {
            spread: {
              betType: step2Result.predictionHeads.spreadHead.betType,
              deviation: step2Result.predictionHeads.spreadHead.predictedDeviation,
              evPercentage: step2Result.predictionHeads.spreadHead.evPercentage,
              meetsThreshold: step2Result.predictionHeads.spreadHead.overallThresholdMet,
              reason: step2Result.predictionHeads.spreadHead.thresholdReason,
            },
            total: {
              betType: step2Result.predictionHeads.totalHead.betType,
              deviation: step2Result.predictionHeads.totalHead.predictedDeviation,
              evPercentage: step2Result.predictionHeads.totalHead.evPercentage,
              meetsThreshold: step2Result.predictionHeads.totalHead.overallThresholdMet,
              reason: step2Result.predictionHeads.totalHead.thresholdReason,
            },
            moneyline: {
              betType: step2Result.predictionHeads.moneylineHead.betType,
              deviation: step2Result.predictionHeads.moneylineHead.predictedDeviation,
              evPercentage: step2Result.predictionHeads.moneylineHead.evPercentage,
              meetsThreshold: step2Result.predictionHeads.moneylineHead.overallThresholdMet,
              reason: step2Result.predictionHeads.moneylineHead.thresholdReason,
            },
            bestPick: step2Result.predictionHeads.recommendedBetType,
            highestEv: step2Result.predictionHeads.highestEv,
          },
          pick: {
            betType: step2Result.predictionHeads.recommendedBetType,
            selection: `${step2Result.predictionHeads.recommendedBetType} bet`,
            expectedValue: selectedHead.expectedValue,
            evPercentage: selectedHead.evPercentage,
            winProbability: selectedHead.winProbability,
            stake: 0, // TODO: Implement Kelly sizing
            units: 0, // TODO: Implement Kelly sizing
            trueLine: selectedHead.trueLine,
            marketLine: selectedHead.marketLine,
            deviation: selectedHead.predictedDeviation,
            offeredOdds: selectedHead.offeredOdds,
          },
          performance: {
            duration_seconds: Number((totalDuration / 1000).toFixed(2)),
            step1_duration_seconds: Number((step1Duration / 1000).toFixed(2)),
            step2_duration_seconds: Number((step2Duration / 1000).toFixed(2)),
            estimated_cost_usd: Number((step1Result.estimatedCost + 0.023).toFixed(4)), // Step 1 + Step 2 costs
          },
        })
      } else {
        // No pick generated
        testSteps.push('⚠️  NO PICK GENERATED')
        testSteps.push(`   Reason: ${step2Result.noPickReason}`)
        testSteps.push(`   ${step2Result.factors.length} factors analyzed`)
        
        return NextResponse.json({
          success: true,
          message: 'No pick generated (thresholds not met)',
          testSteps,
          game: {
            id: gameInput.id,
            matchup: `${gameInput.awayTeam.name} @ ${gameInput.homeTeam.name}`,
            sport: gameInput.sport,
            date: gameInput.gameDate,
            time: gameInput.gameTime,
          },
          scorePrediction: {
            awayScore: step2Result.scorePrediction.awayScore,
            homeScore: step2Result.scorePrediction.homeScore,
            trueSpread: step2Result.scorePrediction.trueSpread,
            trueTotal: step2Result.scorePrediction.trueTotal,
            winProbTrue: step2Result.scorePrediction.winProbTrue,
            sigmaSpread: step2Result.scorePrediction.sigmaSpread,
            sigmaTotal: step2Result.scorePrediction.sigmaTotal,
          },
          factors: step2Result.factors.map(f => ({
            name: f.name,
            category: f.category,
            unit: f.unit,
            effectSize: f.effectSize,
            contribution: f.contribution,
            reliability: f.reliability,
            reasoning: f.reasoning,
            rawData: f.rawData,
            sources: f.sources,
          })),
          predictionHeads: {
            spread: {
              betType: step2Result.predictionHeads.spreadHead.betType,
              deviation: step2Result.predictionHeads.spreadHead.predictedDeviation,
              evPercentage: step2Result.predictionHeads.spreadHead.evPercentage,
              meetsThreshold: step2Result.predictionHeads.spreadHead.overallThresholdMet,
              reason: step2Result.predictionHeads.spreadHead.thresholdReason,
            },
            total: {
              betType: step2Result.predictionHeads.totalHead.betType,
              deviation: step2Result.predictionHeads.totalHead.predictedDeviation,
              evPercentage: step2Result.predictionHeads.totalHead.evPercentage,
              meetsThreshold: step2Result.predictionHeads.totalHead.overallThresholdMet,
              reason: step2Result.predictionHeads.totalHead.thresholdReason,
            },
            moneyline: {
              betType: step2Result.predictionHeads.moneylineHead.betType,
              deviation: step2Result.predictionHeads.moneylineHead.predictedDeviation,
              evPercentage: step2Result.predictionHeads.moneylineHead.evPercentage,
              meetsThreshold: step2Result.predictionHeads.moneylineHead.overallThresholdMet,
              reason: step2Result.predictionHeads.moneylineHead.thresholdReason,
            },
            bestPick: null,
            highestEv: step2Result.predictionHeads.highestEv,
          },
          pick: null,
          noPick: true,
          noPickReason: step2Result.noPickReason,
          performance: {
            duration_seconds: Number((totalDuration / 1000).toFixed(2)),
            step1_duration_seconds: Number((step1Duration / 1000).toFixed(2)),
            step2_duration_seconds: Number((step2Duration / 1000).toFixed(2)),
            estimated_cost_usd: Number((step1Result.estimatedCost + 0.023).toFixed(4)),
          },
          next_steps: [
            '✅ System worked correctly - being selective!',
            `📊 Analyzed ${step2Result.factors.length} factors`,
            '🎯 Check prediction heads to see why no bet met thresholds',
            '💡 This is GOOD - we only want high-EV picks with structural edge',
          ],
        })
      }
    }
    
    // Default: Step 1 only
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

