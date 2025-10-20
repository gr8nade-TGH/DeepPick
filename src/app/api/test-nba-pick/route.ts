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
      .eq('sport', 'basketball')
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
    const gameInput = adaptCapperGameToGameInput(gameData)
    
    if (!gameInput.spread || !gameInput.total) {
      testSteps.push('⚠️  No market odds available for this game')
      return NextResponse.json({
        success: false,
        message: 'Game has no odds data',
        testSteps,
        game: {
          id: gameData.id,
          matchup: `${gameInput.awayTeam.name} @ ${gameInput.homeTeam.name}`,
          sport: gameInput.sport,
        },
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
    
    // 7. Run the analysis
    testSteps.push('⏳ PHASE 1: Score Prediction (Pre-Market)')
    testSteps.push('   Predicting team scores BEFORE considering market odds...')
    
    const analysisStart = Date.now()
    const result = await nbaEngine.analyzeGame(gameInput)
    const analysisDuration = Date.now() - analysisStart
    
    testSteps.push(`✅ Analysis complete in ${(analysisDuration / 1000).toFixed(2)}s`)
    testSteps.push('')
    
    // 8. Add analysis log steps
    if (result.log && result.log.steps) {
      testSteps.push('📋 ANALYSIS BREAKDOWN:')
      for (const step of result.log.steps) {
        const icon = step.impact === 'positive' ? '✅' : step.impact === 'negative' ? '❌' : '📊'
        testSteps.push(`   ${icon} ${step.title}`)
        if (step.result) {
          testSteps.push(`      → ${step.result}`)
        }
      }
      testSteps.push('')
    }
    
    // 9. Display score prediction
    testSteps.push('🎯 SCORE PREDICTION:')
    testSteps.push(`   ${gameInput.awayTeam.abbreviation}: ${result.scorePrediction.awayScore.toFixed(1)} points`)
    testSteps.push(`   ${gameInput.homeTeam.abbreviation}: ${result.scorePrediction.homeScore.toFixed(1)} points`)
    testSteps.push(`   True Spread: ${result.scorePrediction.trueSpread.toFixed(2)} (Market: ${gameInput.spread})`)
    testSteps.push(`   True Total: ${result.scorePrediction.trueTotal.toFixed(1)} (Market: ${gameInput.total})`)
    testSteps.push(`   Win Prob: ${(result.scorePrediction.winProbTrue * 100).toFixed(1)}%`)
    testSteps.push('')
    
    // 10. Display factors
    testSteps.push('💎 FACTORS GENERATED:')
    testSteps.push(`   Total: ${result.factors.length} factors`)
    for (const factor of result.factors) {
      const sign = factor.contribution >= 0 ? '+' : ''
      testSteps.push(`   • ${factor.name}: ${sign}${factor.contribution.toFixed(3)} ${factor.unit}`)
      testSteps.push(`     (Effect: ${sign}${factor.effectSize.toFixed(3)}, Reliability: ${factor.reliability.toFixed(2)})`)
    }
    testSteps.push('')
    
    // 11. Display prediction heads
    testSteps.push('📊 PREDICTION HEADS:')
    testSteps.push(`   Spread: Δ=${result.predictionHeads.spreadHead.predictedDeviation.toFixed(2)}, EV=${result.predictionHeads.spreadHead.evPercentage.toFixed(2)}% ${result.predictionHeads.spreadHead.overallThresholdMet ? '✅' : '❌'}`)
    testSteps.push(`   Total:  Δ=${result.predictionHeads.totalHead.predictedDeviation.toFixed(2)}, EV=${result.predictionHeads.totalHead.evPercentage.toFixed(2)}% ${result.predictionHeads.totalHead.overallThresholdMet ? '✅' : '❌'}`)
    testSteps.push(`   ML:     Δ=${result.predictionHeads.moneylineHead.predictedDeviation.toFixed(3)}, EV=${result.predictionHeads.moneylineHead.evPercentage.toFixed(2)}% ${result.predictionHeads.moneylineHead.overallThresholdMet ? '✅' : '❌'}`)
    testSteps.push('')
    
    // 12. Final result
    const duration = Date.now() - startTime
    
    if (result.predictionHeads.recommendedBetType) {
      const selectedHead = result.predictionHeads[`${result.predictionHeads.recommendedBetType}Head` as keyof typeof result.predictionHeads] as any
      testSteps.push('🎉 PICK GENERATED!')
      testSteps.push(`   Bet Type: ${result.predictionHeads.recommendedBetType.toUpperCase()}`)
      testSteps.push(`   Expected Value: ${selectedHead.evPercentage.toFixed(2)}%`)
      testSteps.push(`   Win Probability: ${(selectedHead.winProbability * 100).toFixed(1)}%`)
      testSteps.push(`   True Line: ${selectedHead.trueLine.toFixed(2)}`)
      testSteps.push(`   Market Line: ${selectedHead.marketLine}`)
      testSteps.push(`   Deviation: ${selectedHead.predictedDeviation.toFixed(2)}`)
      testSteps.push(`   Reasoning: ${selectedHead.thresholdReason}`)
      
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
          awayScore: result.scorePrediction.awayScore,
          homeScore: result.scorePrediction.homeScore,
          trueSpread: result.scorePrediction.trueSpread,
          trueTotal: result.scorePrediction.trueTotal,
          winProbTrue: result.scorePrediction.winProbTrue,
          sigmaSpread: result.scorePrediction.sigmaSpread,
          sigmaTotal: result.scorePrediction.sigmaTotal,
        },
        factors: result.factors.map(f => ({
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
            betType: result.predictionHeads.spreadHead.betType,
            deviation: result.predictionHeads.spreadHead.predictedDeviation,
            evPercentage: result.predictionHeads.spreadHead.evPercentage,
            meetsThreshold: result.predictionHeads.spreadHead.overallThresholdMet,
            reason: result.predictionHeads.spreadHead.thresholdReason,
          },
          total: {
            betType: result.predictionHeads.totalHead.betType,
            deviation: result.predictionHeads.totalHead.predictedDeviation,
            evPercentage: result.predictionHeads.totalHead.evPercentage,
            meetsThreshold: result.predictionHeads.totalHead.overallThresholdMet,
            reason: result.predictionHeads.totalHead.thresholdReason,
          },
          moneyline: {
            betType: result.predictionHeads.moneylineHead.betType,
            deviation: result.predictionHeads.moneylineHead.predictedDeviation,
            evPercentage: result.predictionHeads.moneylineHead.evPercentage,
            meetsThreshold: result.predictionHeads.moneylineHead.overallThresholdMet,
            reason: result.predictionHeads.moneylineHead.thresholdReason,
          },
          bestPick: result.predictionHeads.recommendedBetType,
          highestEv: result.predictionHeads.highestEv,
        },
        pick: {
          betType: result.predictionHeads.recommendedBetType,
          selection: `${result.predictionHeads.recommendedBetType} bet`,
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
          duration_seconds: (duration / 1000).toFixed(2),
          analysis_duration_seconds: (analysisDuration / 1000).toFixed(2),
          estimated_cost_usd: 0.035, // Estimated for full AI research
        },
      })
    } else {
      // No pick generated
      testSteps.push('⚠️  NO PICK GENERATED')
      testSteps.push(`   Reason: ${result.noPickReason}`)
      testSteps.push(`   ${result.factors.length} factors analyzed`)
      
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
          awayScore: result.scorePrediction.awayScore,
          homeScore: result.scorePrediction.homeScore,
          trueSpread: result.scorePrediction.trueSpread,
          trueTotal: result.scorePrediction.trueTotal,
          winProbTrue: result.scorePrediction.winProbTrue,
          sigmaSpread: result.scorePrediction.sigmaSpread,
          sigmaTotal: result.scorePrediction.sigmaTotal,
        },
        factors: result.factors.map(f => ({
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
            betType: result.predictionHeads.spreadHead.betType,
            deviation: result.predictionHeads.spreadHead.predictedDeviation,
            evPercentage: result.predictionHeads.spreadHead.evPercentage,
            meetsThreshold: result.predictionHeads.spreadHead.overallThresholdMet,
            reason: result.predictionHeads.spreadHead.thresholdReason,
          },
          total: {
            betType: result.predictionHeads.totalHead.betType,
            deviation: result.predictionHeads.totalHead.predictedDeviation,
            evPercentage: result.predictionHeads.totalHead.evPercentage,
            meetsThreshold: result.predictionHeads.totalHead.overallThresholdMet,
            reason: result.predictionHeads.totalHead.thresholdReason,
          },
          moneyline: {
            betType: result.predictionHeads.moneylineHead.betType,
            deviation: result.predictionHeads.moneylineHead.predictedDeviation,
            evPercentage: result.predictionHeads.moneylineHead.evPercentage,
            meetsThreshold: result.predictionHeads.moneylineHead.overallThresholdMet,
            reason: result.predictionHeads.moneylineHead.thresholdReason,
          },
          bestPick: null,
          highestEv: result.predictionHeads.highestEv,
        },
        pick: null,
        noPick: true,
        noPickReason: result.noPickReason,
        performance: {
          duration_seconds: (duration / 1000).toFixed(2),
          analysis_duration_seconds: (analysisDuration / 1000).toFixed(2),
          estimated_cost_usd: 0.035,
        },
        next_steps: [
          '✅ System worked correctly - being selective!',
          `📊 Analyzed ${result.factors.length} factors`,
          '🎯 Check prediction heads to see why no bet met thresholds',
          '💡 This is GOOD - we only want high-EV picks with structural edge',
        ],
      })
    }
    
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

