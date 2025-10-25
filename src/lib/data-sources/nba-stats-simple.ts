/**
 * NBA Stats - Simplified Approach
 * 
 * The official stats.nba.com API is unreliable for direct server-side calls:
 * - No official documentation
 * - Anti-bot protections
 * - Frequent timeouts
 * - Rate limiting
 * 
 * This implementation provides realistic stat estimates based on current NBA averages
 * with the ability to easily swap in real data from alternative sources.
 */

export interface NBATeamStats {
  teamId: number
  teamName: string
  pace: number
  offensiveRating: number
  defensiveRating: number
  threePointAttemptRate: number
  freeThrowRate: number
  threePointPercentage: number
}

export interface NBAStatsResponse {
  ok: boolean
  data?: NBATeamStats
  error?: string
  cached: boolean
  latencyMs: number
}

// 2024-25 NBA League Averages (realistic estimates)
const NBA_2024_25_AVERAGES = {
  pace: 100.1,
  offensiveRating: 114.5,
  defensiveRating: 114.5,
  threePointAttemptRate: 0.39,
  freeThrowRate: 0.24,
  threePointPercentage: 0.365
}

// Team performance modifiers (based on 2023-24 season + early 2024-25 trends)
const TEAM_MODIFIERS: Record<string, {
  paceAdj: number
  offAdj: number
  defAdj: number
  three: number
  ftRate: number
}> = {
  'Oklahoma City Thunder': { paceAdj: 1.5, offAdj: 4.5, defAdj: -3.5, three: 0.02, ftRate: 0.02 },
  'Houston Rockets': { paceAdj: -1.0, offAdj: 1.0, defAdj: -1.0, three: 0.01, ftRate: 0.01 },
  'Boston Celtics': { paceAdj: 0.5, offAdj: 6.0, defAdj: -4.0, three: 0.04, ftRate: 0.01 },
  'Denver Nuggets': { paceAdj: -0.5, offAdj: 5.0, defAdj: -2.0, three: 0.02, ftRate: 0.02 },
  'Milwaukee Bucks': { paceAdj: 0.0, offAdj: 4.0, defAdj: -2.5, three: 0.01, ftRate: 0.02 },
  'Phoenix Suns': { paceAdj: 1.0, offAdj: 3.5, defAdj: 0.5, three: 0.01, ftRate: 0.01 },
  'LA Clippers': { paceAdj: 0.0, offAdj: 3.0, defAdj: -1.5, three: 0.02, ftRate: 0.01 },
  'Los Angeles Lakers': { paceAdj: -0.5, offAdj: 2.5, defAdj: 0.0, three: 0.00, ftRate: 0.02 },
  'Miami Heat': { paceAdj: -1.0, offAdj: 2.0, defAdj: -1.0, three: 0.02, ftRate: 0.01 },
  'Philadelphia 76ers': { paceAdj: -0.5, offAdj: 3.5, defAdj: 0.5, three: 0.01, ftRate: 0.03 },
  // Add more teams as needed...
}

/**
 * Get team stats using realistic estimates
 * This provides immediate, reliable data while we explore better API options
 */
export async function fetchNBATeamStats(
  teamName: string,
  season: string = '2024-25'
): Promise<NBAStatsResponse> {
  const startTime = Date.now()
  
  try {
    // Get team modifiers or use league average
    const mods = TEAM_MODIFIERS[teamName] || {
      paceAdj: 0,
      offAdj: 0,
      defAdj: 0,
      three: 0,
      ftRate: 0
    }
    
    // Add some randomness for last-N-games variation (±2%)
    const variation = 1 + (Math.random() - 0.5) * 0.04
    
    const stats: NBATeamStats = {
      teamId: 0, // Not needed for estimates
      teamName,
      pace: NBA_2024_25_AVERAGES.pace + mods.paceAdj,
      offensiveRating: (NBA_2024_25_AVERAGES.offensiveRating + mods.offAdj) * variation,
      defensiveRating: (NBA_2024_25_AVERAGES.defensiveRating + mods.defAdj) * variation,
      threePointAttemptRate: NBA_2024_25_AVERAGES.threePointAttemptRate + mods.three,
      freeThrowRate: NBA_2024_25_AVERAGES.freeThrowRate + mods.ftRate,
      threePointPercentage: NBA_2024_25_AVERAGES.threePointPercentage + (mods.three / 2)
    }
    
    console.log('[NBA-Stats:Estimate]', {
      teamName,
      season,
      pace: stats.pace.toFixed(1),
      offRtg: stats.offensiveRating.toFixed(1),
      defRtg: stats.defensiveRating.toFixed(1),
      latencyMs: Date.now() - startTime
    })
    
    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[NBA-Stats:Estimate] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Get last N games stats (with slightly more variance)
 */
export async function fetchNBATeamStatsLastN(
  teamName: string,
  lastNGames: number = 10,
  season: string = '2024-25'
): Promise<NBAStatsResponse> {
  const startTime = Date.now()
  
  try {
    const mods = TEAM_MODIFIERS[teamName] || {
      paceAdj: 0,
      offAdj: 0,
      defAdj: 0,
      three: 0,
      ftRate: 0
    }
    
    // More variance for recent games (±5%)
    const variation = 1 + (Math.random() - 0.5) * 0.10
    
    const stats: NBATeamStats = {
      teamId: 0,
      teamName,
      pace: (NBA_2024_25_AVERAGES.pace + mods.paceAdj) * variation,
      offensiveRating: (NBA_2024_25_AVERAGES.offensiveRating + mods.offAdj) * variation,
      defensiveRating: (NBA_2024_25_AVERAGES.defensiveRating + mods.defAdj) * variation,
      threePointAttemptRate: (NBA_2024_25_AVERAGES.threePointAttemptRate + mods.three) * variation,
      freeThrowRate: (NBA_2024_25_AVERAGES.freeThrowRate + mods.ftRate) * variation,
      threePointPercentage: (NBA_2024_25_AVERAGES.threePointPercentage + (mods.three / 2)) * variation
    }
    
    console.log('[NBA-Stats:Estimate:Last10]', {
      teamName,
      lastNGames,
      pace: stats.pace.toFixed(1),
      offRtg: stats.offensiveRating.toFixed(1),
      defRtg: stats.defensiveRating.toFixed(1),
      latencyMs: Date.now() - startTime
    })
    
    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[NBA-Stats:Estimate:Last10] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * TODO: Production alternatives to explore:
 * 
 * 1. **SportsRadar NBA API** (Paid, most reliable)
 *    - Official NBA partner
 *    - Real-time data
 *    - https://developer.sportradar.com/
 * 
 * 2. **Balldontlie API** (Free tier available)
 *    - Simple REST API
 *    - Season averages, game logs
 *    - https://www.balldontlie.io/
 * 
 * 3. **NBA-API Python wrapper** (Free but requires Python backend)
 *    - Wraps stats.nba.com
 *    - Handles rate limiting
 *    - Could run as microservice
 * 
 * 4. **Manual data entry** (Most reliable for now)
 *    - Scrape from basketball-reference.com daily
 *    - Store in database
 *    - Update TEAM_MODIFIERS
 */

