/**
 * NBA Factor Registry
 *
 * ⚠️ DEPRECATED: This file now re-exports from the Factor Factory.
 * For new code, import directly from '@/lib/factors' instead.
 *
 * The Factor Factory (src/lib/factors/) is the SINGLE SOURCE OF TRUTH.
 */

// Re-export everything from the compatibility layer
export {
  NBA_TOTALS_FACTORS,
  NBA_SPREAD_FACTORS,
  GLOBAL_FACTORS,
  INJURY_FACTORS,
  FACTOR_REGISTRY,
  getFactorMeta,
  getFactorsBySport,
  getFactorsByBetType,
  getFactorsByContext,
  clamp,
  normalizeToPoints,
  splitPointsEvenly,
  NBA_CONSTANTS,
  type FactorMeta
} from '@/lib/factors/compat'

// Re-export types for backward compatibility
export type { BetType, Sport, Scope } from '@/types/factors'

// StatMuse Query Helpers for NBA Totals (kept here as they're specific to this module)
export const StatMuseQueries = {
  // Pace queries
  pace: (team: string, last10 = false) =>
    last10 ? `${team} pace last 10 games this season` : `${team} pace this season`,

  leaguePace: () => 'league average pace this season',

  // Offensive/Defensive rating queries
  ortgLast10: (team: string) => `${team} offensive rating last 10 games this season`,
  drtgSeason: (team: string) => `${team} defensive rating this season`,
  ortgVenue: (team: string, venue: 'home' | 'away') =>
    `${team} offensive rating ${venue === 'home' ? 'at home' : 'on the road'} this season`,

  // 3-Point environment queries
  threePAR: (team: string) => `${team} 3 point attempt rate this season`,
  oppThreePAR: (team: string) => `${team} opponent 3 point attempt rate this season`,
  threePctLast10: (team: string) => `${team} 3pt percentage last 10 games this season`,

  // Free throw environment queries
  ftr: (team: string) => `${team} free throw rate this season`,
  oppFtr: (team: string) => `${team} opponent free throw rate this season`,
  fouls: (team: string) => `${team} personal fouls per game this season`,

  // Rest/fatigue queries
  restRecord: (team: string, days: number) =>
    `${team} record on ${days} days rest this season`
}