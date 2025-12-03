/**
 * Factor Factory - Core Type Definitions
 * 
 * Single source of truth for all factor types.
 * Supports multiple sports (NBA, NFL, MLB) and bet types (TOTAL, SPREAD, MONEYLINE).
 */

// ============================================================================
// SPORT & BET TYPE ENUMS
// ============================================================================

export type Sport = 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'NCAAB' | 'NCAAF'
export type BetType = 'TOTAL' | 'SPREAD' | 'MONEYLINE' | 'PROP'
export type DataSource = 'mysportsfeeds' | 'perplexity' | 'openai' | 'system'
export type FactorCategory = 'pace' | 'offense' | 'defense' | 'shooting' | 'efficiency' | 'situational' | 'momentum' | 'injury'

// ============================================================================
// FACTOR RESULT TYPES
// ============================================================================

/** Result for TOTALS factors (Over/Under) */
export interface TotalsFactorResult {
  overScore: number      // Points favoring OVER (0-5)
  underScore: number     // Points favoring UNDER (0-5)
  signal: number         // -1 to +1 (negative = under, positive = over)
  meta: {
    raw_values_json: Record<string, any>
    parsed_values_json: Record<string, any>
  }
}

/** Result for SPREAD factors (Away/Home) */
export interface SpreadFactorResult {
  awayScore: number      // Points favoring AWAY team (0-5)
  homeScore: number      // Points favoring HOME team (0-5)
  signal: number         // -1 to +1 (negative = home, positive = away)
  meta: {
    raw_values_json: Record<string, any>
    parsed_values_json: Record<string, any>
  }
}

/** Union type for any factor result */
export type FactorResult = TotalsFactorResult | SpreadFactorResult

// ============================================================================
// FACTOR DEFINITION - THE MAIN TYPE
// ============================================================================

/**
 * Complete factor definition - everything needed to use a factor.
 * This is the SINGLE SOURCE OF TRUTH for each factor.
 */
export interface FactorDefinition<T extends FactorResult = FactorResult> {
  // Identity
  key: string                          // Unique key (e.g., 'paceIndex', 'netRatingDiff')
  factorNumber: number                 // Display order (F1, F2, S1, S2, etc.)
  name: string                         // Full name (e.g., 'Matchup Pace Index')
  shortName: string                    // Short name for UI (e.g., 'Pace')
  
  // Classification - IMPORTANT: Supports multi-sport
  sport: Sport                         // Which sport (NBA, NFL, etc.)
  betType: BetType                     // Which bet type (TOTAL, SPREAD, etc.)
  category: FactorCategory             // Grouping for UI
  
  // UI Display
  icon: string                         // Emoji or Lucide icon name
  description: string                  // One-liner for tooltips
  logic: string                        // Detailed explanation of calculation
  
  // Data Requirements
  dataSource: DataSource               // Primary data source
  dataRequirements: string[]           // Which NBAStatsBundle fields are needed
  
  // Configuration
  defaultWeight: number                // Default weight percentage (e.g., 20 = 20%)
  maxPoints: number                    // Score ceiling (usually 5.0)
  
  // Computation - the actual factor logic
  compute: (bundle: any, ctx: any) => T
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/** Computed factor output (what the orchestrator produces) */
export interface ComputedFactor {
  factor_no: number
  key: string
  name: string
  normalized_value: number             // The signal (-1 to 1)
  raw_values_json: Record<string, any>
  parsed_values_json: Record<string, any>
  caps_applied: boolean
  cap_reason: string | null
  notes: string
  weight_total_pct?: number            // Applied weight
}

/** Factor lookup filters */
export interface FactorFilter {
  sport?: Sport
  betType?: BetType
  category?: FactorCategory
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Clamp a value between min and max */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/** Calculate hyperbolic tangent for smooth signal saturation */
export function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

/** Convert signal to single-direction scores */
export function signalToScores(
  signal: number, 
  maxPoints: number,
  type: 'totals' | 'spread'
): { positive: number; negative: number } {
  const positive = signal > 0 ? Math.abs(signal) * maxPoints : 0
  const negative = signal < 0 ? Math.abs(signal) * maxPoints : 0
  return { positive, negative }
}

/** Create a totals factor result */
export function createTotalsResult(
  signal: number,
  maxPoints: number,
  rawValues: Record<string, any>,
  parsedValues: Record<string, any>
): TotalsFactorResult {
  const { positive: overScore, negative: underScore } = signalToScores(signal, maxPoints, 'totals')
  return {
    overScore,
    underScore,
    signal,
    meta: {
      raw_values_json: rawValues,
      parsed_values_json: { ...parsedValues, overScore, underScore, signal }
    }
  }
}

/** Create a spread factor result */
export function createSpreadResult(
  signal: number,
  maxPoints: number,
  rawValues: Record<string, any>,
  parsedValues: Record<string, any>
): SpreadFactorResult {
  const { positive: awayScore, negative: homeScore } = signalToScores(signal, maxPoints, 'spread')
  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      raw_values_json: rawValues,
      parsed_values_json: { ...parsedValues, awayScore, homeScore, signal }
    }
  }
}

