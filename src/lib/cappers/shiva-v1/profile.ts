/**
 * SHIVA v1 Capper Profile
 * In-memory profile defining weights, caps, providers, and thresholds
 * Future: read from capper_settings table in DB
 */

export type AIProvider = 'perplexity' | 'openai'

export interface CapperProfile {
  capper: 'SHIVA'
  version: 'v1'
  
  // Factor weights (decimals, must sum to ~1.0)
  weights: {
    f1_net_rating: number        // 0.21
    f2_recent_form: number        // 0.175
    f3_h2h_matchup: number        // 0.14
    f4_ortg_diff: number          // 0.07
    f5_news_injury: number        // 0.07
    f6_home_court: number         // 0.035
    f7_three_point: number        // 0.021
  }
  
  // Caps and adjustments
  caps: {
    h2h_per100: number           // ±6
    side_points: number          // 6
    total_points: number         // 12
    news_edge_per100: number     // ±3.0
    market_adj_max: number       // 1.2
  }
  
  // Constants
  constants: {
    home_edge_per100: number     // 1.5
    league_ortg: number          // 114.0
  }
  
  // Unit thresholds
  units: {
    pass_below: number           // 2.5
    one_unit_max: number         // 3.0
    two_units_max: number        // 4.0
    // Above 4.0 = 3 units
  }
  
  // AI providers
  providers: {
    step3_default: AIProvider    // perplexity
    step4_default: AIProvider    // openai
    timeout_ms: number           // 6000-8000
    max_retries: number          // 2
  }
  
  // News settings
  news: {
    window_hours_default: number // 48
    window_hours_extended: number // 72
    extend_threshold_hours: number // 12 (extend if game starts in ≤12h)
  }
}

/**
 * SHIVA v1 Default Profile
 * Read-only, in-memory configuration
 */
export const shivaProfileV1: CapperProfile = {
  capper: 'SHIVA',
  version: 'v1',
  
  weights: {
    f1_net_rating: 0.21,
    f2_recent_form: 0.175,
    f3_h2h_matchup: 0.14,
    f4_ortg_diff: 0.07,
    f5_news_injury: 0.07,
    f6_home_court: 0.035,
    f7_three_point: 0.021,
  },
  
  caps: {
    h2h_per100: 6,
    side_points: 6,
    total_points: 12,
    news_edge_per100: 3.0,
    market_adj_max: 1.2,
  },
  
  constants: {
    home_edge_per100: 1.5,
    league_ortg: 114.0,
  },
  
  units: {
    pass_below: 2.5,
    one_unit_max: 3.0,
    two_units_max: 4.0,
  },
  
  providers: {
    step3_default: 'perplexity',
    step4_default: 'openai',
    timeout_ms: 6000,
    max_retries: 2,
  },
  
  news: {
    window_hours_default: 48,
    window_hours_extended: 72,
    extend_threshold_hours: 12,
  },
}

/**
 * Get capper profile by name
 * Future: load from DB (capper_settings table)
 */
export function getCapperProfile(capper: string): CapperProfile | null {
  if (capper === 'SHIVA') return shivaProfileV1
  return null
}

