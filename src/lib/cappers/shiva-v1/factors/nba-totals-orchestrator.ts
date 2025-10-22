/**
 * NBA Totals Factor Orchestrator
 * 
 * Main entry point that coordinates all 5 NBA totals factors
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx, StatMuseBundle, InjuryImpact, FactorComputationResult } from './types'
import { fetchNBAStatsBundle, summarizeAvailabilityWithLLM } from './data-fetcher'
import { computePaceIndex } from './f1-pace-index'
import { computeOffensiveForm } from './f2-offensive-form'
import { computeDefensiveErosion } from './f3-defensive-erosion'
import { computeThreePointEnv } from './f4-three-point-env'
import { computeWhistleEnv } from './f5-free-throw-env'

/**
 * Main entry point: compute all 5 NBA totals factors
 */
export async function computeTotalsFactors(ctx: RunCtx): Promise<FactorComputationResult> {
  console.log('[TOTALS:COMPUTE_START]', { away: ctx.away, home: ctx.home, sport: ctx.sport, betType: ctx.betType })
  
  const branchLog = { sport: ctx.sport, betType: ctx.betType }
  console.debug('[totals:branch-used]', branchLog)
  
  // Fetch NBA Stats API data bundle
  console.log('[TOTALS:ABOUT_TO_FETCH_NBA_STATS]', 'Starting NBA Stats API fetch...')
  const bundle = await fetchNBAStatsBundle(ctx)
  console.log('[TOTALS:NBA_STATS_FETCHED]', 'NBA Stats bundle received:', Object.keys(bundle))
  console.debug('[totals:bundle]', bundle)
  
  // Fetch injury impact via LLM
  const injuryImpact = await summarizeAvailabilityWithLLM(ctx)
  
  // Compute all 5 factors
  const factors = [
    computePaceIndex(bundle, ctx),
    computeOffensiveForm(bundle, ctx),
    computeDefensiveErosion(bundle, ctx),
    computeThreePointEnv(bundle, ctx),
    computeWhistleEnv(bundle, ctx),
  ]
  
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
      league_anchors: {
        pace: bundle.leaguePace,
        ORtg: bundle.leagueORtg,
        DRtg: bundle.leagueDRtg,
        threePAR: bundle.league3PAR,
        FTr: bundle.leagueFTr,
        threePstdev: bundle.league3Pstdev
      },
      injury_impact: injuryImpact,
      factor_keys: weightedFactors.map(f => f.key),
      console_logs: {
        branch_used: branchLog,
        bundle,
        rows_z_points: rowsZPoints
      }
    }
  }
}
