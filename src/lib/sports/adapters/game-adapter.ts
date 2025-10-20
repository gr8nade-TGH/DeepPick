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
      // Basic ratings
      pace: 102,
      offensiveRating: 112.8,
      defensiveRating: 110.3,
      
      // Lineup synergy data
      lineupNetRating: 3.1,
      starterMinutesShare: 0.78,
      lineupMinutes: 180,
      lineupConfirmed: true,
      
      // Shooting profile data
      threePointRate: 0.35,
      threePointPct: 0.348,
      rimFGPct: 0.65,
      oppThreePointPct: 0.352,
      oppRimFGPct: 0.64,
      
      // Schedule data
      daysRest: 2,
      travelDistance: 0,
      
      // Recent form
      recentForm: [1, 0, 1, 1, 1], // Last 5 games (1=win, 0=loss)
    },
  }

  const awayTeam: TeamInfo = {
    id: typeof game.away_team === 'string' ? game.away_team : game.away_team.abbreviation,
    name: typeof game.away_team === 'string' ? game.away_team : game.away_team.name,
    abbreviation: typeof game.away_team === 'string' ? game.away_team : game.away_team.abbreviation,
    stats: {
      // Basic ratings
      pace: 100,
      offensiveRating: 115.2,
      defensiveRating: 108.7,
      
      // Lineup synergy data
      lineupNetRating: 5.2,
      starterMinutesShare: 0.75,
      lineupMinutes: 200,
      lineupConfirmed: true,
      
      // Shooting profile data
      threePointRate: 0.38,
      threePointPct: 0.362,
      rimFGPct: 0.68,
      oppThreePointPct: 0.345,
      oppRimFGPct: 0.62,
      
      // Schedule data
      daysRest: 1,
      travelDistance: 0,
      
      // Recent form
      recentForm: [1, 1, 0, 1, 0], // Last 5 games (1=win, 0=loss)
    },
  }

  // Extract average odds from bookmakers
  const { spread, total, homeMoneyline, awayMoneyline } = extractAverageOdds(game)
  
  // Debug logging
  console.log('🔍 Game adapter debug:', {
    gameId: game.id,
    hasOdds: !!game.odds,
    oddsType: typeof game.odds,
    oddsKeys: game.odds ? Object.keys(game.odds) : [],
    extracted: { spread, total, homeMoneyline, awayMoneyline }
  })

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
  // Game has odds by bookmaker (stored as sportsbooks from The Odds API)
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

  // Calculate averages from The Odds API structure
  let spreadSum = 0
  let spreadCount = 0
  let totalSum = 0
  let totalCount = 0
  let homeMLSum = 0
  let homeMLCount = 0
  let awayMLSum = 0
  let awayMLCount = 0

  for (const book of bookmakers) {
    // Debug: Log the book structure
    console.log('🔍 Book structure:', JSON.stringify(book, null, 2))
    
    // ACTUAL STRUCTURE: bookmaker.spread.line, bookmaker.total.line, bookmaker.moneyline.home/away
    if (book?.spread?.line !== undefined) {
      spreadSum += book.spread.line
      spreadCount++
      console.log('✅ Found spread (actual structure):', book.spread.line)
    }

    if (book?.total?.line !== undefined) {
      totalSum += book.total.line
      totalCount++
      console.log('✅ Found total (actual structure):', book.total.line)
    }

    if (book?.moneyline?.home !== undefined) {
      homeMLSum += book.moneyline.home
      homeMLCount++
      console.log('✅ Found home ML (actual structure):', book.moneyline.home)
    }

    if (book?.moneyline?.away !== undefined) {
      awayMLSum += book.moneyline.away
      awayMLCount++
      console.log('✅ Found away ML (actual structure):', book.moneyline.away)
    }
  }

  return {
    spread: spreadCount > 0 ? spreadSum / spreadCount : undefined,
    total: totalCount > 0 ? totalSum / totalCount : undefined,
    homeMoneyline: homeMLCount > 0 ? Math.round(homeMLSum / homeMLCount) : undefined,
    awayMoneyline: awayMLCount > 0 ? Math.round(awayMLSum / awayMLCount) : undefined,
  }
}

