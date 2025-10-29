/**
 * NBA Totals Data Fetcher
 *
 * Handles all external data fetching for NBA totals factors
 * Uses MySportsFeeds API to fetch team statistics
 */

import { searchInjuries } from '../news'
import { RunCtx, NBAStatsBundle, InjuryImpact } from './types'
import { getTeamFormData } from '@/lib/data-sources/mysportsfeeds-stats'
import { getTeamAbbrev } from '@/lib/data-sources/team-mappings'

/**
 * Fetch all required data for NBA totals factor computation
 * Uses MySportsFeeds API to get team game logs and calculate advanced stats
 *
 * @throws Error if data cannot be fetched - NO FALLBACK TO DEFAULTS
 */
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  console.log('[DATA_FETCHER] Starting NBA stats bundle fetch')
  console.log(`[DATA_FETCHER] Away: ${ctx.away}, Home: ${ctx.home}`)

  try {
    // Resolve team abbreviations
    const awayAbbrev = getTeamAbbrev(ctx.away)
    const homeAbbrev = getTeamAbbrev(ctx.home)

    console.log(`[DATA_FETCHER] Resolved teams: ${awayAbbrev} @ ${homeAbbrev}`)

    // Fetch recent form (last 10 games) - REDUCED API CALLS to avoid rate limits
    // Using 10-game stats for both recent and season to reduce from 4 calls to 2 calls per game
    console.log('[DATA_FETCHER] Fetching team statistics from MySportsFeeds (10-game window)...')

    const [awayRecent, homeRecent] = await Promise.all([
      getTeamFormData(awayAbbrev, 10),
      getTeamFormData(homeAbbrev, 10)
    ])

    console.log('[DATA_FETCHER] Successfully fetched all team statistics')
    console.log(`[DATA_FETCHER] ${awayAbbrev} recent: Pace=${awayRecent.pace.toFixed(1)}, ORtg=${awayRecent.ortg.toFixed(1)}`)
    console.log(`[DATA_FETCHER] ${homeAbbrev} recent: Pace=${homeRecent.pace.toFixed(1)}, ORtg=${homeRecent.ortg.toFixed(1)}`)

    // Build the stats bundle
    // NOTE: Using 10-game stats for both recent and season to reduce API calls
    // This is a trade-off between data accuracy and rate limit avoidance
    const bundle: NBAStatsBundle = {
      // Pace stats (using 10-game for both)
      awayPaceSeason: awayRecent.pace,
      awayPaceLast10: awayRecent.pace,
      homePaceSeason: homeRecent.pace,
      homePaceLast10: homeRecent.pace,
      leaguePace: 100.1, // NBA league average (static)

      // Offensive Rating
      awayORtgLast10: awayRecent.ortg,
      homeORtgLast10: homeRecent.ortg,
      leagueORtg: 110.0, // NBA league average (static)

      // Defensive Rating (using 10-game for season)
      awayDRtgSeason: awayRecent.drtg,
      homeDRtgSeason: homeRecent.drtg,
      leagueDRtg: 110.0, // NBA league average (static)

      // 3-Point Stats
      away3PAR: awayRecent.threeP_rate,
      home3PAR: homeRecent.threeP_rate,
      awayOpp3PAR: 0.39, // TODO: Fetch opponent stats in future enhancement
      homeOpp3PAR: 0.39,
      away3Pct: awayRecent.threeP_pct,
      home3Pct: homeRecent.threeP_pct,
      away3PctLast10: awayRecent.threeP_pct,
      home3PctLast10: homeRecent.threeP_pct,
      league3PAR: 0.39, // NBA league average (static)
      league3Pct: 0.35, // NBA league average (static)
      league3Pstdev: 0.036, // NBA league standard deviation (static)

      // Free Throw Rate
      awayFTr: awayRecent.ft_rate,
      homeFTr: homeRecent.ft_rate,
      awayOppFTr: 0.22, // TODO: Fetch opponent stats in future enhancement
      homeOppFTr: 0.22,
      leagueFTr: 0.22, // NBA league average (static)

      // Points Per Game (calculated from ORtg and Pace)
      awayPointsPerGame: (awayRecent.ortg * awayRecent.pace) / 100,
      homePointsPerGame: (homeRecent.ortg * homeRecent.pace) / 100
    }

    console.log('[DATA_FETCHER] Stats bundle created successfully')
    console.log(`[DATA_FETCHER] Predicted pace: ${((bundle.awayPaceLast10 + bundle.homePaceLast10) / 2).toFixed(1)}`)
    console.log(`[DATA_FETCHER] Away PPG: ${bundle.awayPointsPerGame.toFixed(1)}, Home PPG: ${bundle.homePointsPerGame.toFixed(1)}`)

    return bundle

  } catch (error) {
    console.error('[DATA_FETCHER] CRITICAL ERROR - Failed to fetch NBA stats bundle')
    console.error('[DATA_FETCHER] Error details:', error)

    // DO NOT return default values - throw the error so it's visible
    throw new Error(
      `Failed to fetch NBA statistics: ${error instanceof Error ? error.message : String(error)}. ` +
      `Cannot generate pick without real data.`
    )
  }
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