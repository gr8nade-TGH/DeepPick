/**
 * NBA Spread Factor Orchestrator
 * 
 * Main entry point that coordinates all 5 NBA spread (ATS) factors
 * 
 * SPREAD FACTORS (S1-S5):
 * - S1: Net Rating Differential (30% weight)
 * - S2: Rest Advantage (25% weight)
 * - S3: Recent ATS Momentum (20% weight)
 * - S4: Home Court Advantage (15% weight)
 * - S5: Four Factors Differential (10% weight)
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx, NBAStatsBundle, InjuryImpact, FactorComputationResult } from './types'
import { fetchNBAStatsBundle, summarizeAvailabilityWithLLM } from './data-fetcher'

// TODO: Import spread factor implementations when created
// import { computeNetRatingDifferential } from './s1-net-rating-differential'
// import { computeRestAdvantage } from './s2-rest-advantage'
// import { computeATSMomentum } from './s3-ats-momentum'
// import { computeHomeCourtAdvantage } from './s4-home-court-advantage'
// import { computeFourFactorsDifferential } from './s5-four-factors'

/**
 * Main entry point: compute only enabled NBA spread factors
 */
export async function computeSpreadFactors(ctx: RunCtx): Promise<FactorComputationResult> {
  console.log('[SPREAD:COMPUTE_START]', { away: ctx.away, home: ctx.home, sport: ctx.sport, betType: ctx.betType })

  const branchLog = { sport: ctx.sport, betType: ctx.betType }
  console.debug('[spread:branch-used]', branchLog)

  // Get enabled factors from profile
  const enabledFactorKeys = Object.keys(ctx.factorWeights || {})
  console.log('[SPREAD:ENABLED_FACTORS]', { enabledFactorKeys, totalEnabled: enabledFactorKeys.length })

  const nbaStatsConditionCheck = {
    enabledFactorKeys,
    shouldFetchNBAStats: enabledFactorKeys.some(key => ['netRatingDiff', 'restAdvantage', 'atsMomentum', 'homeCourtAdv', 'fourFactorsDiff'].includes(key)),
    netRatingDiff: enabledFactorKeys.includes('netRatingDiff'),
    restAdvantage: enabledFactorKeys.includes('restAdvantage'),
    atsMomentum: enabledFactorKeys.includes('atsMomentum'),
    homeCourtAdv: enabledFactorKeys.includes('homeCourtAdv'),
    fourFactorsDiff: enabledFactorKeys.includes('fourFactorsDiff')
  }
  console.log('[SPREAD:NBA_STATS_CONDITION_CHECK]', nbaStatsConditionCheck)

  // Only fetch data if we have enabled factors
  if (enabledFactorKeys.length === 0) {
    console.warn('[SPREAD:NO_ENABLED_FACTORS]', 'No factors enabled, returning empty result')
    return {
      factors: [],
      factor_version: 'nba_spread_v1',
      baseline_avg: 0, // Spread baseline is 0 (no inherent advantage)
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
          bundle: {} as any,
          rows_z_points: []
        },
        nba_stats_api_debug: {
          condition_check: nbaStatsConditionCheck as any,
          enabled_factors: enabledFactorKeys,
          nba_stats_fetched: false,
          team_names: { away: ctx.away, home: ctx.home },
          bundle_keys: [],
          bundle_sample: {} as any,
          api_calls_made: false
        }
      }
    }
  }

  // Fetch NBA Stats API data bundle (only if needed)
  let bundle: NBAStatsBundle | null = null
  let nbaStatsDebugInfo = {
    condition_check: nbaStatsConditionCheck as any,
    enabled_factors: enabledFactorKeys,
    nba_stats_fetched: false,
    team_names: { away: ctx.away, home: ctx.home },
    bundle_keys: [] as string[],
    bundle_sample: {} as any,
    api_calls_made: false
  }

  console.log('[SPREAD:CONDITION_CHECK]', {
    enabledFactorKeys,
    conditionCheck: enabledFactorKeys.some(key => ['netRatingDiff', 'restAdvantage', 'atsMomentum', 'homeCourtAdv', 'fourFactorsDiff'].includes(key))
  })

  if (enabledFactorKeys.some(key => ['netRatingDiff', 'restAdvantage', 'atsMomentum', 'homeCourtAdv', 'fourFactorsDiff'].includes(key))) {
    console.log('[SPREAD:ABOUT_TO_FETCH_NBA_STATS]', 'Starting NBA Stats API fetch...')
    bundle = await fetchNBAStatsBundle(ctx)
    console.log('[SPREAD:NBA_STATS_FETCHED]', 'NBA Stats bundle received:', Object.keys(bundle))
    console.debug('[spread:bundle]', bundle)

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

  // Compute only enabled factors
  const factors: any[] = []

  // TODO: Implement spread factors in Phase 2
  // if (enabledFactorKeys.includes('netRatingDiff')) {
  //   factors.push(computeNetRatingDifferential(bundle!, ctx))
  // }
  // if (enabledFactorKeys.includes('restAdvantage')) {
  //   factors.push(computeRestAdvantage(bundle!, ctx))
  // }
  // if (enabledFactorKeys.includes('atsMomentum')) {
  //   factors.push(computeATSMomentum(bundle!, ctx))
  // }
  // if (enabledFactorKeys.includes('homeCourtAdv')) {
  //   factors.push(computeHomeCourtAdvantage(bundle!, ctx))
  // }
  // if (enabledFactorKeys.includes('fourFactorsDiff')) {
  //   factors.push(computeFourFactorsDifferential(bundle!, ctx))
  // }

  console.log('[SPREAD:FACTORS_COMPUTED]', { totalFactors: factors.length, factorKeys: factors.map(f => f.key) })

  // Calculate baseline_avg (for spread, this is 0 - no inherent advantage)
  const baseline_avg = 0

  // Build debug info
  const totals_debug = {
    league_anchors: {
      pace: bundle?.leaguePace || 100.1,
      ORtg: bundle?.leagueORtg || 110.0,
      DRtg: bundle?.leagueDRtg || 110.0,
      threePAR: bundle?.league3PAR || 0.39,
      FTr: bundle?.leagueFTr || 0.22,
      threePstdev: bundle?.league3Pstdev || 0.036
    },
    injury_impact: { defenseImpactA: 0, defenseImpactB: 0, summary: 'Not implemented for spread yet', rawResponse: '' },
    factor_keys: factors.map(f => f.key),
    console_logs: {
      branch_used: branchLog,
      bundle: (bundle || {}) as any,
      rows_z_points: factors.map(f => ({
        key: f.key,
        name: f.name,
        z: f.normalized_value,
        points: f.parsed_values_json?.points || 0,
        awayScore: f.parsed_values_json?.awayScore || 0,
        homeScore: f.parsed_values_json?.homeScore || 0
      }))
    },
    nba_stats_api_debug: nbaStatsDebugInfo
  }

  return {
    factors,
    factor_version: 'nba_spread_v1',
    baseline_avg,
    totals_debug
  }
}

