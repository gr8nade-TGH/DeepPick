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
 * Fetch last N games for a team by checking recent dates
 */
async function fetchLastNGames(teamAbbrev: string, n: number = 5): Promise<any> {
  // Instead of date-specific endpoint, use cumulative season stats
  // The team_gamelogs endpoint requires completed games, not future games
  const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/team_stats_totals.json?team=${teamAbbrev}`
  
  console.log(`[MySportsFeeds] Fetching team stats for ${teamAbbrev}...`)
  
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
    
    console.log(`[MySportsFeeds] API Response keys:`, Object.keys(data))
    console.log(`[MySportsFeeds] Response structure:`, JSON.stringify(data).substring(0, 500))
    
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
    const gameLogsData = await fetchLastNGames(teamAbbrev, 5)
    
    // Parse the raw data into usable format
    const gameLogs = gameLogsData.gamelogs || []
    
    if (gameLogs.length === 0) {
      throw new Error(`No game logs found for ${teamAbbrev}`)
    }
    
    console.log(`[MySportsFeeds] Found ${gameLogs.length} recent games for ${teamAbbrev}`)
    
    // Collect opponent abbreviations from the games
    const opponents = new Set<string>()
    for (const gl of gameLogs) {
      const game = gl.game
      if (gl.team.abbreviation === teamAbbrev) {
        const opponent = game.awayTeamAbbreviation === teamAbbrev 
          ? game.homeTeamAbbreviation 
          : game.awayTeamAbbreviation
        opponents.add(opponent)
      }
    }
    
    // Fetch opponent stats for the same games
    const opponentStatsMap = new Map<string, any>()
    for (const opponent of opponents) {
      try {
        const oppData = await fetchLastNGames(opponent, 10)
        opponentStatsMap.set(opponent, oppData.gamelogs || [])
      } catch (error) {
        console.warn(`[MySportsFeeds] Failed to fetch stats for opponent ${opponent}:`, error)
      }
    }
    
    // Calculate averages over last 5 games
    let totalPace = 0
    let totalORtg = 0
    let totalDRtg = 0
    let totalThreePA = 0
    let totalThreePM = 0
    let totalFTA = 0
    let totalFGA = 0
    
    for (const gameLog of gameLogs) {
      const stats = gameLog.stats
      if (!stats) continue
      
      // Get team stats
      const teamFGA = stats.fieldGoals?.fgAtt || 0
      const teamFTA = stats.freeThrows?.ftAtt || 0
      const teamOREB = stats.rebounds?.offReb || 0
      const teamTOV = stats.defense?.tov || 0
      const team3PA = stats.fieldGoals?.fg3PtAtt || 0
      const team3PM = stats.fieldGoals?.fg3PtMade || 0
      const teamPTS = stats.offense?.pts || 0
      
      // Calculate team possessions
      const teamPoss = calculatePossessions(teamFGA, teamFTA, teamOREB, teamTOV)
      
      // Try to get opponent stats for DRtg calculation
      let oppPoss = teamPoss // Default to same as team if we can't find opponent
      const game = gameLog.game
      const opponent = game.awayTeamAbbreviation === teamAbbrev 
        ? game.homeTeamAbbreviation 
        : game.awayTeamAbbreviation
      
      const oppGameLogs = opponentStatsMap.get(opponent)
      if (oppGameLogs) {
        // Find the matching game
        const oppGame = oppGameLogs.find((gl: any) => 
          (gl.game.awayTeamAbbreviation === opponent && gl.game.homeTeamAbbreviation === teamAbbrev) ||
          (gl.game.homeTeamAbbreviation === opponent && gl.game.awayTeamAbbreviation === teamAbbrev)
        )
        
        if (oppGame && oppGame.stats) {
          const oppFGA = oppGame.stats.fieldGoals?.fgAtt || 0
          const oppFTA = oppGame.stats.freeThrows?.ftAtt || 0
          const oppOREB = oppGame.stats.rebounds?.offReb || 0
          const oppTOV = oppGame.stats.defense?.tov || 0
          oppPoss = calculatePossessions(oppFGA, oppFTA, oppOREB, oppTOV)
        }
      }
      
      const pace = calculatePace(teamPoss, oppPoss)
      const ortg = calculateORtg(teamPTS, teamPoss)
      
      // For DRtg, use ptsAgainst from the game log
      const oppPTS = stats.defense?.ptsAgainst || 0
      const drtg = calculateDRtg(oppPTS, oppPoss)
      
      totalPace += pace
      totalORtg += ortg
      totalDRtg += drtg
      totalThreePA += team3PA
      totalThreePM += team3PM
      totalFTA += teamFTA
      totalFGA += teamFGA
    }
    
    const gameCount = gameLogs.length
    
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
function parseGameLogs(data: any, teamAbbrev: string): GameLogEntry[] {
  if (!data || !data.gamelogs) {
    console.warn('[MySportsFeeds] No gamelogs in response')
    return []
  }
  
  const parsed: GameLogEntry[] = []
  
  // Loop through all games
  for (const gameLog of data.gamelogs) {
    const game = gameLog.game
    const team = gameLog.team
    const stats = gameLog.stats
    
    // Skip if not the requested team or incomplete stats
    if (team.abbreviation !== teamAbbrev || !stats) {
      continue
    }
    
      // Determine opponent
      const isHomeGame = game.homeTeam.id === team.id
      const opponentAbbrev = isHomeGame ? game.awayTeam.abbreviation : game.homeTeam.abbreviation
      
      // Extract stats we need
      const entry: GameLogEntry = {
        teamAbbrev: team.abbreviation,
        opponentAbbrev,
        date: game.startTime,
        stats: {
          FGA: stats.fieldGoals?.fgAtt || 0,
          FTA: stats.freeThrows?.ftAtt || 0,
          OREB: stats.rebounds?.offReb || 0,
          TOV: stats.defense?.tov || 0,
          threePA: stats.fieldGoals?.fg3PtAtt || 0,
          threePM: stats.fieldGoals?.fg3PtMade || 0,
          PTS: stats.offense?.pts || 0,
          // Opponent stats - we only have ptsAgainst, will need to fetch opponent log for others
          opponentFGA: 0, // Need to get from opponent game log
          opponentFTA: 0,
          opponentOREB: 0,
          opponentTOV: 0,
          opponentPTS: stats.defense?.ptsAgainst || 0
        }
      }
    
    parsed.push(entry)
  }
  
  console.log(`[MySportsFeeds] Parsed ${parsed.length} games for ${teamAbbrev}`)
  return parsed
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

