/**
 * MySportsFeeds NBA Stats Fetcher
 *
 * Fetches team game logs and calculates derived factors:
 * - Pace, ORtg, DRtg from box scores
 * - 3P%, 3PAR, FTr from shooting stats
 */

import { fetchTeamGameLogs } from './mysportsfeeds-api'
import { getTeamAbbrev } from './team-mappings'
import { getCachedTeamForm as getSupabaseCachedTeamForm, setCachedTeamForm as setSupabaseCachedTeamForm } from './mysportsfeeds-cache'

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
  avgTurnovers: number // Average turnovers per game (for SPREAD factor S2)

  // Rebounding data (for SPREAD factor S3)
  avgOffReb: number // Offensive rebounds per game
  avgDefReb: number // Defensive rebounds per game
  avgOppOffReb: number // Opponent offensive rebounds per game
  avgOppDefReb: number // Opponent defensive rebounds per game

  // Four Factors data (for SPREAD factor S5)
  avgEfg: number // Effective Field Goal %
  avgTovPct: number // Turnover %
  avgOrebPct: number // Offensive Rebound %
  avgFtr: number // Free Throw Rate

  // Home/Away splits (for SPREAD factor S4)
  ortgHome?: number // ORtg in home games only
  ortgAway?: number // ORtg in away games only
  drtgHome?: number // DRtg in home games only
  drtgAway?: number // DRtg in away games only
  homeGames?: number // Number of home games analyzed
  awayGames?: number // Number of away games analyzed

  // Rest advantage data (for TOTALS factor F7)
  restDays?: number // Days since last game
  isBackToBack?: boolean // True if playing on consecutive days

  // Momentum data (for SPREAD factor S7)
  winStreak?: number // Positive = win streak, Negative = loss streak
  last10Record?: { wins: number; losses: number } // Record in last 10 games
}

/**
 * Cache for team form data to reduce API calls
 *
 * NOTE: Now using Supabase cache instead of in-memory cache
 * This persists across serverless function cold starts and prevents rate limiting
 */

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

  // Check Supabase cache first (persists across serverless cold starts)
  const cacheKey = `${teamAbbrev}:${n}`
  const cached = await getSupabaseCachedTeamForm(cacheKey)

  // Validate cached data has all required fields (invalidate old cache entries)
  // Also require home/away splits to be present - we're 2+ months into season, all teams should have both
  const hasRequiredFields = cached &&
    typeof cached.avgTurnovers === 'number' &&
    typeof cached.avgOffReb === 'number' &&
    typeof cached.avgDefReb === 'number' &&
    typeof cached.avgOppOffReb === 'number' &&
    typeof cached.avgOppDefReb === 'number' &&
    typeof cached.avgEfg === 'number' &&
    typeof cached.avgTovPct === 'number' &&
    typeof cached.avgOrebPct === 'number' &&
    typeof cached.avgFtr === 'number'

  // Check if home/away splits are properly populated (both should have at least 1 game)
  const hasHomeAwaySplits = cached &&
    typeof cached.homeGames === 'number' && cached.homeGames > 0 &&
    typeof cached.awayGames === 'number' && cached.awayGames > 0 &&
    typeof cached.ortgHome === 'number' &&
    typeof cached.ortgAway === 'number'

  if (hasRequiredFields && hasHomeAwaySplits) {
    console.log(`[MySportsFeeds Stats] Cache HIT for ${cacheKey} - using cached data (home: ${cached.homeGames}, away: ${cached.awayGames} games)`)
    return cached
  } else if (cached) {
    console.log(`[MySportsFeeds Stats] Cache INVALID for ${cacheKey} - missing home/away splits or required fields, refetching...`, {
      hasRequiredFields,
      homeGames: cached.homeGames,
      awayGames: cached.awayGames,
      ortgHome: cached.ortgHome,
      ortgAway: cached.ortgAway
    })
  }

  console.log(`[MySportsFeeds Stats] Cache MISS for ${cacheKey} - fetching from API...`)

  try {
    // Fetch game logs using the centralized API function
    const gameLogsData = await fetchTeamGameLogs(teamAbbrev, n)

    // Parse the raw data into usable format
    const gameLogs = gameLogsData.gamelogs || []

    if (!gameLogs || gameLogs.length === 0) {
      throw new Error(`No game logs found for ${teamAbbrev}. Team may not have played any games yet this season, or the season may not have started.`)
    }

    // Use whatever games are available (may be fewer than requested)
    const actualGames = gameLogs.length
    if (actualGames < n) {
      console.log(`[MySportsFeeds Stats] Requested ${n} games for ${teamAbbrev}, but only ${actualGames} available - using all available games`)
    } else {
      console.log(`[MySportsFeeds Stats] Found ${actualGames} games for ${teamAbbrev}`)
    }

    // DIAGNOSTIC: Log first game to see what data we're getting
    if (gameLogs.length > 0) {
      const firstGame = gameLogs[0]
      // Check both possible API structures for home/away teams
      const resolvedHomeTeam = firstGame.game?.homeTeam || firstGame.game?.schedule?.homeTeam
      const resolvedAwayTeam = firstGame.game?.awayTeam || firstGame.game?.schedule?.awayTeam

      console.log(`[MySportsFeeds Stats] DIAGNOSTIC - First game for ${teamAbbrev}:`, {
        gameId: firstGame.game?.id,
        startTime: firstGame.game?.startTime,
        hasStats: !!firstGame.stats,
        statsKeys: firstGame.stats ? Object.keys(firstGame.stats) : [],
        fieldGoals: firstGame.stats?.fieldGoals,
        freeThrows: firstGame.stats?.freeThrows,
        offense: firstGame.stats?.offense,
        defense: firstGame.stats?.defense,
        rebounds: firstGame.stats?.rebounds,
        // Home/Away detection fields - check both possible locations
        gameKeys: firstGame.game ? Object.keys(firstGame.game) : [],
        teamId: firstGame.team?.id,
        directHomeTeam: firstGame.game?.homeTeam,
        directAwayTeam: firstGame.game?.awayTeam,
        scheduleHomeTeam: firstGame.game?.schedule?.homeTeam,
        scheduleAwayTeam: firstGame.game?.schedule?.awayTeam,
        resolvedHomeTeam,
        resolvedAwayTeam
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
    let totalTOV = 0
    let totalOffReb = 0
    let totalDefReb = 0
    let totalOppOffReb = 0
    let totalOppDefReb = 0
    let totalFGM = 0
    let total3PM = 0

    // Home/Away splits tracking (for S4 factor)
    let homeORtgTotal = 0
    let homeDRtgTotal = 0
    let homeGamesCount = 0
    let awayORtgTotal = 0
    let awayDRtgTotal = 0
    let awayGamesCount = 0

    // Momentum tracking (for S7 factor)
    let currentStreak = 0
    let wins = 0
    let losses = 0
    let gameDates: Date[] = []

    for (const gameLog of gameLogs) {
      const stats = gameLog.stats
      if (!stats) {
        console.warn(`[MySportsFeeds Stats] Game log missing stats field for ${teamAbbrev}`)
        continue
      }

      // Get team stats - VALIDATE that we have actual data, not just zeros
      const teamFGA = stats.fieldGoals?.fgAtt || 0
      const teamFGM = stats.fieldGoals?.fgMade || 0
      const teamFTA = stats.freeThrows?.ftAtt || 0
      const teamOREB = stats.rebounds?.offReb || 0
      const teamDREB = stats.rebounds?.defReb || 0
      const teamTOV = stats.defense?.tov || 0
      const team3PA = stats.fieldGoals?.fg3PtAtt || 0
      const team3PM = stats.fieldGoals?.fg3PtMade || 0
      const teamPTS = stats.offense?.pts || 0

      // Opponent rebounding (from defense stats)
      const oppOREB = stats.defense?.offRebAgainst || 0
      const oppDREB = stats.defense?.defRebAgainst || 0

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
      totalTOV += teamTOV
      totalOffReb += teamOREB
      totalDefReb += teamDREB
      totalOppOffReb += oppOREB
      totalOppDefReb += oppDREB
      totalFGM += teamFGM
      total3PM += team3PM

      // Track home/away splits
      const game = gameLog.game
      const team = gameLog.team

      // MySportsFeeds API can have homeTeam/awayTeam at different levels:
      // - game.homeTeam / game.awayTeam (direct)
      // - game.schedule.homeTeam / game.schedule.awayTeam (nested under schedule)
      const homeTeam = game?.homeTeam || game?.schedule?.homeTeam
      const awayTeam = game?.awayTeam || game?.schedule?.awayTeam

      // Debug: Log game structure for first game only
      if (gameLogs.indexOf(gameLog) === 0) {
        console.log(`[MySportsFeeds Stats] Home/Away detection debug for ${teamAbbrev}:`, {
          gameId: game?.id,
          teamId: team?.id,
          teamAbbrev: team?.abbreviation,
          // Check both possible locations
          directHomeTeam: game?.homeTeam,
          directAwayTeam: game?.awayTeam,
          scheduleHomeTeam: game?.schedule?.homeTeam,
          scheduleAwayTeam: game?.schedule?.awayTeam,
          // Resolved values
          resolvedHomeTeamId: homeTeam?.id,
          resolvedAwayTeamId: awayTeam?.id,
          gameKeys: game ? Object.keys(game) : []
        })
      }

      const isHomeGame = homeTeam?.id === team?.id

      if (isHomeGame) {
        homeORtgTotal += ortg
        homeDRtgTotal += drtg
        homeGamesCount++
      } else {
        awayORtgTotal += ortg
        awayDRtgTotal += drtg
        awayGamesCount++
      }

      // Track game dates for rest calculation (F7)
      if (game?.startTime) {
        gameDates.push(new Date(game.startTime))
      }

      // Track wins/losses for momentum (S7)
      // Determine if team won this game
      const teamPTS = stats.offense?.pts || 0
      const oppPTS = stats.defense?.ptsAgainst || 0
      if (teamPTS > oppPTS) {
        wins++
      } else if (oppPTS > teamPTS) {
        losses++
      }
    }

    // Calculate win streak (positive = wins, negative = losses)
    // Process games in chronological order (oldest first) to get current streak
    let streakCount = 0
    let lastResult: 'W' | 'L' | null = null
    for (const gameLog of gameLogs.slice().reverse()) { // Reverse to go oldest to newest
      const stats = gameLog.stats
      if (!stats) continue
      const teamPTS = stats.offense?.pts || 0
      const oppPTS = stats.defense?.ptsAgainst || 0
      const result = teamPTS > oppPTS ? 'W' : 'L'

      if (lastResult === null || result === lastResult) {
        streakCount = result === 'W' ? streakCount + 1 : streakCount - 1
        lastResult = result
      } else {
        // Streak broken, start new streak
        streakCount = result === 'W' ? 1 : -1
        lastResult = result
      }
    }
    const winStreak = streakCount

    // Calculate rest days (days since most recent game)
    // gameDates[0] is the most recent game
    let restDays = 1 // Default to 1 day rest
    let isBackToBack = false
    if (gameDates.length > 0) {
      const today = new Date()
      const mostRecentGame = gameDates[0]
      const daysSinceLastGame = Math.floor((today.getTime() - mostRecentGame.getTime()) / (1000 * 60 * 60 * 24))
      restDays = daysSinceLastGame
      isBackToBack = daysSinceLastGame === 0 // Playing same day or next day
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
    const avgTurnovers = totalTOV / gameCount

    // Rebounding averages (for S3)
    const avgOffReb = totalOffReb / gameCount
    const avgDefReb = totalDefReb / gameCount
    const avgOppOffReb = totalOppOffReb / gameCount
    const avgOppDefReb = totalOppDefReb / gameCount

    // DIAGNOSTIC: Log rebounding data to debug missing fields
    console.log(`[MySportsFeeds Stats] Rebounding data for ${teamAbbrev}:`, {
      totalOffReb,
      totalDefReb,
      totalOppOffReb,
      totalOppDefReb,
      avgOffReb,
      avgDefReb,
      avgOppOffReb,
      avgOppDefReb,
      gameCount
    })

    // CRITICAL: Validate rebounding data exists (required for SPREAD factors)
    if (totalOffReb === 0 && totalDefReb === 0) {
      throw new Error(
        `Missing rebounding data for ${teamAbbrev}. ` +
        `MySportsFeeds API did not return rebounds in stats.rebounds field. ` +
        `This data is required for SPREAD factor S3 (Rebounding Differential). ` +
        `Check API response structure or field names.`
      )
    }

    // Four Factors calculations (for S5)
    const avgEfg = totalFGA > 0 ? (totalFGM + 0.5 * total3PM) / totalFGA : 0
    const avgPoss = totalPace * gameCount // Total possessions across all games
    const avgTovPct = avgPoss > 0 ? totalTOV / avgPoss : 0
    const avgOrebPct = (totalOffReb + totalOppDefReb) > 0 ? totalOffReb / (totalOffReb + totalOppDefReb) : 0
    const avgFtr = totalFGA > 0 ? totalFTA / totalFGA : 0

    // Home/Away splits calculations (for S4)
    const ortgHome = homeGamesCount > 0 ? homeORtgTotal / homeGamesCount : undefined
    const ortgAway = awayGamesCount > 0 ? awayORtgTotal / awayGamesCount : undefined
    const drtgHome = homeGamesCount > 0 ? homeDRtgTotal / homeGamesCount : undefined
    const drtgAway = awayGamesCount > 0 ? awayDRtgTotal / awayGamesCount : undefined

    console.log(`[MySportsFeeds Stats] Home/Away splits for ${teamAbbrev}:`, {
      homeGames: homeGamesCount,
      awayGames: awayGamesCount,
      ortgHome: ortgHome?.toFixed(1),
      ortgAway: ortgAway?.toFixed(1),
      drtgHome: drtgHome?.toFixed(1),
      drtgAway: drtgAway?.toFixed(1)
    })

    const formData: TeamFormData = {
      team: teamAbbrev,
      pace: avgPace,
      ortg: avgORtg,
      drtg: avgDRtg,
      threeP_pct,
      threeP_rate,
      ft_rate,
      gamesAnalyzed: gameCount,
      avgTurnovers,

      // Rebounding data (S3)
      avgOffReb,
      avgDefReb,
      avgOppOffReb,
      avgOppDefReb,

      // Four Factors (S5)
      avgEfg,
      avgTovPct,
      avgOrebPct,
      avgFtr,

      // Home/Away splits (S4)
      ortgHome,
      ortgAway,
      drtgHome,
      drtgAway,
      homeGames: homeGamesCount,
      awayGames: awayGamesCount,

      // Rest advantage (F7)
      restDays,
      isBackToBack,

      // Momentum (S7)
      winStreak,
      last10Record: { wins, losses }
    }

    console.log(`[MySportsFeeds Stats] Form data for ${teamAbbrev}:`, {
      pace: avgPace.toFixed(1),
      ortg: avgORtg.toFixed(1),
      drtg: avgDRtg.toFixed(1),
      threeP_pct: (threeP_pct * 100).toFixed(1) + '%',
      threeP_rate: (threeP_rate * 100).toFixed(1) + '%',
      ft_rate: (ft_rate * 100).toFixed(1) + '%',
      avgTurnovers: avgTurnovers.toFixed(1),
      avgOffReb: avgOffReb.toFixed(1),
      avgDefReb: avgDefReb.toFixed(1),
      avgEfg: (avgEfg * 100).toFixed(1) + '%',
      avgOrebPct: (avgOrebPct * 100).toFixed(1) + '%',
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
    // Cache in Supabase (persists across serverless cold starts)
    await setSupabaseCachedTeamForm(cacheKey, formData)

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

    // Determine opponent - check both possible API structures
    const homeTeam = game.homeTeam || game.schedule?.homeTeam
    const awayTeam = game.awayTeam || game.schedule?.awayTeam
    const isHomeGame = homeTeam?.id === team.id
    const opponentAbbrev = isHomeGame ? awayTeam?.abbreviation : homeTeam?.abbreviation

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

