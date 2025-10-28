/**
 * MySportsFeeds NBA Stats Fetcher
 * 
 * Fetches team game logs and calculates derived factors:
 * - Pace, ORtg, DRtg from box scores
 * - 3P%, 3PAR, FTr from shooting stats
 */

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull/nba'

interface GameLogEntry {
  teamAbbrev: string
  opponentAbbrev: string
  date: string
  stats: {
    FGA: number       // Field Goal Attempts
    FTA: number       // Free Throw Attempts
    OREB: number      // Offensive Rebounds
    TOV: number       // Turnovers
    threePA: number   // 3-Point Attempts
    threePM: number   // 3-Point Makes
    PTS: number       // Points
    opponentFGA: number
    opponentFTA: number
    opponentOREB: number
    opponentTOV: number
    opponentPTS: number
  }
}

export interface TeamFormData {
  team: string
  pace: number
  ortg: number
  drtg: number
  threeP_pct: number
  threeP_rate: number // 3PAR
  ft_rate: number     // FTr
}

/**
 * Calculate Base64 encoded Basic Auth credentials for MySportsFeeds API v2.x
 */
function getAuthHeader(): string {
  if (!MYSPORTSFEEDS_API_KEY) {
    throw new Error('MYSPORTSFEEDS_API_KEY environment variable not set')
  }
  
  const credentials = `${MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`
  const encoded = Buffer.from(credentials).toString('base64')
  
  return `Basic ${encoded}`
}

/**
 * Fetch team game log from MySportsFeeds
 */
async function fetchTeamGameLog(teamAbbrev: string): Promise<any> {
  const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/team_gamelogs.json?team=${teamAbbrev}`
  
  console.log(`[MySportsFeeds] Fetching game logs for ${teamAbbrev}...`)
  
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
      throw new Error(`MySportsFeeds API returned ${response.status}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('[MySportsFeeds] Request failed:', error)
    throw error
  }
}

/**
 * Calculate possessions using simplified formula
 * Poss = FGA + 0.44 * FTA - OREB + TOV
 */
function calculatePossessions(fga: number, fta: number, oreb: number, tov: number): number {
  return fga + 0.44 * fta - oreb + tov
}

/**
 * Calculate Pace (average possessions per game)
 * Pace = average(Poss_team, Poss_opp)
 */
function calculatePace(teamPoss: number, oppPoss: number): number {
  return (teamPoss + oppPoss) / 2
}

/**
 * Calculate Offensive Rating
 * ORtg = (PTS / Poss) * 100
 */
function calculateORtg(pts: number, poss: number): number {
  return poss > 0 ? (pts / poss) * 100 : 0
}

/**
 * Calculate Defensive Rating
 * DRtg = (OppPTS / OppPoss) * 100
 */
function calculateDRtg(oppPts: number, oppPoss: number): number {
  return oppPoss > 0 ? (oppPts / oppPoss) * 100 : 0
}

/**
 * Get last 5 completed games for a team and calculate averaged stats
 */
export async function getTeamFormData(teamAbbrev: string): Promise<TeamFormData> {
  console.log(`[MySportsFeeds] Getting form data for ${teamAbbrev}...`)
  
  try {
    // Fetch game logs
    const gameLogsData = await fetchTeamGameLog(teamAbbrev)
    
    // Parse and extract last 5 completed games
    const gameLogs = parseGameLogs(gameLogsData, teamAbbrev)
    const last5Games = gameLogs.slice(0, 5)
    
    console.log(`[MySportsFeeds] Found ${last5Games.length} recent games for ${teamAbbrev}`)
    
    // Calculate averages over last 5 games
    let totalPace = 0
    let totalORtg = 0
    let totalDRtg = 0
    let totalThreePA = 0
    let totalThreePM = 0
    let totalFTA = 0
    let totalFGA = 0
    
    last5Games.forEach((game: any) => {
      const teamPoss = calculatePossessions(game.stats.FGA, game.stats.FTA, game.stats.OREB, game.stats.TOV)
      const oppPoss = calculatePossessions(game.stats.opponentFGA, game.stats.opponentFTA, game.stats.opponentOREB, game.stats.opponentTOV)
      
      const pace = calculatePace(teamPoss, oppPoss)
      const ortg = calculateORtg(game.stats.PTS, teamPoss)
      const drtg = calculateDRtg(game.stats.opponentPTS, oppPoss)
      
      totalPace += pace
      totalORtg += ortg
      totalDRtg += drtg
      totalThreePA += game.stats.threePA
      totalThreePM += game.stats.threePM
      totalFTA += game.stats.FTA
      totalFGA += game.stats.FGA
    })
    
    const gameCount = last5Games.length
    
    // Calculate averages
    const avgPace = totalPace / gameCount
    const avgORtg = totalORtg / gameCount
    const avgDRtg = totalDRtg / gameCount
    const threeP_pct = totalThreePA > 0 ? totalThreePM / totalThreePA : 0
    const threeP_rate = totalFGA > 0 ? totalThreePA / totalFGA : 0
    const ft_rate = totalFGA > 0 ? totalFTA / totalFGA : 0
    
    const formData: TeamFormData = {
      team: teamAbbrev,
      pace: avgPace,
      ortg: avgORtg,
      drtg: avgDRtg,
      threeP_pct,
      threeP_rate,
      ft_rate
    }
    
    console.log(`[MySportsFeeds] Form data for ${teamAbbrev}:`, formData)
    
    return formData
  } catch (error) {
    console.error(`[MySportsFeeds] Failed to get form data for ${teamAbbrev}:`, error)
    throw error
  }
}

/**
 * Parse MySportsFeeds game logs response
 */
function parseGameLogs(data: any, teamAbbrev: string): any[] {
  // TODO: Implement actual parsing based on MSF response structure
  // This will need to be updated once we see the actual API response
  return []
}

/**
 * Main export function to get matchup form data
 */
export async function getMatchupFormData(awayTeam: string, homeTeam: string): Promise<{
  away: TeamFormData
  home: TeamFormData
}> {
  const [awayForm, homeForm] = await Promise.all([
    getTeamFormData(awayTeam),
    getTeamFormData(homeTeam)
  ])
  
  return { away: awayForm, home: homeForm }
}

