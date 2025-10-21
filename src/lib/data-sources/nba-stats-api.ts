/**
 * NBA Stats API Adapter
 * Official NBA statistics from stats.nba.com
 * 
 * This is a free, official API that doesn't require authentication
 * but has rate limiting. We use caching to minimize requests.
 */

import { createHash } from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry {
  data: NBATeamStats
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getCacheKey(teamName: string, stat: string): string {
  return createHash('md5').update(`${teamName}:${stat}`).digest('hex')
}

function getCached(teamName: string, stat: string): NBATeamStats | null {
  const key = getCacheKey(teamName, stat)
  const entry = cache.get(key)
  
  if (!entry) return null
  
  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

function setCache(teamName: string, stat: string, data: NBATeamStats): void {
  const key = getCacheKey(teamName, stat)
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
}

// ============================================================================
// TEAM NAME MAPPING
// ============================================================================

const NBA_TEAM_IDS: Record<string, number> = {
  'Atlanta Hawks': 1610612737,
  'Boston Celtics': 1610612738,
  'Brooklyn Nets': 1610612751,
  'Charlotte Hornets': 1610612766,
  'Chicago Bulls': 1610612741,
  'Cleveland Cavaliers': 1610612739,
  'Dallas Mavericks': 1610612742,
  'Denver Nuggets': 1610612743,
  'Detroit Pistons': 1610612765,
  'Golden State Warriors': 1610612744,
  'Houston Rockets': 1610612745,
  'Indiana Pacers': 1610612754,
  'LA Clippers': 1610612746,
  'Los Angeles Lakers': 1610612747,
  'Memphis Grizzlies': 1610612763,
  'Miami Heat': 1610612748,
  'Milwaukee Bucks': 1610612749,
  'Minnesota Timberwolves': 1610612750,
  'New Orleans Pelicans': 1610612740,
  'New York Knicks': 1610612752,
  'Oklahoma City Thunder': 1610612760,
  'Orlando Magic': 1610612753,
  'Philadelphia 76ers': 1610612755,
  'Phoenix Suns': 1610612756,
  'Portland Trail Blazers': 1610612757,
  'Sacramento Kings': 1610612758,
  'San Antonio Spurs': 1610612759,
  'Toronto Raptors': 1610612761,
  'Utah Jazz': 1610612762,
  'Washington Wizards': 1610612764,
}

function getTeamId(teamName: string): number | null {
  return NBA_TEAM_IDS[teamName] ?? null
}

// ============================================================================
// API FETCHERS
// ============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000) // 60s timeout (max for Vercel)
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        // Add connection keepalive for better performance
        keepalive: true
      })
      
      clearTimeout(timeout)
      return response
    } catch (error) {
      lastError = error as Error
      console.error(`[NBA-Stats-API] Attempt ${attempt + 1} failed:`, error)
      if (attempt < maxRetries) {
        const backoff = 500 * (attempt + 1) // Shorter backoff: 500ms, 1s
        console.log(`[NBA-Stats-API] Retrying in ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
      }
    }
  }
  
  throw lastError || new Error('Fetch failed')
}

/**
 * Fetch team advanced stats from NBA Stats API
 */
export async function fetchNBATeamStats(
  teamName: string,
  season: string = '2024-25'
): Promise<NBAStatsResponse> {
  const startTime = Date.now()
  
  // Check cache first
  const cached = getCached(teamName, 'advanced')
  if (cached) {
    return {
      ok: true,
      data: cached,
      cached: true,
      latencyMs: Date.now() - startTime
    }
  }
  
  const teamId = getTeamId(teamName)
  if (!teamId) {
    return {
      ok: false,
      error: `Unknown team: ${teamName}`,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
  
  try {
    // NBA Stats API endpoint for team advanced stats
    const url = `https://stats.nba.com/stats/teamdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`
    
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://stats.nba.com/',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body')
      console.error(`[NBA-Stats-API] HTTP ${response.status}:`, errorText.substring(0, 200))
      return {
        ok: false,
        error: `NBA Stats API returned ${response.status}: ${errorText.substring(0, 100)}`,
        cached: false,
        latencyMs: Date.now() - startTime
      }
    }
    
    const json = await response.json()
    const headers = json.resultSets[0].headers
    const row = json.resultSets[0].rowSet[0]
    
    // Parse the stats we need
    const stats: NBATeamStats = {
      teamId,
      teamName,
      pace: row[headers.indexOf('PACE')] || 100,
      offensiveRating: row[headers.indexOf('OFF_RATING')] || 110,
      defensiveRating: row[headers.indexOf('DEF_RATING')] || 110,
      threePointAttemptRate: row[headers.indexOf('PCT_FGA_3PT')] || 0.39,
      freeThrowRate: row[headers.indexOf('PCT_FGA_FT')] || 0.22,
      threePointPercentage: row[headers.indexOf('FG3_PCT')] || 0.35
    }
    
    // Cache the result
    setCache(teamName, 'advanced', stats)
    
    console.log('[NBA-Stats-API]', {
      teamName,
      teamId,
      season,
      latencyMs: Date.now() - startTime,
      cached: false,
      stats
    })
    
    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[NBA-Stats-API] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

/**
 * Fetch last N games stats for a team
 */
export async function fetchNBATeamStatsLastN(
  teamName: string,
  lastNGames: number = 10,
  season: string = '2024-25'
): Promise<NBAStatsResponse> {
  const startTime = Date.now()
  
  // Check cache first
  const cached = getCached(teamName, `last${lastNGames}`)
  if (cached) {
    return {
      ok: true,
      data: cached,
      cached: true,
      latencyMs: Date.now() - startTime
    }
  }
  
  const teamId = getTeamId(teamName)
  if (!teamId) {
    return {
      ok: false,
      error: `Unknown team: ${teamName}`,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
  
  try {
    const url = `https://stats.nba.com/stats/teamdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=${lastNGames}&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`
    
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://stats.nba.com/',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body')
      console.error(`[NBA-Stats-API] HTTP ${response.status}:`, errorText.substring(0, 200))
      return {
        ok: false,
        error: `NBA Stats API returned ${response.status}: ${errorText.substring(0, 100)}`,
        cached: false,
        latencyMs: Date.now() - startTime
      }
    }
    
    const json = await response.json()
    const headers = json.resultSets[0].headers
    const row = json.resultSets[0].rowSet[0]
    
    const stats: NBATeamStats = {
      teamId,
      teamName,
      pace: row[headers.indexOf('PACE')] || 100,
      offensiveRating: row[headers.indexOf('OFF_RATING')] || 110,
      defensiveRating: row[headers.indexOf('DEF_RATING')] || 110,
      threePointAttemptRate: row[headers.indexOf('PCT_FGA_3PT')] || 0.39,
      freeThrowRate: row[headers.indexOf('PCT_FGA_FT')] || 0.22,
      threePointPercentage: row[headers.indexOf('FG3_PCT')] || 0.35
    }
    
    setCache(teamName, `last${lastNGames}`, stats)
    
    console.log('[NBA-Stats-API]', {
      teamName,
      teamId,
      season,
      lastNGames,
      latencyMs: Date.now() - startTime,
      cached: false,
      stats
    })
    
    return {
      ok: true,
      data: stats,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  } catch (error) {
    console.error('[NBA-Stats-API] Error:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
}

