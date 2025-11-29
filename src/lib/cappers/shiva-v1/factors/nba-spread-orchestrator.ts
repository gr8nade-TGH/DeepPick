/**
 * NBA Spread Factor Orchestrator
 *
 * Main entry point that coordinates all 6 NBA spread (ATS) factors
 *
 * SPREAD FACTORS (S1-S6):
 * - S1: Net Rating Differential (30% weight)
 * - S2: Turnover Differential (25% weight)
 * - S3: Shooting Efficiency + Momentum (20% weight)
 * - S4: Home/Away Performance Splits (15% weight) - REPLACED Pace Mismatch
 * - S5: Four Factors Differential (10% weight)
 * - S6: Key Injuries & Availability (10% weight)
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx, NBAStatsBundle, InjuryImpact, FactorComputationResult } from './types'
import { fetchNBAStatsBundle, summarizeAvailabilityWithLLM } from './data-fetcher'

// Import spread factor implementations
import { computeNetRatingDifferential } from './s1-net-rating-differential'
import { computeTurnoverDifferential } from './s2-turnover-differential'
import { computeShootingEfficiencyMomentum } from './s3-shooting-efficiency-momentum'
import { computeHomeAwaySplits } from './s4-home-away-splits'
import { computeFourFactorsDifferential } from './s5-four-factors-differential'
import { computeInjuryAvailabilitySpread } from './s6-injury-availability'

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
    shouldFetchNBAStats: enabledFactorKeys.some(key => ['netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'homeAwaySplits', 'paceMismatch', 'fourFactorsDiff'].includes(key)),
    netRatingDiff: enabledFactorKeys.includes('netRatingDiff'),
    turnoverDiff: enabledFactorKeys.includes('turnoverDiff'),
    shootingEfficiencyMomentum: enabledFactorKeys.includes('shootingEfficiencyMomentum'),
    homeAwaySplits: enabledFactorKeys.includes('homeAwaySplits') || enabledFactorKeys.includes('paceMismatch'),
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
    conditionCheck: enabledFactorKeys.some(key => ['netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'paceMismatch', 'fourFactorsDiff'].includes(key))
  })

  if (enabledFactorKeys.some(key => ['netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'paceMismatch', 'fourFactorsDiff'].includes(key))) {
    console.log('[SPREAD:ABOUT_TO_FETCH_NBA_STATS]', 'Starting NBA Stats API fetch...')
    bundle = await fetchNBAStatsBundle(ctx)

    if (!bundle) {
      throw new Error('[SPREAD] Failed to fetch NBA stats bundle - bundle is null')
    }

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

  // S1: Net Rating Differential
  if (enabledFactorKeys.includes('netRatingDiff')) {
    console.log('[SPREAD:S1] Computing Net Rating Differential...')
    factors.push(computeNetRatingDifferential(bundle!, ctx))
  }

  // S2: Turnover Differential
  if (enabledFactorKeys.includes('turnoverDiff')) {
    console.log('[SPREAD:S2] Computing Turnover Differential...')
    factors.push(computeTurnoverDifferential(bundle!, ctx))
  }

  // S3: Shooting Efficiency + Momentum
  if (enabledFactorKeys.includes('shootingEfficiencyMomentum')) {
    console.log('[SPREAD:S3] Computing Shooting Efficiency + Momentum...')
    factors.push(await computeShootingEfficiencyMomentum(bundle!, ctx))
  }

  // S4: Home/Away Performance Splits (replaced Pace Mismatch)
  // Also support legacy 'paceMismatch' key for backward compatibility
  if (enabledFactorKeys.includes('homeAwaySplits') || enabledFactorKeys.includes('paceMismatch')) {
    console.log('[SPREAD:S4] Computing Home/Away Performance Splits...')
    factors.push(computeHomeAwaySplits(bundle!, ctx))
  }

  // S5: Four Factors Differential
  if (enabledFactorKeys.includes('fourFactorsDiff')) {
    console.log('[SPREAD:S5] Computing Four Factors Differential...')
    factors.push(computeFourFactorsDifferential(bundle!, ctx))
  }

  // S6: Injury Availability (deterministic)
  // NOTE: Capper profiles use 'injuryAvailability' key for SPREAD too (same as TOTALS)
  if (enabledFactorKeys.includes('injuryAvailability')) {
    console.log('[SPREAD:S6] Computing Key Injuries & Availability...')
    try {
      const injuryFactor = await computeInjuryAvailabilitySpread(bundle, ctx)
      factors.push(injuryFactor)
      console.log('[SPREAD:INJURY_SUCCESS]', {
        signal: injuryFactor.normalized_value,
        awayImpact: injuryFactor.raw_values_json.awayImpact,
        homeImpact: injuryFactor.raw_values_json.homeImpact,
        netDifferential: injuryFactor.raw_values_json.netDifferential
      })
    } catch (error) {
      console.error('[SPREAD:INJURY_ERROR]', error)
      // Add error factor
      factors.push({
        factor_no: 6,
        key: 'injuryAvailability',
        name: 'Key Injuries & Availability - Spread',
        normalized_value: 0,
        raw_values_json: {
          awayImpact: 0,
          homeImpact: 0,
          netDifferential: 0,
          awayInjuries: [],
          homeInjuries: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        parsed_values_json: {
          awayScore: 0,
          homeScore: 0,
          signal: 0,
          awayImpact: 0,
          homeImpact: 0,
          netDifferential: 0
        },
        caps_applied: false,
        cap_reason: 'Injury analysis error',
        notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  console.log('[SPREAD:FACTORS_COMPUTED]', { totalFactors: factors.length, factorKeys: factors.map(f => f.key) })

  // Calculate baseline_avg (for spread, this is 0 - no inherent advantage)
  const baseline_avg = 0

  // Build debug info
  const totals_debug = {
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
    injury_impact: { defenseImpactA: 0, defenseImpactB: 0, summary: 'Not implemented for spread yet', rawResponse: '' },
    factor_keys: factors.map(f => f.key),
    console_logs: {
      branch_used: branchLog,
      bundle: bundle!,
      rows_z_points: factors.map(f => ({
        key: f.key,
        z: f.normalized_value,
        pts: f.parsed_values_json?.points || 0
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

