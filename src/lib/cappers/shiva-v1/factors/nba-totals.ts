/**
 * NBA Totals Factor Computation Engine
 * 
 * Main entry point for NBA totals factor computation.
 * This file now serves as a re-export of the modular factor system.
 */

// Re-export types
export type { RunCtx, StatMuseBundle, InjuryImpact, FactorComputationResult } from './types'

// Re-export the main orchestrator function
export { computeTotalsFactors } from './nba-totals-orchestrator'

// Re-export individual factor functions for testing/debugging
export { computePaceIndex } from './f1-pace-index'
export { computeOffensiveForm } from './f2-offensive-form'
export { computeDefensiveErosion } from './f3-defensive-erosion'
export { computeThreePointEnv } from './f4-three-point-env'
export { computeWhistleEnv } from './f5-free-throw-env'

// Re-export data fetching functions
export { fetchNBAStatsBundle, summarizeAvailabilityWithLLM } from './data-fetcher'