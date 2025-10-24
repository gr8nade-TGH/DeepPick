/**
 * The Odds API - Scores Endpoint
 * 
 * Fetches completed game results to calculate recent form stats.
 * This replaces NBA Stats API with real game results from The Odds API.
 */

export interface GameScore {
  id: string
  sport_key: string
  commence_time: string
  completed: boolean
  home_team: string
  away_team: string
  scores: Array<{
    name: string
    score: string
  }>
}

export interface TeamRecentStats {
  teamName: string
  gamesPlayed: number
  // Offensive stats
  pointsPerGame: number
  // Defensive stats
  pointsAllowedPerGame: number
  // Pace estimation (possessions estimated from total points)
  estimatedPace: number
  // Shooting stats
  avgTotalPoints: number  // Average of game totals (for 3PT/FT estimation)
  // Win/Loss
  wins: number
  losses: number
  // Raw game data for detailed analysis
  recentGames: Array<{
    date: string
    opponent: string
    pointsScored: number
    pointsAllowed: number
    gameTotal: number
    won: boolean
    wasHome: boolean
  }>
}

export interface OddsAPIScoresResponse {
  ok: boolean
  data?: TeamRecentStats
  error?: string
  cached: boolean
  latencyMs: number
}

// Cache to reduce API calls
interface CacheEntry {
  data: TeamRecentStats
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes (games complete, stats change)

/**
 * Fetch recent game scores from The Odds API
 */
async function fetchRecentScores(
  sport: string = 'basketball_nba',
  daysFrom: number = 14  // Look back 2 weeks to find 5 games
): Promise<GameScore[]> {
  const apiKey = process.env.THE_ODDS_API_KEY
  if (!apiKey) {
    throw new Error('THE_ODDS_API_KEY not configured')
  }

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?daysFrom=${daysFrom}&dateFormat=iso`
  
  console.log('[ODDS-API:SCORES] Fetching scores from:', url)
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'x-api-key': apiKey
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[ODDS-API:SCORES] API Error:', response.status, errorText)
    throw new Error(`Odds API returned ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  console.log('[ODDS-API:SCORES] API Response:', {
    dataType: typeof data,
    isArray: Array.isArray(data),
    length: Array.isArray(data) ? data.length : 'N/A',
    sample: Array.isArray(data) && data.length > 0 ? data[0] : data
  })
  return data
}

/**
 * Calculate team's recent form statistics from completed games
 */
export async function fetchTeamRecentForm(
  teamName: string,
  lastNGames: number = 5
): Promise<OddsAPIScoresResponse> {
  const startTime = Date.now()
  
  // Check cache first
  const cacheKey = `nba-recent-${teamName}-${lastNGames}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[ODDS-API:SCORES] Using cached data for', teamName)
    return {
      ok: true,
      data: cached.data,
      cached: true,
      latencyMs: Date.now() - startTime
    }
  }

  try {
    console.log('[ODDS-API:SCORES:FETCH_START]', { teamName, lastNGames })
    
    // Fetch completed games from The Odds API
    const scores = await fetchRecentScores('basketball_nba', 21) // 3 weeks to ensure we get enough games
    
    console.log('[ODDS-API:SCORES:FETCHED_GAMES]', { 
      totalGames: scores.length,
      sampleGame: scores.length > 0 ? scores[0] : null
    })
    
    console.log('[ODDS-API:SCORES] Fetched', scores.length, 'completed games')
    
    // Filter for this team's games (completed only)
    const teamGames = scores
      .filter(game => 
        game.completed && 
        (game.home_team === teamName || game.away_team === teamName)
      )
      .sort((a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime())
      .slice(0, lastNGames) // Take most recent N games

    console.log('[ODDS-API:SCORES] Found', teamGames.length, 'recent games for', teamName)

    if (teamGames.length === 0) {
      console.warn('[ODDS-API:SCORES] No recent games found for', teamName)
      // Return league averages as fallback
      return {
        ok: true,
        data: {
          teamName,
          gamesPlayed: 0,
          pointsPerGame: 112, // League avg
          pointsAllowedPerGame: 112,
          estimatedPace: 100.1,
          avgTotalPoints: 224,
          wins: 0,
          losses: 0,
          recentGames: []
        },
        cached: false,
        latencyMs: Date.now() - startTime
      }
    }

    // Calculate stats from recent games
    let totalPointsScored = 0
    let totalPointsAllowed = 0
    let totalGamePoints = 0
    let wins = 0

    const recentGames = teamGames.map(game => {
      const isHome = game.home_team === teamName
      const teamScore = game.scores.find(s => s.name === teamName)
      const oppScore = game.scores.find(s => s.name !== teamName)
      
      if (!teamScore || !oppScore) {
        console.warn('[ODDS-API:SCORES] Missing scores for game:', game.id)
        return null
      }

      const pointsScored = parseInt(teamScore.score)
      const pointsAllowed = parseInt(oppScore.score)
      const gameTotal = pointsScored + pointsAllowed
      const won = pointsScored > pointsAllowed

      totalPointsScored += pointsScored
      totalPointsAllowed += pointsAllowed
      totalGamePoints += gameTotal
      if (won) wins++

      return {
        date: game.commence_time,
        opponent: isHome ? game.away_team : game.home_team,
        pointsScored,
        pointsAllowed,
        gameTotal,
        won,
        wasHome: isHome
      }
    }).filter(g => g !== null) as TeamRecentStats['recentGames']

    const gamesPlayed = recentGames.length
    const pointsPerGame = totalPointsScored / gamesPlayed
    const pointsAllowedPerGame = totalPointsAllowed / gamesPlayed
    const avgTotalPoints = totalGamePoints / gamesPlayed
    
    // Estimate pace from total points (NBA avg is ~100 possessions = ~224 points)
    // Formula: pace = (totalPoints / 224) * 100
    const estimatedPace = (avgTotalPoints / 224) * 100.1

    const stats: TeamRecentStats = {
      teamName,
      gamesPlayed,
      pointsPerGame,
      pointsAllowedPerGame,
      estimatedPace,
      avgTotalPoints,
      wins,
      losses: gamesPlayed - wins,
      recentGames
    }

    // Cache the result
    cache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    })

    console.log('[ODDS-API:SCORES] Calculated stats for', teamName, {
      gamesPlayed,
      ppg: pointsPerGame.toFixed(1),
      papg: pointsAllowedPerGame.toFixed(1),
      pace: estimatedPace.toFixed(1),
      record: `${wins}-${gamesPlayed - wins}`,
      latencyMs: Date.now() - startTime
    })

    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[ODDS-API:SCORES] Error:', error)
    console.error('[ODDS-API:SCORES] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      teamName,
      lastNGames
    })
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Convert recent form stats to the format expected by factor calculations
 * This maps our PPG/PAPG data to the same structure as NBA Stats API
 */
export function convertRecentFormToStats(recentForm: TeamRecentStats): {
  pace: number
  offensiveRating: number
  defensiveRating: number
  threePointAttemptRate: number
  freeThrowRate: number
  threePointPercentage: number
} {
  // Convert PPG to offensive rating (ORtg = points per 100 possessions)
  // ORtg = (PPG / pace) * 100
  const offensiveRating = (recentForm.pointsPerGame / recentForm.estimatedPace) * 100
  
  // Convert PAPG to defensive rating (DRtg = points allowed per 100 possessions)
  const defensiveRating = (recentForm.pointsAllowedPerGame / recentForm.estimatedPace) * 100
  
  // For 3PT and FT stats, we'll estimate from total points
  // These are rough estimates - we can refine later if needed
  const threePointAttemptRate = 0.39 // League avg (we don't have this data from scores)
  const freeThrowRate = 0.22 // League avg
  const threePointPercentage = 0.35 // League avg

  return {
    pace: recentForm.estimatedPace,
    offensiveRating,
    defensiveRating,
    threePointAttemptRate,
    freeThrowRate,
    threePointPercentage
  }
}

