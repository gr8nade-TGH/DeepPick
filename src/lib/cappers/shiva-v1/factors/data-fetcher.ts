/**
 * NBA Totals Data Fetcher
 * 
 * Handles all external data fetching for NBA totals factors
 */

import { fetchNBATeamStats, fetchNBATeamStatsLastN } from '@/lib/data-sources/nba-stats-simple'
import { searchInjuries } from '../news'
import { RunCtx, StatMuseBundle, InjuryImpact } from './types'

/**
 * Fetch all required data for NBA totals factor computation
 */
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<StatMuseBundle> {
  console.log('[NBA_STATS:FETCH_START]', { away: ctx.away, home: ctx.home })
  
  try {
    // Fetch team stats in parallel
    const [awaySeason, awayLast10, homeSeason, homeLast10] = await Promise.allSettled([
      fetchNBATeamStats(ctx.away),
      fetchNBATeamStatsLastN(ctx.away, 10),
      fetchNBATeamStats(ctx.home),
      fetchNBATeamStatsLastN(ctx.home, 10)
    ])
    
    // Extract data with fallbacks
    const awaySeasonData = awaySeason.status === 'fulfilled' ? awaySeason.value : null
    const awayLast10Data = awayLast10.status === 'fulfilled' ? awayLast10.value : null
    const homeSeasonData = homeSeason.status === 'fulfilled' ? homeSeason.value : null
    const homeLast10Data = homeLast10.status === 'fulfilled' ? homeLast10.value : null
    
    // Build bundle with fallbacks to league averages
    const bundle: StatMuseBundle = {
      // Pace data
      awayPaceSeason: awaySeasonData?.data?.pace || ctx.leagueAverages.pace,
      awayPaceLast10: awayLast10Data?.data?.pace || ctx.leagueAverages.pace,
      homePaceSeason: homeSeasonData?.data?.pace || ctx.leagueAverages.pace,
      homePaceLast10: homeLast10Data?.data?.pace || ctx.leagueAverages.pace,
      
      // Offensive ratings
      awayORtgLast10: awayLast10Data?.data?.offensiveRating || ctx.leagueAverages.ORtg,
      homeORtgLast10: homeLast10Data?.data?.offensiveRating || ctx.leagueAverages.ORtg,
      
      // Defensive ratings
      awayDRtgSeason: awaySeasonData?.data?.defensiveRating || ctx.leagueAverages.DRtg,
      homeDRtgSeason: homeSeasonData?.data?.defensiveRating || ctx.leagueAverages.DRtg,
      
      // 3-Point environment
      away3PAR: awaySeasonData?.data?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      home3PAR: homeSeasonData?.data?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      awayOpp3PAR: awaySeasonData?.data?.threePointAttemptRate || ctx.leagueAverages.threePAR, // Using same as team rate for now
      homeOpp3PAR: homeSeasonData?.data?.threePointAttemptRate || ctx.leagueAverages.threePAR, // Using same as team rate for now
      away3PctLast10: awayLast10Data?.data?.threePointPercentage || 0.35,
      home3PctLast10: homeLast10Data?.data?.threePointPercentage || 0.35,
      
      // Free throw environment
      awayFTr: awaySeasonData?.data?.freeThrowRate || ctx.leagueAverages.FTr,
      homeFTr: homeSeasonData?.data?.freeThrowRate || ctx.leagueAverages.FTr,
      awayOppFTr: awaySeasonData?.data?.freeThrowRate || ctx.leagueAverages.FTr, // Using same as team rate for now
      homeOppFTr: homeSeasonData?.data?.freeThrowRate || ctx.leagueAverages.FTr, // Using same as team rate for now
      
      // League anchors
      leaguePace: ctx.leagueAverages.pace,
      leagueORtg: ctx.leagueAverages.ORtg,
      leagueDRtg: ctx.leagueAverages.DRtg,
      league3PAR: ctx.leagueAverages.threePAR,
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
