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

export interface CapperPick {
  gameId: string
  pickType: 'moneyline' | 'spread' | 'total_over' | 'total_under'
  selection: string
  odds: number
  units: number
  confidence: number
  reasoning: string[]
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
      if (side === 'home') validOdds.push(bookmakerOdds.moneyline.home)
      if (side === 'away') validOdds.push(bookmakerOdds.moneyline.away)
    } else if (market === 'spread' && bookmakerOdds.spread) {
      if (side === 'home') validOdds.push(bookmakerOdds.spread.home)
      if (side === 'away') validOdds.push(bookmakerOdds.spread.away)
    } else if (market === 'total' && bookmakerOdds.total) {
      if (side === 'over') validOdds.push(bookmakerOdds.total.over)
      if (side === 'under') validOdds.push(bookmakerOdds.total.under)
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
      currentOdds = side === 'home' ? bookmakerOdds.moneyline.home : bookmakerOdds.moneyline.away
    } else if (market === 'spread' && bookmakerOdds.spread) {
      currentOdds = side === 'home' ? bookmakerOdds.spread.home : bookmakerOdds.spread.away
    } else if (market === 'total' && bookmakerOdds.total) {
      currentOdds = side === 'over' ? bookmakerOdds.total.over : bookmakerOdds.total.under
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
    if (bookmakerOdds.total?.line !== undefined) {
      lines.push(bookmakerOdds.total.line)
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

