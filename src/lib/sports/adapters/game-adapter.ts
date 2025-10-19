/**
 * Game Adapter
 * 
 * Converts existing CapperGame format to new GameInput format
 * This bridges the old system with the new sharp betting system
 */

import type { GameInput, TeamInfo } from '@/types/sharp-betting'
import type { CapperGame } from '@/lib/cappers/shared-logic'

/**
 * Convert CapperGame to GameInput for sharp betting system
 */
export function adaptCapperGameToGameInput(game: CapperGame): GameInput {
  const homeTeam: TeamInfo = {
    id: typeof game.home_team === 'string' ? game.home_team : game.home_team.abbreviation,
    name: typeof game.home_team === 'string' ? game.home_team : game.home_team.name,
    abbreviation: typeof game.home_team === 'string' ? game.home_team : game.home_team.abbreviation,
    stats: {
      // Extract stats from game if available
      // For now, we'll use placeholders that can be filled in later
      pace: 100, // Default NBA pace
      offensiveRating: 110,
      defensiveRating: 110,
      // These would come from external data sources or AI research
    },
  }

  const awayTeam: TeamInfo = {
    id: typeof game.away_team === 'string' ? game.away_team : game.away_team.abbreviation,
    name: typeof game.away_team === 'string' ? game.away_team : game.away_team.name,
    abbreviation: typeof game.away_team === 'string' ? game.away_team : game.away_team.abbreviation,
    stats: {
      pace: 100,
      offensiveRating: 110,
      defensiveRating: 110,
    },
  }

  // Extract average odds from bookmakers
  const { spread, total, homeMoneyline, awayMoneyline } = extractAverageOdds(game)

  return {
    id: game.id,
    sport: game.sport,
    league: game.sport.toUpperCase(), // Use sport as league (NBA, NFL, etc.)
    homeTeam,
    awayTeam,
    gameDate: game.game_date,
    gameTime: game.game_time,
    spread,
    total,
    homeMoneyline,
    awayMoneyline,
    venue: typeof game.home_team === 'string' ? undefined : game.home_team.name, // Use team name as venue
    weather: undefined, // Would be fetched from weather API for outdoor sports
    injuries: [], // Would be fetched from injury API or AI research
    recentGames: [], // Would be fetched from database
  }
}

/**
 * Extract average odds from CapperGame bookmaker odds
 */
function extractAverageOdds(game: CapperGame): {
  spread: number | undefined
  total: number | undefined
  homeMoneyline: number | undefined
  awayMoneyline: number | undefined
} {
  // Game has odds by bookmaker
  if (!game.odds || typeof game.odds !== 'object') {
    return {
      spread: undefined,
      total: undefined,
      homeMoneyline: undefined,
      awayMoneyline: undefined,
    }
  }

  const bookmakers = Object.values(game.odds) as any[]
  if (bookmakers.length === 0) {
    return {
      spread: undefined,
      total: undefined,
      homeMoneyline: undefined,
      awayMoneyline: undefined,
    }
  }

  // Calculate averages
  let spreadSum = 0
  let spreadCount = 0
  let totalSum = 0
  let totalCount = 0
  let homeMLSum = 0
  let homeMLCount = 0
  let awayMLSum = 0
  let awayMLCount = 0

  for (const book of bookmakers) {
    if (book?.markets?.spreads?.home?.point !== undefined) {
      spreadSum += book.markets.spreads.home.point
      spreadCount++
    }

    if (book?.markets?.totals?.over?.point !== undefined) {
      totalSum += book.markets.totals.over.point
      totalCount++
    }

    if (book?.markets?.h2h?.home?.price !== undefined) {
      homeMLSum += book.markets.h2h.home.price
      homeMLCount++
    }

    if (book?.markets?.h2h?.away?.price !== undefined) {
      awayMLSum += book.markets.h2h.away.price
      awayMLCount++
    }
  }

  return {
    spread: spreadCount > 0 ? spreadSum / spreadCount : undefined,
    total: totalCount > 0 ? totalSum / totalCount : undefined,
    homeMoneyline: homeMLCount > 0 ? Math.round(homeMLSum / homeMLCount) : undefined,
    awayMoneyline: awayMLCount > 0 ? Math.round(awayMLSum / awayMLCount) : undefined,
  }
}

