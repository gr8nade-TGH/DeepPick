/**
 * NBA Totals Factor Computation Engine
 * 
 * Implements F1-F5 factors for NBA totals betting with StatMuse integration
 * and LLM injury parsing. All factors return symmetric contributions.
 */

import { FactorMeta, FactorComputation } from '@/types/factors'
import { NBA_CONSTANTS, StatMuseQueries, clamp, normalizeToPoints, splitPointsEvenly } from '../factor-registry'
import { getFactorsByContext } from '../factor-registry'
import { fetchNBATeamStats, fetchNBATeamStatsLastN } from '@/lib/data-sources/nba-stats-simple'
import { searchInjuries } from '../news'

// ============================================================================
// TYPES
// ============================================================================

export interface RunCtx {
  game_id: string
  away: string
  home: string
  sport: 'NBA'
  betType: 'TOTAL'
  leagueAverages: {
    pace: number
    ORtg: number
    DRtg: number
    threePAR: number
    FTr: number
    threePstdev: number
  }
  factorWeights?: Record<string, number> // weight percentages (0-100)
}

export interface StatMuseBundle {
  // Team pace data
  awayPaceSeason: number
  awayPaceLast10: number
  homePaceSeason: number
  homePaceLast10: number
  
  // Offensive/Defensive ratings
  awayORtgLast10: number
  homeORtgLast10: number
  awayDRtgSeason: number
  homeDRtgSeason: number
  
  // 3-Point environment
  away3PAR: number
  home3PAR: number
  awayOpp3PAR: number
  homeOpp3PAR: number
  away3PctLast10: number
  home3PctLast10: number
  
  // Free throw environment
  awayFTr: number
  homeFTr: number
  awayOppFTr: number
  homeOppFTr: number
  
  // League anchors
  leaguePace: number
  leagueORtg: number
  leagueDRtg: number
  league3PAR: number
  leagueFTr: number
  league3Pstdev: number
}

export interface InjuryImpact {
  away: number  // defense_impact_score ∈ [-1, +1]
  home: number  // defense_impact_score ∈ [-1, +1]
}

// ============================================================================
// NBA STATS API BUNDLE FETCHER (PRIMARY)
// ============================================================================

export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<StatMuseBundle> {
  console.log('[NBA-Stats:FETCH_START]', { away: ctx.away, home: ctx.home })
  
  try {
    // Fetch all team stats in parallel
    const [awaySeasonRes, awayLast10Res, homeSeasonRes, homeLast10Res] = await Promise.all([
      fetchNBATeamStats(ctx.away),
      fetchNBATeamStatsLastN(ctx.away, 10),
      fetchNBATeamStats(ctx.home),
      fetchNBATeamStatsLastN(ctx.home, 10)
    ])
    
    // Check if all requests succeeded
    if (!awaySeasonRes.ok || !awayLast10Res.ok || !homeSeasonRes.ok || !homeLast10Res.ok) {
      const errors = [
        awaySeasonRes.ok ? null : `away season: ${awaySeasonRes.error}`,
        awayLast10Res.ok ? null : `away last10: ${awayLast10Res.error}`,
        homeSeasonRes.ok ? null : `home season: ${homeSeasonRes.error}`,
        homeLast10Res.ok ? null : `home last10: ${homeLast10Res.error}`
      ].filter(Boolean).join(', ')
      
      throw new Error(`NBA Stats API failed: ${errors}`)
    }
    
    const awaySeason = awaySeasonRes.data!
    const awayLast10 = awayLast10Res.data!
    const homeSeason = homeSeasonRes.data!
    const homeLast10 = homeLast10Res.data!
    
    // Calculate league averages from the four teams (rough approximation)
    const leaguePace = (awaySeason.pace + homeSeason.pace) / 2
    const leagueORtg = (awaySeason.offensiveRating + homeSeason.offensiveRating) / 2
    const leagueDRtg = (awaySeason.defensiveRating + homeSeason.defensiveRating) / 2
    const league3PAR = (awaySeason.threePointAttemptRate + homeSeason.threePointAttemptRate) / 2
    const leagueFTr = (awaySeason.freeThrowRate + homeSeason.freeThrowRate) / 2
    
    console.log('[NBA-Stats:SUCCESS]', {
      away: ctx.away,
      home: ctx.home,
      latencyMs: awaySeasonRes.latencyMs + awayLast10Res.latencyMs + homeSeasonRes.latencyMs + homeLast10Res.latencyMs
    })
    
    return {
      // Team pace data
      awayPaceSeason: awaySeason.pace,
      awayPaceLast10: awayLast10.pace,
      homePaceSeason: homeSeason.pace,
      homePaceLast10: homeLast10.pace,
      
      // Offensive/Defensive ratings
      awayORtgLast10: awayLast10.offensiveRating,
      homeORtgLast10: homeLast10.offensiveRating,
      awayDRtgSeason: awaySeason.defensiveRating,
      homeDRtgSeason: homeSeason.defensiveRating,
      
      // 3-Point environment
      away3PAR: awaySeason.threePointAttemptRate,
      home3PAR: homeSeason.threePointAttemptRate,
      awayOpp3PAR: awaySeason.threePointAttemptRate, // Approximation (opponent data not directly available)
      homeOpp3PAR: homeSeason.threePointAttemptRate, // Approximation
      away3PctLast10: awayLast10.threePointPercentage,
      home3PctLast10: homeLast10.threePointPercentage,
      
      // Free throw environment
      awayFTr: awaySeason.freeThrowRate,
      homeFTr: homeSeason.freeThrowRate,
      awayOppFTr: awaySeason.freeThrowRate, // Approximation
      homeOppFTr: homeSeason.freeThrowRate, // Approximation
      
      // League anchors
      leaguePace,
      leagueORtg,
      leagueDRtg,
      league3PAR,
      leagueFTr,
      league3Pstdev: 0.05 // Hardcoded for now
    }
  } catch (error) {
    console.error('[NBA-Stats:ERROR]', error)
    throw new Error(`NBA Stats API failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// ============================================================================
// STATMUSE BUNDLE FETCHER (DEPRECATED - commented out)
// ============================================================================

/*
export async function fetchStatMuseBundle(ctx: RunCtx): Promise<StatMuseBundle> {
  console.log('[StatMuse:FETCH_START]', { away: ctx.away, home: ctx.home })
  
  const { away, home } = ctx
  
  // Fetch all queries in parallel for efficiency
  const queries = [
    // Pace queries
    StatMuseQueries.pace(away, false),           // away pace season
    StatMuseQueries.pace(away, true),            // away pace last 10
    StatMuseQueries.pace(home, false),           // home pace season
    StatMuseQueries.pace(home, true),            // home pace last 10
    StatMuseQueries.leaguePace(),                // league pace
    
    // Offensive/Defensive ratings
    StatMuseQueries.ortgLast10(away),            // away ORtg last 10
    StatMuseQueries.ortgLast10(home),            // home ORtg last 10
    StatMuseQueries.drtgSeason(away),            // away DRtg season
    StatMuseQueries.drtgSeason(home),            // home DRtg season
    
    // 3-Point environment
    StatMuseQueries.threePAR(away),              // away 3PAR
    StatMuseQueries.threePAR(home),              // home 3PAR
    StatMuseQueries.oppThreePAR(away),           // away opp 3PAR
    StatMuseQueries.oppThreePAR(home),           // home opp 3PAR
    StatMuseQueries.threePctLast10(away),        // away 3P% last 10
    StatMuseQueries.threePctLast10(home),        // home 3P% last 10
    
    // Free throw environment
    StatMuseQueries.ftr(away),                   // away FTr
    StatMuseQueries.ftr(home),                   // home FTr
    StatMuseQueries.oppFtr(away),                // away opp FTr
    StatMuseQueries.oppFtr(home),                // home opp FTr
  ]
  
  console.log('[StatMuse:QUERIES]', queries.length, 'queries built')
  
  const responses = await Promise.allSettled(
    queries.map(query => askStatMuse(query, 'per100'))
  )
  
  console.log('[StatMuse:RESPONSES_RECEIVED]', responses.length, 'responses')
  
  // Parse responses - NO FALLBACKS, let it fail
  const parseNumeric = (response: any, queryName: string = 'unknown'): number => {
    if (!response?.ok || response.value === undefined) {
      console.log(`[StatMuse:FAIL] ${queryName}:`, { ok: response?.ok, value: response?.value, rawText: response?.rawText })
      throw new Error(`StatMuse web scraping failed for ${queryName}: ${response?.rawText || 'No data'}`)
    }
    const numeric = parseFloat(response.value.toString())
    if (isNaN(numeric)) {
      console.log(`[StatMuse:PARSE_FAIL] ${queryName}:`, { value: response.value, rawText: response.rawText, parsed: numeric })
      throw new Error(`StatMuse returned invalid data for ${queryName}: ${response.value} (raw: ${response.rawText})`)
    }
    console.log(`[StatMuse:SUCCESS] ${queryName}:`, numeric)
    return numeric
  }
  
  const [
    awayPaceSeasonRes,
    awayPaceLast10Res,
    homePaceSeasonRes,
    homePaceLast10Res,
    leaguePaceRes,
    awayORtgLast10Res,
    homeORtgLast10Res,
    awayDRtgSeasonRes,
    homeDRtgSeasonRes,
    away3PARRes,
    home3PARRes,
    awayOpp3PARRes,
    homeOpp3PARRes,
    away3PctLast10Res,
    home3PctLast10Res,
    awayFTrRes,
    homeFTrRes,
    awayOppFTrRes,
    homeOppFTrRes,
  ] = responses
  
  // Log StatMuse call summary
  const successCount = responses.filter(r => r.status === 'fulfilled' && r.value?.ok).length
  const failCount = responses.length - successCount
  console.log(`[StatMuse:SUMMARY] ${successCount}/${responses.length} calls succeeded, ${failCount} failed`)
  console.log(`[StatMuse:RESPONSES]`, responses.map((r, i) => ({
    index: i,
    status: r.status,
    ok: r.status === 'fulfilled' ? r.value?.ok : false,
    value: r.status === 'fulfilled' ? (r.value as any)?.value : null,
    rawText: r.status === 'fulfilled' ? (r.value as any)?.rawText : null,
    error: r.status === 'rejected' ? r.reason : null
  })))
  
  return {
    // Team pace data - NO FALLBACKS
    awayPaceSeason: parseNumeric(awayPaceSeasonRes, 'awayPaceSeason'),
    awayPaceLast10: parseNumeric(awayPaceLast10Res, 'awayPaceLast10'),
    homePaceSeason: parseNumeric(homePaceSeasonRes, 'homePaceSeason'),
    homePaceLast10: parseNumeric(homePaceLast10Res, 'homePaceLast10'),
    
    // Offensive/Defensive ratings - NO FALLBACKS
    awayORtgLast10: parseNumeric(awayORtgLast10Res, 'awayORtgLast10'),
    homeORtgLast10: parseNumeric(homeORtgLast10Res, 'homeORtgLast10'),
    awayDRtgSeason: parseNumeric(awayDRtgSeasonRes, 'awayDRtgSeason'),
    homeDRtgSeason: parseNumeric(homeDRtgSeasonRes, 'homeDRtgSeason'),
    
    // 3-Point environment - NO FALLBACKS
    away3PAR: parseNumeric(away3PARRes, 'away3PAR'),
    home3PAR: parseNumeric(home3PARRes, 'home3PAR'),
    awayOpp3PAR: parseNumeric(awayOpp3PARRes, 'awayOpp3PAR'),
    homeOpp3PAR: parseNumeric(homeOpp3PARRes, 'homeOpp3PAR'),
    away3PctLast10: parseNumeric(away3PctLast10Res, 'away3PctLast10'),
    home3PctLast10: parseNumeric(home3PctLast10Res, 'home3PctLast10'),
    
    // Free throw environment - NO FALLBACKS
    awayFTr: parseNumeric(awayFTrRes, 'awayFTr'),
    homeFTr: parseNumeric(homeFTrRes, 'homeFTr'),
    awayOppFTr: parseNumeric(awayOppFTrRes, 'awayOppFTr'),
    homeOppFTr: parseNumeric(homeOppFTrRes, 'homeOppFTr'),
    
    // League anchors - NO FALLBACKS
    leaguePace: parseNumeric(leaguePaceRes, 'leaguePace'),
    leagueORtg: parseNumeric(awayORtgLast10Res, 'leagueORtg'), // Use one of the ORtg calls for league
    leagueDRtg: parseNumeric(awayDRtgSeasonRes, 'leagueDRtg'), // Use one of the DRtg calls for league
    league3PAR: parseNumeric(away3PARRes, 'league3PAR'), // Use one of the 3PAR calls for league
    leagueFTr: parseNumeric(awayFTrRes, 'leagueFTr'), // Use one of the FTr calls for league
    league3Pstdev: 0.05, // Hardcoded for now
  }
}
*/

// ============================================================================
// LLM INJURY PARSER
// ============================================================================

export async function summarizeAvailabilityWithLLM(ctx: RunCtx): Promise<InjuryImpact> {
  try {
    // Fetch injury news for both teams
    const awayNews = await searchInjuries(ctx.away, ctx.home, 48) // 48h window
    const homeNews = await searchInjuries(ctx.home, ctx.away, 48)
    
    // Combine news snippets from findings
    const combinedNews = [
      ...(awayNews?.findings || []).map(f => `[${ctx.away}] ${f.player} (${f.status}) - ${f.minutesImpact} impact`),
      ...(homeNews?.findings || []).map(f => `[${ctx.home}] ${f.player} (${f.status}) - ${f.minutesImpact} impact`)
    ].join('\n\n')
    
    if (!combinedNews.trim()) {
      return { away: 0, home: 0 }
    }
    
    // LLM prompt for JSON-only response
    const prompt = `You are an NBA availability parser. Return JSON only.

Given snippets about injuries and status for ${ctx.away} at ${ctx.home} (date ${new Date().toISOString().split('T')[0]}), produce:
{
  "key_absences": [{"team":"${ctx.away}","player":"Player Name","role":"rim protector","status":"OUT"}],
  "minutes_limits": [{"team":"${ctx.home}","player":"Player Name","limit":28}],
  "defense_impact_score": -1..+1   // positive = weaker defense tonight
}

Heavily weight absences of rim protection and top wing defenders. If information is uncertain, return 0.
TEXT:
<<<
${combinedNews}
>>>`

    // Call OpenAI with JSON-only response
    const response = await fetch('/api/ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for deterministic responses
        response_format: { type: 'json_object' }
      })
    })
    
    if (!response.ok) {
      console.error('[NBA-Totals] LLM injury parsing failed:', response.status)
      throw new Error(`LLM injury parsing failed with status ${response.status}`)
    }
    
    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    
    // Extract defense impact scores per team
    const awayImpact = parsed.key_absences?.find((a: any) => a.team === ctx.away)?.defense_impact_score || 0
    const homeImpact = parsed.key_absences?.find((a: any) => a.team === ctx.home)?.defense_impact_score || 0
    
    return {
      away: clamp(awayImpact, -1, 1),
      home: clamp(homeImpact, -1, 1)
    }
    
  } catch (error) {
    console.error('[NBA-Totals] LLM injury parsing error:', error)
    throw new Error(`LLM injury parsing error: ${error}`)
  }
}

// ============================================================================
// FACTOR COMPUTATION FUNCTIONS
// ============================================================================

/**
 * F1: Matchup Pace Index ⏱️
 * How fast both teams will play tonight (blending season + last-10 + rest)
 */
export function computePaceIndex(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { awayPaceSeason, awayPaceLast10, homePaceSeason, homePaceLast10, leaguePace } = bundle
  
  // Blend season + last 10 with 60/40 weighting
  const awayPace = 0.6 * awayPaceSeason + 0.4 * awayPaceLast10
  const homePace = 0.6 * homePaceSeason + 0.4 * homePaceLast10
  
  // Expected pace for the game
  const expPace = (awayPace + homePace) / 2
  
  // Delta from league average
  const paceDelta = expPace - leaguePace
  
  // Normalize to z-score (±6 possessions ≈ big difference)
  const z = clamp(paceDelta / 6, -1, 1)
  const points = normalizeToPoints(z, 1.0) // maxPoints = 1.0
  const { away, home } = splitPointsEvenly(points)
  
  return {
    factor_no: 1,
    key: 'paceIndex',
    name: 'Matchup Pace Index',
    normalized_value: z,
    raw_values_json: {
      awayPaceSeason,
      awayPaceLast10,
      homePaceSeason,
      homePaceLast10,
      expPace,
      paceDelta,
      leaguePace
    },
    parsed_values_json: {
      awayPace,
      homePace,
      expPace,
      paceDelta,
      z,
      points,
      awayContribution: away,
      homeContribution: home
    },
    caps_applied: Math.abs(z) >= 1,
    cap_reason: Math.abs(z) >= 1 ? 'z-score clamped to ±1' : null,
    notes: `Expected pace: ${expPace.toFixed(1)} vs league ${leaguePace.toFixed(1)}`
  }
}

/**
 * F2: Offensive Form vs Opponent 🔥
 * Are offenses hot? Uses last-10 ORtg, adjusted for opponent defense and venue
 */
export function computeOffensiveForm(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { 
    awayORtgLast10, homeORtgLast10, 
    awayDRtgSeason, homeDRtgSeason, 
    leagueORtg 
  } = bundle
  
  // Adjust ORtg for opponent defense (110 is league ORtg anchor)
  const awayORtgAdj = awayORtgLast10 * (leagueORtg / homeDRtgSeason)
  const homeORtgAdj = homeORtgLast10 * (leagueORtg / awayDRtgSeason)
  
  // Combined form delta vs league baseline
  const formDeltaPer100 = (awayORtgAdj + homeORtgAdj) - (2 * leagueORtg)
  
  // Normalize to z-score (±10 ORtg ≈ significant)
  const z = clamp(formDeltaPer100 / 10, -1, 1)
  const points = normalizeToPoints(z, 1.0) // maxPoints = 1.0
  const { away, home } = splitPointsEvenly(points)
  
  return {
    factor_no: 2,
    key: 'offForm',
    name: 'Offensive Form vs Opp',
    normalized_value: z,
    raw_values_json: {
      awayORtgLast10,
      homeORtgLast10,
      awayDRtgSeason,
      homeDRtgSeason,
      leagueORtg
    },
    parsed_values_json: {
      awayORtgAdj,
      homeORtgAdj,
      formDeltaPer100,
      z,
      points,
      awayContribution: away,
      homeContribution: home
    },
    caps_applied: Math.abs(z) >= 1,
    cap_reason: Math.abs(z) >= 1 ? 'z-score clamped to ±1' : null,
    notes: `Combined ORtg: ${(awayORtgAdj + homeORtgAdj).toFixed(1)} vs league ${(2 * leagueORtg).toFixed(1)}`
  }
}

/**
 * F3: Defensive Erosion (DRtg + Availability) 🛡️
 * Are key defenders out or playing hurt? Combine DRtg form with injury news
 */
export function computeDefensiveErosion(
  bundle: StatMuseBundle, 
  injuryImpact: InjuryImpact, 
  ctx: RunCtx
): FactorComputation {
  const { awayDRtgSeason, homeDRtgSeason, leagueDRtg } = bundle
  const { away: awayInjury, home: homeInjury } = injuryImpact
  
  // DRtg delta from league average (worse defense = positive)
  const awayDrDelta = (awayDRtgSeason - leagueDRtg) / 8
  const homeDrDelta = (homeDRtgSeason - leagueDRtg) / 8
  
  // Combine DRtg form (70%) with injury impact (30%)
  const awayErosion = 0.7 * awayDrDelta + 0.3 * awayInjury
  const homeErosion = 0.7 * homeDrDelta + 0.3 * homeInjury
  
  // Average erosion for both teams
  const erosion = (awayErosion + homeErosion) / 2
  
  // Normalize to z-score
  const z = clamp(erosion, -1, 1)
  const points = normalizeToPoints(z, 1.0) // maxPoints = 1.0
  const { away, home } = splitPointsEvenly(points)
  
  return {
    factor_no: 3,
    key: 'defErosion',
    name: 'Defensive Erosion',
    normalized_value: z,
    raw_values_json: {
      awayDRtgSeason,
      homeDRtgSeason,
      leagueDRtg,
      awayInjury,
      homeInjury
    },
    parsed_values_json: {
      awayDrDelta,
      homeDrDelta,
      awayErosion,
      homeErosion,
      erosion,
      z,
      points,
      awayContribution: away,
      homeContribution: home
    },
    caps_applied: Math.abs(z) >= 1,
    cap_reason: Math.abs(z) >= 1 ? 'z-score clamped to ±1' : null,
    notes: `Erosion: ${erosion.toFixed(2)} (DRtg: ${awayDrDelta.toFixed(2)}/${homeDrDelta.toFixed(2)}, Injury: ${awayInjury.toFixed(2)}/${homeInjury.toFixed(2)})`
  }
}

/**
 * F4: 3-Point Environment & Volatility 🏹
 * Combined 3PA rate and recent 3P variance
 */
export function computeThreePointEnv(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { 
    away3PAR, home3PAR, awayOpp3PAR, homeOpp3PAR,
    away3PctLast10, home3PctLast10,
    league3PAR, league3Pstdev 
  } = bundle
  
  // Environment rate (average of all 3PA rates)
  const envRate = (away3PAR + home3PAR + awayOpp3PAR + homeOpp3PAR) / 4
  const rateDelta = envRate - league3PAR
  
  // Hot variance (recent 3P% volatility vs league)
  const recent3Pct = [away3PctLast10, home3PctLast10]
  const recentStdev = Math.sqrt(
    recent3Pct.reduce((sum, val, i, arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length
      return sum + Math.pow(val - mean, 2)
    }, 0) / recent3Pct.length
  )
  const hotVar = Math.max(0, recentStdev - league3Pstdev)
  
  // Combined z-score (weight rate 2x more than variance)
  const z = clamp((2 * rateDelta + hotVar), -1, 1)
  const points = normalizeToPoints(z, 1.0) // maxPoints = 1.0
  const { away, home } = splitPointsEvenly(points)
  
  return {
    factor_no: 4,
    key: 'threeEnv',
    name: '3PT Environment',
    normalized_value: z,
    raw_values_json: {
      away3PAR,
      home3PAR,
      awayOpp3PAR,
      homeOpp3PAR,
      away3PctLast10,
      home3PctLast10,
      league3PAR,
      league3Pstdev
    },
    parsed_values_json: {
      envRate,
      rateDelta,
      recentStdev,
      hotVar,
      z,
      points,
      awayContribution: away,
      homeContribution: home
    },
    caps_applied: Math.abs(z) >= 1,
    cap_reason: Math.abs(z) >= 1 ? 'z-score clamped to ±1' : null,
    notes: `Env rate: ${envRate.toFixed(3)} vs league ${league3PAR.toFixed(3)}, Var: ${hotVar.toFixed(3)}`
  }
}

/**
 * F5: Free-Throw/Whistle Environment ⛹️‍♂️
 * Free throws stop the clock and add "free" points
 */
export function computeWhistleEnv(bundle: StatMuseBundle, ctx: RunCtx): FactorComputation {
  const { awayFTr, homeFTr, awayOppFTr, homeOppFTr, leagueFTr } = bundle
  
  // Environment FTr (average of all FTr rates)
  const ftrEnv = (awayFTr + homeFTr + awayOppFTr + homeOppFTr) / 4
  const ftrDelta = ftrEnv - leagueFTr
  
  // Normalize to z-score (±0.06 FTr ≈ significant)
  const z = clamp(ftrDelta / 0.06, -1, 1)
  const points = normalizeToPoints(z, 1.0) // maxPoints = 1.0
  const { away, home } = splitPointsEvenly(points)
  
  return {
    factor_no: 5,
    key: 'whistleEnv',
    name: 'FT/Whistle Env',
    normalized_value: z,
    raw_values_json: {
      awayFTr,
      homeFTr,
      awayOppFTr,
      homeOppFTr,
      leagueFTr
    },
    parsed_values_json: {
      ftrEnv,
      ftrDelta,
      z,
      points,
      awayContribution: away,
      homeContribution: home
    },
    caps_applied: Math.abs(z) >= 1,
    cap_reason: Math.abs(z) >= 1 ? 'z-score clamped to ±1' : null,
    notes: `FTr env: ${ftrEnv.toFixed(3)} vs league ${leagueFTr.toFixed(3)}`
  }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Main entry point: compute all 5 NBA totals factors
 */
export async function computeTotalsFactors(ctx: RunCtx): Promise<{
  factors: FactorComputation[]
  factor_version: string
  totals_debug: {
    league_anchors: {
      pace: number
      ORtg: number
      DRtg: number
      threePAR: number
      FTr: number
      threePstdev: number
    }
    injury_impact: InjuryImpact
    factor_keys: string[]
    console_logs: {
      branch_used: { sport: string; betType: string }
      bundle: StatMuseBundle
      rows_z_points: Array<{ key: string; z: number; pts: number }>
    }
  }
}> {
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
    computeDefensiveErosion(bundle, injuryImpact, ctx),
    computeThreePointEnv(bundle, ctx),
    computeWhistleEnv(bundle, ctx),
  ]
  
  // Apply factor weights if provided
  const factorWeights = ctx.factorWeights || {}
  const weightedFactors = factors.map(factor => {
    const weight = factorWeights[factor.key] || 20 // Default 20% if not specified
    const weightDecimal = weight / 100
    
    // Scale the points by the weight (base max points = 1.0, so 100% weight = 1.0 points)
    // But we want 100% weight to equal 5.0 total points, so multiply by 5
    const weightedPoints = factor.parsed_values_json.points * weightDecimal * 5
    const weightedAway = factor.parsed_values_json.awayContribution * weightDecimal * 5
    const weightedHome = factor.parsed_values_json.homeContribution * weightDecimal * 5
    
    return {
      ...factor,
      weight_total_pct: weight,
      parsed_values_json: {
        ...factor.parsed_values_json,
        points: weightedPoints,
        awayContribution: weightedAway,
        homeContribution: weightedHome
      }
    }
  })
  
  const rowsLog = weightedFactors.map(f => ({ 
    key: f.key, 
    z: f.normalized_value, 
    pts: f.parsed_values_json?.points ?? 0,
    weight: f.weight_total_pct
  }))
  console.debug('[totals:rows:z-points]', rowsLog)
  
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
        threePstdev: bundle.league3Pstdev,
      },
      injury_impact: injuryImpact,
      factor_keys: factors.map(f => f.key),
      console_logs: {
        branch_used: branchLog,
        bundle: bundle,
        rows_z_points: rowsLog
      }
    }
  }
}
