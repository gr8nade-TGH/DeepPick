/**
 * MySportsFeeds NBA API Integration
 * 
 * Replaces both The Odds API and NBA Stats API
 * Uses past 5 box scores to calculate advanced statistics
 */

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY
// MySportsFeeds v2.0+ uses /pull/{league}/{season}/date/{date}/endpoint.json
// Season format: 2024-2025-regular (not 2024-25)
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.0/pull/nba/2024-2025-regular'

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
 * Make authenticated request to MySportsFeeds API
 */
async function fetchMySportsFeeds(endpoint: string): Promise<any> {
  const url = `${MYSPORTSFEEDS_BASE_URL}/${endpoint}`
  
  console.log(`[MySportsFeeds] Fetching: ${url}`)
  
  const authHeader = getAuthHeader()
  console.log(`[MySportsFeeds] Auth header present: ${!!authHeader}`)
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    }
    
    if (authHeader) {
      headers['Authorization'] = authHeader
    }
    
    console.log(`[MySportsFeeds] Request headers:`, Object.keys(headers))
    
    const response = await fetch(url, { headers })
    
    console.log(`[MySportsFeeds] Response status: ${response.status}`)
    console.log(`[MySportsFeeds] Response headers:`, Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    
    console.log(`[MySportsFeeds] Response text length: ${text.length}`)
    console.log(`[MySportsFeeds] Response text (first 500 chars): ${text.substring(0, 500)}`)
    
    if (!response.ok) {
      console.error(`[MySportsFeeds] API Error (${response.status}):`, text.substring(0, 500))
      throw new Error(`MySportsFeeds API returned ${response.status}: ${text.substring(0, 200)}`)
    }
    
    if (!text || text.trim().length === 0) {
      console.error('[MySportsFeeds] Empty response from API')
      throw new Error('Empty response from MySportsFeeds API')
    }
    
    let data
    try {
      data = JSON.parse(text)
      console.log(`[MySportsFeeds] Success: ${JSON.stringify(data).substring(0, 200)}...`)
    } catch (parseError) {
      console.error('[MySportsFeeds] JSON parse error:', parseError)
      console.error('[MySportsFeeds] Response text:', text)
      throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }
    
    return data
  } catch (error) {
    console.error('[MySportsFeeds] Request failed:', error)
    throw error
  }
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
 * Fetch game scoreboard for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 */
export async function fetchScoreboard(date: string): Promise<any> {
  return await fetchMySportsFeeds(`date/${date}/scoreboard.json`)
}

/**
 * Fetch game box score for a specific game
 */
export async function fetchGameBoxscore(gameId: string): Promise<any> {
  return await fetchMySportsFeeds(`game_boxscore/${gameId}.json`)
}

/**
 * Fetch odds game lines for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 */
export async function fetchOddsGameLines(date: string): Promise<any> {
  return await fetchMySportsFeeds(`date/${date}/odds_gamelines.json`)
}

/**
 * Fetch team game log for a specific date
 * Format: YYYYMMDD (e.g., 20250128)
 */
export async function fetchTeamGameLogByDate(date: string, teamAbbrev: string): Promise<any> {
  return await fetchMySportsFeeds(`date/${date}/team_gamelogs.json?team=${teamAbbrev}`)
}

// Export for testing
export { fetchMySportsFeeds }

