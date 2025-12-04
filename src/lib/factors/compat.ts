/**
 * Factor Factory - Compatibility Layer
 * 
 * Provides backward-compatible exports for old code that uses:
 * - factor-registry.ts (FactorMeta, FACTOR_REGISTRY, etc.)
 * - factor-config-registry.ts (FACTOR_REGISTRY with different structure)
 * 
 * This allows gradual migration without breaking existing code.
 */

import { FactorRegistry } from './registry'
import type { FactorDefinition, Sport, BetType } from './types'

// ============================================================================
// LEGACY TYPE: FactorMeta (from old factor-registry.ts)
// ============================================================================

export interface FactorMeta {
  key: string
  name: string
  shortName: string
  icon: string
  description: string
  appliesTo: {
    sports: Sport[] | '*'
    betTypes: BetType[] | '*'
    scope: 'GLOBAL' | 'SPORT' | 'LEAGUE'
  }
  maxPoints: number
  defaultWeight: number
  defaultDataSource: 'mysportsfeeds' | 'perplexity' | 'openai' | 'system'
}

// ============================================================================
// CONVERT: FactorDefinition -> FactorMeta
// ============================================================================

function toFactorMeta(def: FactorDefinition): FactorMeta {
  return {
    key: def.key,
    name: def.name,
    shortName: def.shortName,
    icon: def.icon,
    description: def.description,
    appliesTo: {
      sports: [def.sport],
      betTypes: [def.betType],
      scope: 'LEAGUE'
    },
    maxPoints: def.maxPoints,
    defaultWeight: def.defaultWeight / 100, // Convert from percentage to decimal
    defaultDataSource: def.dataSource
  }
}

// ============================================================================
// LEGACY EXPORTS: NBA_TOTALS_FACTORS, NBA_SPREAD_FACTORS, etc.
// ============================================================================

export const NBA_TOTALS_FACTORS: FactorMeta[] =
  FactorRegistry.getBySportAndBetType('NBA', 'TOTAL').map(toFactorMeta)

export const NBA_SPREAD_FACTORS: FactorMeta[] =
  FactorRegistry.getBySportAndBetType('NBA', 'SPREAD').map(toFactorMeta)

// Global factors (Edge vs Market) - these are computed separately, not in registry
export const GLOBAL_FACTORS: FactorMeta[] = [
  {
    key: 'edgeVsMarket',
    name: 'Edge vs Market',
    shortName: 'Edge',
    icon: '📊',
    description: 'The money line. How far is our prediction from Vegas? Bigger edge = stronger conviction.',
    appliesTo: { sports: '*', betTypes: ['TOTAL'], scope: 'GLOBAL' },
    maxPoints: 5.0,
    defaultWeight: 0.15,
    defaultDataSource: 'system'
  },
  {
    key: 'edgeVsMarketSpread',
    name: 'Edge vs Market',
    shortName: 'Edge',
    icon: '📊',
    description: 'The money line. How far is our prediction from Vegas? Bigger edge = stronger conviction.',
    appliesTo: { sports: '*', betTypes: ['SPREAD'], scope: 'GLOBAL' },
    maxPoints: 5.0,
    defaultWeight: 0.15,
    defaultDataSource: 'system'
  }
]

// Injury factors are now part of the main registry
export const INJURY_FACTORS: FactorMeta[] =
  FactorRegistry.getAll()
    .filter(f => f.category === 'injury')
    .map(toFactorMeta)

// Combined registry
export const FACTOR_REGISTRY: FactorMeta[] = [
  ...GLOBAL_FACTORS,
  ...NBA_TOTALS_FACTORS,
  ...NBA_SPREAD_FACTORS
]

// ============================================================================
// LEGACY FUNCTIONS
// ============================================================================

export function getFactorMeta(key: string): FactorMeta | undefined {
  return FACTOR_REGISTRY.find(f => f.key === key)
}

export function getFactorsBySport(sport: Sport): FactorMeta[] {
  return FACTOR_REGISTRY.filter(f =>
    f.appliesTo.sports === '*' ||
    (Array.isArray(f.appliesTo.sports) && f.appliesTo.sports.includes(sport))
  )
}

export function getFactorsByBetType(betType: BetType): FactorMeta[] {
  return FACTOR_REGISTRY.filter(f =>
    f.appliesTo.betTypes === '*' ||
    (Array.isArray(f.appliesTo.betTypes) && f.appliesTo.betTypes.includes(betType))
  )
}

export function getFactorsByContext(sport: Sport, betType: BetType): FactorMeta[] {
  return FACTOR_REGISTRY.filter(f => {
    const sportMatch = f.appliesTo.sports === '*' ||
      (Array.isArray(f.appliesTo.sports) && f.appliesTo.sports.includes(sport))
    const betTypeMatch = f.appliesTo.betTypes === '*' ||
      (Array.isArray(f.appliesTo.betTypes) && f.appliesTo.betTypes.includes(betType))
    return sportMatch && betTypeMatch
  })
}

// ============================================================================
// HELPER FUNCTIONS (unchanged)
// ============================================================================

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function normalizeToPoints(value: number, maxPoints: number): number {
  return clamp(value, -1, 1) * maxPoints
}

export function splitPointsEvenly(points: number): { away: number; home: number } {
  return { away: points / 2, home: points / 2 }
}

// NBA Constants
export const NBA_CONSTANTS = {
  LEAGUE_PACE: 100.0,
  LEAGUE_ORTG: 110.0,
  LEAGUE_DRTG: 110.0,
  LEAGUE_3PAR: 0.39,
  LEAGUE_FTR: 0.220,
  LEAGUE_3P_STDEV: 0.05
}

// ============================================================================
// UI HELPERS - For Create Capper, SHIVA Management, Admin pages
// ============================================================================

/**
 * Get available factor keys for a bet type
 * Replaces hardcoded AVAILABLE_FACTORS in Create Capper page
 */
export function getAvailableFactors(betType: 'TOTAL' | 'SPREAD'): string[] {
  return FactorRegistry.getBySportAndBetType('NBA', betType).map(f => f.key)
}

/**
 * Get factor details for UI display
 * Replaces hardcoded FACTOR_DETAILS in Create Capper page
 */
export function getFactorDetailsForUI(key: string): {
  name: string
  icon: string
  description: string
  importance: string
  example: string
  defaultWeight: number
  color: string
} | null {
  const factor = FactorRegistry.getByKey(key)
  if (!factor) return null

  // Map category to color
  const categoryColors: Record<string, string> = {
    pace: 'cyan',
    offense: 'green',
    defense: 'red',
    shooting: 'orange',
    freeThrows: 'yellow',
    injury: 'purple',
    situational: 'blue',
    efficiency: 'emerald',
    ballSecurity: 'amber',
    splits: 'indigo',
    momentum: 'pink'
  }

  return {
    name: factor.name,
    icon: factor.icon,
    description: factor.description,
    importance: factor.logic.split('.')[0] + '.', // First sentence
    example: factor.logic.split('.').slice(1, 3).join('.') + '.', // Next 2 sentences
    defaultWeight: factor.defaultWeight,
    color: categoryColors[factor.category] || 'slate'
  }
}

/**
 * Get factor groups for organized display
 * Replaces hardcoded FACTOR_GROUPS in Create Capper page
 */
export function getFactorGroups(betType: 'TOTAL' | 'SPREAD'): Array<{
  id: string
  name: string
  icon: string
  factors: string[]
  color: string
}> {
  const factors = FactorRegistry.getBySportAndBetType('NBA', betType)

  // Group by category
  const groups: Record<string, { factors: FactorDefinition[], icon: string, color: string }> = {}

  const categoryMeta: Record<string, { name: string, icon: string, color: string }> = {
    pace: { name: 'Pace & Tempo', icon: 'Activity', color: 'cyan' },
    offense: { name: 'Offensive Form', icon: 'TrendingUp', color: 'green' },
    defense: { name: 'Defensive Erosion', icon: 'Shield', color: 'red' },
    shooting: { name: '3-Point Environment', icon: 'Crosshair', color: 'orange' },
    freeThrows: { name: 'Free Throw Environment', icon: 'Target', color: 'yellow' },
    injury: { name: 'Injury Impact', icon: 'AlertTriangle', color: 'purple' },
    situational: { name: 'Situational Factors', icon: 'Moon', color: 'blue' },
    efficiency: { name: 'Efficiency Metrics', icon: 'BarChart2', color: 'emerald' },
    ballSecurity: { name: 'Ball Security', icon: 'Lock', color: 'amber' },
    splits: { name: 'Home/Away Splits', icon: 'Home', color: 'indigo' },
    momentum: { name: 'Momentum', icon: 'TrendingUp', color: 'pink' }
  }

  factors.forEach(f => {
    if (!groups[f.category]) {
      const meta = categoryMeta[f.category] || { name: f.category, icon: 'Circle', color: 'slate' }
      groups[f.category] = { factors: [], icon: meta.icon, color: meta.color }
    }
    groups[f.category].factors.push(f)
  })

  return Object.entries(groups).map(([id, group]) => ({
    id,
    name: categoryMeta[id]?.name || id,
    icon: group.icon,
    factors: group.factors.map(f => f.key),
    color: group.color
  }))
}

// Re-export FactorRegistry for direct access
export { FactorRegistry }

