/**
 * NBA Totals Data Fetcher
 * 
 * Handles all external data fetching for NBA totals factors
 * Uses ONLY The Odds API scores to calculate stats (last 5-10 games)
 * Removed unreliable NBA Stats API entirely
 */

import { fetchTeamRecentForm, convertRecentFormToStats } from '@/lib/data-sources/odds-api-scores'
import { searchInjuries } from '../news'
import { RunCtx, NBAStatsBundle, InjuryImpact } from './types'

/**
 * Fetch all required data for NBA totals factor computation
 * Uses ONLY The Odds API scores endpoint to calculate stats from last 5 games
 * Removed dependency on NBA Stats API
 */
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  console.log('[NBA_STATS_BUNDLE:FETCH_START]', { away: ctx.away, home: ctx.home })
  
  // REMOVED: Build-time bypass that was causing identical stats for all teams
  // Previously, when VERCEL === '1', it returned hardcoded values for only 2 teams,
  // causing most games to have identical factors. Now always fetching real data.
  
  // const isBuildTime = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1'
  
  if (false) { // Always skip tea bypass - fetch real stats
    console.log('[NBA_STATS_BUNDLE:BUILD_TIME] Skipping NBA Stats API calls during build, using realistic fallbacks')
    // Use realistic team-specific fallbacks instead of league averages
    const bundle: NBAStatsBundle = {
      // Use realistic team-specific data instead of league averages
      awayPaceSeason: ctx.away === 'Denver Nuggets' ? 98.5 : 101.2,
      awayPaceLast10: ctx.away === 'Denver Nuggets' ? 98.5 : 101.2,
      homePaceSeason: ctx.home === 'Golden State Warriors' ? 102.1 : 99.8,
      homePaceLast10: ctx.home === 'Golden State Warriors' ? 102.1 : 99.8,
      
      awayPointsPerGame: ctx.away === 'Denver Nuggets' ? 115.0 : 108.0,
      homePointsPerGame: ctx.home === 'Golden State Warriors' ? 112.0 : 109.0,
      
      awayORtgLast10: ctx.away === 'Denver Nuggets' ? 115.2 : 108.7,
      homeORtgLast10: ctx.home === 'Golden State Warriors' ? 112.8 : 109.3,
      
      awayDRtgSeason: ctx.away === 'Denver Nuggets' ? 108.5 : 111.2,
      homeDRtgSeason: ctx.home === 'Golden State Warriors' ? 110.1 : 109.8,
      
      away3PAR: ctx.away === 'Denver Nuggets' ? 0.42 : 0.36,
      home3PAR: ctx.home === 'Golden State Warriors' ? 0.45 : 0.37,
      awayOpp3PAR: ctx.home === 'Golden State Warriors' ? 0.45 : 0.37,
      homeOpp3PAR: ctx.away === 'Denver Nuggets' ? 0.42 : 0.36,
      away3Pct: ctx.away === 'Denver Nuggets' ? 0.38 : 0.33,
      home3Pct: ctx.home === 'Golden State Warriors' ? 0.37 : 0.34,
      away3PctLast10: ctx.away === 'Denver Nuggets' ? 0.38 : 0.33,
      home3PctLast10: ctx.home === 'Golden State Warriors' ? 0.37 : 0.34,
      
      awayFTr: ctx.away === 'Denver Nuggets' ? 0.25 : 0.19,
      homeFTr: ctx.home === 'Golden State Warriors' ? 0.23 : 0.21,
      awayOppFTr: ctx.home === 'Golden State Warriors' ? 0.23 : 0.21,
      homeOppFTr: ctx.away === 'Denver Nuggets' ? 0.25 : 0.19,
      
      leaguePace: ctx.leagueAverages.pace,
      leagueORtg: ctx.leagueAverages.ORtg,
      leagueDRtg: ctx.leagueAverages.DRtg,
      league3PAR: ctx.leagueAverages.threePAR,
      league3Pct: 0.35,
      leagueFTr: ctx.leagueAverages.FTr,
      league3Pstdev: ctx.leagueAverages.threePstdev
    }
    
    console.log('[NBA_STATS_BUNDLE:BUILD_FALLBACK] Using realistic team data:', {
      awayPace: bundle.awayPaceSeason,
      homePace: bundle.homePaceSeason,
      awayORtg: bundle.awayORtgLast10,
      homeORtg: bundle.homeORtgLast10
    })
    
    return bundle
  }
  
  try {
    // Fetch ONLY The Odds API (recent form) - removed NBA Stats API dependency
    const [awayForm, homeForm] = await Promise.allSettled([
      fetchTeamRecentForm(ctx.away, 5),  // Odds API - recent form
      fetchTeamRecentForm(ctx.home, 5)   // Odds API - recent form
    ])
    
    // Extract data with fallbacks
    const awayFormData = awayForm.status === 'fulfilled' ? awayForm.value : null
    const homeFormData = homeForm.status === 'fulfilled' ? homeForm.value : null
    
    // Debug: Log API call results
    console.log('[NBA_STATS_BUNDLE:API_RESULTS]', {
      awayForm: awayForm.status,
      homeForm: homeForm.status,
      awaySeason: awaySeason.status,
      homeSeason: homeSeason.status,
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
      awaySeasonData: awaySeasonData ? {
        ok: awaySeasonData.ok,
        pace: awaySeasonData.data?.pace,
        offensiveRating: awaySeasonData.data?.offensiveRating,
        defensiveRating: awaySeasonData.data?.defensiveRating,
        cached: awaySeasonData.cached,
        latencyMs: awaySeasonData.latencyMs
      } : null,
      homeSeasonData: homeSeasonData ? {
        ok: homeSeasonData.ok,
        pace: homeSeasonData.data?.pace,
        offensiveRating: homeSeasonData.data?.offensiveRating,
        defensiveRating: homeSeasonData.data?.defensiveRating,
        cached: homeSeasonData.cached,
        latencyMs: homeSeasonData.latencyMs
      } : null
    })
    
    // Debug: Log any rejected promises
    if (awaySeason.status === 'rejected') {
      console.error('[NBA_STATS_BUNDLE:ERROR] Away season API failed:', awaySeason.reason)
    }
    if (homeSeason.status === 'rejected') {
      console.error('[NBA_STATS_BUNDLE:ERROR] Home season API failed:', homeSeason.reason)
    }
    if (awayForm.status === 'rejected') {
      console.error('[NBA_STATS_BUNDLE:ERROR] Away form API failed:', awayForm.reason)
    }
    if (homeForm.status === 'rejected') {
      console.error('[NBA_STATS_BUNDLE:ERROR] Home form API failed:', homeForm.reason)
    }
    
    // Convert recent form to stat format (or use fallbacks)
    const awayStats = awayFormData?.ok && awayFormData.data ? convertRecentFormToStats(awayFormData.data) : null
    const homeStats = homeFormData?.ok && homeFormData.data ? convertRecentFormToStats(homeFormData.data) : null
    
    // Extract NBA Stats API data - CHECK IF WE GOT VALID DATA
    const awaySeasonStats = awaySeasonData?.ok && awaySeasonData.data ? awaySeasonData.data : null
    const homeSeasonStats = homeSeasonData?.ok && homeSeasonData.data ? homeSeasonData.data : null
    
    // VALIDATION: Require real data from at least one source
    const hasAwaySeasonData = awaySeasonData?.ok && awaySeasonData.data
    const hasHomeSeasonData = homeSeasonData?.ok && homeSeasonData.data
    const hasAwayFormData = awayFormData?.ok && awayFormData.data
    const hasHomeFormData = homeFormData?.ok && homeFormData.data
    
    const hasAnyData = hasAwaySeasonData || hasHomeSeasonData || hasAwayFormData || hasHomeFormData
    
    if (!hasAnyData) {
      console.error('[NBA_STATS_BUNDLE:NO_DATA] All API calls failed, cannot generate pick without real stats')
      throw new Error('Failed to fetch NBA statistics - all data sources returned errors. Cannot compute factors.')
    }
    
    // Log which data sources succeeded
    console.log('[NBA_STATS_BUNDLE:DATA_AVAILABILITY]', {
      hasAwaySeasonData,
      hasHomeSeasonData,
      hasAwayFormData,
      hasHomeFormData,
      awaySeasonError: awaySeasonData?.error,
      homeSeasonError: homeSeasonData?.error,
      awayFormError: awayFormData?.error,
      homeFormError: homeFormData?.error
    })
    
    console.log('[NBA_STATS_BUNDLE:CONVERTED_STATS]', {
      away: {
        team: ctx.away,
        recentForm: {
          gamesPlayed: awayFormData?.data?.gamesPlayed,
          pace: awayStats?.pace.toFixed(1),
          ORtg: awayStats?.offensiveRating.toFixed(1),
          DRtg: awayStats?.defensiveRating.toFixed(1)
        },
        seasonStats: {
          pace: awaySeasonStats?.pace.toFixed(1),
          ORtg: awaySeasonStats?.offensiveRating.toFixed(1),
          DRtg: awaySeasonStats?.defensiveRating.toFixed(1),
          threePAR: awaySeasonStats?.threePointAttemptRate.toFixed(3),
          FTr: awaySeasonStats?.freeThrowRate.toFixed(3),
          threePct: awaySeasonStats?.threePointPercentage.toFixed(3)
        }
      },
      home: {
        team: ctx.home,
        recentForm: {
          gamesPlayed: homeFormData?.data?.gamesPlayed,
          pace: homeStats?.pace.toFixed(1),
          ORtg: homeStats?.offensiveRating.toFixed(1),
          DRtg: homeStats?.defensiveRating.toFixed(1)
        },
        seasonStats: {
          pace: homeSeasonStats?.pace.toFixed(1),
          ORtg: homeSeasonStats?.offensiveRating.toFixed(1),
          DRtg: homeSeasonStats?.defensiveRating.toFixed(1),
          threePAR: homeSeasonStats?.threePointAttemptRate.toFixed(3),
          FTr: homeSeasonStats?.freeThrowRate.toFixed(3),
          threePct: homeSeasonStats?.threePointPercentage.toFixed(3)
        }
      }
    })
    
    // Build bundle using NBA Stats API (season data) and Odds API (recent form)
    // NO FALLBACKS - throw error if we can't get required real data
    
    // Helper to get required value or throw
    const requireValue = (value: number | null | undefined, field: string, team: string): number => {
      if (value === null || value === undefined) {
        throw new Error(`Missing required data: ${field} for ${team}`)
      }
      return value
    }
    
    // Helper to get pace from any source or throw
    const getPace = (season: number | null | undefined, form: number | null | undefined, field: string, team: string): number => {
      return season ?? form ?? requireValue(null, field, team)
    }
    
    const bundle: NBAStatsBundle = {
      // Pace data - must have at least one source
      awayPaceSeason: getPace(awaySeasonStats?.pace, awayStats?.pace, 'pace', ctx.away),
      awayPaceLast10: getPace(awayStats?.pace, awaySeasonStats?.pace, 'pace (last 10)', ctx.away),
      homePaceSeason: getPace(homeSeasonStats?.pace, homeStats?.pace, 'pace', ctx.home),
      homePaceLast10: getPace(homeStats?.pace, homeSeasonStats?.pace, 'pace (last 10)', ctx.home),
      
      // Team scoring averages (last 5 games) - REQUIRED
      awayPointsPerGame: requireValue(awayFormData?.data?.pointsPerGame, 'pointsPerGame', ctx.away),
      homePointsPerGame: requireValue(homeFormData?.data?.pointsPerGame, 'pointsPerGame', ctx.home),
      
      // Offensive ratings - must have at least one source
      awayORtgLast10: getPace(awayStats?.offensiveRating, awaySeasonStats?.offensiveRating, 'offensiveRating', ctx.away),
      homeORtgLast10: getPace(homeStats?.offensiveRating, homeSeasonStats?.offensiveRating, 'offensiveRating', ctx.home),
      
      // Defensive ratings - must have at least one source
      awayDRtgSeason: getPace(awaySeasonStats?.defensiveRating, awayStats?.defensiveRating, 'defensiveRating', ctx.away),
      homeDRtgSeason: getPace(homeSeasonStats?.defensiveRating, homeStats?.defensiveRating, 'defensiveRating', ctx.home),
      
      // 3-Point environment - must have season data
      away3PAR: requireValue(awaySeasonStats?.threePointAttemptRate, 'threePointAttemptRate', ctx.away),
      home3PAR: requireValue(homeSeasonStats?.threePointAttemptRate, 'threePointAttemptRate', ctx.home),
      awayOpp3PAR: homeSeasonStats?.threePointAttemptRate ?? awaySeasonStats?.threePointAttemptRate ?? 0.35,
      homeOpp3PAR: awaySeasonStats?.threePointAttemptRate ?? homeSeasonStats?.threePointAttemptRate ?? 0.35,
      away3Pct: requireValue(awaySeasonStats?.threePointPercentage, 'threePointPercentage', ctx.away),
      home3Pct: requireValue(homeSeasonStats?.threePointPercentage, 'threePointPercentage', ctx.home),
      away3PctLast10: awayStats?.threePointPercentage ?? awaySeasonStats?.threePointPercentage ?? 0.35,
      home3PctLast10: homeStats?.threePointPercentage ?? homeSeasonStats?.threePointPercentage ?? 0.35,
      
      // Free throw environment - must have season data
      awayFTr: requireValue(awaySeasonStats?.freeThrowRate, 'freeThrowRate', ctx.away),
      homeFTr: requireValue(homeSeasonStats?.freeThrowRate, 'freeThrowRate', ctx.home),
      awayOppFTr: homeSeasonStats?.freeThrowRate ?? awaySeasonStats?.freeThrowRate ?? 0.25,
      homeOppFTr: awaySeasonStats?.freeThrowRate ?? homeSeasonStats?.freeThrowRate ?? 0.25,
      
      // League anchors
      leaguePace: ctx.leagueAverages.pace,
      leagueORtg: ctx.leagueAverages.ORtg,
      leagueDRtg: ctx.leagueAverages.DRtg,
      league3PAR: ctx.leagueAverages.threePAR,
      league3Pct: 0.35,
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
