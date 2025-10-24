/**
 * NBA Totals Data Fetcher
 * 
 * Handles all external data fetching for NBA totals factors
 * Now uses The Odds API scores to calculate recent form (last 5 games)
 */

import { fetchTeamRecentForm, convertRecentFormToStats } from '@/lib/data-sources/odds-api-scores'
import { searchInjuries } from '../news'
import { RunCtx, StatMuseBundle, InjuryImpact } from './types'

/**
 * Fetch all required data for NBA totals factor computation
 * Uses The Odds API scores endpoint to calculate stats from last 5 games
 */
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<StatMuseBundle> {
  console.log('[ODDS_API:SCORES:FETCH_START]', { away: ctx.away, home: ctx.home })
  
  try {
    // Fetch recent form from The Odds API (last 5 games)
    const [awayForm, homeForm] = await Promise.allSettled([
      fetchTeamRecentForm(ctx.away, 5),
      fetchTeamRecentForm(ctx.home, 5)
    ])
    
    // Extract data with fallbacks
    const awayFormData = awayForm.status === 'fulfilled' ? awayForm.value : null
    const homeFormData = homeForm.status === 'fulfilled' ? homeForm.value : null
    
    // Debug: Log API call results
    console.log('[ODDS_API:SCORES:API_RESULTS]', {
      awayForm: awayForm.status,
      homeForm: homeForm.status,
      awayFormData: awayFormData ? { 
        ok: awayFormData.ok, 
        gamesPlayed: awayFormData.data?.gamesPlayed,
        cached: awayFormData.cached, 
        latencyMs: awayFormData.latencyMs 
      } : null,
      homeFormData: homeFormData ? { 
        ok: homeFormData.ok, 
        gamesPlayed: homeFormData.data?.gamesPlayed,
        cached: homeFormData.cached, 
        latencyMs: homeFormData.latencyMs 
      } : null,
    })
    
    // Log any API errors
    if (awayForm.status === 'rejected') console.error('[ODDS_API:SCORES:ERROR] Away Form:', awayForm.reason)
    if (homeForm.status === 'rejected') console.error('[ODDS_API:SCORES:ERROR] Home Form:', homeForm.reason)
    
    // Convert recent form to stat format (or use fallbacks)
    const awayStats = awayFormData?.ok && awayFormData.data ? convertRecentFormToStats(awayFormData.data) : null
    const homeStats = homeFormData?.ok && homeFormData.data ? convertRecentFormToStats(homeFormData.data) : null
    
    console.log('[ODDS_API:SCORES:CONVERTED_STATS]', {
      away: {
        team: ctx.away,
        gamesPlayed: awayFormData?.data?.gamesPlayed,
        pace: awayStats?.pace.toFixed(1),
        ORtg: awayStats?.offensiveRating.toFixed(1),
        DRtg: awayStats?.defensiveRating.toFixed(1)
      },
      home: {
        team: ctx.home,
        gamesPlayed: homeFormData?.data?.gamesPlayed,
        pace: homeStats?.pace.toFixed(1),
        ORtg: homeStats?.offensiveRating.toFixed(1),
        DRtg: homeStats?.defensiveRating.toFixed(1)
      }
    })
    
    // Build bundle using recent form data (last 5 games)
    // All stats now come from actual game results, not season averages
    const bundle: StatMuseBundle = {
      // Pace data (from last 5 games)
      awayPaceSeason: awayStats?.pace || ctx.leagueAverages.pace,
      awayPaceLast10: awayStats?.pace || ctx.leagueAverages.pace,
      homePaceSeason: homeStats?.pace || ctx.leagueAverages.pace,
      homePaceLast10: homeStats?.pace || ctx.leagueAverages.pace,
      
      // Offensive ratings (from last 5 games)
      awayORtgLast10: awayStats?.offensiveRating || ctx.leagueAverages.ORtg,
      homeORtgLast10: homeStats?.offensiveRating || ctx.leagueAverages.ORtg,
      
      // Defensive ratings (from last 5 games)
      awayDRtgSeason: awayStats?.defensiveRating || ctx.leagueAverages.DRtg,
      homeDRtgSeason: homeStats?.defensiveRating || ctx.leagueAverages.DRtg,
      
      // 3-Point environment (estimated from total points)
      away3PAR: awayStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      home3PAR: homeStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      awayOpp3PAR: homeStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      homeOpp3PAR: awayStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      away3Pct: awayStats?.threePointPercentage || 0.35,
      home3Pct: homeStats?.threePointPercentage || 0.35,
      away3PctLast10: awayStats?.threePointPercentage || 0.35,
      home3PctLast10: homeStats?.threePointPercentage || 0.35,
      
      // Free throw environment (estimated from total points)
      awayFTr: awayStats?.freeThrowRate || ctx.leagueAverages.FTr,
      homeFTr: homeStats?.freeThrowRate || ctx.leagueAverages.FTr,
      awayOppFTr: homeStats?.freeThrowRate || ctx.leagueAverages.FTr,
      homeOppFTr: awayStats?.freeThrowRate || ctx.leagueAverages.FTr,
      
      // League anchors
      leaguePace: ctx.leagueAverages.pace,
      leagueORtg: ctx.leagueAverages.ORtg,
      leagueDRtg: ctx.leagueAverages.DRtg,
      league3PAR: ctx.leagueAverages.threePAR,
      league3Pct: 0.35, // League average 3P percentage
      leagueFTr: ctx.leagueAverages.FTr,
      league3Pstdev: ctx.leagueAverages.threePstdev
    }
    
    console.log('[NBA_STATS:FETCH_SUCCESS]', { 
      awayPace: bundle.awayPaceSeason, 
      homePace: bundle.homePaceSeason,
      awayORtg: bundle.awayORtgLast10,
      homeORtg: bundle.homeORtgLast10
    })
    
    return bundle
    
  } catch (error) {
    console.error('[NBA_STATS:FETCH_ERROR]', error)
    throw new Error(`NBA Stats API failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
