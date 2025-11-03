/**
 * Territory Map Type Definitions
 */

export type TerritoryState = 'unclaimed' | 'claimed' | 'active'
export type TerritoryTier = 'dominant' | 'strong' | 'weak'
export type TimePeriod = 'all-time' | 'current-season' | 'last-30-days' | 'last-7-days'

export interface TerritoryData {
  teamAbbr: string
  state: TerritoryState
  tier?: TerritoryTier
  capperUsername?: string
  units?: number
  wins?: number
  losses?: number
  pushes?: number
  activePick?: ActivePickData
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

