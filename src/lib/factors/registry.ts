/**
 * Factor Factory - Unified Registry
 * 
 * Auto-loads all factor definitions and provides lookup/compute APIs.
 * This is the SINGLE ENTRY POINT for all factor operations.
 */

import { 
  FactorDefinition, 
  FactorResult, 
  FactorFilter, 
  Sport, 
  BetType,
  ComputedFactor 
} from './types'

// ============================================================================
// FACTOR IMPORTS - Add new factors here
// ============================================================================

// NBA TOTALS Factors
import { F1_PACE_INDEX } from './definitions/nba/totals/f1-pace-index'
import { F2_OFFENSIVE_FORM } from './definitions/nba/totals/f2-offensive-form'
import { F3_DEFENSIVE_EROSION } from './definitions/nba/totals/f3-defensive-erosion'
import { F4_THREE_POINT_ENV } from './definitions/nba/totals/f4-three-point-env'
import { F5_WHISTLE_ENV } from './definitions/nba/totals/f5-whistle-env'
import { F6_INJURY_AVAILABILITY_TOTALS } from './definitions/nba/totals/f6-injury-availability'
import { F7_REST_ADVANTAGE } from './definitions/nba/totals/f7-rest-advantage'

// NBA SPREAD Factors
import { S1_NET_RATING_DIFF } from './definitions/nba/spread/s1-net-rating-diff'
import { S2_TURNOVER_DIFF } from './definitions/nba/spread/s2-turnover-diff'
import { S3_SHOOTING_EFFICIENCY } from './definitions/nba/spread/s3-shooting-efficiency'
import { S4_HOME_AWAY_SPLITS } from './definitions/nba/spread/s4-home-away-splits'
import { S5_FOUR_FACTORS_DIFF } from './definitions/nba/spread/s5-four-factors-diff'
import { S6_INJURY_AVAILABILITY_SPREAD } from './definitions/nba/spread/s6-injury-availability'
import { S7_MOMENTUM_INDEX } from './definitions/nba/spread/s7-momentum-index'

// ============================================================================
// MASTER FACTOR LIST - Add new factors to this array
// ============================================================================

const ALL_FACTORS: FactorDefinition[] = [
  // NBA TOTALS (7 factors)
  F1_PACE_INDEX,
  F2_OFFENSIVE_FORM,
  F3_DEFENSIVE_EROSION,
  F4_THREE_POINT_ENV,
  F5_WHISTLE_ENV,
  F6_INJURY_AVAILABILITY_TOTALS,
  F7_REST_ADVANTAGE,
  
  // NBA SPREAD (7 factors)
  S1_NET_RATING_DIFF,
  S2_TURNOVER_DIFF,
  S3_SHOOTING_EFFICIENCY,
  S4_HOME_AWAY_SPLITS,
  S5_FOUR_FACTORS_DIFF,
  S6_INJURY_AVAILABILITY_SPREAD,
  S7_MOMENTUM_INDEX,
]

// ============================================================================
// BUILD INDEXES FOR FAST LOOKUP
// ============================================================================

const factorsByKey = new Map<string, FactorDefinition>(
  ALL_FACTORS.map(f => [f.key, f])
)

const factorsBySportAndBetType = new Map<string, FactorDefinition[]>()

// Build sport+betType index
ALL_FACTORS.forEach(f => {
  const key = `${f.sport}:${f.betType}`
  if (!factorsBySportAndBetType.has(key)) {
    factorsBySportAndBetType.set(key, [])
  }
  factorsBySportAndBetType.get(key)!.push(f)
})

// ============================================================================
// PUBLIC API - FactorRegistry
// ============================================================================

export const FactorRegistry = {
  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------
  
  /** Get all registered factors */
  getAll: (): FactorDefinition[] => ALL_FACTORS,
  
  /** Get a factor by its unique key */
  getByKey: (key: string): FactorDefinition | undefined => factorsByKey.get(key),
  
  /** Get factors for a specific sport and bet type */
  getBySportAndBetType: (sport: Sport, betType: BetType): FactorDefinition[] => {
    return factorsBySportAndBetType.get(`${sport}:${betType}`) || []
  },
  
  /** Get factor keys for a sport/betType combo */
  getKeys: (sport: Sport, betType: BetType): string[] => {
    return FactorRegistry.getBySportAndBetType(sport, betType).map(f => f.key)
  },
  
  /** Check if a factor key exists */
  has: (key: string): boolean => factorsByKey.has(key),
  
  // -------------------------------------------------------------------------
  // UI Helpers - for Create Capper, SHIVA Management, Admin pages
  // -------------------------------------------------------------------------
  
  /** Get factor details for UI display */
  getFactorDetails: (key: string): { name: string; icon: string; description: string; shortName: string } | null => {
    const f = factorsByKey.get(key)
    if (!f) return null
    return { name: f.name, icon: f.icon, description: f.description, shortName: f.shortName }
  },
  
  /** Get factor logic explanation */
  getFactorLogic: (key: string): string => factorsByKey.get(key)?.logic ?? '',
  
  /** Get all factors grouped by category */
  getGroupedByCategory: (sport: Sport, betType: BetType) => {
    const factors = FactorRegistry.getBySportAndBetType(sport, betType)
    const groups: Record<string, FactorDefinition[]> = {}
    factors.forEach(f => {
      if (!groups[f.category]) groups[f.category] = []
      groups[f.category].push(f)
    })
    return groups
  },
  
  // -------------------------------------------------------------------------
  // Computation - for Orchestrators
  // -------------------------------------------------------------------------
  
  /** Compute a single factor */
  compute: (key: string, bundle: any, ctx: any): ComputedFactor => {
    const factor = factorsByKey.get(key)
    if (!factor) {
      throw new Error(`[FactorRegistry] Unknown factor: ${key}`)
    }
    
    const result = factor.compute(bundle, ctx)
    
    // Convert to ComputedFactor format
    return {
      factor_no: factor.factorNumber,
      key: factor.key,
      name: factor.name,
      normalized_value: result.signal,
      raw_values_json: result.meta.raw_values_json,
      parsed_values_json: result.meta.parsed_values_json,
      caps_applied: false,
      cap_reason: null,
      notes: `${factor.shortName}: signal=${result.signal.toFixed(3)}`
    }
  },
  
  /** Compute multiple factors (for orchestrator use) */
  computeMany: (keys: string[], bundle: any, ctx: any): ComputedFactor[] => {
    const results: ComputedFactor[] = []
    
    for (const key of keys) {
      try {
        results.push(FactorRegistry.compute(key, bundle, ctx))
      } catch (error) {
        console.error(`[FactorRegistry] Factor ${key} failed:`, error)
        // Add error entry
        const factor = factorsByKey.get(key)
        results.push({
          factor_no: factor?.factorNumber ?? 0,
          key,
          name: factor?.name ?? key,
          normalized_value: 0,
          raw_values_json: { error: error instanceof Error ? error.message : 'Unknown error' },
          parsed_values_json: { error: true },
          caps_applied: false,
          cap_reason: 'computation_error',
          notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }
    
    return results
  }
}

// Export for convenience
export type { FactorDefinition, FactorResult, FactorFilter }

