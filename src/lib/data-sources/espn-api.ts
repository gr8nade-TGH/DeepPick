/**
 * ESPN Hidden API Integration
 * 
 * ESPN provides free, undocumented but stable API endpoints
 * Source: https://gist.github.com/bhaidar/b2fdd34004250932a4a354a2cc15ddd4
 * 
 * Advantages:
 * - Free, no authentication required
 * - Fast and reliable
 * - Comprehensive team and game data
 * - Well-structured JSON responses
 */

export interface ESPNTeamStats {
  id: string
  displayName: string
  abbreviation: string
  record?: {
    wins: number
    losses: number
  }
  // We'll derive advanced stats from game data
  offensiveRating?: number
  defensiveRating?: number
  pace?: number
  threePointAttemptRate?: number
  freeThrowRate?: number
  threePointPercentage?: number
}

export interface ESPNStatsResponse {
  ok: boolean
  data?: ESPNTeamStats
  error?: string
  cached: boolean
  latencyMs: number
}

// Cache to reduce API calls
interface CacheEntry {
  data: ESPNTeamStats
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Fetch NBA team information from ESPN
 */
export async function fetchESPNTeamInfo(
  teamName: string
): Promise<ESPNStatsResponse> {
  const startTime = Date.now()
  
  // Check cache first
  const cacheKey = `nba-team-${teamName}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      ok: true,
      data: cached.data,
      cached: true,
      latencyMs: Date.now() - startTime
    }
  }
  
  try {
    // ESPN NBA Teams API - gets all teams
    const url = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams'
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeepPick/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}`)
    }
    
    const data = await response.json()
    
    // Find the team in the response
    let teamData = null
    if (data.sports && data.sports[0]?.leagues) {
      const teams = data.sports[0].leagues[0]?.teams || []
      teamData = teams.find((t: any) => {
        const team = t.team
        return (
          team.displayName === teamName ||
          team.name === teamName ||
          team.abbreviation === teamName
        )
      })?.team
    }
    
    if (!teamData) {
      throw new Error(`Team not found: ${teamName}`)
    }
    
    // Parse team stats
    const stats: ESPNTeamStats = {
      id: teamData.id,
      displayName: teamData.displayName,
      abbreviation: teamData.abbreviation,
      record: teamData.record ? {
        wins: parseInt(teamData.record.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || '0'),
        losses: parseInt(teamData.record.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || '0')
      } : undefined,
      // Advanced stats will be fetched separately from scoreboard data
      offensiveRating: undefined,
      defensiveRating: undefined,
      pace: undefined,
      threePointAttemptRate: undefined,
      freeThrowRate: undefined,
      threePointPercentage: undefined
    }
    
    // Cache the result
    cache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    })
    
    console.log('[ESPN-API]', {
      team: teamName,
      found: teamData.displayName,
      record: `${stats.record?.wins}-${stats.record?.losses}`,
      latencyMs: Date.now() - startTime
    })
    
    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[ESPN-API] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Fetch recent game stats for a team from ESPN scoreboard
 * This gives us actual game performance data
 */
export async function fetchESPNTeamRecentStats(
  teamName: string,
  lastNGames: number = 10
): Promise<ESPNStatsResponse> {
  const startTime = Date.now()
  
  // Check cache first
  const cacheKey = `nba-recent-${teamName}-${lastNGames}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      ok: true,
      data: cached.data,
      cached: true,
      latencyMs: Date.now() - startTime
    }
  }
  
  try {
    // Get current scoreboard to find recent games
    // Note: ESPN's scoreboard only shows today's games
    // For historical stats, we'd need to query specific dates
    const url = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeepPick/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`ESPN Scoreboard API returned ${response.status}`)
    }
    
    const data = await response.json()
    
    // For now, return basic team info
    // TODO: Implement historical game data fetching
    const stats: ESPNTeamStats = {
      id: '',
      displayName: teamName,
      abbreviation: '',
      // These would come from aggregating recent game data
      offensiveRating: undefined,
      defensiveRating: undefined,
      pace: undefined,
      threePointAttemptRate: undefined,
      freeThrowRate: undefined,
      threePointPercentage: undefined
    }
    
    console.log('[ESPN-API:Recent]', {
      team: teamName,
      lastNGames,
      note: 'Historical stats not yet implemented',
      latencyMs: Date.now() - startTime
    })
    
    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[ESPN-API:Recent] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Get today's NBA games from ESPN
 * Useful for live game data and current matchups
 */
export async function fetchESPNScoreboard() {
  try {
    const url = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeepPick/1.0',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`ESPN Scoreboard API returned ${response.status}`)
    }
    
    const data = await response.json()
    
    console.log('[ESPN-API:Scoreboard]', {
      gamesCount: data.events?.length || 0,
      date: data.day?.date
    })
    
    return {
      ok: true,
      games: data.events || [],
      date: data.day?.date
    }
  } catch (error) {
    console.error('[ESPN-API:Scoreboard] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

