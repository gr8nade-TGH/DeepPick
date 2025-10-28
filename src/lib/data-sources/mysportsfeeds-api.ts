/**
 * MySportsFeeds NBA API Integration
 * 
 * Replaces both The Odds API and NBA Stats API
 * Uses past 5 box scores to calculate advanced statistics
 */

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull/nba/latest/date'

/**
 * Calculate Base64 encoded Basic Auth credentials for MySportsFeeds API v2.x
 */
function getAuthHeader(): string {
  if (!MYSPORTSFEEDS_API_KEY) {
    throw new Error('MYSPORTSFEEDS_API_KEY environment variable not set')
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
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[MySportsFeeds] API Error (${response.status}):`, errorText)
      throw new Error(`MySportsFeeds API returned ${response.status}: ${errorText}`)
    }
    
    const data = await response.json()
    console.log(`[MySportsFeeds] Success: ${JSON.stringify(data).substring(0, 200)}...`)
    
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
  return await fetchMySportsFeeds(`${date}/scoreboard.json`)
}

/**
 * Fetch game box score for a specific game
 */
export async function fetchGameBoxscore(gameId: string): Promise<any> {
  return await fetchMySportsFeeds(`game_boxscore/${gameId}.json`)
}

/**
 * Fetch odds game lines for a specific date
 * Format: YYYYMMDD
 */
export async function fetchOddsGameLines(date: string): Promise<any> {
  return await fetchMySportsFeeds(`${date}/odds_gamelines.json`)
}

/**
 * Fetch team game log for a specific date
 * Format: YYYYMMDD
 */
export async function fetchTeamGameLogByDate(date: string, teamAbbrev: string): Promise<any> {
  return await fetchMySportsFeeds(`${date}/team_gamelogs.json?team=${teamAbbrev}`)
}

// Export for testing
export { fetchMySportsFeeds }

