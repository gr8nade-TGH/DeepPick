/**
 * NBA Totals Data Fetcher
 * 
 * Handles all external data fetching for NBA totals factors
 * Now uses The Odds API scores to calculate recent form (last 5 games)
 */

import { fetchTeamRecentForm, convertRecentFormToStats } from '@/lib/data-sources/odds-api-scores'
import { fetchNBATeamStats } from '@/lib/data-sources/nba-stats-api'
import { searchInjuries } from '../news'
import { RunCtx, NBAStatsBundle, InjuryImpact } from './types'

/**
 * Fetch all required data for NBA totals factor computation
 * Uses The Odds API scores endpoint to calculate stats from last 5 games
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
    // Fetch both NBA Stats API (season data) and Odds API (recent form)
    const [awayForm, homeForm, awaySeason, homeSeason] = await Promise.allSettled([
      fetchTeamRecentForm(ctx.away, 5),  // Odds API - recent form
      fetchTeamRecentForm(ctx.home, 5),  // Odds API - recent form
      fetchNBATeamStats(ctx.away),       // NBA Stats API - season data
      fetchNBATeamStats(ctx.home)        // NBA Stats API - season data
    ])
    
    // Extract data with fallbacks
    const awayFormData = awayForm.status === 'fulfilled' ? awayForm.value : null
    const homeFormData = homeForm.status === 'fulfilled' ? homeForm.value : null
    const awaySeasonData = awaySeason.status === 'fulfilled' ? awaySeason.value : null
    const homeSeasonData = homeSeason.status === 'fulfilled' ? homeSeason.value : null
    
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
    
    // Extract NBA Stats API data
    const awaySeasonStats = awaySeasonData?.ok && awaySeasonData.data ? awaySeasonData.data : null
    const homeSeasonStats = homeSeasonData?.ok && homeSeasonData.data ? homeSeasonData.data : null
    
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
    // Priority: NBA Stats API for season data, Odds API for recent form, fallback to league averages
    const bundle: NBAStatsBundle = {
      // Pace data (NBA Stats API season data, with recent form fallback)
      awayPaceSeason: awaySeasonStats?.pace || awayStats?.pace || ctx.leagueAverages.pace,
      awayPaceLast10: awayStats?.pace || awaySeasonStats?.pace || ctx.leagueAverages.pace,
      homePaceSeason: homeSeasonStats?.pace || homeStats?.pace || ctx.leagueAverages.pace,
      homePaceLast10: homeStats?.pace || homeSeasonStats?.pace || ctx.leagueAverages.pace,
      
      // Team scoring averages (last 5 games) - NEW BASELINE DATA
      awayPointsPerGame: awayFormData?.data?.pointsPerGame || 111.5, // Fallback to league avg/2
      homePointsPerGame: homeFormData?.data?.pointsPerGame || 111.5, // Fallback to league avg/2
      
      // Offensive ratings (NBA Stats API season data, with recent form fallback)
      awayORtgLast10: awayStats?.offensiveRating || awaySeasonStats?.offensiveRating || ctx.leagueAverages.ORtg,
      homeORtgLast10: homeStats?.offensiveRating || homeSeasonStats?.offensiveRating || ctx.leagueAverages.ORtg,
      
      // Defensive ratings (NBA Stats API season data, with recent form fallback)
      awayDRtgSeason: awaySeasonStats?.defensiveRating || awayStats?.defensiveRating || ctx.leagueAverages.DRtg,
      homeDRtgSeason: homeSeasonStats?.defensiveRating || homeStats?.defensiveRating || ctx.leagueAverages.DRtg,
      
      // 3-Point environment (NBA Stats API season data, with fallback)
      away3PAR: awaySeasonStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      home3PAR: homeSeasonStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      awayOpp3PAR: homeSeasonStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      homeOpp3PAR: awaySeasonStats?.threePointAttemptRate || ctx.leagueAverages.threePAR,
      away3Pct: awaySeasonStats?.threePointPercentage || 0.35,
      home3Pct: homeSeasonStats?.threePointPercentage || 0.35,
      away3PctLast10: awayStats?.threePointPercentage || awaySeasonStats?.threePointPercentage || 0.35,
      home3PctLast10: homeStats?.threePointPercentage || homeSeasonStats?.threePointPercentage || 0.35,
      
      // Free throw environment (NBA Stats API season data, with fallback)
      awayFTr: awaySeasonStats?.freeThrowRate || ctx.leagueAverages.FTr,
      homeFTr: homeSeasonStats?.freeThrowRate || ctx.leagueAverages.FTr,
      awayOppFTr: homeSeasonStats?.freeThrowRate || ctx.leagueAverages.FTr,
      homeOppFTr: awaySeasonStats?.freeThrowRate || ctx.leagueAverages.FTr,
      
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
