/**
 * S4: Home/Away Performance Splits (SPREAD)
 *
 * Measures how well each team performs in their current game context:
 * - Away team: How do they perform on the ROAD vs at HOME?
 * - Home team: How do they perform at HOME vs on the ROAD?
 *
 * Formula:
 * - Away Road Edge = Away team's road NetRtg (away ORtg - away DRtg)
 * - Home Home Edge = Home team's home NetRtg (home ORtg - home DRtg)
 * - Context Advantage = Away Road NetRtg - Home Home NetRtg
 *
 * ATS Predictive Value:
 * - Teams with strong road records traveling → better cover rate
 * - Teams with strong home records hosting → better cover rate
 * - The differential shows which team has the bigger contextual advantage
 *
 * Data Source: MySportsFeeds team_gamelogs API (last 10 games, split by venue)
 */

import { NBAStatsBundle, RunCtx } from './types'

function tanh(x: number): number {
  if (x > 20) return 1
  if (x < -20) return -1
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export interface HomeAwaySplitsInput {
  // Away team's performance when playing AWAY
  awayORtgAway: number
  awayDRtgAway: number
  // Home team's performance when playing HOME
  homeORtgHome: number
  homeDRtgHome: number
}

export interface HomeAwaySplitsOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayRoadNetRtg: number
    homeHomeNetRtg: number
    contextAdvantage: number
    awayRoadStrength: string
    homeHomeStrength: string
  }
}

/**
 * Calculate home/away performance splits points
 *
 * @param input - Home/Away ORtg and DRtg for both teams
 * @returns Points awarded to away/home based on contextual performance
 */
export function calculateHomeAwaySplitsPoints(input: HomeAwaySplitsInput): HomeAwaySplitsOutput {
  const MAX_POINTS = 5.0
  const SCALE = 6.0 // Scaling factor for tanh (6 point differential = strong signal)

  // Validate inputs - if any are missing/invalid, return neutral
  if (
    !Number.isFinite(input.awayORtgAway) || input.awayORtgAway <= 0 ||
    !Number.isFinite(input.awayDRtgAway) || input.awayDRtgAway <= 0 ||
    !Number.isFinite(input.homeORtgHome) || input.homeORtgHome <= 0 ||
    !Number.isFinite(input.homeDRtgHome) || input.homeDRtgHome <= 0
  ) {
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayRoadNetRtg: 0,
        homeHomeNetRtg: 0,
        contextAdvantage: 0,
        awayRoadStrength: 'Unknown',
        homeHomeStrength: 'Unknown'
      }
    }
  }

  // Calculate Net Ratings in their respective contexts
  // Away team: How good are they when playing AWAY?
  const awayRoadNetRtg = input.awayORtgAway - input.awayDRtgAway

  // Home team: How good are they when playing HOME?
  const homeHomeNetRtg = input.homeORtgHome - input.homeDRtgHome

  // Context advantage: positive = away team has better contextual performance
  // This compares how each team performs in THIS game's specific context
  const contextAdvantage = awayRoadNetRtg - homeHomeNetRtg

  // Categorize performance strength
  const awayRoadStrength = awayRoadNetRtg > 5 ? 'Strong Road' 
    : awayRoadNetRtg > 0 ? 'Good Road'
    : awayRoadNetRtg > -5 ? 'Average Road' 
    : 'Weak Road'

  const homeHomeStrength = homeHomeNetRtg > 5 ? 'Strong Home'
    : homeHomeNetRtg > 0 ? 'Good Home'
    : homeHomeNetRtg > -5 ? 'Average Home'
    : 'Weak Home'

  // Apply tanh scaling for smooth saturation
  // Positive contextAdvantage → away team has edge in this context
  const signal = clamp(tanh(contextAdvantage / SCALE), -1, 1)

  // Award points based on signal direction
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive signal = away team has contextual advantage
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal = home team has contextual advantage
    homeScore = Math.abs(signal) * MAX_POINTS
  }

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayRoadNetRtg,
      homeHomeNetRtg,
      contextAdvantage,
      awayRoadStrength,
      homeHomeStrength
    }
  }
}

/**
 * Compute S4 (Home/Away Performance Splits) for orchestrator
 */
export function computeHomeAwaySplits(bundle: NBAStatsBundle, ctx: RunCtx): any {
  // Extract home/away performance data
  // Away team's performance when playing AWAY
  const awayORtgAway = bundle.awayORtgAway
  const awayDRtgAway = bundle.awayDRtgAway
  // Home team's performance when playing HOME
  const homeORtgHome = bundle.homeORtgHome
  const homeDRtgHome = bundle.homeDRtgHome

  // Check if we have sufficient data
  if (!awayORtgAway || !awayDRtgAway || !homeORtgHome || !homeDRtgHome) {
    console.warn('[S4] Missing home/away split data - returning neutral factor')
    return {
      factor_no: 4,
      key: 'homeAwaySplits',
      name: 'Home/Away Performance Splits',
      normalized_value: 0,
      raw_values_json: {
        awayORtgAway: awayORtgAway || 'missing',
        awayDRtgAway: awayDRtgAway || 'missing',
        homeORtgHome: homeORtgHome || 'missing',
        homeDRtgHome: homeDRtgHome || 'missing',
        dataAvailable: false
      },
      parsed_values_json: {
        points: 0,
        awayScore: 0,
        homeScore: 0,
        signal: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Insufficient home/away split data (need at least 1 home and 1 away game for each team)'
    }
  }

  const result = calculateHomeAwaySplitsPoints({
    awayORtgAway,
    awayDRtgAway,
    homeORtgHome,
    homeDRtgHome
  })

  return {
    factor_no: 4,
    key: 'homeAwaySplits',
    name: 'Home/Away Performance Splits',
    normalized_value: result.signal,
    raw_values_json: {
      awayORtgAway,
      awayDRtgAway,
      homeORtgHome,
      homeDRtgHome,
      awayRoadNetRtg: result.meta.awayRoadNetRtg,
      homeHomeNetRtg: result.meta.homeHomeNetRtg,
      contextAdvantage: result.meta.contextAdvantage
    },
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal
    },
    caps_applied: false,
    cap_reason: null,
    notes: `Away Road: ${result.meta.awayRoadStrength} (NetRtg ${result.meta.awayRoadNetRtg.toFixed(1)}), Home Home: ${result.meta.homeHomeStrength} (NetRtg ${result.meta.homeHomeNetRtg.toFixed(1)})`
  }
}

