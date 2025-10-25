/**
 * Shared logic and utilities for all cappers
 */

export interface CapperGame {
  id: string
  sport: string
  home_team: { name: string; abbreviation: string }
  away_team: { name: string; abbreviation: string }
  game_date: string
  game_time: string
  status: string
  odds: {
    [bookmaker: string]: {
      moneyline?: { home: number; away: number }
      spread?: { home: number; away: number; line: number }
      total?: { over: number; under: number; line: number }
    }
  }
}

/**
 * Score prediction that cappers must make FIRST before looking at odds
 */
export interface ScorePrediction {
  homeScore: number
  awayScore: number
  totalPoints: number
  marginOfVictory: number // Positive = home wins, negative = away wins
  winner: 'home' | 'away'
  reasoning: string[]
}

export interface CapperPick {
  gameId: string
  pickType: 'moneyline' | 'spread' | 'total_over' | 'total_under'
  selection: string
  odds: number
  units: number
  confidence: number
  reasoning: string[]
  scorePrediction: ScorePrediction // NEW: Store the prediction
  dataPoints: {
    avgOdds?: number
    lineValue?: number
    totalLine?: number
    [key: string]: any
  }
}

/**
 * Global rule: Never pick heavy favorites unless confidence is very high
 * @param odds - American odds (e.g., -250, +150)
 * @param confidence - Confidence percentage (0-100)
 * @returns true if pick is allowed
 */
export function isValidFavoriteOdds(odds: number, confidence: number): boolean {
  // If odds are -250 or worse (more negative), require 90%+ confidence
  if (odds <= -250 && confidence < 90) {
    return false
  }
  return true
}

/**
 * Calculate average odds across all sportsbooks for a given market
 */
export function getAverageOdds(
  game: CapperGame,
  market: 'moneyline' | 'spread' | 'total',
  side: 'home' | 'away' | 'over' | 'under'
): number | null {
  const bookmakers = Object.keys(game.odds)
  const validOdds: number[] = []

  for (const bookmaker of bookmakers) {
    const bookmakerOdds = game.odds[bookmaker]
    
    if (market === 'moneyline' && bookmakerOdds.moneyline) {
      const homeTeam = game.home_team?.name
      const awayTeam = game.away_team?.name
      if (side === 'home' && homeTeam) validOdds.push(bookmakerOdds.moneyline[homeTeam])
      if (side === 'away' && awayTeam) validOdds.push(bookmakerOdds.moneyline[awayTeam])
    } else if (market === 'spread' && bookmakerOdds.spread) {
      const homeTeam = game.home_team?.name
      const awayTeam = game.away_team?.name
      if (side === 'home' && homeTeam) validOdds.push(bookmakerOdds.spread[homeTeam]?.price)
      if (side === 'away' && awayTeam) validOdds.push(bookmakerOdds.spread[awayTeam]?.price)
    } else if (market === 'total' && bookmakerOdds.total) {
      if (side === 'over') validOdds.push(bookmakerOdds.total.Over?.price)
      if (side === 'under') validOdds.push(bookmakerOdds.total.Under?.price)
    }
  }

  if (validOdds.length === 0) return null
  return Math.round(validOdds.reduce((sum, odd) => sum + odd, 0) / validOdds.length)
}

/**
 * Get the best (highest) odds available across all sportsbooks
 */
export function getBestOdds(
  game: CapperGame,
  market: 'moneyline' | 'spread' | 'total',
  side: 'home' | 'away' | 'over' | 'under'
): { odds: number; bookmaker: string } | null {
  const bookmakers = Object.keys(game.odds)
  let bestOdds = -Infinity
  let bestBookmaker = ''

  for (const bookmaker of bookmakers) {
    const bookmakerOdds = game.odds[bookmaker]
    let currentOdds: number | undefined

    if (market === 'moneyline' && bookmakerOdds.moneyline) {
      const homeTeam = game.home_team?.name
      const awayTeam = game.away_team?.name
      currentOdds = side === 'home' ? bookmakerOdds.moneyline[homeTeam] : bookmakerOdds.moneyline[awayTeam]
    } else if (market === 'spread' && bookmakerOdds.spread) {
      const homeTeam = game.home_team?.name
      const awayTeam = game.away_team?.name
      currentOdds = side === 'home' ? bookmakerOdds.spread[homeTeam]?.price : bookmakerOdds.spread[awayTeam]?.price
    } else if (market === 'total' && bookmakerOdds.total) {
      currentOdds = side === 'over' ? bookmakerOdds.total.Over?.price : bookmakerOdds.total.Under?.price
    }

    if (currentOdds !== undefined && currentOdds > bestOdds) {
      bestOdds = currentOdds
      bestBookmaker = bookmaker
    }
  }

  if (bestOdds === -Infinity) return null
  return { odds: bestOdds, bookmaker: bestBookmaker }
}

/**
 * Get the total line (over/under number)
 */
export function getTotalLine(game: CapperGame): number | null {
  // Get average total line across all books
  const bookmakers = Object.keys(game.odds)
  const lines: number[] = []

  for (const bookmaker of bookmakers) {
    const bookmakerOdds = game.odds[bookmaker]
    if (bookmakerOdds.total?.Over?.point !== undefined) {
      lines.push(bookmakerOdds.total.Over.point)
    }
  }

  if (lines.length === 0) return null
  return lines.reduce((sum, line) => sum + line, 0) / lines.length
}

/**
 * Determine if a team is a favorite or underdog
 */
export function getTeamRole(odds: number): 'favorite' | 'underdog' | 'even' {
  if (odds < -110) return 'favorite'
  if (odds > 110) return 'underdog'
  return 'even'
}

/**
 * Calculate implied probability from American odds
 */
export function getImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100)
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }
}

/**
 * Format team name for display
 */
export function formatTeamName(team: { name: string; abbreviation: string }): string {
  return team.abbreviation || team.name
}

/**
 * Get the spread line (average across books, from home team perspective)
 */
export function getSpreadLine(game: CapperGame): number | null {
  const bookmakers = Object.keys(game.odds)
  const lines: number[] = []

  for (const bookmaker of bookmakers) {
    const bookmakerOdds = game.odds[bookmaker]
    const homeTeam = game.home_team?.name
    if (homeTeam && bookmakerOdds.spread?.[homeTeam]?.point !== undefined) {
      lines.push(bookmakerOdds.spread[homeTeam].point)
    }
  }

  if (lines.length === 0) return null
  return lines.reduce((sum, line) => sum + line, 0) / lines.length
}

/**
 * CORE CONFIDENCE CALCULATOR
 * 
 * This is the heart of the capper system!
 * Compare capper's score prediction to Vegas odds to determine confidence and find value bets.
 * 
 * @param prediction - The capper's predicted final score
 * @param game - Game data with current Vegas odds
 * @returns Confidence levels for each bet type and reasoning
 */
export function calculateConfidenceFromPrediction(
  prediction: ScorePrediction,
  game: CapperGame
): {
  totalConfidence: number | null
  spreadConfidence: number | null
  moneylineConfidence: number | null
  reasoning: string[]
} {
  const reasoning: string[] = []
  
  // Get Vegas lines
  const vegasTotalLine = getTotalLine(game)
  const vegasSpreadLine = getSpreadLine(game) // From home team perspective (negative = home favored)
  
  let totalConfidence: number | null = null
  let spreadConfidence: number | null = null
  let moneylineConfidence: number | null = null
  
  // ============================================
  // 1. TOTAL (O/U) CONFIDENCE
  // ============================================
  if (vegasTotalLine !== null) {
    const predictedTotal = prediction.totalPoints
    const difference = Math.abs(predictedTotal - vegasTotalLine)
    
    // Calculate confidence based on gap between prediction and Vegas line
    // Bigger gap = higher confidence (we see something Vegas doesn't)
    if (difference >= 15) {
      totalConfidence = 90 // MASSIVE edge
      reasoning.push(`🔥 MASSIVE total edge: Predicted ${predictedTotal} vs Vegas ${vegasTotalLine.toFixed(1)} (${difference.toFixed(1)} point gap!)`)
    } else if (difference >= 10) {
      totalConfidence = 80 // Strong edge
      reasoning.push(`💎 Strong total edge: Predicted ${predictedTotal} vs Vegas ${vegasTotalLine.toFixed(1)} (${difference.toFixed(1)} point gap)`)
    } else if (difference >= 7) {
      totalConfidence = 70 // Good edge
      reasoning.push(`✅ Good total edge: Predicted ${predictedTotal} vs Vegas ${vegasTotalLine.toFixed(1)} (${difference.toFixed(1)} point gap)`)
    } else if (difference >= 4) {
      totalConfidence = 60 // Moderate edge
      reasoning.push(`⚡ Moderate total edge: Predicted ${predictedTotal} vs Vegas ${vegasTotalLine.toFixed(1)} (${difference.toFixed(1)} point gap)`)
    } else {
      totalConfidence = 50 // Minimal edge - probably pass
      reasoning.push(`⚠️ Minimal total edge: Predicted ${predictedTotal} vs Vegas ${vegasTotalLine.toFixed(1)} (only ${difference.toFixed(1)} point gap)`)
    }
  }
  
  // ============================================
  // 2. SPREAD & MONEYLINE CONFIDENCE
  // ============================================
  if (vegasSpreadLine !== null) {
    const predictedMargin = prediction.marginOfVictory // Positive = home wins
    const vegasMargin = vegasSpreadLine // Negative = home favored
    
    // Check if we agree on winner
    const predictWinner = predictedMargin > 0 ? 'home' : 'away'
    const vegasWinner = vegasMargin < 0 ? 'home' : 'away'
    
    if (predictWinner !== vegasWinner) {
      // ========================================
      // SCENARIO A: We disagree on winner!
      // ========================================
      // This is HUGE - we think the underdog wins outright
      moneylineConfidence = 85
      reasoning.push(`🚨 MAJOR DISAGREEMENT: We predict ${predictWinner.toUpperCase()} wins, Vegas favors ${vegasWinner.toUpperCase()}!`)
      reasoning.push(`💰 Strong moneyline underdog value detected`)
      
      spreadConfidence = 80
      reasoning.push(`💪 Strong spread value: Our margin (${predictedMargin > 0 ? '+' : ''}${predictedMargin.toFixed(1)}) vs Vegas (${vegasMargin > 0 ? '+' : ''}${vegasMargin.toFixed(1)})`)
    } else {
      // ========================================
      // SCENARIO B: We agree on winner
      // ========================================
      // Check if our predicted margin gives us spread value
      const ourMargin = Math.abs(predictedMargin)
      const vegasLine = Math.abs(vegasMargin)
      const marginDiff = ourMargin - vegasLine
      
      if (marginDiff >= 7) {
        // We predict they win by 7+ MORE than Vegas spread
        spreadConfidence = 85
        reasoning.push(`🔥 Big spread edge: We see ${ourMargin.toFixed(1)} pt win, Vegas only ${vegasLine.toFixed(1)} spread`)
      } else if (marginDiff >= 4) {
        // We predict they win by 4-6 more than spread
        spreadConfidence = 75
        reasoning.push(`✅ Good spread value: Predicted margin ${ourMargin.toFixed(1)} vs spread ${vegasLine.toFixed(1)}`)
      } else if (marginDiff >= 1) {
        // We predict they win by 1-3 more than spread
        spreadConfidence = 65
        reasoning.push(`⚡ Slight spread edge: Predicted margin ${ourMargin.toFixed(1)} vs spread ${vegasLine.toFixed(1)}`)
      } else if (marginDiff >= -3) {
        // Close to the line (within 3 points)
        spreadConfidence = 55
        reasoning.push(`⚠️ Marginal spread value: Close to Vegas line (${ourMargin.toFixed(1)} vs ${vegasLine.toFixed(1)})`)
      } else {
        // We predict SMALLER margin than Vegas spread - NO VALUE
        spreadConfidence = 40
        reasoning.push(`❌ No spread value: Predicted margin ${ourMargin.toFixed(1)} < spread ${vegasLine.toFixed(1)}`)
      }
      
      // Moneyline confidence based on predicted margin
      if (ourMargin >= 14) {
        moneylineConfidence = 85
        reasoning.push(`💰 Strong moneyline: Predicted blowout (${ourMargin.toFixed(1)} pt margin)`)
      } else if (ourMargin >= 10) {
        moneylineConfidence = 80
        reasoning.push(`💰 Strong moneyline: Predicted ${ourMargin.toFixed(1)} pt win`)
      } else if (ourMargin >= 7) {
        moneylineConfidence = 70
        reasoning.push(`✅ Good moneyline: Predicted ${ourMargin.toFixed(1)} pt win`)
      } else if (ourMargin >= 4) {
        moneylineConfidence = 60
        reasoning.push(`⚡ Moderate moneyline: Predicted ${ourMargin.toFixed(1)} pt win`)
      } else {
        moneylineConfidence = 55
        reasoning.push(`⚠️ Close game: Predicted ${ourMargin.toFixed(1)} pt margin`)
      }
    }
  }
  
  return {
    totalConfidence,
    spreadConfidence,
    moneylineConfidence,
    reasoning
  }
}

