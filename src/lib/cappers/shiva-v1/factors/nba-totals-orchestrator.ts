/**
 * NBA Totals Factor Orchestrator
 * 
 * Main entry point that coordinates all 5 NBA totals factors
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx, NBAStatsBundle, InjuryImpact, FactorComputationResult } from './types'
import { fetchNBAStatsBundle, summarizeAvailabilityWithLLM } from './data-fetcher'
import { computePaceIndex } from './f1-pace-index'
import { computeOffensiveForm } from './f2-offensive-form'
import { computeDefensiveErosion } from './f3-defensive-erosion'
import { computeThreePointEnv } from './f4-three-point-env'
import { computeWhistleEnv } from './f5-free-throw-env'
import { computeInjuryAvailabilityAsync } from './f6-injury-availability'

/**
 * Main entry point: compute only enabled NBA totals factors
 */
export async function computeTotalsFactors(ctx: RunCtx): Promise<FactorComputationResult> {
  console.log('[TOTALS:COMPUTE_START]', { away: ctx.away, home: ctx.home, sport: ctx.sport, betType: ctx.betType })
  
  const branchLog = { sport: ctx.sport, betType: ctx.betType }
  console.debug('[totals:branch-used]', branchLog)
  
  // Get enabled factors from profile
  const enabledFactorKeys = Object.keys(ctx.factorWeights || {})
  console.log('[TOTALS:ENABLED_FACTORS]', { enabledFactorKeys, totalEnabled: enabledFactorKeys.length })
  console.log('[TOTALS:INJURY_FACTOR_CHECK]', { 
    hasInjuryFactor: enabledFactorKeys.includes('injuryAvailability'),
    allKeys: enabledFactorKeys,
    factorWeights: ctx.factorWeights
  })
  const nbaStatsConditionCheck = {
    enabledFactorKeys,
    shouldFetchNBAStats: enabledFactorKeys.some(key => ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'].includes(key)),
    paceIndex: enabledFactorKeys.includes('paceIndex'),
    offForm: enabledFactorKeys.includes('offForm'),
    defErosion: enabledFactorKeys.includes('defErosion'),
    threeEnv: enabledFactorKeys.includes('threeEnv'),
    whistleEnv: enabledFactorKeys.includes('whistleEnv')
  }
  console.log('[TOTALS:NBA_STATS_CONDITION_CHECK]', nbaStatsConditionCheck)
  
  // Only fetch data if we have enabled factors
  if (enabledFactorKeys.length === 0) {
    console.warn('[TOTALS:NO_ENABLED_FACTORS]', 'No factors enabled, returning empty result')
    return {
      factors: [],
      factor_version: 'nba_totals_v1',
      totals_debug: {
        league_anchors: {
          pace: 100.1,
          ORtg: 110.0,
          DRtg: 110.0,
          threePAR: 0.39,
          FTr: 0.22,
          threePstdev: 0.036
        },
        injury_impact: { defenseImpactA: 0, defenseImpactB: 0, summary: 'No factors enabled', rawResponse: '' },
        factor_keys: [],
        console_logs: { 
          branch_used: branchLog, 
          bundle: {
            awayPaceSeason: 100.1,
            awayPaceLast10: 100.1,
            homePaceSeason: 100.1,
            homePaceLast10: 100.1,
            awayORtgLast10: 110.0,
            homeORtgLast10: 110.0,
            awayDRtgSeason: 110.0,
            homeDRtgSeason: 110.0,
            away3PAR: 0.39,
            home3PAR: 0.39,
            awayOpp3PAR: 0.39,
            homeOpp3PAR: 0.39,
            away3Pct: 0.35,
            home3Pct: 0.35,
            away3PctLast10: 0.35,
            home3PctLast10: 0.35,
            awayFTr: 0.22,
            homeFTr: 0.22,
            awayOppFTr: 0.22,
            homeOppFTr: 0.22,
            leaguePace: 100.1,
            leagueORtg: 110.0,
            leagueDRtg: 110.0,
            league3PAR: 0.39,
            league3Pct: 0.35,
            leagueFTr: 0.22,
            league3Pstdev: 0.036,
            awayPointsPerGame: 110.0,
            homePointsPerGame: 110.0
          },
          rows_z_points: []
        },
        nba_stats_api_debug: {
          condition_check: nbaStatsConditionCheck,
          enabled_factors: enabledFactorKeys,
          nba_stats_fetched: false,
          team_names: { away: ctx.away, home: ctx.home },
          bundle_keys: [],
          bundle_sample: {
            awayPaceSeason: 0,
            homePaceSeason: 0,
            awayORtgLast10: 0,
            homeORtgLast10: 0,
            leaguePace: 0,
            leagueORtg: 0
          },
          api_calls_made: false
        }
      }
    }
  }
  
  // Fetch NBA Stats API data bundle (only if needed)
  let bundle: NBAStatsBundle | null = null
  let nbaStatsDebugInfo = {
    condition_check: nbaStatsConditionCheck,
    enabled_factors: enabledFactorKeys,
    nba_stats_fetched: false,
    team_names: { away: ctx.away, home: ctx.home },
    bundle_keys: [] as string[],
    bundle_sample: {} as any,
    api_calls_made: false
  }
  
  console.log('[TOTALS:CONDITION_CHECK]', {
    enabledFactorKeys,
    conditionCheck: enabledFactorKeys.some(key => ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'].includes(key)),
    paceIndex: enabledFactorKeys.includes('paceIndex'),
    offForm: enabledFactorKeys.includes('offForm'),
    defErosion: enabledFactorKeys.includes('defErosion'),
    threeEnv: enabledFactorKeys.includes('threeEnv'),
    whistleEnv: enabledFactorKeys.includes('whistleEnv')
  })
  
  if (enabledFactorKeys.some(key => ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'].includes(key))) {
    console.log('[TOTALS:ABOUT_TO_FETCH_NBA_STATS]', 'Starting NBA Stats API fetch...')
    console.log('[TOTALS:ENABLED_FACTORS_FOR_DATA]', { 
      paceIndex: enabledFactorKeys.includes('paceIndex'),
      offForm: enabledFactorKeys.includes('offForm'), 
      defErosion: enabledFactorKeys.includes('defErosion'),
      threeEnv: enabledFactorKeys.includes('threeEnv'),
      whistleEnv: enabledFactorKeys.includes('whistleEnv')
    })
    console.log('[TOTALS:TEAM_NAMES]', { away: ctx.away, home: ctx.home })
    bundle = await fetchNBAStatsBundle(ctx)
    console.log('[TOTALS:NBA_STATS_FETCHED]', 'NBA Stats bundle received:', Object.keys(bundle))
    console.debug('[totals:bundle]', bundle)
    
    // Update debug info
    nbaStatsDebugInfo.nba_stats_fetched = true
    nbaStatsDebugInfo.bundle_keys = Object.keys(bundle)
    nbaStatsDebugInfo.bundle_sample = {
      awayPaceSeason: bundle.awayPaceSeason,
      homePaceSeason: bundle.homePaceSeason,
      awayORtgLast10: bundle.awayORtgLast10,
      homeORtgLast10: bundle.homeORtgLast10,
      leaguePace: bundle.leaguePace,
      leagueORtg: bundle.leagueORtg
    }
    nbaStatsDebugInfo.api_calls_made = true
  }
  
  // Fetch injury impact via LLM (only if Defensive Erosion is enabled)
  let injuryImpact: InjuryImpact = { defenseImpactA: 0, defenseImpactB: 0, summary: 'Not needed', rawResponse: '' }
  if (enabledFactorKeys.includes('defErosion')) {
    console.log('[TOTALS:FETCHING_INJURY_DATA]', 'Defensive Erosion enabled, fetching injury data...')
    injuryImpact = await summarizeAvailabilityWithLLM(ctx)
  } else {
    console.log('[TOTALS:SKIPPING_INJURY_DATA]', 'Defensive Erosion disabled, skipping injury data fetch')
  }
  
  // Compute only enabled factors
  const factors: any[] = []
  
  if (enabledFactorKeys.includes('paceIndex')) {
    factors.push(computePaceIndex(bundle!, ctx))
  }
  if (enabledFactorKeys.includes('offForm')) {
    factors.push(computeOffensiveForm(bundle!, ctx))
  }
  if (enabledFactorKeys.includes('defErosion')) {
    factors.push(computeDefensiveErosion(bundle!, ctx))
  }
  if (enabledFactorKeys.includes('threeEnv')) {
    factors.push(computeThreePointEnv(bundle!, ctx))
  }
  if (enabledFactorKeys.includes('whistleEnv')) {
    factors.push(computeWhistleEnv(bundle!, ctx))
  }
  
  // Handle AI-powered injury factor (async)
  if (enabledFactorKeys.includes('injuryAvailability')) {
    console.log('[TOTALS:COMPUTING_INJURY_AI]', 'Key Injuries & Availability enabled, running AI analysis...')
    try {
      const injuryFactor = await computeInjuryAvailabilityAsync(ctx)
      factors.push(injuryFactor)
      console.log('[TOTALS:INJURY_AI_SUCCESS]', { 
        signal: injuryFactor.normalized_value,
        keyInjuries: injuryFactor.parsed_values_json.keyInjuries?.length || 0
      })
    } catch (error) {
      console.error('[TOTALS:INJURY_AI_ERROR]', error)
      // Add error factor
      factors.push({
        key: 'injuryAvailability',
        name: 'Key Injuries & Availability - Totals',
        normalized_value: 0,
        parsed_values_json: {
          overScore: 0,
          underScore: 0,
          awayContribution: 0,
          homeContribution: 0,
          reasoning: 'AI analysis failed'
        },
        caps_applied: false,
        cap_reason: 'AI analysis error',
        notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }
  
  // Apply factor weights for display purposes (confidence calculation happens separately)
  const factorWeights = ctx.factorWeights || {}
  const weightedFactors = factors.map(factor => {
    const weight = factorWeights[factor.key] || 20 // Default 20% if not specified
    
    return {
      ...factor,
      weight_total_pct: weight,
      // Note: We don't modify the parsed_values_json here as confidence calculation
      // uses the raw signals and applies weights separately
    }
  })
  
  // Log factor results
  const rowsZPoints = weightedFactors.map(f => ({
    key: f.key,
    z: f.normalized_value,
    pts: f.parsed_values_json.points
  }))
  console.debug('[totals:rows:z-points]', rowsZPoints)
  
  return {
    factors: weightedFactors,
    factor_version: 'nba_totals_v1',
    totals_debug: {
      league_anchors: bundle ? {
        pace: bundle.leaguePace,
        ORtg: bundle.leagueORtg,
        DRtg: bundle.leagueDRtg,
        threePAR: bundle.league3PAR,
        FTr: bundle.leagueFTr,
        threePstdev: bundle.league3Pstdev
      } : {
        pace: 100.1,
        ORtg: 110.0,
        DRtg: 110.0,
        threePAR: 0.39,
        FTr: 0.22,
        threePstdev: 0.036
      },
      injury_impact: injuryImpact,
      factor_keys: weightedFactors.map(f => f.key),
      console_logs: {
        branch_used: branchLog,
        bundle: bundle || {
          awayPaceSeason: 100.1,
          awayPaceLast10: 100.1,
          homePaceSeason: 100.1,
          homePaceLast10: 100.1,
          awayORtgLast10: 110.0,
          homeORtgLast10: 110.0,
          awayDRtgSeason: 110.0,
          homeDRtgSeason: 110.0,
          away3PAR: 0.39,
          home3PAR: 0.39,
          awayOpp3PAR: 0.39,
          homeOpp3PAR: 0.39,
          away3Pct: 0.35,
          home3Pct: 0.35,
          away3PctLast10: 0.35,
          home3PctLast10: 0.35,
          awayFTr: 0.22,
          homeFTr: 0.22,
          awayOppFTr: 0.22,
          homeOppFTr: 0.22,
          leaguePace: 100.1,
          leagueORtg: 110.0,
          leagueDRtg: 110.0,
          league3PAR: 0.39,
          league3Pct: 0.35,
          leagueFTr: 0.22,
          league3Pstdev: 0.036,
          awayPointsPerGame: 110.0,
          homePointsPerGame: 110.0
        },
        rows_z_points: rowsZPoints
      },
      nba_stats_api_debug: nbaStatsDebugInfo
    }
  }
}
