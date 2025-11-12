/**
 * Territory Map Type Definitions
 */

export type TerritoryState = 'unclaimed' | 'claimed' | 'active'
export type TerritoryTier = 'dominant' | 'strong' | 'weak'
export type TimePeriod = 'all-time' | 'current-season' | 'last-30-days' | 'last-7-days'

export interface CapperRanking {
  rank: number
  capperId: string
  capperName: string
  netUnits: number
  wins: number
  losses: number
  pushes: number
  totalPicks: number
  hasActivePick: boolean
  activePickId?: string
}

export interface TerritoryData {
  teamAbbr: string
  state: TerritoryState
  tier?: TerritoryTier
  capperUsername?: string
  capperRank?: number // Rank of the displayed capper (#1, #2, #3, etc.)
  units?: number
  wins?: number
  losses?: number
  pushes?: number
  activePick?: ActivePickData
  leaderboard?: CapperRanking[] // Top 3 cappers for this territory
  gameTime?: string // For active picks - when the game starts
}

export interface ActivePickData {
  gameId: string
  opponent: string
  gameTime: string
  prediction: string
  confidence: number
  betType: 'TOTAL' | 'SPREAD'
  line: number
}

export interface MapFilters {
  timePeriod: TimePeriod
  capper: string | null
  activePicksOnly: boolean
}

export interface MapStats {
  claimed: number
  active: number
  unclaimed: number
}

export interface ActiveMatchup {
  gameId: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  status: string
}

