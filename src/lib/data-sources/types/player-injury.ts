/**
 * Player Injury Data Types
 * 
 * Type definitions for MySportsFeeds player stats and injury data
 * Used by the injury factor analysis system
 */

/**
 * MySportsFeeds injury status values
 */
export type InjuryStatus = 'OUT' | 'QUESTIONABLE' | 'DOUBTFUL' | 'PROBABLE' | null

/**
 * MySportsFeeds playing probability values
 */
export type PlayingProbability = 'OUT' | 'QUESTIONABLE' | 'DOUBTFUL' | 'PROBABLE' | null

/**
 * Current injury information from MySportsFeeds
 */
export interface CurrentInjury {
  description: string
  playingProbability: PlayingProbability
}

/**
 * Player information from MySportsFeeds
 */
export interface PlayerInfo {
  id: number
  firstName: string
  lastName: string
  primaryPosition: string
  jerseyNumber: number | null
  currentTeam: {
    id: number
    abbreviation: string
  }
  currentRosterStatus: string
  currentInjury: CurrentInjury | null
  height: string | null
  weight: number | null
  birthDate: string | null
  age: number | null
  rookie: boolean
}

/**
 * NBA player stats from MySportsFeeds (season totals)
 */
export interface NBAPlayerStats {
  gamesPlayed: number
  
  // Offense stats
  offense?: {
    pts: number
    fgAtt: number
    fgMade: number
    fg3PtAtt: number
    fg3PtMade: number
    ftAtt: number
    ftMade: number
  }
  
  // Rebounds
  rebounds?: {
    reb: number
    offReb: number
    defReb: number
  }
  
  // Assists and playmaking
  assists?: {
    ast: number
  }
  
  // Defense
  defense?: {
    stl: number
    blk: number
  }
  
  // Miscellaneous
  miscellaneous?: {
    minSeconds: number
    plusMinus: number
  }
}

/**
 * Calculated player averages (per game)
 */
export interface PlayerAverages {
  gamesPlayed: number
  avgMinutes: number
  avgPoints: number
  avgRebounds: number
  avgAssists: number
  avgSteals: number
  avgBlocks: number
  fg3PtPct: number
  ftPct: number
}

/**
 * Complete player injury data with stats
 */
export interface PlayerInjuryData {
  player: PlayerInfo
  stats: NBAPlayerStats
  averages: PlayerAverages
  team: {
    id: number
    abbreviation: string
  }
}

/**
 * Injury impact classification
 */
export interface InjuryImpactClassification {
  severity: 'critical' | 'major' | 'moderate' | 'minor' | 'none'
  impactScore: number // -10 to +10
  reasoning: string
}

/**
 * Team injury summary
 */
export interface TeamInjurySummary {
  teamName: string
  teamAbbrev: string
  totalPlayers: number
  injuredPlayers: PlayerInjuryData[]
  keyPlayers: PlayerInjuryData[] // Players with significant stats
  injuryImpact: InjuryImpactClassification
}

/**
 * Merged injury data from multiple sources
 */
export interface MergedInjuryData {
  awayTeam: TeamInjurySummary
  homeTeam: TeamInjurySummary
  recentNews: Array<{
    team: string
    player: string
    status: string
    source: string
    timestamp?: string
  }>
  dataSourcesUsed: string[]
  fetchedAt: string
}

/**
 * AI injury analysis result
 */
export interface AIInjuryAnalysis {
  awayImpact: number // -10 to +10
  homeImpact: number // -10 to +10
  totalImpact: number // Average of away and home
  keyInjuries: string[]
  reasoning: string
  confidence: 'low' | 'medium' | 'high'
}

/**
 * Complete injury factor result
 */
export interface InjuryFactorResult {
  mergedData: MergedInjuryData
  aiAnalysis: AIInjuryAnalysis
  signal: number // -1 to +1
  overScore: number // 0 to 5.0
  underScore: number // 0 to 5.0
  meta: {
    dataSourcesUsed: string[]
    aiProvider: 'perplexity' | 'openai'
    cacheHit: boolean
    latencyMs: number
  }
}

