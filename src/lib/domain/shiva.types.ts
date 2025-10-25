// SHIVA domain types
export type FactorId =
  | 'pace'
  | 'efg'
  | 'tov'
  | 'orb'
  | 'ftr'
  | 'home_away'
  | 'form10'
  | 'schedule_tax'
  | 'injuries'
  | 'market_move'
  | 'edge_vs_market'

export interface FactorConfig {
  id: FactorId
  weight: number
  enabled: boolean
}

export interface FactorsPayload {
  factors: FactorConfig[]
  thresholds: {
    play_abs: number
    units_map: [number, number][]
  }
  weights_sum: number
}

export interface FactorScore {
  id: FactorId
  value: number // normalized [-1,1]
}

export interface Prediction {
  score: number
  rationale: string[]
}

export interface Pick {
  game_id: string
  market: 'spread' | 'total' | 'ml'
  side: string
  units: number
  confidence: number
}

export interface CapperProfile {
  profile_id: string
  capper_code: string
  version: number
  is_active: boolean
  label?: string
  config: FactorsPayload
  created_at: string
  updated_at: string
}

// Common types
export type RequestId = string
export type RunId = string
export type GameId = string

export type PipelineStepStatus = 'STARTED' | 'SUCCESS' | 'FAILED'
export type PipelineStep = 
  | 'ODDS_SNAPSHOT'
  | 'FACTORS'
  | 'PREDICT'
  | 'DECIDE'
  | 'WRITE_PICK'
  | 'INSIGHT_CARD'

export interface TracingContext {
  request_id?: RequestId
  run_id?: RunId
  capper?: string
  game_id?: GameId
  route?: string
}
