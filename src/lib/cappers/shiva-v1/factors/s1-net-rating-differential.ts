/**
 * Net Rating Differential Factor (S1)
 * 
 * Calculates expected point margin based on net rating differential
 * Compares to spread line to determine edge
 * 
 * Net Rating = Offensive Rating - Defensive Rating
 * Expected Margin = (Away Net Rating - Home Net Rating) * (Pace / 100)
 * 
 * Signal Interpretation:
 * - Positive signal → Favors AWAY team
 * - Negative signal → Favors HOME team
 */

export interface NetRatingDiffInput {
  awayORtg: number
  awayDRtg: number
  homeORtg: number
  homeDRtg: number
  pace: number
  spreadLine?: number // Optional: spread line for edge calculation (e.g., -4.5 means home favored by 4.5)
}

export interface NetRatingDiffOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayNetRtg: number
    homeNetRtg: number
    netRatingDiff: number
    expectedMargin: number
    spreadEdge?: number
    reason?: string
  }
}

/**
 * Helper function to clamp a value between min and max
 */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * Helper function to calculate hyperbolic tangent
 */
function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

/**
 * Calculate net rating differential factor points
 * 
 * @param input - Team ratings and pace data
 * @returns Away/Home scores and debugging metadata
 */
export function calculateNetRatingDiffPoints(input: NetRatingDiffInput): NetRatingDiffOutput {
  const { awayORtg, awayDRtg, homeORtg, homeDRtg, pace, spreadLine } = input
  const MAX_POINTS = 5.0
  const SCALE = 3.5 // Scaling factor for tanh (3.5 points = strong signal) - reduced from 8.0 for better sensitivity

  // Input validation
  if (![awayORtg, awayDRtg, homeORtg, homeDRtg, pace].every(v => Number.isFinite(v) && v > 0)) {
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayNetRtg: 0,
        homeNetRtg: 0,
        netRatingDiff: 0,
        expectedMargin: 0,
        reason: 'bad_input'
      }
    }
  }

  // Calculate net ratings
  const awayNetRtg = awayORtg - awayDRtg
  const homeNetRtg = homeORtg - homeDRtg

  // Calculate net rating differential (positive = away advantage)
  const netRatingDiff = awayNetRtg - homeNetRtg

  // Calculate expected margin (adjusted for pace)
  // Formula: netRatingDiff * (pace / 100)
  // Example: +5 net rating diff at 100 pace = +5 point expected margin
  const expectedMargin = netRatingDiff * (pace / 100)

  // Calculate spread edge if spread line is provided
  let spreadEdge: number | undefined
  let edgeForSignal = expectedMargin // Default to expected margin

  if (spreadLine !== undefined) {
    // Spread line is from home perspective (negative = home favored, positive = away favored)
    // Expected margin is from away perspective (positive = away wins, negative = home wins)
    // Direct subtraction gives us the edge
    // Example: spreadLine=+4 (away favored by 4), expectedMargin=-2 (home wins by 2) → edge=-6 (home undervalued)

    // Calculate edge: how much better is our expected margin vs the spread?
    // Positive edge = away team has value
    // Negative edge = home team has value
    spreadEdge = expectedMargin - spreadLine
    edgeForSignal = spreadEdge
  }

  // Safety cap for extreme outliers
  const cappedEdge = clamp(edgeForSignal, -20, 20)

  // Calculate signal using tanh for smooth saturation
  // Positive signal = away advantage, negative signal = home advantage
  const rawSignal = tanh(cappedEdge / SCALE)
  const signal = clamp(rawSignal, -1, 1)

  // Convert to single positive scores for one direction
  let awayScore = 0
  let homeScore = 0

  if (signal > 0) {
    // Positive signal favors AWAY team
    awayScore = Math.abs(signal) * MAX_POINTS
  } else if (signal < 0) {
    // Negative signal favors HOME team
    homeScore = Math.abs(signal) * MAX_POINTS
  }
  // signal = 0 means neutral, both scores remain 0

  return {
    awayScore,
    homeScore,
    signal,
    meta: {
      awayNetRtg,
      homeNetRtg,
      netRatingDiff,
      expectedMargin,
      spreadEdge
    }
  }
}

/**
 * Legacy wrapper function for compatibility with orchestrator
 * Integrates with the existing factor computation pipeline
 */
export function computeNetRatingDifferential(bundle: any, ctx: any): any {
  // Handle case where bundle is null (factor disabled)
  if (!bundle) {
    return {
      factor_no: 1,
      key: 'netRatingDiff',
      name: 'Net Rating Differential',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        points: 0,
        awayScore: 0,
        homeScore: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Extract data from bundle
  const awayORtg = bundle.awayORtgLast10 || 110.0
  const awayDRtg = bundle.awayDRtgSeason || 110.0
  const homeORtg = bundle.homeORtgLast10 || 110.0
  const homeDRtg = bundle.homeDRtgSeason || 110.0
  const pace = bundle.leaguePace || 100.1

  // Get spread line from context if available
  const spreadLine = ctx.spreadLine // Optional: may be undefined

  // Use the calculation function
  const result = calculateNetRatingDiffPoints({
    awayORtg,
    awayDRtg,
    homeORtg,
    homeDRtg,
    pace,
    spreadLine
  })

  // Build notes string
  let notes = `NetRtg: Away ${result.meta.awayNetRtg.toFixed(1)} vs Home ${result.meta.homeNetRtg.toFixed(1)} (Δ${result.meta.netRatingDiff.toFixed(1)})`
  if (result.meta.spreadEdge !== undefined) {
    notes += ` | Edge: ${result.meta.spreadEdge > 0 ? '+' : ''}${result.meta.spreadEdge.toFixed(1)}`
  }

  return {
    factor_no: 1,
    key: 'netRatingDiff',
    name: 'Net Rating Differential',
    normalized_value: result.signal,
    raw_values_json: {
      awayORtg,
      awayDRtg,
      homeORtg,
      homeDRtg,
      awayNetRtg: result.meta.awayNetRtg,
      homeNetRtg: result.meta.homeNetRtg,
      netRatingDiff: result.meta.netRatingDiff,
      expectedMargin: result.meta.expectedMargin,
      spreadLine,
      spreadEdge: result.meta.spreadEdge,
      pace
    },
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal
    },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

