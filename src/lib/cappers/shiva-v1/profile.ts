/**
 * SHIVA v1 Capper Profile
 * In-memory profile defining weights, caps, providers, and thresholds
 * Can be loaded from capper_settings table in DB
 */

import { z } from 'zod'

export type AIProvider = 'perplexity' | 'openai'

// ============================================================================
// ZOD SCHEMA FOR PROFILE VALIDATION
// ============================================================================

export const ProfileJSONSchema = z.object({
  capper: z.string(),
  sport: z.enum(['NBA', 'MLB', 'NFL']),
  version: z.string(),
  providers: z.object({
    step3: z.enum(['perplexity', 'openai']),
    step4: z.enum(['perplexity', 'openai']),
  }).strict(),
  searchMode: z.enum(['quick', 'deep']),
  factors: z.array(z.object({
    key: z.string(),
    enabled: z.boolean(),
    weight: z.number().min(0).max(1),
  }).strict()),
  caps: z.object({
    h2hPer100: z.number(),
    newsEdgePer100: z.number(),
    homePer100: z.number(),
  }).strict(),
  market: z.object({
    weight: z.number(),
    sideCap: z.number(),
    totalCap: z.number(),
    adjMax: z.number(),
  }).strict(),
  thresholds: z.object({
    passLt: z.number(),
    oneUnit: z.number(),
    twoUnits: z.number(),
    maxUnits: z.number(),
  }).strict(),
  behavior: z.object({
    seasonDefault: z.string(),
    pinnedSeasonFallback: z.string(),
    probableImpact: z.number(),
  }).strict(),
}).strict()

export interface CapperProfile {
  capper: string
  version: string

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

  // Unit thresholds (for documentation - actual logic is hardcoded in orchestrator)
  units: {
    pass_below: number           // 5.0 (PASS if conf ≤ 5.0)
    one_unit_min: number         // 5.0 (1 unit if conf > 5.0)
    two_units_min: number        // 6.0 (2 units if conf > 6.0)
    three_units_min: number      // 7.0 (3 units if conf > 7.0)
    four_units_min: number       // 8.0 (4 units if conf > 8.0)
    five_units_min: number       // 9.0 (5 units if conf > 9.0, max)
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
    pass_below: 5.0,
    one_unit_min: 5.0,
    two_units_min: 6.0,
    three_units_min: 7.0,
    four_units_min: 8.0,
    five_units_min: 9.0,
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
 * Get capper profile by name and sport
 * Loads from DB if available, falls back to in-memory defaults
 */
export async function getCapperProfile(
  capper: string,
  sport: 'NBA' | 'MLB' | 'NFL' = 'NBA'
): Promise<CapperProfile | null> {
  const capperLower = capper.toLowerCase()
  const capperUpper = capper.toUpperCase()

  // Try loading from user_cappers table first (for IFRIT, CERBERUS, etc.)
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/server')
    const admin = getSupabaseAdmin()

    const userCapperResult = await admin
      .from('user_cappers')
      .select('*')
      .eq('capper_id', capperLower)
      .eq('sport', sport)
      .eq('is_active', true)
      .maybeSingle()

    if (userCapperResult.data) {
      console.log('[Profile] Loaded from user_cappers:', { capper, sport })

      // Return a basic profile for user cappers
      // The factor config is stored in user_cappers.factor_config
      return shivaProfileV1 // Use SHIVA profile as template for now
    }
  } catch (error) {
    console.warn('[Profile]', 'Failed to load from user_cappers', error)
  }

  // Try loading from capper_settings (for SHIVA)
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/server')
    const admin = getSupabaseAdmin()

    const result = await admin
      .from('capper_settings')
      .select('profile_json, version')
      .eq('capper', capperUpper)
      .eq('sport', sport)
      .eq('is_active', true)
      .maybeSingle()

    if (result.data && result.data.profile_json) {
      // Validate profile JSON
      const parsed = ProfileJSONSchema.safeParse(result.data.profile_json)
      if (parsed.success) {
        // Convert DB JSON to CapperProfile format
        return convertProfileJSONToCapperProfile(parsed.data)
      }
    }
  } catch (error) {
    console.warn('[Profile]', 'Failed to load from DB, using fallback', error)
  }

  // Fallback to in-memory defaults
  if (capperUpper === 'SHIVA' && sport === 'NBA') return shivaProfileV1

  return null
}

/**
 * Convert DB profile JSON to CapperProfile interface
 */
function convertProfileJSONToCapperProfile(json: z.infer<typeof ProfileJSONSchema>): CapperProfile {
  const factorsMap = new Map(json.factors.map(f => [f.key, f]))

  return {
    capper: 'SHIVA',
    version: json.version,
    weights: {
      f1_net_rating: factorsMap.get('seasonNet')?.weight ?? 0.21,
      f2_recent_form: factorsMap.get('recentNet')?.weight ?? 0.175,
      f3_h2h_matchup: factorsMap.get('h2hPpg')?.weight ?? 0.14,
      f4_ortg_diff: factorsMap.get('matchupORtgDRtg')?.weight ?? 0.07,
      f5_news_injury: factorsMap.get('newsEdge')?.weight ?? 0.07,
      f6_home_court: factorsMap.get('homeEdge')?.weight ?? 0.035,
      f7_three_point: factorsMap.get('threePoint')?.weight ?? 0.021,
    },
    caps: {
      h2h_per100: json.caps.h2hPer100,
      side_points: json.market.sideCap,
      total_points: json.market.totalCap,
      news_edge_per100: json.caps.newsEdgePer100,
      market_adj_max: json.market.adjMax,
    },
    constants: {
      home_edge_per100: json.caps.homePer100,
      league_ortg: 114.0, // Default for NBA
    },
    units: {
      pass_below: json.thresholds.passLt,
      one_unit_min: json.thresholds.oneUnit,
      two_units_min: json.thresholds.twoUnits,
      three_units_min: json.thresholds.maxUnits || 7.0,
      four_units_min: 8.0,
      five_units_min: 9.0,
    },
    providers: {
      step3_default: json.providers.step3,
      step4_default: json.providers.step4,
      timeout_ms: 6000,
      max_retries: 2,
    },
    news: {
      window_hours_default: 48,
      window_hours_extended: 72,
      extend_threshold_hours: 12,
    },
  }
}

/**
 * Sync function for backward compatibility
 * Use getCapperProfile() for DB-backed loading
 */
export function getCapperProfileSync(capper: string): CapperProfile | null {
  if (capper === 'SHIVA') return shivaProfileV1
  return null
}

