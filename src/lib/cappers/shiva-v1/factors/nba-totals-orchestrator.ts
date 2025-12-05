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
import { computeInjuryAvailability } from './f6-injury-availability-deterministic'
import { computeRestAdvantage } from './f7-rest-advantage'
import { computeDefensiveStrength } from './f8-defensive-strength'
import { computeColdShooting } from './f9-cold-shooting'

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
    shouldFetchNBAStats: enabledFactorKeys.some(key => ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'restAdvantage', 'defStrength', 'coldShooting'].includes(key)),
    paceIndex: enabledFactorKeys.includes('paceIndex'),
    offForm: enabledFactorKeys.includes('offForm'),
    defErosion: enabledFactorKeys.includes('defErosion'),
    threeEnv: enabledFactorKeys.includes('threeEnv'),
    whistleEnv: enabledFactorKeys.includes('whistleEnv'),
    restAdvantage: enabledFactorKeys.includes('restAdvantage'),
    defStrength: enabledFactorKeys.includes('defStrength'),
    coldShooting: enabledFactorKeys.includes('coldShooting')
  }
  console.log('[TOTALS:NBA_STATS_CONDITION_CHECK]', nbaStatsConditionCheck)

  // Only fetch data if we have enabled factors
  if (enabledFactorKeys.length === 0) {
    console.warn('[TOTALS:NO_ENABLED_FACTORS]', 'No factors enabled, returning empty result')
    return {
      factors: [],
      factor_version: 'nba_totals_v1',
      baseline_avg: 228, // 2024-25 NBA average (was 220)
      totals_debug: {
        league_anchors: {
          pace: 99.5,
          ORtg: 114.5,
          DRtg: 114.5,
          threePAR: 0.42,
          FTr: 0.26,
          threePstdev: 0.036
        },
        injury_impact: { defenseImpactA: 0, defenseImpactB: 0, summary: 'No factors enabled', rawResponse: '' },
        factor_keys: [],
        console_logs: {
          branch_used: branchLog,
          bundle: {
            awayPaceSeason: 99.5,
            awayPaceLast10: 99.5,
            homePaceSeason: 99.5,
            homePaceLast10: 99.5,
            awayORtgLast10: 114.5,
            homeORtgLast10: 114.5,
            awayDRtgSeason: 114.5,
            homeDRtgSeason: 114.5,
            away3PAR: 0.42,
            home3PAR: 0.42,
            awayOpp3PAR: 0.42,
            homeOpp3PAR: 0.42,
            away3Pct: 0.365,
            home3Pct: 0.365,
            away3PctLast10: 0.365,
            home3PctLast10: 0.365,
            awayFTr: 0.26,
            homeFTr: 0.26,
            awayOppFTr: 0.26,
            homeOppFTr: 0.26,
            awayTOVLast10: 14.0,
            homeTOVLast10: 14.0,
            awayOffReb: 10.5,
            awayDefReb: 34.0,
            awayOppOffReb: 10.5,
            awayOppDefReb: 34.0,
            homeOffReb: 10.5,
            homeDefReb: 34.0,
            homeOppOffReb: 10.5,
            homeOppDefReb: 34.0,
            awayEfg: 0.53,
            awayTovPct: 0.14,
            awayOrebPct: 0.24,
            awayFtr: 0.26,
            homeEfg: 0.53,
            homeTovPct: 0.14,
            homeOrebPct: 0.24,
            homeFtr: 0.26,
            leaguePace: 99.5,
            leagueORtg: 114.5,
            leagueDRtg: 114.5,
            league3PAR: 0.42,
            league3Pct: 0.365,
            leagueFTr: 0.26,
            league3Pstdev: 0.036,
            awayPointsPerGame: 114.5,
            homePointsPerGame: 114.5
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
    conditionCheck: enabledFactorKeys.some(key => ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'defStrength', 'coldShooting'].includes(key)),
    paceIndex: enabledFactorKeys.includes('paceIndex'),
    offForm: enabledFactorKeys.includes('offForm'),
    defErosion: enabledFactorKeys.includes('defErosion'),
    threeEnv: enabledFactorKeys.includes('threeEnv'),
    whistleEnv: enabledFactorKeys.includes('whistleEnv'),
    defStrength: enabledFactorKeys.includes('defStrength'),
    coldShooting: enabledFactorKeys.includes('coldShooting')
  })

  if (enabledFactorKeys.some(key => ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'defStrength', 'coldShooting'].includes(key))) {
    console.log('[TOTALS:ABOUT_TO_FETCH_NBA_STATS]', 'Starting NBA Stats API fetch...')
    console.log('[TOTALS:ENABLED_FACTORS_FOR_DATA]', {
      paceIndex: enabledFactorKeys.includes('paceIndex'),
      offForm: enabledFactorKeys.includes('offForm'),
      defErosion: enabledFactorKeys.includes('defErosion'),
      threeEnv: enabledFactorKeys.includes('threeEnv'),
      whistleEnv: enabledFactorKeys.includes('whistleEnv'),
      defStrength: enabledFactorKeys.includes('defStrength'),
      coldShooting: enabledFactorKeys.includes('coldShooting')
    })
    console.log('[TOTALS:TEAM_NAMES]', { away: ctx.away, home: ctx.home })
    bundle = await fetchNBAStatsBundle(ctx)

    if (!bundle) {
      throw new Error('[TOTALS] Failed to fetch NBA stats bundle - bundle is null')
    }

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

  // Compute only enabled factors - with individual error handling
  const factors: any[] = []
  const factorErrors: string[] = []

  console.log('[TOTALS:COMPUTING_FACTORS]', {
    enabledFactorKeys,
    bundleAvailable: !!bundle,
    bundleKeys: bundle ? Object.keys(bundle) : []
  })

  if (enabledFactorKeys.includes('paceIndex')) {
    try {
      console.log('[TOTALS:COMPUTING] paceIndex...')
      factors.push(computePaceIndex(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] paceIndex computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] paceIndex failed:', error)
      factorErrors.push(`paceIndex: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('offForm')) {
    try {
      console.log('[TOTALS:COMPUTING] offForm...')
      factors.push(computeOffensiveForm(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] offForm computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] offForm failed:', error)
      factorErrors.push(`offForm: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('defErosion')) {
    try {
      console.log('[TOTALS:COMPUTING] defErosion...')
      factors.push(computeDefensiveErosion(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] defErosion computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] defErosion failed:', error)
      factorErrors.push(`defErosion: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('threeEnv')) {
    try {
      console.log('[TOTALS:COMPUTING] threeEnv...')
      factors.push(computeThreePointEnv(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] threeEnv computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] threeEnv failed:', error)
      factorErrors.push(`threeEnv: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('whistleEnv')) {
    try {
      console.log('[TOTALS:COMPUTING] whistleEnv...')
      factors.push(computeWhistleEnv(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] whistleEnv computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] whistleEnv failed:', error)
      factorErrors.push(`whistleEnv: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('restAdvantage')) {
    try {
      console.log('[TOTALS:COMPUTING] restAdvantage...')
      factors.push(computeRestAdvantage(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] restAdvantage computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] restAdvantage failed:', error)
      factorErrors.push(`restAdvantage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('defStrength')) {
    try {
      console.log('[TOTALS:COMPUTING] defStrength...')
      factors.push(computeDefensiveStrength(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] defStrength computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] defStrength failed:', error)
      factorErrors.push(`defStrength: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  if (enabledFactorKeys.includes('coldShooting')) {
    try {
      console.log('[TOTALS:COMPUTING] coldShooting...')
      factors.push(computeColdShooting(bundle!, ctx))
      console.log('[TOTALS:SUCCESS] coldShooting computed')
    } catch (error) {
      console.error('[TOTALS:ERROR] coldShooting failed:', error)
      factorErrors.push(`coldShooting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Log summary of factor computation
  console.log('[TOTALS:FACTOR_SUMMARY]', {
    enabledCount: enabledFactorKeys.length,
    computedCount: factors.length,
    errorCount: factorErrors.length,
    errors: factorErrors
  })

  // Handle deterministic injury factor (async)
  // NOTE: Capper profiles use 'injuryAvailability' key, not 'injuryImpact'
  if (enabledFactorKeys.includes('injuryAvailability')) {
    console.log('[TOTALS:COMPUTING_INJURY]', 'Key Injuries & Availability enabled, running deterministic analysis...')
    try {
      const injuryFactor = await computeInjuryAvailability(bundle, ctx)
      factors.push(injuryFactor)
      console.log('[TOTALS:INJURY_SUCCESS]', {
        signal: injuryFactor.normalized_value,
        awayImpact: injuryFactor.raw_values_json.awayImpact,
        homeImpact: injuryFactor.raw_values_json.homeImpact,
        totalImpact: injuryFactor.raw_values_json.totalImpact
      })
    } catch (error) {
      console.error('[TOTALS:INJURY_ERROR]', error)
      // Add error factor
      factors.push({
        factor_no: 6,
        key: 'injuryAvailability',
        name: 'Key Injuries & Availability - Totals',
        normalized_value: 0,
        raw_values_json: {
          awayImpact: 0,
          homeImpact: 0,
          totalImpact: 0,
          awayInjuries: [],
          homeInjuries: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        parsed_values_json: {
          overScore: 0,
          underScore: 0,
          signal: 0,
          awayImpact: 0,
          homeImpact: 0,
          totalImpact: 0
        },
        caps_applied: false,
        cap_reason: 'Injury analysis error',
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

  // Calculate baseline_avg (sum of both teams' PPG)
  const baselineAvg = bundle ? bundle.awayPointsPerGame + bundle.homePointsPerGame : 220

  return {
    factors: weightedFactors,
    factor_version: 'nba_totals_v1',
    baseline_avg: baselineAvg, // Add baseline_avg to return value
    statsBundle: bundle || undefined, // Pass bundle up for stats-based baseline calculation
    totals_debug: {
      league_anchors: bundle ? {
        pace: bundle.leaguePace,
        ORtg: bundle.leagueORtg,
        DRtg: bundle.leagueDRtg,
        threePAR: bundle.league3PAR,
        FTr: bundle.leagueFTr,
        threePstdev: bundle.league3Pstdev
      } : {
        pace: 99.5,
        ORtg: 114.5,
        DRtg: 114.5,
        threePAR: 0.42,
        FTr: 0.26,
        threePstdev: 0.036
      },
      injury_impact: injuryImpact,
      factor_keys: weightedFactors.map(f => f.key),
      console_logs: {
        branch_used: branchLog,
        bundle: bundle!,
        rows_z_points: rowsZPoints
      },
      nba_stats_api_debug: nbaStatsDebugInfo
    }
  }
}
