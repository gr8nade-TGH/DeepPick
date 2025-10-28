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
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout to prevent build hangs
      
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
  console.log(`[NBA-Stats-API] Fetching stats for ${teamName} (${season})...`)
  
  // Check cache first
  const cached = getCached(teamName, 'advanced')
  if (cached) {
    console.log(`[NBA-Stats-API] Using cached data for ${teamName}`)
    return {
      ok: true,
      data: cached,
      cached: true,
      latencyMs: Date.now() - startTime
    }
  }
  
  const teamId = getTeamId(teamName)
  console.log(`[NBA-Stats-API] Team ID for ${teamName}: ${teamId}`)
  if (!teamId) {
    console.error(`[NBA-Stats-API] Unknown team: ${teamName}`)
    return {
      ok: false,
      error: `Unknown team: ${teamName}`,
      cached: false,
      latencyMs: Date.now() - startTime
    }
  }
  
  try {
    // Add random delay to avoid rate limiting (NBA Stats API is sensitive)
    const delay = Math.random() * 1000 + 500 // 500-1500ms delay
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // NBA Stats API endpoint for team advanced stats
    const encodedSeason = encodeURIComponent(season)
    const url = `https://stats.nba.com/stats/teamdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=${encodedSeason}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`
    
    console.log(`[NBA-Stats-API] Constructed URL: ${url.substring(0, 200)}...`)
    
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    
    console.log(`[NBA-Stats-API] Response status for ${teamName}: ${response.status} ${response.statusText}`)
    console.log(`[NBA-Stats-API] Response headers for ${teamName}:`, Object.fromEntries(response.headers.entries()))
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body')
      console.error(`[NBA-Stats-API] HTTP ${response.status}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        errorText: errorText.substring(0, 500),
        url: url.substring(0, 200) + '...'
      })
      return {
        ok: false,
        error: `NBA Stats API returned ${response.status}: ${errorText.substring(0, 100)}`,
        cached: false,
        latencyMs: Date.now() - startTime
      }
    }
    
    const json = await response.json()
    
    // Debug: Log the full API response structure
    console.log(`[NBA-Stats-API] Response structure for ${teamName}:`, {
      hasResultSets: !!json.resultSets,
      resultSetsCount: json.resultSets?.length || 0,
      firstResultSet: json.resultSets?.[0] ? {
        name: json.resultSets[0].name,
        headers: json.resultSets[0].headers,
        rowCount: json.resultSets[0].rowSet?.length || 0,
        firstRow: json.resultSets[0].rowSet?.[0] || null
      } : null
    })
    
    // Debug: Log the raw response for debugging
    console.log(`[NBA-Stats-API] Raw response for ${teamName}:`, JSON.stringify(json, null, 2).substring(0, 1000) + '...')
    
        if (!json.resultSets || !json.resultSets[0] || !json.resultSets[0].rowSet || json.resultSets[0].rowSet.length === 0) {
          console.error(`[NBA-Stats-API] No data returned for ${teamName} (${season}):`, {
            hasResultSets: !!json.resultSets,
            resultSetsCount: json.resultSets?.length || 0,
            firstResultSet: json.resultSets?.[0] ? {
              name: json.resultSets[0].name,
              headers: json.resultSets[0].headers,
              rowCount: json.resultSets[0].rowSet?.length || 0
            } : null,
            season: season,
            note: 'This may be due to the new NBA season (2024-25) having limited data availability'
          })
          // Try fallback to previous season if current season has no data
          if (season === '2024-25') {
            console.log(`[NBA-Stats-API] Trying fallback to 2023-24 season for ${teamName}...`)
            return await fetchNBATeamStats(teamName, '2023-24')
          }
          
          return {
            ok: false,
            error: `No data returned for team ${teamName} in season ${season}. This may be due to the new NBA season having limited data availability.`,
            cached: false,
            latencyMs: Date.now() - startTime
          }
        }
    
    const headers = json.resultSets[0].headers
    const row = json.resultSets[0].rowSet[0]
    
    // Parse the stats we need - use league averages if data is missing
    const pace = row[headers.indexOf('PACE')]
    const offRating = row[headers.indexOf('OFF_RATING')]
    const defRating = row[headers.indexOf('DEF_RATING')]
    const threePAR = row[headers.indexOf('PCT_FGA_3PT')]
    const ftr = row[headers.indexOf('PCT_FGA_FT')]
    const threePct = row[headers.indexOf('FG3_PCT')]
    
    // Check if we have real data or just empty values
    const hasRealData = pace && offRating && defRating && threePAR && ftr && threePct
    
    if (!hasRealData) {
      console.warn(`[NBA-Stats-API] Incomplete data for ${teamName} in season ${season}, using league averages`)
      // Try fallback to previous season if current season has incomplete data
      if (season === '2024-25') {
        console.log(`[NBA-Stats-API] Trying fallback to 2023-24 season for ${teamName}...`)
        return await fetchNBATeamStats(teamName, '2023-24')
      }
    }
    
    // NO FALLBACKS - if data is missing, throw error
    if (pace === null || pace === undefined || !isFinite(pace)) {
      throw new Error(`Missing or invalid pace data for ${teamName}`)
    }
    if (offRating === null || offRating === undefined || !isFinite(offRating)) {
      throw new Error(`Missing or invalid offensiveRating data for ${teamName}`)
    }
    if (defRating === null || defRating === undefined || !isFinite(defRating)) {
      throw new Error(`Missing or invalid defensiveRating data for ${teamName}`)
    }
    
    const stats: NBATeamStats = {
      teamId,
      teamName,
      pace,
      offensiveRating: offRating,
      defensiveRating: defRating,
      threePointAttemptRate: threePAR ?? 0.39, // Allow default for this stat
      freeThrowRate: ftr ?? 0.22, // Allow default for this stat
      threePointPercentage: threePct ?? 0.35 // Allow default for this stat
    }
    
    // Debug: Log the parsed stats
    console.log(`[NBA-Stats-API] Parsed stats for ${teamName}:`, stats)
    
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
    // Add random delay to avoid rate limiting (NBA Stats API is sensitive)
    const delay = Math.random() * 1000 + 500 // 500-1500ms delay
    await new Promise(resolve => setTimeout(resolve, delay))
    
    const url = `https://stats.nba.com/stats/teamdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=${lastNGames}&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`
    
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body')
      console.error(`[NBA-Stats-API] HTTP ${response.status}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        errorText: errorText.substring(0, 500),
        url: url.substring(0, 200) + '...'
      })
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

