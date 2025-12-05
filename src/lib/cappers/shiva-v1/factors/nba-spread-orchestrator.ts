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
import { computeReboundingDiff } from './s4-rebounding-diff'
import { computeFourFactorsDifferential } from './s5-four-factors-differential'
import { computeInjuryAvailabilitySpread } from './s6-injury-availability'
import { computeMomentumIndex } from './s7-momentum-index'
import { computeDefensivePressure } from './s8-defensive-pressure'
import { computeAssistEfficiency } from './s9-assist-efficiency'
import { computeClutchShooting } from './s10-clutch-shooting'
import { computeScoringMargin } from './s11-scoring-margin'
import { computePerimeterDefense } from './s12-perimeter-defense'

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
    shouldFetchNBAStats: enabledFactorKeys.some(key => ['netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'reboundingDiff', 'fourFactorsDiff', 'momentumIndex', 'defensivePressure', 'assistEfficiency', 'clutchShooting', 'scoringMargin', 'perimeterDefense'].includes(key)),
    netRatingDiff: enabledFactorKeys.includes('netRatingDiff'),
    turnoverDiff: enabledFactorKeys.includes('turnoverDiff'),
    shootingEfficiencyMomentum: enabledFactorKeys.includes('shootingEfficiencyMomentum'),
    reboundingDiff: enabledFactorKeys.includes('reboundingDiff'),
    fourFactorsDiff: enabledFactorKeys.includes('fourFactorsDiff'),
    momentumIndex: enabledFactorKeys.includes('momentumIndex'),
    defensivePressure: enabledFactorKeys.includes('defensivePressure'),
    assistEfficiency: enabledFactorKeys.includes('assistEfficiency'),
    clutchShooting: enabledFactorKeys.includes('clutchShooting'),
    scoringMargin: enabledFactorKeys.includes('scoringMargin'),
    perimeterDefense: enabledFactorKeys.includes('perimeterDefense')
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

  // All factors that require NBA stats bundle
  // S10, S11, S12 added for new factors (clutchShooting, scoringMargin, perimeterDefense)
  // Also include legacy aliases: shootingMomentum, homeAwaySplits, paceMismatch
  const factorsRequiringBundle = [
    'netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'reboundingDiff',
    'fourFactorsDiff', 'momentumIndex', 'defensivePressure', 'assistEfficiency',
    'clutchShooting', 'scoringMargin', 'perimeterDefense',
    // Legacy aliases
    'shootingMomentum', 'homeAwaySplits', 'paceMismatch'
  ]
  const needsBundle = enabledFactorKeys.some(key => factorsRequiringBundle.includes(key))

  console.log('[SPREAD:CONDITION_CHECK]', {
    enabledFactorKeys,
    factorsRequiringBundle,
    needsBundle
  })

  if (needsBundle) {
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

  // Compute only enabled factors - with individual error handling
  const factors: any[] = []
  const factorErrors: string[] = []

  console.log('[SPREAD:COMPUTING_FACTORS]', {
    enabledFactorKeys,
    bundleAvailable: !!bundle,
    bundleKeys: bundle ? Object.keys(bundle) : []
  })

  // S1: Net Rating Differential
  if (enabledFactorKeys.includes('netRatingDiff')) {
    try {
      console.log('[SPREAD:S1] Computing Net Rating Differential...')
      factors.push(computeNetRatingDifferential(bundle!, ctx))
      console.log('[SPREAD:S1] Success')
    } catch (error) {
      console.error('[SPREAD:S1:ERROR]', error)
      factorErrors.push(`netRatingDiff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S2: Turnover Differential
  if (enabledFactorKeys.includes('turnoverDiff')) {
    try {
      console.log('[SPREAD:S2] Computing Turnover Differential...')
      factors.push(computeTurnoverDifferential(bundle!, ctx))
      console.log('[SPREAD:S2] Success')
    } catch (error) {
      console.error('[SPREAD:S2:ERROR]', error)
      factorErrors.push(`turnoverDiff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S3: Shooting Efficiency + Momentum
  // Also handle legacy 'shootingMomentum' alias
  if (enabledFactorKeys.includes('shootingEfficiencyMomentum') || enabledFactorKeys.includes('shootingMomentum')) {
    try {
      console.log('[SPREAD:S3] Computing Shooting Efficiency + Momentum...')
      factors.push(await computeShootingEfficiencyMomentum(bundle!, ctx))
      console.log('[SPREAD:S3] Success')
    } catch (error) {
      console.error('[SPREAD:S3:ERROR]', error)
      factorErrors.push(`shootingEfficiencyMomentum: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S4: Rebounding Differential
  // Also handle legacy 'homeAwaySplits' and 'paceMismatch' aliases (these use rebounding as proxy)
  if (enabledFactorKeys.includes('reboundingDiff') || enabledFactorKeys.includes('homeAwaySplits') || enabledFactorKeys.includes('paceMismatch')) {
    try {
      console.log('[SPREAD:S4] Computing Rebounding Differential...')
      factors.push(computeReboundingDiff(bundle!, ctx))
      console.log('[SPREAD:S4] Success')
    } catch (error) {
      console.error('[SPREAD:S4:ERROR]', error)
      factorErrors.push(`reboundingDiff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S5: Four Factors Differential
  if (enabledFactorKeys.includes('fourFactorsDiff')) {
    try {
      console.log('[SPREAD:S5] Computing Four Factors Differential...')
      factors.push(computeFourFactorsDifferential(bundle!, ctx))
      console.log('[SPREAD:S5] Success')
    } catch (error) {
      console.error('[SPREAD:S5:ERROR]', error)
      factorErrors.push(`fourFactorsDiff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S7: Momentum Index
  if (enabledFactorKeys.includes('momentumIndex')) {
    try {
      console.log('[SPREAD:S7] Computing Momentum Index...')
      factors.push(computeMomentumIndex(bundle!, ctx))
      console.log('[SPREAD:S7] Success')
    } catch (error) {
      console.error('[SPREAD:S7:ERROR]', error)
      factorErrors.push(`momentumIndex: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S8: Defensive Pressure
  if (enabledFactorKeys.includes('defensivePressure')) {
    try {
      console.log('[SPREAD:S8] Computing Defensive Pressure...')
      factors.push(computeDefensivePressure(bundle!, ctx))
      console.log('[SPREAD:S8] Success')
    } catch (error) {
      console.error('[SPREAD:S8:ERROR]', error)
      factorErrors.push(`defensivePressure: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S9: Assist Efficiency
  if (enabledFactorKeys.includes('assistEfficiency')) {
    try {
      console.log('[SPREAD:S9] Computing Assist Efficiency...')
      factors.push(computeAssistEfficiency(bundle!, ctx))
      console.log('[SPREAD:S9] Success')
    } catch (error) {
      console.error('[SPREAD:S9:ERROR]', error)
      factorErrors.push(`assistEfficiency: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S10: Clutch Shooting
  if (enabledFactorKeys.includes('clutchShooting')) {
    try {
      console.log('[SPREAD:S10] Computing Clutch Shooting...')
      factors.push(computeClutchShooting(bundle!, ctx))
      console.log('[SPREAD:S10] Success')
    } catch (error) {
      console.error('[SPREAD:S10:ERROR]', error)
      factorErrors.push(`clutchShooting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S11: Scoring Margin
  if (enabledFactorKeys.includes('scoringMargin')) {
    try {
      console.log('[SPREAD:S11] Computing Scoring Margin...')
      factors.push(computeScoringMargin(bundle!, ctx))
      console.log('[SPREAD:S11] Success')
    } catch (error) {
      console.error('[SPREAD:S11:ERROR]', error)
      factorErrors.push(`scoringMargin: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // S12: Perimeter Defense
  if (enabledFactorKeys.includes('perimeterDefense')) {
    try {
      console.log('[SPREAD:S12] Computing Perimeter Defense...')
      factors.push(computePerimeterDefense(bundle!, ctx))
      console.log('[SPREAD:S12] Success')
    } catch (error) {
      console.error('[SPREAD:S12:ERROR]', error)
      factorErrors.push(`perimeterDefense: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Log summary of factor computation
  console.log('[SPREAD:FACTOR_SUMMARY]', {
    enabledCount: enabledFactorKeys.length,
    computedCount: factors.length,
    errorCount: factorErrors.length,
    errors: factorErrors
  })

  // S6: Injury Availability (deterministic)
  // NOTE: Capper profiles may use 'injuryAvailability' or 'injuryAvailabilitySpread' key
  if (enabledFactorKeys.includes('injuryAvailability') || enabledFactorKeys.includes('injuryAvailabilitySpread')) {
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
      pace: 99.5,
      ORtg: 114.5,
      DRtg: 114.5,
      threePAR: 0.42,
      FTr: 0.26,
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
    statsBundle: bundle || undefined, // Pass bundle up for stats-based baseline calculation
    totals_debug
  }
}

