/**
 * NBA Totals Data Fetcher
 * 
 * Handles all external data fetching for NBA totals factors
 * Uses ONLY The Odds API scores to calculate stats (last 5-10 games)
 * Removed unreliable NBA Stats API entirely
 */

import { searchInjuries } from '../news'
import { RunCtx, NBAStatsBundle, InjuryImpact } from './types'

/**
 * Fetch all required data for NBA totals factor computation
 * Uses ONLY The Odds API scores endpoint to calculate stats from last 5 games
 * Removed dependency on NBA Stats API
 */
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  // TODO: This file needs to be completely refactored to use MySportsFeeds instead of NBA Stats API
  throw new Error('fetchNBAStatsBundle is being refactored to use MySportsFeeds. Not yet implemented.')
}

/**
 * Fetch injury impact via LLM (Legacy - now replaced by AI factor)
 * @deprecated Use computeInjuryAvailabilityAsync instead
 */
export async function summarizeAvailabilityWithLLM(ctx: RunCtx): Promise<InjuryImpact> {
  console.log('[INJURY_LLM:LEGACY]', 'Using legacy injury analysis - consider using AI factor instead')
  
  try {
    const injuryData = await searchInjuries(ctx.away, ctx.home, 48) // 48 hour window
    
    // Mock LLM processing (would use actual LLM in production)
    const defenseImpactA = Math.random() * 0.4 - 0.2 // -0.2 to +0.2
    const defenseImpactB = Math.random() * 0.4 - 0.2 // -0.2 to +0.2
    
    const result: InjuryImpact = {
      defenseImpactA,
      defenseImpactB,
      summary: `Legacy injury analysis for ${ctx.away} vs ${ctx.home}`,
      rawResponse: JSON.stringify(injuryData)
    }
    
    console.log('[INJURY_LLM:SUCCESS]', { 
      defenseImpactA, 
      defenseImpactB 
    })
    
    return result
    
  } catch (error) {
    console.error('[INJURY_LLM:ERROR]', error)
    
    // Return neutral impact on error
    return {
      defenseImpactA: 0,
      defenseImpactB: 0,
      summary: 'Legacy injury analysis failed',
      rawResponse: ''
    }
  }
}