/**
 * IFRIT - The Aggressive Scorer
 * 
 * Philosophy: "Fire and fury. High-scoring games, fast pace, offensive firepower."
 * 
 * Ifrit's Prediction Strategy:
 * 1. First, predict the actual game score based on offensive indicators
 * 2. Then compare prediction to Vegas odds to find value
 * 3. Focus on OVERS and high-scoring games
 */

import {
  type CapperGame,
  type CapperPick,
  type ScorePrediction,
  calculateConfidenceFromPrediction,
  isValidFavoriteOdds,
  getAverageOdds,
  getBestOdds,
  getTotalLine,
  getSpreadLine,
} from './shared-logic'

/**
 * Detailed prediction log for analysis
 */
export interface PredictionLog {
  timestamp: string
  capper: string
  game: string
  steps: Array<{
    step: number
    title: string
    description: string
    calculation?: string
    result: string
    impact: 'positive' | 'negative' | 'neutral'
  }>
  finalPrediction: {
    homeScore: number
    awayScore: number
    total: number
    margin: number
    winner: string
  }
  vegasComparison: {
    totalLine: number | null
    spreadLine: number | null
    totalGap: number | null
    spreadGap: number | null
  }
  confidenceBreakdown: {
    totalConfidence: number | null
    spreadConfidence: number | null
    moneylineConfidence: number | null
    selectedBet: string
    finalConfidence: number
  }
  decisionFactors: {
    passedFavoriteRule: boolean
    passedMinConfidence: boolean
    bestOddsAvailable: number
    unitsAllocated: number
  }
}

/**
 * STEP 1: Predict the actual game score
 * 
 * Ifrit looks for high-scoring indicators and predicts an aggressive score
 */
function predictGameScore(game: CapperGame, log: PredictionLog): ScorePrediction {
  const reasoning: string[] = []
  let stepNum = 1
  
  // Get Vegas total as a baseline (but we'll adjust based on our analysis)
  const vegasTotal = getTotalLine(game) || 200 // Default if no line
  const vegasSpread = getSpreadLine(game) || 0
  
  log.steps.push({
    step: stepNum++,
    title: 'Baseline Analysis',
    description: 'Starting with Vegas market lines as baseline',
    calculation: `Vegas Total: ${vegasTotal.toFixed(1)} | Vegas Spread: ${vegasSpread > 0 ? '+' : ''}${vegasSpread.toFixed(1)}`,
    result: `Baseline total: ${vegasTotal.toFixed(1)} points`,
    impact: 'neutral'
  })
  
  // Base prediction starts at Vegas line
  let predictedTotal = vegasTotal
  
  // ============================================
  // IFRIT'S SCORING FACTORS
  // ============================================
  
  // 1. Sport-specific scoring tendencies
  const sportFactor = getSportScoringFactor(game.sport, vegasTotal)
  predictedTotal += sportFactor.adjustment
  reasoning.push(...sportFactor.reasoning)
  
  log.steps.push({
    step: stepNum++,
    title: 'Sport-Specific Scoring Factor',
    description: `Analyzing ${game.sport.toUpperCase()} scoring tendencies`,
    calculation: `${vegasTotal.toFixed(1)} + ${sportFactor.adjustment.toFixed(1)} = ${predictedTotal.toFixed(1)}`,
    result: sportFactor.reasoning[0] || `Added ${sportFactor.adjustment.toFixed(1)} points`,
    impact: sportFactor.adjustment > 0 ? 'positive' : 'neutral'
  })
  
  // 2. High total line = both teams can score
  if (vegasTotal > getHighScoringThreshold(game.sport)) {
    const bonus = vegasTotal * 0.05 // Add 5% to already high totals
    const beforeBonus = predictedTotal
    predictedTotal += bonus
    reasoning.push(`🔥 Vegas total already high (${vegasTotal.toFixed(1)}) - expecting shootout, adding ${bonus.toFixed(1)} pts`)
    
    log.steps.push({
      step: stepNum++,
      title: 'High-Scoring Game Bonus',
      description: `Vegas total (${vegasTotal.toFixed(1)}) exceeds high-scoring threshold (${getHighScoringThreshold(game.sport)})`,
      calculation: `${beforeBonus.toFixed(1)} + (${vegasTotal.toFixed(1)} × 0.05) = ${predictedTotal.toFixed(1)}`,
      result: `+${bonus.toFixed(1)} points (5% shootout bonus)`,
      impact: 'positive'
    })
  } else {
    log.steps.push({
      step: stepNum++,
      title: 'High-Scoring Game Check',
      description: `Vegas total (${vegasTotal.toFixed(1)}) below high-scoring threshold (${getHighScoringThreshold(game.sport)})`,
      result: 'No bonus applied',
      impact: 'neutral'
    })
  }
  
  // 3. Ifrit's bias: Always lean toward more scoring
  const ifritBias = vegasTotal * 0.03 // Always add 3% (Ifrit is aggressive)
  const beforeBias = predictedTotal
  predictedTotal += ifritBias
  reasoning.push(`⚡ Ifrit aggression factor: +${ifritBias.toFixed(1)} pts`)
  
  log.steps.push({
    step: stepNum++,
    title: 'Ifrit Aggression Factor',
    description: 'Ifrit always leans toward higher scoring (offensive bias)',
    calculation: `${beforeBias.toFixed(1)} + (${vegasTotal.toFixed(1)} × 0.03) = ${predictedTotal.toFixed(1)}`,
    result: `+${ifritBias.toFixed(1)} points (3% aggression)`,
    impact: 'positive'
  })
  
  // ============================================
  // DISTRIBUTE TOTAL TO TEAMS
  // ============================================
  
  // Use spread to determine who scores more
  const spread = vegasSpread
  
  let homeScore: number
  let awayScore: number
  
  if (spread < 0) {
    // Home favored - they score more
    const homeAdvantage = Math.abs(spread)
    homeScore = (predictedTotal / 2) + (homeAdvantage / 2)
    awayScore = predictedTotal - homeScore
    
    log.steps.push({
      step: stepNum++,
      title: 'Score Distribution',
      description: `Home team favored by ${homeAdvantage.toFixed(1)} points`,
      calculation: `Home: (${predictedTotal.toFixed(1)} ÷ 2) + (${homeAdvantage.toFixed(1)} ÷ 2) = ${homeScore.toFixed(1)}\nAway: ${predictedTotal.toFixed(1)} - ${homeScore.toFixed(1)} = ${awayScore.toFixed(1)}`,
      result: `${game.home_team.abbreviation} ${Math.round(homeScore)}, ${game.away_team.abbreviation} ${Math.round(awayScore)}`,
      impact: 'neutral'
    })
  } else if (spread > 0) {
    // Away favored - they score more
    const awayAdvantage = Math.abs(spread)
    awayScore = (predictedTotal / 2) + (awayAdvantage / 2)
    homeScore = predictedTotal - awayScore
    
    log.steps.push({
      step: stepNum++,
      title: 'Score Distribution',
      description: `Away team favored by ${awayAdvantage.toFixed(1)} points`,
      calculation: `Away: (${predictedTotal.toFixed(1)} ÷ 2) + (${awayAdvantage.toFixed(1)} ÷ 2) = ${awayScore.toFixed(1)}\nHome: ${predictedTotal.toFixed(1)} - ${awayScore.toFixed(1)} = ${homeScore.toFixed(1)}`,
      result: `${game.home_team.abbreviation} ${Math.round(homeScore)}, ${game.away_team.abbreviation} ${Math.round(awayScore)}`,
      impact: 'neutral'
    })
  } else {
    // Even game - split evenly
    homeScore = predictedTotal / 2
    awayScore = predictedTotal / 2
    
    log.steps.push({
      step: stepNum++,
      title: 'Score Distribution',
      description: 'Even matchup (no spread)',
      calculation: `Both teams: ${predictedTotal.toFixed(1)} ÷ 2 = ${homeScore.toFixed(1)}`,
      result: `${game.home_team.abbreviation} ${Math.round(homeScore)}, ${game.away_team.abbreviation} ${Math.round(awayScore)}`,
      impact: 'neutral'
    })
  }
  
  // Round to reasonable numbers
  homeScore = Math.round(homeScore)
  awayScore = Math.round(awayScore)
  const actualTotal = homeScore + awayScore
  
  reasoning.push(`📊 Final prediction: ${game.home_team.abbreviation} ${homeScore}, ${game.away_team.abbreviation} ${awayScore} (Total: ${actualTotal})`)
  
  // Update log with final prediction
  log.finalPrediction = {
    homeScore,
    awayScore,
    total: actualTotal,
    margin: homeScore - awayScore,
    winner: homeScore > awayScore ? game.home_team.name : game.away_team.name
  }
  
  log.vegasComparison = {
    totalLine: vegasTotal,
    spreadLine: vegasSpread,
    totalGap: actualTotal - vegasTotal,
    spreadGap: (homeScore - awayScore) - vegasSpread
  }
  
  return {
    homeScore,
    awayScore,
    totalPoints: actualTotal,
    marginOfVictory: homeScore - awayScore,
    winner: homeScore > awayScore ? 'home' : 'away',
    reasoning
  }
}

/**
 * Get sport-specific scoring adjustments
 */
function getSportScoringFactor(sport: string, vegasTotal: number): { adjustment: number; reasoning: string[] } {
  const reasoning: string[] = []
  
  switch (sport.toLowerCase()) {
    case 'nfl':
      // NFL: Look for high-scoring games (48+)
      if (vegasTotal >= 52) {
        reasoning.push(`🏈 NFL: Elite offensive matchup (${vegasTotal} total)`)
        return { adjustment: 4, reasoning }
      } else if (vegasTotal >= 48) {
        reasoning.push(`🏈 NFL: High-scoring game expected (${vegasTotal} total)`)
        return { adjustment: 3, reasoning }
      } else if (vegasTotal >= 45) {
        reasoning.push(`🏈 NFL: Above-average scoring (${vegasTotal} total)`)
        return { adjustment: 2, reasoning }
      } else {
        reasoning.push(`🏈 NFL: Moderate total (${vegasTotal})`)
        return { adjustment: 0, reasoning }
      }
    
    case 'nba':
      // NBA: Look for fast-pace games (230+)
      if (vegasTotal >= 235) {
        reasoning.push(`🏀 NBA: Elite pace game (${vegasTotal} total) - both teams push tempo`)
        return { adjustment: 6, reasoning }
      } else if (vegasTotal >= 230) {
        reasoning.push(`🏀 NBA: Fast-paced game (${vegasTotal} total)`)
        return { adjustment: 4, reasoning }
      } else if (vegasTotal >= 225) {
        reasoning.push(`🏀 NBA: Above-average pace (${vegasTotal} total)`)
        return { adjustment: 2, reasoning }
      } else {
        reasoning.push(`🏀 NBA: Moderate pace (${vegasTotal})`)
        return { adjustment: 0, reasoning }
      }
    
    case 'mlb':
      // MLB: Look for hitter-friendly games (9+)
      if (vegasTotal >= 10) {
        reasoning.push(`⚾ MLB: Premium hitter's park or weak pitching (${vegasTotal} total)`)
        return { adjustment: 1.5, reasoning }
      } else if (vegasTotal >= 9) {
        reasoning.push(`⚾ MLB: Above-average run environment (${vegasTotal} total)`)
        return { adjustment: 1, reasoning }
      } else if (vegasTotal >= 8) {
        reasoning.push(`⚾ MLB: Moderate scoring (${vegasTotal} total)`)
        return { adjustment: 0.5, reasoning }
      } else {
        reasoning.push(`⚾ MLB: Pitcher's duel expected (${vegasTotal})`)
        return { adjustment: 0, reasoning }
      }
    
    default:
      return { adjustment: 0, reasoning: [`Unknown sport: ${sport}`] }
  }
}

/**
 * Get high-scoring threshold per sport
 */
function getHighScoringThreshold(sport: string): number {
  switch (sport.toLowerCase()) {
    case 'nfl': return 48
    case 'nba': return 230
    case 'mlb': return 9
    default: return 200
  }
}

/**
 * STEP 2: Analyze game and generate pick based on prediction
 */
export function analyzeGame(game: CapperGame): { pick: CapperPick | null; log: PredictionLog } {
  console.log(`\n🔥 IFRIT analyzing: ${game.away_team.name} @ ${game.home_team.name}`)
  
  // Initialize prediction log
  const log: PredictionLog = {
    timestamp: new Date().toISOString(),
    capper: 'Ifrit',
    game: `${game.away_team.name} @ ${game.home_team.name}`,
    steps: [],
    finalPrediction: { homeScore: 0, awayScore: 0, total: 0, margin: 0, winner: '' },
    vegasComparison: { totalLine: null, spreadLine: null, totalGap: null, spreadGap: null },
    confidenceBreakdown: { 
      totalConfidence: null, 
      spreadConfidence: null, 
      moneylineConfidence: null, 
      selectedBet: '', 
      finalConfidence: 0 
    },
    decisionFactors: {
      passedFavoriteRule: false,
      passedMinConfidence: false,
      bestOddsAvailable: 0,
      unitsAllocated: 0
    }
  }
  
  // STEP 1: Make score prediction FIRST
  const prediction = predictGameScore(game, log)
  console.log(`📊 Prediction: ${prediction.homeScore}-${prediction.awayScore} (Total: ${prediction.totalPoints})`)
  
  // STEP 2: Compare to Vegas odds
  const confidenceAnalysis = calculateConfidenceFromPrediction(prediction, game)
  
  // Add confidence analysis to log
  let stepNum = log.steps.length + 1
  log.steps.push({
    step: stepNum++,
    title: 'Confidence Analysis',
    description: 'Comparing prediction to Vegas odds to calculate confidence levels',
    calculation: `Total Gap: ${log.vegasComparison.totalGap?.toFixed(1)} pts | Spread Gap: ${log.vegasComparison.spreadGap?.toFixed(1)} pts`,
    result: `Total: ${confidenceAnalysis.totalConfidence}% | Spread: ${confidenceAnalysis.spreadConfidence}% | ML: ${confidenceAnalysis.moneylineConfidence}%`,
    impact: 'neutral'
  })
  
  // Add detailed confidence reasoning to log
  confidenceAnalysis.reasoning.forEach((reason) => {
    log.steps.push({
      step: stepNum++,
      title: 'Confidence Factor',
      description: reason,
      result: reason.includes('🔥') || reason.includes('💎') ? 'Strong edge detected' : 
              reason.includes('✅') ? 'Good value found' :
              reason.includes('⚠️') ? 'Marginal value' : 
              reason.includes('❌') ? 'No value' : 'Analysis complete',
      impact: reason.includes('🔥') || reason.includes('💎') || reason.includes('✅') ? 'positive' :
              reason.includes('❌') ? 'negative' : 'neutral'
    })
  })
  
  // Update log with confidence breakdown
  log.confidenceBreakdown.totalConfidence = confidenceAnalysis.totalConfidence
  log.confidenceBreakdown.spreadConfidence = confidenceAnalysis.spreadConfidence
  log.confidenceBreakdown.moneylineConfidence = confidenceAnalysis.moneylineConfidence
  
  // STEP 3: Decide what to bet based on confidence levels
  const picks: Array<{
    type: 'total' | 'spread' | 'moneyline'
    confidence: number
  }> = []
  
  if (confidenceAnalysis.totalConfidence !== null) {
    picks.push({ type: 'total', confidence: confidenceAnalysis.totalConfidence })
  }
  if (confidenceAnalysis.spreadConfidence !== null) {
    picks.push({ type: 'spread', confidence: confidenceAnalysis.spreadConfidence })
  }
  if (confidenceAnalysis.moneylineConfidence !== null) {
    picks.push({ type: 'moneyline', confidence: confidenceAnalysis.moneylineConfidence })
  }
  
  // Sort by confidence and pick the best one
  picks.sort((a, b) => b.confidence - a.confidence)
  
  log.steps.push({
    step: stepNum++,
    title: 'Bet Type Selection',
    description: 'Selecting best bet type based on confidence levels',
    result: picks.length > 0 ? `Available: ${picks.map(p => `${p.type} (${p.confidence}%)`).join(', ')}` : 'No valid bets found',
    impact: picks.length > 0 ? 'neutral' : 'negative'
  })
  
  if (picks.length === 0) {
    console.log(`⚠️ No valid picks found`)
    log.steps.push({
      step: stepNum++,
      title: 'DECISION: PASS',
      description: 'No valid bet types available',
      result: 'No pick generated',
      impact: 'negative'
    })
    return { pick: null, log }
  }
  
  const bestPick = picks[0]
  log.confidenceBreakdown.selectedBet = bestPick.type
  log.confidenceBreakdown.finalConfidence = bestPick.confidence
  
  log.steps.push({
    step: stepNum++,
    title: 'Best Bet Selected',
    description: `Highest confidence bet type: ${bestPick.type.toUpperCase()}`,
    result: `${bestPick.confidence}% confidence`,
    impact: 'positive'
  })
  
  // Ifrit's minimum confidence threshold
  if (bestPick.confidence < 60) {
    console.log(`⚠️ Best confidence (${bestPick.confidence}%) below Ifrit's threshold (60%)`)
    log.steps.push({
      step: stepNum++,
      title: 'DECISION: PASS',
      description: `Confidence (${bestPick.confidence}%) below Ifrit's minimum threshold (60%)`,
      result: 'No pick generated',
      impact: 'negative'
    })
    log.decisionFactors.passedMinConfidence = false
    return { pick: null, log }
  }
  
  log.decisionFactors.passedMinConfidence = true
  log.steps.push({
    step: stepNum++,
    title: 'Confidence Threshold Check',
    description: `Ifrit requires minimum 60% confidence`,
    result: `✅ PASSED (${bestPick.confidence}% ≥ 60%)`,
    impact: 'positive'
  })
  
  // STEP 4: Generate the actual pick
  const vegasTotal = getTotalLine(game)
  const vegasSpread = getSpreadLine(game)
  
  let pickType: CapperPick['pickType']
  let selection: string
  let odds: number
  let market: 'moneyline' | 'spread' | 'total'
  let side: 'home' | 'away' | 'over' | 'under'
  
  if (bestPick.type === 'total') {
    // Determine if we're betting over or under
    if (prediction.totalPoints > (vegasTotal || 0)) {
      pickType = 'total_over'
      selection = `Over ${vegasTotal?.toFixed(1)}`
      market = 'total'
      side = 'over'
    } else {
      pickType = 'total_under'
      selection = `Under ${vegasTotal?.toFixed(1)}`
      market = 'total'
      side = 'under'
    }
  } else if (bestPick.type === 'spread') {
    // Bet the team we predict to cover
    if (prediction.winner === 'home') {
      pickType = 'spread'
      selection = `${game.home_team.name} ${vegasSpread && vegasSpread < 0 ? '' : '+'}${vegasSpread?.toFixed(1)}`
      market = 'spread'
      side = 'home'
    } else {
      pickType = 'spread'
      selection = `${game.away_team.name} ${vegasSpread && vegasSpread > 0 ? '' : '+'}${(-1 * (vegasSpread || 0)).toFixed(1)}`
      market = 'spread'
      side = 'away'
    }
  } else {
    // Moneyline
    if (prediction.winner === 'home') {
      pickType = 'moneyline'
      selection = `${game.home_team.name} ML`
      market = 'moneyline'
      side = 'home'
    } else {
      pickType = 'moneyline'
      selection = `${game.away_team.name} ML`
      market = 'moneyline'
      side = 'away'
    }
  }
  
  log.steps.push({
    step: stepNum++,
    title: 'Pick Construction',
    description: `Building ${bestPick.type} bet selection`,
    result: `Selection: ${selection}`,
    impact: 'neutral'
  })
  
  // Get best odds for this pick
  const bestOdds = getBestOdds(game, market, side)
  if (!bestOdds) {
    console.log(`⚠️ No odds available for ${selection}`)
    log.steps.push({
      step: stepNum++,
      title: 'DECISION: PASS',
      description: `No odds available for ${selection}`,
      result: 'No pick generated',
      impact: 'negative'
    })
    return { pick: null, log }
  }
  
  odds = bestOdds.odds
  log.decisionFactors.bestOddsAvailable = odds
  
  log.steps.push({
    step: stepNum++,
    title: 'Best Odds Found',
    description: `Searching across all sportsbooks for best odds`,
    result: `${odds > 0 ? '+' : ''}${odds} (${bestOdds.bookmaker})`,
    impact: 'positive'
  })
  
  // Apply global favorite rule
  if (!isValidFavoriteOdds(odds, bestPick.confidence)) {
    console.log(`⚠️ Odds too heavy (${odds}) for confidence level (${bestPick.confidence}%)`)
    log.steps.push({
      step: stepNum++,
      title: 'DECISION: PASS',
      description: `Global Rule: Favorites over -250 require 90%+ confidence`,
      calculation: `Odds: ${odds} | Confidence: ${bestPick.confidence}%`,
      result: `❌ FAILED (odds too heavy for confidence level)`,
      impact: 'negative'
    })
    log.decisionFactors.passedFavoriteRule = false
    return { pick: null, log }
  }
  
  log.decisionFactors.passedFavoriteRule = true
  log.steps.push({
    step: stepNum++,
    title: 'Favorite Rule Check',
    description: `Global Rule: Favorites over -250 require 90%+ confidence`,
    calculation: `Odds: ${odds} | Confidence: ${bestPick.confidence}%`,
    result: odds <= -250 ? `✅ PASSED (${bestPick.confidence}% ≥ 90%)` : `✅ PASSED (odds not heavy favorite)`,
    impact: 'positive'
  })
  
  // Calculate units based on confidence
  let units = 1
  if (bestPick.confidence >= 75) units = 1.5
  if (bestPick.confidence >= 85) units = 2
  
  log.decisionFactors.unitsAllocated = units
  log.steps.push({
    step: stepNum++,
    title: 'Unit Allocation',
    description: `Calculating bet size based on confidence`,
    calculation: bestPick.confidence >= 85 ? `${bestPick.confidence}% ≥ 85% → 2 units` :
                 bestPick.confidence >= 75 ? `${bestPick.confidence}% ≥ 75% → 1.5 units` :
                 `${bestPick.confidence}% < 75% → 1 unit`,
    result: `${units} unit${units > 1 ? 's' : ''}`,
    impact: units >= 1.5 ? 'positive' : 'neutral'
  })
  
  log.steps.push({
    step: stepNum++,
    title: '✅ DECISION: PLACE BET',
    description: `All checks passed - generating pick`,
    result: `${selection} | ${units}u @ ${odds > 0 ? '+' : ''}${odds} | ${bestPick.confidence}% confidence`,
    impact: 'positive'
  })
  
  // Combine all reasoning
  const fullReasoning = [
    ...prediction.reasoning,
    '---',
    ...confidenceAnalysis.reasoning,
    '---',
    `🎯 Best bet: ${selection} (${bestPick.confidence}% confidence)`,
    `💰 Betting ${units} units at ${odds > 0 ? '+' : ''}${odds}`
  ]
  
  console.log(`✅ Pick generated: ${selection} (${bestPick.confidence}% confidence, ${units}u)`)
  
  return {
    pick: {
      gameId: game.id,
      pickType,
      selection,
      odds,
      units,
      confidence: bestPick.confidence,
      reasoning: fullReasoning,
      scorePrediction: prediction,
      dataPoints: {
        avgOdds: getAverageOdds(game, market, side) || odds,
        totalLine: vegasTotal ?? undefined,
        spreadLine: vegasSpread ?? undefined,
        bestBookmaker: bestOdds.bookmaker,
        predictedScore: `${prediction.homeScore}-${prediction.awayScore}`,
        predictionLog: log, // Include full log in data points
      },
    },
    log
  }
}

/**
 * Batch analyze multiple games and return best picks with logs
 * 
 * @param games - Games to analyze
 * @param maxPicks - Maximum number of picks to return
 * @param existingPicksByGame - Optional map of game_id -> existing pick types to avoid duplicates
 */
export function analyzeBatch(
  games: CapperGame[], 
  maxPicks: number = 3,
  existingPicksByGame?: Map<string, Set<string>>
): Array<{ pick: CapperPick; log: PredictionLog }> {
  console.log(`\n🔥 IFRIT analyzing ${games.length} games...`)
  
  const results: Array<{ pick: CapperPick; log: PredictionLog }> = []
  
  for (const game of games) {
    // Check if we already have a pick on this game for the same bet type
    if (existingPicksByGame) {
      const existingTypes = existingPicksByGame.get(game.id) || new Set<string>()
      
      const result = analyzeGame(game)
      
      if (result.pick) {
        // Normalize pick type (total_over/total_under -> total)
        const basePickType = result.pick.pickType.startsWith('total_') ? 'total' : result.pick.pickType
        
        if (existingTypes.has(basePickType)) {
          console.log(`⏭️ Skipping ${result.log.game} - already have ${basePickType} pick on this game`)
          result.log.steps.push({
            step: result.log.steps.length + 1,
            title: 'DUPLICATE CHECK: SKIP',
            description: `Already have ${basePickType} pick on this game`,
            result: 'Pick not generated (duplicate prevention)',
            impact: 'negative'
          })
          continue
        }
        
        results.push({ pick: result.pick, log: result.log })
      } else {
        // Log the pass decision
        console.log(`⏭️ Passed on ${result.log.game}`)
      }
    } else {
      // No duplicate checking
      const result = analyzeGame(game)
      if (result.pick) {
        results.push({ pick: result.pick, log: result.log })
      } else {
        console.log(`⏭️ Passed on ${result.log.game}`)
      }
    }
  }
  
  console.log(`\n✅ Generated ${results.length} picks`)
  
  // Sort by confidence and return top picks
  return results
    .sort((a, b) => b.pick.confidence - a.pick.confidence)
    .slice(0, maxPicks)
}
