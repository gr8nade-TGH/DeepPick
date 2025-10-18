/**
 * IFRIT - Aggressive Value Hunter
 * 
 * Focus: High-scoring games, fast pace, overs, underdogs with value
 * Philosophy: "High risk, high reward. Attack market inefficiencies."
 */

import {
  type CapperGame,
  type CapperPick,
  isValidFavoriteOdds,
  getAverageOdds,
  getBestOdds,
  getTotalLine,
  getTeamRole,
  formatTeamName,
} from './shared-logic'

/**
 * Ifrit's main analysis function
 */
export function analyzeGame(game: CapperGame): CapperPick | null {
  const reasoning: string[] = []
  let confidence = 50 // Start at baseline
  
  // Get total line
  const totalLine = getTotalLine(game)
  
  if (!totalLine) {
    console.log(`⚠️ Ifrit: No total line available for ${game.away_team.name} @ ${game.home_team.name}`)
    return null
  }

  // IFRIT'S STRATEGY: Look for high-scoring games (overs)
  
  // 1. Check if total is high enough to indicate fast-pace game
  const isHighScoringGame = checkHighScoringPotential(game.sport, totalLine)
  
  if (isHighScoringGame.isHigh) {
    confidence += 15
    reasoning.push(`🔥 High total line (${totalLine}) suggests fast-paced, high-scoring game`)
    reasoning.push(isHighScoringGame.reason || '')
  } else {
    // Ifrit prefers high-scoring games
    confidence -= 10
    reasoning.push(`⚠️ Total line (${totalLine}) is moderate - not Ifrit's ideal target`)
  }

  // 2. Get best OVER odds
  const bestOverOdds = getBestOdds(game, 'total', 'over')
  const avgOverOdds = getAverageOdds(game, 'total', 'over')
  
  if (!bestOverOdds || !avgOverOdds) {
    console.log(`⚠️ Ifrit: No over odds available`)
    return null
  }

  // 3. Check for value (best odds vs average)
  const oddsValue = bestOverOdds.odds - avgOverOdds
  if (oddsValue > 5) {
    confidence += 10
    reasoning.push(`💎 Found value: Best odds (${bestOverOdds.odds}) vs avg (${avgOverOdds}) = +${oddsValue.toFixed(0)} value`)
  }

  // 4. Favor overs with plus odds (more value)
  if (bestOverOdds.odds > 100) {
    confidence += 5
    reasoning.push(`⚡ Plus odds (+${bestOverOdds.odds}) on OVER - good value`)
  }

  // 5. Sport-specific adjustments
  const sportBonus = getSportSpecificBonus(game.sport, totalLine)
  confidence += sportBonus.bonus
  if (sportBonus.reason) {
    reasoning.push(sportBonus.reason)
  }

  // 6. Apply global favorite rule (though we're betting totals, not sides)
  // For totals, this doesn't apply, but we check anyway
  if (!isValidFavoriteOdds(bestOverOdds.odds, confidence)) {
    console.log(`⚠️ Ifrit: Odds too heavy for confidence level`)
    return null
  }

  // 7. Minimum confidence threshold for Ifrit (he's aggressive but not reckless)
  if (confidence < 60) {
    console.log(`⚠️ Ifrit: Confidence too low (${confidence}%) - passing on this game`)
    return null
  }

  // 8. Calculate units (Ifrit bets more on higher confidence)
  let units = 1
  if (confidence >= 75) units = 1.5
  if (confidence >= 85) units = 2

  reasoning.push(`🎯 Final confidence: ${confidence}%`)
  reasoning.push(`💰 Betting ${units} units on OVER ${totalLine}`)

  return {
    gameId: game.id,
    pickType: 'total_over',
    selection: `Over ${totalLine}`,
    odds: bestOverOdds.odds,
    units,
    confidence,
    reasoning,
    dataPoints: {
      avgOdds: avgOverOdds,
      totalLine,
      oddsValue,
      bestBookmaker: bestOverOdds.bookmaker,
    },
  }
}

/**
 * Check if game has high-scoring potential based on sport and total line
 */
function checkHighScoringPotential(sport: string, totalLine: number): { isHigh: boolean; reason?: string } {
  switch (sport.toLowerCase()) {
    case 'nfl':
      // NFL: High scoring is 48+
      if (totalLine >= 48) {
        return { isHigh: true, reason: `NFL total of ${totalLine} indicates offensive shootout expected` }
      }
      return { isHigh: false }
    
    case 'nba':
      // NBA: High scoring is 230+
      if (totalLine >= 230) {
        return { isHigh: true, reason: `NBA total of ${totalLine} suggests up-tempo, high-pace game` }
      }
      return { isHigh: false }
    
    case 'mlb':
      // MLB: High scoring is 9+
      if (totalLine >= 9) {
        return { isHigh: true, reason: `MLB total of ${totalLine} indicates hitter-friendly conditions` }
      }
      return { isHigh: false }
    
    default:
      // Generic: Consider anything above average as high
      return { isHigh: totalLine > 200, reason: `Total of ${totalLine} is above average` }
  }
}

/**
 * Get sport-specific confidence bonus
 */
function getSportSpecificBonus(sport: string, totalLine: number): { bonus: number; reason?: string } {
  switch (sport.toLowerCase()) {
    case 'nfl':
      // Extra bonus for really high NFL totals (rare and valuable)
      if (totalLine >= 52) {
        return { bonus: 10, reason: `🏈 Exceptionally high NFL total (${totalLine}) - rare opportunity` }
      }
      return { bonus: 0 }
    
    case 'nba':
      // NBA naturally has high totals, so be more selective
      if (totalLine >= 235) {
        return { bonus: 8, reason: `🏀 Elite NBA pace game (${totalLine}) - both teams push tempo` }
      }
      return { bonus: 0 }
    
    case 'mlb':
      // MLB overs in high-scoring games are Ifrit's bread and butter
      if (totalLine >= 10) {
        return { bonus: 12, reason: `⚾ Premium MLB over spot (${totalLine}) - pitching mismatch likely` }
      }
      return { bonus: 0 }
    
    default:
      return { bonus: 0 }
  }
}

/**
 * Batch analyze multiple games and return best picks
 */
export function analyzeBatch(games: CapperGame[], maxPicks: number = 3): CapperPick[] {
  const picks: CapperPick[] = []
  
  for (const game of games) {
    const pick = analyzeGame(game)
    if (pick) {
      picks.push(pick)
    }
  }
  
  // Sort by confidence and return top picks
  return picks
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxPicks)
}

