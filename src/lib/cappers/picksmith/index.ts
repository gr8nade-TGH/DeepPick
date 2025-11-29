/**
 * PICKSMITH - Consensus Meta-Capper
 * 
 * PICKSMITH doesn't analyze games directly. Instead, it:
 * 1. Monitors picks from other system cappers with positive unit records
 * 2. Generates picks when 2+ cappers agree on the same side
 * 3. Skips when cappers are split (1v1 disagreement blocks)
 * 4. Weighs by capper record and bet sizes
 * 
 * Usage:
 *   import { generatePicksmithPicks } from '@/lib/cappers/picksmith'
 *   const result = await generatePicksmithPicks()
 */

export * from './types'
export * from './eligibility'
export * from './consensus'
export * from './units-calculator'
export { generatePicksmithPicks, getUpcomingGames } from './pick-generator'

