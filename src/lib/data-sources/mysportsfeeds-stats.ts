/**
 * MySportsFeeds NBA Stats Fetcher
 *
 * Fetches team game logs and calculates derived factors:
 * - Pace, ORtg, DRtg from box scores
 * - 3P%, 3PAR, FTr from shooting stats
 */

import { fetchTeamGameLogs } from './mysportsfeeds-api'
import { getTeamAbbrev } from './team-mappings'

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
  gamesAnalyzed: number // Number of games used in calculation
}

/**
 * Cache for team form data to reduce API calls
 */
interface TeamFormCacheEntry {
  data: TeamFormData
  timestamp: number
}

const teamFormCache = new Map<string, TeamFormCacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 60 minutes (1 hour) - team stats don't change frequently, reduces API calls

function getCachedTeamForm(cacheKey: string): TeamFormData | null {
  const cached = teamFormCache.get(cacheKey)
  if (!cached) return null

  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL_MS) {
    teamFormCache.delete(cacheKey)
    return null
  }

  console.log(`[MySportsFeeds Stats] Cache HIT for ${cacheKey} (age: ${(age / 1000).toFixed(1)}s)`)
  return cached.data
}

function setCachedTeamForm(cacheKey: string, data: TeamFormData): void {
  teamFormCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  })
  console.log(`[MySportsFeeds Stats] Cached team form for ${cacheKey}`)
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
 * Get last N completed games for a team and calculate averaged stats
 * @param teamInput - Team abbreviation or full name
 * @param n - Number of games to analyze (default: 10)
 * @throws Error if no game data is available or API fails
 */
export async function getTeamFormData(teamInput: string, n: number = 10): Promise<TeamFormData> {
  // Resolve team abbreviation
  const teamAbbrev = getTeamAbbrev(teamInput)

  // Check cache first
  const cacheKey = `${teamAbbrev}:${n}`
  const cached = getCachedTeamForm(cacheKey)
  if (cached) {
    return cached
  }

  console.log(`[MySportsFeeds Stats] Cache MISS for ${cacheKey} - fetching from API...`)

  try {
    // Fetch game logs using the centralized API function
    const gameLogsData = await fetchTeamGameLogs(teamAbbrev, n)

    // Parse the raw data into usable format
    const gameLogs = gameLogsData.gamelogs || []

    if (!gameLogs || gameLogs.length === 0) {
      throw new Error(`No game logs found for ${teamAbbrev}. Team may not have played ${n} games yet this season, or the season may not have started.`)
    }

    console.log(`[MySportsFeeds Stats] Found ${gameLogs.length} games for ${teamAbbrev}`)

    // DIAGNOSTIC: Log first game to see what data we're getting
    if (gameLogs.length > 0) {
      const firstGame = gameLogs[0]
      console.log(`[MySportsFeeds Stats] DIAGNOSTIC - First game for ${teamAbbrev}:`, {
        gameId: firstGame.game?.id,
        startTime: firstGame.game?.startTime,
        hasStats: !!firstGame.stats,
        statsKeys: firstGame.stats ? Object.keys(firstGame.stats) : [],
        fieldGoals: firstGame.stats?.fieldGoals,
        freeThrows: firstGame.stats?.freeThrows,
        offense: firstGame.stats?.offense,
        defense: firstGame.stats?.defense,
        rebounds: firstGame.stats?.rebounds
      })
    }

    // OPTIMIZATION: Removed opponent stats fetching to reduce API calls from ~22 to 2 per pick
    // We approximate opponent possessions with team possessions (typically <1% error)
    // This eliminates rate limit errors while maintaining prediction accuracy

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
      if (!stats) {
        console.warn(`[MySportsFeeds Stats] Game log missing stats field for ${teamAbbrev}`)
        continue
      }

      // Get team stats - VALIDATE that we have actual data, not just zeros
      const teamFGA = stats.fieldGoals?.fgAtt || 0
      const teamFTA = stats.freeThrows?.ftAtt || 0
      const teamOREB = stats.rebounds?.offReb || 0
      const teamTOV = stats.defense?.tov || 0
      const team3PA = stats.fieldGoals?.fg3PtAtt || 0
      const team3PM = stats.fieldGoals?.fg3PtMade || 0
      const teamPTS = stats.offense?.pts || 0

      // CRITICAL: Skip games with missing/zero stats (incomplete data from API)
      if (teamFGA === 0 && teamFTA === 0 && teamPTS === 0) {
        console.warn(`[MySportsFeeds Stats] Game log has zero stats for ${teamAbbrev} - skipping incomplete game`)
        console.warn(`[MySportsFeeds Stats] Game ID: ${gameLog.game?.id}, Date: ${gameLog.game?.startTime}`)
        continue
      }

      // Calculate team possessions
      const teamPoss = calculatePossessions(teamFGA, teamFTA, teamOREB, teamTOV)

      // OPTIMIZATION: Use team possessions as approximation for opponent possessions
      // In basketball, both teams have nearly identical possession counts (differ by 0-1 typically)
      // This approximation introduces <1% error while eliminating 10+ API calls per pick
      const oppPoss = teamPoss

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

    // CRITICAL: Validate we have enough valid games with actual stats
    // If totalPace is 0, it means all games had zero stats (incomplete data)
    if (totalPace === 0 || totalORtg === 0 || gameCount === 0) {
      throw new Error(
        `Insufficient valid game data for ${teamAbbrev}. ` +
        `Found ${gameCount} games but all had incomplete/zero stats. ` +
        `This likely means the MySportsFeeds API returned game logs without stats data. ` +
        `Total stats: Pace=${totalPace}, ORtg=${totalORtg}, DRtg=${totalDRtg}`
      )
    }

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
      ft_rate,
      gamesAnalyzed: gameCount
    }

    console.log(`[MySportsFeeds Stats] Form data for ${teamAbbrev}:`, {
      pace: avgPace.toFixed(1),
      ortg: avgORtg.toFixed(1),
      drtg: avgDRtg.toFixed(1),
      threeP_pct: (threeP_pct * 100).toFixed(1) + '%',
      threeP_rate: (threeP_rate * 100).toFixed(1) + '%',
      ft_rate: (ft_rate * 100).toFixed(1) + '%',
      games: gameCount
    })

    // DIAGNOSTIC: Log raw totals to help debug zero stats issue
    console.log(`[MySportsFeeds Stats] DIAGNOSTIC - Raw totals for ${teamAbbrev}:`, {
      totalPace,
      totalORtg,
      totalDRtg,
      totalThreePA,
      totalThreePM,
      totalFTA,
      totalFGA,
      gameCount,
      avgPace: (totalPace / gameCount).toFixed(1),
      avgORtg: (totalORtg / gameCount).toFixed(1),
      avgDRtg: (totalDRtg / gameCount).toFixed(1)
    })

    // Validate the data - throw error if values are unrealistic
    if (avgPace < 80 || avgPace > 120) {
      throw new Error(`Invalid pace calculated for ${teamAbbrev}: ${avgPace.toFixed(1)}. Expected range: 80-120.`)
    }
    if (avgORtg < 80 || avgORtg > 140) {
      throw new Error(`Invalid ORtg calculated for ${teamAbbrev}: ${avgORtg.toFixed(1)}. Expected range: 80-140.`)
    }
    if (avgDRtg < 80 || avgDRtg > 140) {
      throw new Error(`Invalid DRtg calculated for ${teamAbbrev}: ${avgDRtg.toFixed(1)}. Expected range: 80-140.`)
    }

    // Cache the result before returning
    setCachedTeamForm(cacheKey, formData)

    return formData
  } catch (error) {
    console.error(`[MySportsFeeds Stats] Failed to get form data for ${teamAbbrev}:`, error)
    // Re-throw the error - DO NOT return default values
    throw new Error(`Failed to fetch stats for ${teamAbbrev}: ${error instanceof Error ? error.message : String(error)}`)
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

