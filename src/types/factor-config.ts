/**
 * Factor Configuration Types
 * Defines the structure for configurable factors per capper/sport/bet type
 */

export type DataSource = 'nba-stats-api' | 'odds-api-scores' | 'statmuse' | 'manual' | 'llm' | 'news-api' | 'system'

export interface FactorConfig {
  key: string
  name: string
  description: string
  enabled: boolean
  weight: number // 0-100
  dataSource: DataSource
  maxPoints: number
  
  // Metadata
  sport: string
  betType: string
  scope: 'team' | 'player' | 'matchup' | 'global'
  
  // UI
  icon: string
  shortName: string
}

export interface CapperProfile {
  id: string
  capperId: string // 'SHIVA', 'IFRIT', 'CERBERUS', etc.
  sport: string // 'NBA', 'NFL', 'MLB'
  betType: string // 'SPREAD', 'MONEYLINE', 'TOTAL'
  
  name: string
  description?: string
  
  factors: FactorConfig[]
  
  // Metadata
  createdAt: string
  updatedAt: string
  isActive: boolean
  isDefault: boolean
}

export interface FactorRegistry {
  [key: string]: {
    name: string
    description: string
    defaultWeight: number
    maxPoints: number
    supportedSports: string[]
    supportedBetTypes: string[]
    availableDataSources: DataSource[]
    defaultDataSource: DataSource
    scope: 'team' | 'player' | 'matchup' | 'global'
    icon: string
    shortName: string
  }
}

