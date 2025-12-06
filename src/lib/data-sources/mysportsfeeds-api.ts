/**
 * MySportsFeeds NBA API Integration
 *
 * Replaces both The Odds API and NBA Stats API
 * Uses past 5 box scores to calculate advanced statistics
 *
 * RATE LIMITING:
 * - Daily/Weekly Team Gamelogs require 5-second backoff between requests
 * - Requests are queued and serialized to respect backoff delays
 */

import { getNBASeason, getNBASeasonForDateString } from './season-utils'

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull/nba'

/**
 * Global request queue for ALL MySportsFeeds API requests to enforce backoff
 * Per MySportsFeeds API docs: Daily/Weekly Team Gamelogs require 5-second backoff
 *
 * REDUCED FROM 30s TO 5s: The 30-second backoff was causing Vercel function timeouts
 * because fetching stats for 2 teams requires ~11 API calls per team. With 30s backoff,
 * that's 11 minutes total - far exceeding the 5-minute maxDuration.
 *
 * If we hit 429 rate limits, the retry logic uses exponential backoff (10s, 20s, 40s).
 */
let lastMySportsFeedsRequest = 0
const MYSPORTSFEEDS_BACKOFF_MS = 5000 // 5 seconds (reduced from 30s to prevent function timeouts)

/**
 * Sleep utility for backoff delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get the base URL for a specific season
 */
function getSeasonBaseURL(season: string): string {
  return `${MYSPORTSFEEDS_BASE_URL}/${season}`
}

/**
 * Calculate Base64 encoded Basic Auth credentials for MySportsFeeds API v2.x
 */
function getAuthHeader(): string | null {
  if (!MYSPORTSFEEDS_API_KEY) {
    console.warn('[MySportsFeeds] MYSPORTSFEEDS_API_KEY environment variable not set')
    return null
  }

  // v2.x uses "MYSPORTSFEEDS" as the password
  const credentials = `${MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`
  const encoded = Buffer.from(credentials).toString('base64')

  return `Basic ${encoded}`
}

/**
 * Make authenticated request to MySportsFeeds API with retry logic
 * @param endpoint - The endpoint path (can include season or will use current season)
 * @param season - Optional season override (e.g., "2024-2025-regular")
 * @param maxRetries - Maximum number of retry attempts for rate limits (default: 3)
 */
async function fetchMySportsFeeds(endpoint: string, season?: string, maxRetries: number = 3): Promise<any> {
  // Enforce 5-second backoff for ALL MySportsFeeds API requests
  const now = Date.now()
  const timeSinceLastRequest = now - lastMySportsFeedsRequest

  if (timeSinceLastRequest < MYSPORTSFEEDS_BACKOFF_MS) {
    const waitTime = MYSPORTSFEEDS_BACKOFF_MS - timeSinceLastRequest
    console.log(`[MySportsFeeds] Enforcing 5-second backoff - waiting ${waitTime}ms before request...`)
    await sleep(waitTime)
  }

  // Update last request timestamp BEFORE making the request to prevent race conditions
  lastMySportsFeedsRequest = Date.now()

  // If endpoint already includes full URL path, use it as-is
  // Otherwise, prepend the season
  let url: string
  if (endpoint.startsWith('http')) {
    url = endpoint
  } else if (endpoint.includes('/nba/')) {
    // Endpoint already has season in it
    url = `https://api.mysportsfeeds.com/v2.1/pull/${endpoint}`
  } else {
    // Need to add season
    const seasonToUse = season || getNBASeason().season
    url = `${getSeasonBaseURL(seasonToUse)}/${endpoint}`
  }

  console.log(`[MySportsFeeds] Fetching: ${url}`)

  const authHeader = getAuthHeader()
  if (!authHeader) {
    throw new Error('MySportsFeeds API key not configured. Set MYSPORTSFEEDS_API_KEY environment variable.')
  }

  // Retry loop for rate limit handling
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Authorization': authHeader
      }

      const response = await fetch(url, { headers })

      console.log(`[MySportsFeeds] Response status: ${response.status} (attempt ${attempt + 1}/${maxRetries + 1})`)

      // Handle 204 No Content - this is a valid response when no data is available
      if (response.status === 204) {
        console.log('[MySportsFeeds] 204 No Content - no data available for this request')
        return {
          gameLines: [],
          lastUpdatedOn: new Date().toISOString(),
          references: null,
          message: 'No data available for the requested date/season'
        }
      }

      const text = await response.text()
      console.log(`[MySportsFeeds] Response length: ${text.length} bytes`)

      if (!response.ok) {
        const errorPreview = text.substring(0, 500)
        console.error(`[MySportsFeeds] API Error (${response.status}):`, errorPreview)

        // Handle 429 Rate Limit - retry with exponential backoff
        if (response.status === 429) {
          if (attempt < maxRetries) {
            // Exponential backoff: 2s, 5s, 10s
            const backoffMs = Math.min(2000 * Math.pow(2, attempt), 10000)
            console.warn(`[MySportsFeeds] Rate limit hit (429). Retrying in ${backoffMs}ms... (attempt ${attempt + 1}/${maxRetries})`)
            console.warn(`[MySportsFeeds] Endpoint: ${endpoint}`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            continue // Retry the request
          } else {
            // Max retries exceeded
            throw new Error(`MySportsFeeds rate limit exceeded (429). Max retries (${maxRetries}) reached. Please wait 60 seconds before trying again. Endpoint: ${endpoint}`)
          }
        }

        // Provide helpful error messages for other errors
        if (response.status === 401) {
          throw new Error('MySportsFeeds authentication failed. Check your API key.')
        } else if (response.status === 403) {
          throw new Error('MySportsFeeds access forbidden. Check your subscription tier and API permissions.')
        } else if (response.status === 404) {
          throw new Error(`MySportsFeeds endpoint not found: ${url}. This may indicate no data available for the requested date/season.`)
        } else {
          throw new Error(`MySportsFeeds API error ${response.status}: ${errorPreview}`)
        }
      }

      if (!text || text.trim().length === 0) {
        console.warn('[MySportsFeeds] Empty response body (but 200 OK) - treating as no data')
        return {
          gameLines: [],
          lastUpdatedOn: new Date().toISOString(),
          references: null,
          message: 'Empty response from API'
        }
      }

      let data
      try {
        data = JSON.parse(text)
        console.log(`[MySportsFeeds] Success - Response keys:`, Object.keys(data))
      } catch (parseError) {
        console.error('[MySportsFeeds] JSON parse error:', parseError)
        console.error('[MySportsFeeds] Response text (first 1000 chars):', text.substring(0, 1000))
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }

      return data
    } catch (error) {
      lastError = error as Error

      // If it's a rate limit error and we have retries left, continue to next iteration
      if (error instanceof Error && error.message.includes('429') && attempt < maxRetries) {
        continue
      }

      // For other errors, throw immediately
      console.error('[MySportsFeeds] Request failed:', error)
      throw error
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('MySportsFeeds request failed after all retries')
}

/**
 * Test API connection by fetching current season info
 */
export async function testMySportsFeedsConnection(): Promise<void> {
  console.log('[MySportsFeeds] Testing connection...')

  try {
    // Fetch current season schedule
    const data = await fetchMySportsFeeds('season_games/2024-25')
    console.log('[MySportsFeeds] Connection successful!')
    console.log('[MySportsFeeds] Sample data:', JSON.stringify(data, null, 2).substring(0, 500))
  } catch (error) {
    console.error('[MySportsFeeds] Connection test failed:', error)
    throw error
  }
}

/**
 * Fetch daily games for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 * Automatically determines the correct season based on the date
 *
 * NOTE: v2.1 API uses 'games.json' endpoint, not 'scoreboard.json'
 */
export async function fetchScoreboard(date: string): Promise<any> {
  const season = getNBASeasonForDateString(date).season
  console.log(`[MySportsFeeds] Fetching daily games for ${date} (season: ${season})`)
  return await fetchMySportsFeeds(`date/${date}/games.json`, season)
}

/**
 * Fetch game box score for a specific game
 */
export async function fetchGameBoxscore(gameId: string): Promise<any> {
  const season = getNBASeason().season
  return await fetchMySportsFeeds(`game_boxscore/${gameId}.json`, season)
}

/**
 * Fetch odds game lines for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 * Uses 'current' season keyword for live data by default
 */
export async function fetchOddsGameLines(date: string, useCurrentSeason: boolean = true): Promise<any> {
  // Use 'current' keyword for live data (recommended for today/upcoming games)
  // or calculate season for historical data
  const season = useCurrentSeason ? 'current' : getNBASeasonForDateString(date).season
  console.log(`[MySportsFeeds] Fetching odds for ${date} (season: ${season})`)

  const data = await fetchMySportsFeeds(`date/${date}/odds_gamelines.json`, season)

  // Log detailed information about the response
  if (data.gameLines && data.gameLines.length > 0) {
    console.log(`[MySportsFeeds] Found ${data.gameLines.length} games with odds`)
    console.log(`[MySportsFeeds] First game sample:`, JSON.stringify(data.gameLines[0]).substring(0, 300))
  } else {
    console.warn(`[MySportsFeeds] No games found for date ${date} in season ${season}`)
    console.warn(`[MySportsFeeds] This may indicate:`)
    console.warn(`  - No games scheduled for this date`)
    console.warn(`  - Date is outside the regular season`)
    console.warn(`  - API subscription doesn't include odds data`)
  }

  return data
}

/**
 * Fetch team game log for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 */
export async function fetchTeamGameLogByDate(date: string, teamAbbrev: string): Promise<any> {
  const season = getNBASeasonForDateString(date).season
  return await fetchMySportsFeeds(`date/${date}/team_gamelogs.json?team=${teamAbbrev}`, season)
}

/**
 * Fetch team game logs for last N games
 *
 * CRITICAL: The MySportsFeeds seasonal team_gamelogs endpoint has incomplete data.
 * We must use the DAILY team_gamelogs endpoint instead, which has up-to-date stats.
 *
 * Strategy:
 * 1. First get recent game schedule from games.json (1 API call)
 * 2. Then fetch daily team_gamelogs for each game date (N API calls for N games)
 *
 * @param teamAbbrev - Team abbreviation (e.g., "BOS", "LAL")
 * @param limit - Number of games to fetch (default: 10)
 */
export async function fetchTeamGameLogs(teamAbbrev: string, limit: number = 10): Promise<any> {
  const season = getNBASeason().season
  console.log(`[MySportsFeeds] Fetching last ${limit} games for ${teamAbbrev} using DAILY endpoints`)
  console.log(`[MySportsFeeds] Current date: ${new Date().toISOString()}`)

  // Step 1: Get recent game schedule (completed games only)
  // Look back 45 days to ensure we get enough games
  const scheduleResult = await fetchMySportsFeeds(
    `games.json?team=${teamAbbrev}&date=from-45-days-ago-to-today&status=final`,
    season
  )

  const games = scheduleResult.games || []
  if (games.length === 0) {
    console.log(`[MySportsFeeds] No completed games found for ${teamAbbrev}`)
    return { gamelogs: [] }
  }

  // Sort games by startTime descending (newest first) and take only what we need
  games.sort((a: any, b: any) => {
    const dateA = new Date(a.schedule?.startTime || 0).getTime()
    const dateB = new Date(b.schedule?.startTime || 0).getTime()
    return dateB - dateA
  })

  // Only fetch gamelogs for the N most recent games
  const gamesToFetch = games.slice(0, limit)
  console.log(`[MySportsFeeds] Found ${games.length} completed games, fetching stats for ${gamesToFetch.length} most recent`)

  // Step 2: Fetch daily team_gamelogs for each game date
  const gamelogs: any[] = []
  for (const game of gamesToFetch) {
    const startTime = game.schedule?.startTime
    if (!startTime) continue

    // Convert startTime to YYYYMMDD format for the daily endpoint
    const gameDate = new Date(startTime)
    const dateStr = `${gameDate.getUTCFullYear()}${String(gameDate.getUTCMonth() + 1).padStart(2, '0')}${String(gameDate.getUTCDate()).padStart(2, '0')}`

    try {
      const dailyResult = await fetchMySportsFeeds(
        `date/${dateStr}/team_gamelogs.json?team=${teamAbbrev}`,
        season
      )

      if (dailyResult.gamelogs && dailyResult.gamelogs.length > 0) {
        // Find the gamelog that matches this specific game
        const matchingGamelog = dailyResult.gamelogs.find((gl: any) =>
          gl.game?.id === game.schedule?.id
        ) || dailyResult.gamelogs[0]

        gamelogs.push(matchingGamelog)
      }
    } catch (err) {
      console.error(`[MySportsFeeds] Failed to fetch gamelog for ${teamAbbrev} on ${dateStr}:`, err)
    }
  }

  // Sort gamelogs by startTime descending (should already be in order, but ensure it)
  gamelogs.sort((a: any, b: any) => {
    const dateA = new Date(a.game?.startTime || 0).getTime()
    const dateB = new Date(b.game?.startTime || 0).getTime()
    return dateB - dateA
  })

  console.log(`[MySportsFeeds] Successfully fetched ${gamelogs.length} gamelogs for ${teamAbbrev}`)
  if (gamelogs.length > 0) {
    console.log(`[MySportsFeeds] Most recent game: ${gamelogs[0].game?.startTime} pts: ${gamelogs[0].stats?.offense?.pts}`)
  }

  const result = { gamelogs }

  // Log what we got back
  console.log(`[MySportsFeeds] Team game logs response for ${teamAbbrev}:`, {
    hasGamelogs: !!result.gamelogs,
    gamelogsCount: result.gamelogs?.length || 0,
    firstGameSample: result.gamelogs?.[0] ? {
      gameId: result.gamelogs[0].game?.id,
      startTime: result.gamelogs[0].game?.startTime,
      hasStats: !!result.gamelogs[0].stats
    } : null
  })

  return result
}

/**
 * In-memory cache for player injuries
 * TTL: 5 minutes (injury status can change, but not that frequently)
 */
interface InjuryCacheEntry {
  data: any
  timestamp: number
}

const injuryCache = new Map<string, InjuryCacheEntry>()
const INJURY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch player injuries for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 *
 * NOTE: 5-second backoff applies (enforced by global 30-second backoff)
 * Cached for 5 minutes to reduce API calls
 *
 * @param date - Date in YYYYMMDD format
 * @returns Player injury data including currentInjury status
 */
export async function fetchPlayerInjuries(date: string): Promise<any> {
  const cacheKey = `injuries_${date}`

  // Check cache first
  const cached = injuryCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < INJURY_CACHE_TTL_MS) {
    console.log(`[MySportsFeeds] Using cached injury data for ${date}`)
    return cached.data
  }

  const season = getNBASeasonForDateString(date).season
  console.log(`[MySportsFeeds] Fetching player injuries for ${date} (season: ${season})`)

  const result = await fetchMySportsFeeds(`date/${date}/player_injuries.json`, season)

  // Cache the result
  injuryCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  })

  console.log(`[MySportsFeeds] Player injuries response for ${date}:`, {
    hasPlayers: !!result.players,
    playerCount: result.players?.length || 0,
    injuredCount: result.players?.filter((p: any) => p.currentInjury).length || 0
  })

  return result
}

/**
 * Fetch player injuries for specific teams
 * Filters the injury report to only include players from the specified teams
 *
 * @param date - Date in YYYYMMDD format
 * @param teamAbbrevs - Array of team abbreviations (e.g., ["BOS", "LAL"])
 * @returns Filtered injury data for specified teams
 */
export async function fetchPlayerInjuriesForTeams(date: string, teamAbbrevs: string[]): Promise<any> {
  const allInjuries = await fetchPlayerInjuries(date)

  if (!allInjuries.players) {
    return { players: [] }
  }

  // Filter to only include players from specified teams
  const filteredPlayers = allInjuries.players.filter((player: any) => {
    const playerTeam = player.currentTeam?.abbreviation
    return playerTeam && teamAbbrevs.includes(playerTeam)
  })

  console.log(`[MySportsFeeds] Filtered injuries for teams ${teamAbbrevs.join(', ')}:`, {
    totalPlayers: allInjuries.players.length,
    filteredPlayers: filteredPlayers.length,
    injuredPlayers: filteredPlayers.filter((p: any) => p.currentInjury).length
  })

  return {
    ...allInjuries,
    players: filteredPlayers
  }
}

// Export for testing
export { fetchMySportsFeeds }

