/**
 * MySportsFeeds Player Stats Fetcher
 * 
 * Fetches player statistics and injury data from MySportsFeeds API
 * Uses STATS addon - Seasonal Player Stats endpoint
 * 
 * Endpoint: /nba/current/player_stats_totals.json?team={ABBREV}
 * Rate Limit: 5-second backoff + 1 = 6 points per request
 */

import { fetchMySportsFeeds } from './mysportsfeeds-api'
import { getTeamAbbrev } from './team-mappings'
import type {
  PlayerInjuryData,
  PlayerInfo,
  NBAPlayerStats,
  PlayerAverages,
  CurrentInjury
} from './types/player-injury'

/**
 * In-memory cache for player stats
 * TTL: 5 minutes (injury status can change quickly)
 */
interface CacheEntry {
  data: PlayerInjuryData[]
  timestamp: number
}

const playerStatsCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached player stats if available and not expired
 */
function getCachedPlayerStats(teamAbbrev: string): PlayerInjuryData[] | null {
  const cached = playerStatsCache.get(teamAbbrev)
  if (!cached) return null
  
  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL_MS) {
    playerStatsCache.delete(teamAbbrev)
    return null
  }
  
  console.log(`[MySportsFeeds Players] Cache HIT for ${teamAbbrev} (age: ${(age / 1000).toFixed(1)}s)`)
  return cached.data
}

/**
 * Set player stats in cache
 */
function setCachedPlayerStats(teamAbbrev: string, data: PlayerInjuryData[]): void {
  playerStatsCache.set(teamAbbrev, {
    data,
    timestamp: Date.now()
  })
}

/**
 * Calculate player averages from season totals
 */
function calculatePlayerAverages(stats: NBAPlayerStats, gamesPlayed: number): PlayerAverages {
  const gp = gamesPlayed || 1 // Avoid division by zero
  
  return {
    gamesPlayed,
    avgMinutes: stats.miscellaneous?.minSeconds ? (stats.miscellaneous.minSeconds / 60) / gp : 0,
    avgPoints: stats.offense?.pts ? stats.offense.pts / gp : 0,
    avgRebounds: stats.rebounds?.reb ? stats.rebounds.reb / gp : 0,
    avgAssists: stats.assists?.ast ? stats.assists.ast / gp : 0,
    avgSteals: stats.defense?.stl ? stats.defense.stl / gp : 0,
    avgBlocks: stats.defense?.blk ? stats.defense.blk / gp : 0,
    fg3PtPct: stats.offense?.fg3PtAtt ? (stats.offense.fg3PtMade || 0) / stats.offense.fg3PtAtt : 0,
    ftPct: stats.offense?.ftAtt ? (stats.offense.ftMade || 0) / stats.offense.ftAtt : 0
  }
}

/**
 * Fetch player stats and injury data for a team
 * 
 * @param teamInput - Team name or abbreviation
 * @returns Array of player injury data with stats
 * @throws Error if API call fails
 */
export async function fetchTeamPlayerStats(teamInput: string): Promise<PlayerInjuryData[]> {
  const startTime = Date.now()
  const teamAbbrev = getTeamAbbrev(teamInput)
  
  console.log(`[MySportsFeeds Players] Fetching player stats for ${teamAbbrev}...`)
  
  // Check cache first
  const cached = getCachedPlayerStats(teamAbbrev)
  if (cached) {
    return cached
  }
  
  try {
    // Fetch from MySportsFeeds API
    // Endpoint: /nba/current/player_stats_totals.json?team={teamAbbrev}
    const response = await fetchMySportsFeeds(
      `player_stats_totals.json?team=${teamAbbrev}`,
      'current'
    )
    
    if (!response || !response.playerStatsTotals) {
      console.warn(`[MySportsFeeds Players] No player stats found for ${teamAbbrev}`)
      return []
    }
    
    const players: PlayerInjuryData[] = []
    
    for (const playerData of response.playerStatsTotals) {
      const player: PlayerInfo = {
        id: playerData.player.id,
        firstName: playerData.player.firstName,
        lastName: playerData.player.lastName,
        primaryPosition: playerData.player.primaryPosition,
        jerseyNumber: playerData.player.jerseyNumber,
        currentTeam: playerData.player.currentTeam,
        currentRosterStatus: playerData.player.currentRosterStatus,
        currentInjury: playerData.player.currentInjury as CurrentInjury | null,
        height: playerData.player.height,
        weight: playerData.player.weight,
        birthDate: playerData.player.birthDate,
        age: playerData.player.age,
        rookie: playerData.player.rookie
      }
      
      const stats: NBAPlayerStats = {
        gamesPlayed: playerData.stats.gamesPlayed || 0,
        offense: playerData.stats.offense,
        rebounds: playerData.stats.rebounds,
        assists: playerData.stats.assists,
        defense: playerData.stats.defense,
        miscellaneous: playerData.stats.miscellaneous
      }
      
      const averages = calculatePlayerAverages(stats, stats.gamesPlayed)
      
      players.push({
        player,
        stats,
        averages,
        team: playerData.team
      })
    }
    
    console.log(`[MySportsFeeds Players] Fetched ${players.length} players for ${teamAbbrev}`)
    console.log(`[MySportsFeeds Players] Latency: ${Date.now() - startTime}ms`)
    
    // Cache the results
    setCachedPlayerStats(teamAbbrev, players)
    
    return players
    
  } catch (error) {
    console.error(`[MySportsFeeds Players] Failed to fetch player stats for ${teamAbbrev}:`, error)
    throw new Error(
      `Failed to fetch player stats for ${teamAbbrev}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Get injured players from a team's roster
 */
export function getInjuredPlayers(players: PlayerInjuryData[]): PlayerInjuryData[] {
  return players.filter(p => p.player.currentInjury !== null)
}

/**
 * Get key players (significant contributors)
 * Criteria: 15+ PPG OR 25+ MPG OR top 5 scorers on team
 */
export function getKeyPlayers(players: PlayerInjuryData[]): PlayerInjuryData[] {
  // Filter by PPG or MPG thresholds
  const significantPlayers = players.filter(p => 
    p.averages.avgPoints >= 15 || p.averages.avgMinutes >= 25
  )
  
  // If we have fewer than 5, add top scorers
  if (significantPlayers.length < 5) {
    const sortedByPoints = [...players].sort((a, b) => b.averages.avgPoints - a.averages.avgPoints)
    const topScorers = sortedByPoints.slice(0, 5)
    
    // Merge without duplicates
    const keyPlayerIds = new Set(significantPlayers.map(p => p.player.id))
    for (const scorer of topScorers) {
      if (!keyPlayerIds.has(scorer.player.id)) {
        significantPlayers.push(scorer)
        keyPlayerIds.add(scorer.player.id)
      }
    }
  }
  
  return significantPlayers
}

/**
 * Get injured key players (intersection of injured and key players)
 */
export function getInjuredKeyPlayers(players: PlayerInjuryData[]): PlayerInjuryData[] {
  const injured = getInjuredPlayers(players)
  const keyPlayers = getKeyPlayers(players)
  const keyPlayerIds = new Set(keyPlayers.map(p => p.player.id))
  
  return injured.filter(p => keyPlayerIds.has(p.player.id))
}

/**
 * Format player for display
 */
export function formatPlayerDisplay(player: PlayerInjuryData): string {
  const { player: p, averages } = player
  const injury = p.currentInjury
  
  if (injury) {
    return `${p.firstName} ${p.lastName} (${p.primaryPosition}, ${averages.avgPoints.toFixed(1)} PPG) - ${injury.playingProbability}: ${injury.description}`
  }
  
  return `${p.firstName} ${p.lastName} (${p.primaryPosition}, ${averages.avgPoints.toFixed(1)} PPG)`
}

/**
 * Clear cache (useful for testing)
 */
export function clearPlayerStatsCache(): void {
  playerStatsCache.clear()
  console.log('[MySportsFeeds Players] Cache cleared')
}

