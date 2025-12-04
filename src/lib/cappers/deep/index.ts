/**
 * DEEP - Factor Confluence Meta-Capper
 * 
 * DEEP doesn't just count votes. It:
 * 1. Aggregates Factor Intelligence - Combines all factor evaluations into a unified view
 * 2. Weights by Quality - Uses tier scores, not just net units
 * 3. Analyzes Disagreement - Understands WHY cappers disagree
 * 4. Tracks Factor Confidence - Which factors are cappers most confident in?
 * 
 * The name "Deep Pick" comes from this - we go DEEP into the factor analysis.
 * 
 * Usage:
 *   import { generateDeepPicks } from '@/lib/cappers/deep'
 *   const result = await generateDeepPicks()
 */

export * from './types'
export * from './eligibility'
export * from './consensus'
export * from './factor-confluence'
export * from './units-calculator'
export { generateDeepPicks, getUpcomingGames } from './pick-generator'

