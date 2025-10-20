/**
 * SHIVA v1 AI Provider Adapters
 * Orchestrates StatMuse/News for Step 3 and predictions for Step 4
 */

import * as statmuse from '../statmuse'
import * as news from '../news'
import * as math from '../math'
import type { PlayerRoster } from '../news'

// ============================================================================
// TYPES
// ============================================================================

export type AIProvider = 'perplexity' | 'openai'

export interface Step3Inputs {
  homeTeam: string
  awayTeam: string
  aiProvider: AIProvider
  newsWindowHours: number
  roster?: PlayerRoster
}

export interface Step3Factor {
  factor_no: 1 | 2 | 3 | 4 | 5
  name: string
  weight_total_pct: number
  raw_values_json: unknown
  parsed_values_json: Record<string, unknown>
  normalized_value: number
  caps_applied: boolean
  cap_reason: string | null
  notes?: string | null
}

export interface Step3Result {
  ok: boolean
  factors: Step3Factor[]
  meta: {
    ai_provider: AIProvider
    cache_hits: number
    total_queries: number
  }
  latencyMs: number
}

export interface Step4Inputs {
  homeTeam: string
  awayTeam: string
  aiProvider: AIProvider
  factors1to5: Step3Factor[]
}

export interface Step4Result {
  ok: boolean
  factors: Array<{
    factor_no: 6 | 7
    name: string
    weight_total_pct: number
    raw_values_json: unknown
    parsed_values_json: Record<string, unknown>
    normalized_value: number
    caps_applied: boolean
    cap_reason: string | null
  }>
  pace_and_predictions: {
    statmuse_pace: {
      okc_query?: string
      hou_query?: string
      okc_pace: number
      hou_pace: number
    }
    pace_exp: number
    delta_100: number | string
    delta_100_value: number
    spread_pred_points: number
    league_avg_ortg: number
    ortg_hat: Record<string, number>
    total_pred_points: number
    scores: { home_pts: number; away_pts: number }
    winner: string
    conf7_score: number | string
    conf7_score_value: number
  }
  meta: {
    ai_provider: AIProvider
    cache_hits: number
    total_queries: number
  }
  latencyMs: number
}

// ============================================================================
// FACTOR WEIGHTS (Per Spec)
// ============================================================================

const FACTOR_WEIGHTS = {
  f1: { pct: 21.0, decimal: 0.21 }, // Net rating
  f2: { pct: 17.5, decimal: 0.175 }, // Recent form
  f3: { pct: 14.0, decimal: 0.14 }, // H2H
  f4: { pct: 7.0, decimal: 0.07 }, // ORtg differential
  f5: { pct: 7.0, decimal: 0.07 }, // News/injury edge
  f6: { pct: 3.5, decimal: 0.035 }, // Home court
  f7: { pct: 2.1, decimal: 0.021 }, // 3PT environment
}

// ============================================================================
// STEP 3: ORCHESTRATE STATMUSE + NEWS FOR FACTORS 1-5
// ============================================================================

/**
 * Run Step 3: Gather StatMuse stats and news to generate Factors 1-5
 */
export async function runStep3(inputs: Step3Inputs): Promise<Step3Result> {
  const startTime = Date.now()

  try {
    // Build all StatMuse queries
    const queries = [
      // Factor 1: Net rating differential
      { ...statmuse.buildQuery.netRating(inputs.homeTeam), id: 'home_net' },
      { ...statmuse.buildQuery.netRating(inputs.awayTeam), id: 'away_net' },
      
      // Factor 2: Recent form (last 10 games)
      { ...statmuse.buildQuery.netRatingLastN(inputs.homeTeam, 10), id: 'home_last10' },
      { ...statmuse.buildQuery.netRatingLastN(inputs.awayTeam, 10), id: 'away_last10' },
      
      // Factor 3: H2H
      { ...statmuse.buildQuery.ppgVs(inputs.homeTeam, inputs.awayTeam), id: 'home_ppg_vs' },
      { ...statmuse.buildQuery.ppgVs(inputs.awayTeam, inputs.homeTeam), id: 'away_ppg_vs' },
      
      // Factor 4: ORtg differential
      { ...statmuse.buildQuery.offensiveRating(inputs.homeTeam), id: 'home_ortg' },
      { ...statmuse.buildQuery.offensiveRating(inputs.awayTeam), id: 'away_ortg' },
    ]

    // Batch fetch StatMuse data
    const statMuseResults = await statmuse.runBatch(queries.map(q => ({ query: q.query, unit: q.unit })))
    
    // Map results by ID
    const resultsMap = new Map<string, statmuse.StatMuseNumeric>()
    queries.forEach((q, i) => {
      resultsMap.set(q.id, statMuseResults[i])
    })

    // Fetch news/injury edge for Factor 5
    const [homeNewsEdge, awayNewsEdge] = await Promise.all([
      news.searchInjuries(inputs.homeTeam, inputs.awayTeam, inputs.newsWindowHours, inputs.roster),
      news.searchInjuries(inputs.awayTeam, inputs.homeTeam, inputs.newsWindowHours, inputs.roster),
    ])

    // Count cache hits
    const cacheHits = statMuseResults.filter(r => r.cache === 'hit').length +
                     (homeNewsEdge.cache === 'hit' ? 1 : 0) +
                     (awayNewsEdge.cache === 'hit' ? 1 : 0)
    const totalQueries = statMuseResults.length + 2

    // Build Factor 1: Net Rating Differential
    const homeNet = resultsMap.get('home_net')?.value ?? 0
    const awayNet = resultsMap.get('away_net')?.value ?? 0
    const netDiff = homeNet - awayNet
    const factor1Capped = math.applyCap(netDiff, math.H2H_CAP_100)

    // Build Factor 2: Recent Form Differential
    const homeLast10 = resultsMap.get('home_last10')?.value ?? 0
    const awayLast10 = resultsMap.get('away_last10')?.value ?? 0
    const formDiff = homeLast10 - awayLast10
    const factor2Capped = math.applyCap(formDiff, math.H2H_CAP_100)

    // Build Factor 3: H2H Matchup
    const homePpgVs = resultsMap.get('home_ppg_vs')?.value ?? 0
    const awayPpgVs = resultsMap.get('away_ppg_vs')?.value ?? 0
    const h2hDiff = homePpgVs - awayPpgVs
    const factor3Capped = math.applyCap(h2hDiff, math.H2H_CAP_100)

    // Build Factor 4: ORtg Differential
    const homeORtg = resultsMap.get('home_ortg')?.value ?? math.LEAGUE_ORtg
    const awayORtg = resultsMap.get('away_ortg')?.value ?? math.LEAGUE_ORtg
    const ortgDiff = homeORtg - awayORtg
    const factor4Capped = math.applyCap(ortgDiff, math.H2H_CAP_100)

    // Build Factor 5: News/Injury Edge
    // Cap at ±3.0 pre-aggregation as specified
    const newsEdgeDiff = homeNewsEdge.edgePer100 - awayNewsEdge.edgePer100

    const factors: Step3Factor[] = [
      {
        factor_no: 1,
        name: 'Net Rating Differential',
        weight_total_pct: FACTOR_WEIGHTS.f1.pct,
        raw_values_json: {
          home_net: homeNet,
          away_net: awayNet,
          queries: {
            home: resultsMap.get('home_net')?.query,
            away: resultsMap.get('away_net')?.query,
          },
        },
        parsed_values_json: {
          home_net: homeNet,
          away_net: awayNet,
          differential: netDiff,
        },
        normalized_value: factor1Capped.value,
        caps_applied: factor1Capped.capped,
        cap_reason: factor1Capped.reason,
      },
      {
        factor_no: 2,
        name: 'Recent Form (Last 10 Games)',
        weight_total_pct: FACTOR_WEIGHTS.f2.pct,
        raw_values_json: {
          home_last10: homeLast10,
          away_last10: awayLast10,
          queries: {
            home: resultsMap.get('home_last10')?.query,
            away: resultsMap.get('away_last10')?.query,
          },
        },
        parsed_values_json: {
          home_last10: homeLast10,
          away_last10: awayLast10,
          differential: formDiff,
        },
        normalized_value: factor2Capped.value,
        caps_applied: factor2Capped.capped,
        cap_reason: factor2Capped.reason,
      },
      {
        factor_no: 3,
        name: 'Head-to-Head Matchup',
        weight_total_pct: FACTOR_WEIGHTS.f3.pct,
        raw_values_json: {
          home_ppg_vs_away: homePpgVs,
          away_ppg_vs_home: awayPpgVs,
          queries: {
            home: resultsMap.get('home_ppg_vs')?.query,
            away: resultsMap.get('away_ppg_vs')?.query,
          },
        },
        parsed_values_json: {
          home_ppg_vs: homePpgVs,
          away_ppg_vs: awayPpgVs,
          differential: h2hDiff,
        },
        normalized_value: factor3Capped.value,
        caps_applied: factor3Capped.capped,
        cap_reason: factor3Capped.reason,
      },
      {
        factor_no: 4,
        name: 'Offensive Rating Differential',
        weight_total_pct: FACTOR_WEIGHTS.f4.pct,
        raw_values_json: {
          home_ortg: homeORtg,
          away_ortg: awayORtg,
          queries: {
            home: resultsMap.get('home_ortg')?.query,
            away: resultsMap.get('away_ortg')?.query,
          },
        },
        parsed_values_json: {
          home_ortg: homeORtg,
          away_ortg: awayORtg,
          differential: ortgDiff,
        },
        normalized_value: factor4Capped.value,
        caps_applied: factor4Capped.capped,
        cap_reason: factor4Capped.reason,
      },
      {
        factor_no: 5,
        name: 'News/Injury Edge',
        weight_total_pct: FACTOR_WEIGHTS.f5.pct,
        raw_values_json: {
          home_findings: homeNewsEdge.findings,
          away_findings: awayNewsEdge.findings,
          home_edge: homeNewsEdge.edgePer100,
          away_edge: awayNewsEdge.edgePer100,
        },
        parsed_values_json: {
          home_edge_100: homeNewsEdge.edgePer100,
          away_edge_100: awayNewsEdge.edgePer100,
          differential: newsEdgeDiff,
        },
        normalized_value: newsEdgeDiff,
        caps_applied: false, // Already capped at ±3.0 in news module
        cap_reason: null,
        notes: homeNewsEdge.ok && awayNewsEdge.ok ? null : 'News search degraded',
      },
    ]

    console.log('[AI-Provider:Step3]', {
      provider: inputs.aiProvider,
      homeTeam: inputs.homeTeam,
      awayTeam: inputs.awayTeam,
      cacheHits,
      totalQueries,
      latencyMs: Date.now() - startTime,
    })

    return {
      ok: true,
      factors,
      meta: {
        ai_provider: inputs.aiProvider,
        cache_hits: cacheHits,
        total_queries: totalQueries,
      },
      latencyMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[AI-Provider:Step3]', {
      provider: inputs.aiProvider,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    })

    return {
      ok: false,
      factors: [],
      meta: {
        ai_provider: inputs.aiProvider,
        cache_hits: 0,
        total_queries: 0,
      },
      latencyMs: Date.now() - startTime,
    }
  }
}

// ============================================================================
// STEP 4: ORCHESTRATE 3PT + PACE → RUN MATH ENGINE → PREDICTIONS + CONF7
// ============================================================================

/**
 * Run Step 4: Gather 3PT and Pace data, calculate predictions and Conf7
 */
export async function runStep4(inputs: Step4Inputs): Promise<Step4Result> {
  const startTime = Date.now()

  try {
    // Build StatMuse queries for 3PT and Pace
    const queries = [
      // Pace
      { ...statmuse.buildQuery.pace(inputs.homeTeam), id: 'home_pace' },
      { ...statmuse.buildQuery.pace(inputs.awayTeam), id: 'away_pace' },
      
      // 3PT environment
      { ...statmuse.buildQuery.threePtAttempts(inputs.homeTeam), id: 'home_3pa' },
      { ...statmuse.buildQuery.threePtPct(inputs.homeTeam), id: 'home_3pct' },
      { ...statmuse.buildQuery.oppThreePtAttempts(inputs.homeTeam), id: 'home_opp_3pa' },
      { ...statmuse.buildQuery.threePtAttempts(inputs.awayTeam), id: 'away_3pa' },
      { ...statmuse.buildQuery.threePtPct(inputs.awayTeam), id: 'away_3pct' },
      { ...statmuse.buildQuery.oppThreePtAttempts(inputs.awayTeam), id: 'away_opp_3pa' },
    ]

    // Batch fetch StatMuse data
    const statMuseResults = await statmuse.runBatch(queries.map(q => ({ query: q.query, unit: q.unit })))
    
    // Map results by ID
    const resultsMap = new Map<string, statmuse.StatMuseNumeric>()
    queries.forEach((q, i) => {
      resultsMap.set(q.id, statMuseResults[i])
    })

    // Count cache hits
    const cacheHits = statMuseResults.filter(r => r.cache === 'hit').length
    const totalQueries = statMuseResults.length

    // Extract Pace values
    const homePace = resultsMap.get('home_pace')?.value ?? 100
    const awayPace = resultsMap.get('away_pace')?.value ?? 100
    const paceExp = math.paceHarmonic(homePace, awayPace)

    // Extract 3PT values
    const home3pa = resultsMap.get('home_3pa')?.value ?? 35
    const home3pct = resultsMap.get('home_3pct')?.value ?? 36
    const homeOpp3pa = resultsMap.get('home_opp_3pa')?.value ?? 35
    const away3pa = resultsMap.get('away_3pa')?.value ?? 35
    const away3pct = resultsMap.get('away_3pct')?.value ?? 36
    const awayOpp3pa = resultsMap.get('away_opp_3pa')?.value ?? 35

    // Calculate 3PT environment edge (simplified)
    // In production, this would use a more sophisticated model
    const threePtEdge = 0.0 // Placeholder - simplified for now

    // Build Factor 6: Home Court Advantage
    const factor6 = {
      factor_no: 6 as const,
      name: 'Home Court Advantage',
      weight_total_pct: FACTOR_WEIGHTS.f6.pct,
      raw_values_json: {
        home_team: inputs.homeTeam,
      },
      parsed_values_json: {
        home_edge_100: math.HOME_EDGE_100,
      },
      normalized_value: math.HOME_EDGE_100,
      caps_applied: false,
      cap_reason: null,
    }

    // Build Factor 7: 3PT Environment
    const factor7 = {
      factor_no: 7 as const,
      name: '3-Point Environment',
      weight_total_pct: FACTOR_WEIGHTS.f7.pct,
      raw_values_json: {
        home: { '3pa': home3pa, '3p_pct': home3pct, 'opp_3pa': homeOpp3pa },
        away: { '3pa': away3pa, '3p_pct': away3pct, 'opp_3pa': awayOpp3pa },
      },
      parsed_values_json: {
        three_point_edge_100: threePtEdge,
        explanation: 'Simplified 3PT model',
      },
      normalized_value: threePtEdge,
      caps_applied: false,
      cap_reason: null,
    }

    // Calculate delta_100 using all 7 factors
    const f1 = inputs.factors1to5.find(f => f.factor_no === 1)?.normalized_value ?? 0
    const f2 = inputs.factors1to5.find(f => f.factor_no === 2)?.normalized_value ?? 0
    const f3 = inputs.factors1to5.find(f => f.factor_no === 3)?.normalized_value ?? 0
    const f4 = inputs.factors1to5.find(f => f.factor_no === 4)?.normalized_value ?? 0
    const f5 = inputs.factors1to5.find(f => f.factor_no === 5)?.normalized_value ?? 0
    const f6val = factor6.normalized_value
    const f7val = factor7.normalized_value

    const delta100Value = math.delta100(f1, f2, f3, f4, f5, f6val, f7val, {
      f1: FACTOR_WEIGHTS.f1.decimal,
      f2: FACTOR_WEIGHTS.f2.decimal,
      f3: FACTOR_WEIGHTS.f3.decimal,
      f4: FACTOR_WEIGHTS.f4.decimal,
      f5: FACTOR_WEIGHTS.f5.decimal,
      f6: FACTOR_WEIGHTS.f6.decimal,
      f7: FACTOR_WEIGHTS.f7.decimal,
    })

    // Calculate predictions
    const spreadPredPoints = math.spreadFromDelta(delta100Value, paceExp)
    
    // Get ORtg from Factor 4 raw values
    const homeOrtg = (inputs.factors1to5.find(f => f.factor_no === 4)?.raw_values_json as any)?.home_ortg ?? math.LEAGUE_ORtg
    const awayOrtg = (inputs.factors1to5.find(f => f.factor_no === 4)?.raw_values_json as any)?.away_ortg ?? math.LEAGUE_ORtg
    
    const totalPredPoints = math.totalFromORtgs(homeOrtg, awayOrtg, paceExp)
    const scores = math.scoresFromSpreadTotal(spreadPredPoints, totalPredPoints)
    const winner = scores.home_pts > scores.away_pts ? inputs.homeTeam : inputs.awayTeam
    
    // Calculate Conf7
    const conf7Value = math.conf7(spreadPredPoints)

    // Build delta_100 formula string for display
    const delta100Formula = `${f1.toFixed(1)}*${FACTOR_WEIGHTS.f1.decimal} + ${f2.toFixed(1)}*${FACTOR_WEIGHTS.f2.decimal} + ${f3.toFixed(1)}*${FACTOR_WEIGHTS.f3.decimal} + ${f4.toFixed(1)}*${FACTOR_WEIGHTS.f4.decimal} + ${f5.toFixed(1)}*${FACTOR_WEIGHTS.f5.decimal} + ${f6val.toFixed(1)}*${FACTOR_WEIGHTS.f6.decimal} + ${f7val.toFixed(1)}*${FACTOR_WEIGHTS.f7.decimal}`

    // Build conf7 formula string
    const conf7Formula = `1.0 + 4.0 * (${Math.abs(spreadPredPoints).toFixed(2)} / 6.0)`

    console.log('[AI-Provider:Step4]', {
      provider: inputs.aiProvider,
      homeTeam: inputs.homeTeam,
      awayTeam: inputs.awayTeam,
      cacheHits,
      totalQueries,
      latencyMs: Date.now() - startTime,
    })

    return {
      ok: true,
      factors: [factor6, factor7],
      pace_and_predictions: {
        statmuse_pace: {
          okc_query: resultsMap.get('home_pace')?.query,
          hou_query: resultsMap.get('away_pace')?.query,
          okc_pace: homePace,
          hou_pace: awayPace,
        },
        pace_exp: paceExp,
        delta_100: delta100Formula,
        delta_100_value: delta100Value,
        spread_pred_points: spreadPredPoints,
        league_avg_ortg: math.LEAGUE_ORtg,
        ortg_hat: {
          home: homeOrtg,
          away: awayOrtg,
        },
        total_pred_points: totalPredPoints,
        scores: {
          home_pts: scores.home_pts,
          away_pts: scores.away_pts,
        },
        winner,
        conf7_score: conf7Formula,
        conf7_score_value: conf7Value,
      },
      meta: {
        ai_provider: inputs.aiProvider,
        cache_hits: cacheHits,
        total_queries: totalQueries,
      },
      latencyMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[AI-Provider:Step4]', {
      provider: inputs.aiProvider,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    })

    // Return error structure matching the DTO
    throw error
  }
}

