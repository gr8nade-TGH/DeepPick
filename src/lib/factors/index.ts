/**
 * Factor Factory - Main Export
 * 
 * This is the SINGLE SOURCE OF TRUTH for all factor operations.
 * Import from here instead of the old registries.
 */

// Core types
export * from './types'

// Registry
export { FactorRegistry } from './registry'

// Re-export for convenience
export type { 
  FactorDefinition, 
  FactorResult, 
  TotalsFactorResult, 
  SpreadFactorResult,
  ComputedFactor,
  Sport,
  BetType,
  FactorCategory
} from './types'

