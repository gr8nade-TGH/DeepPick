/**
 * SHIVA v1 Math Engine
 * Core mathematical functions for factor computation and confidence calculation
 */

// League averages and constants
export const LEAGUE_AVERAGES = {
  NBA: {
    pace: 100.1,
    ORtg: 110.0,
    DRtg: 110.0,
    threePAR: 0.39,
    FTr: 0.22,
    threePstdev: 0.036
  }
} as const

// Mathematical helper functions
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

export function sigmoidScaled(x: number, scale: number = 2.5): number {
  return sigmoid(x * scale)
}

export function oddsToProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100)
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100)
  }
}

export function probabilityToOdds(prob: number): number {
  if (prob >= 0.5) {
    return (prob / (1 - prob)) * -100
  } else {
    return ((1 - prob) / prob) * 100
  }
}

// Legacy confidence calculation (Phase 3)
export function calculateLegacyConfidence(
  factors: Array<{ normalized_value: number; weight_total_pct: number }>
): number {
  const weightedSum = factors.reduce((sum, f) => sum + f.weight_total_pct * Math.abs(f.normalized_value), 0)
  return 5 * Math.min(1, weightedSum / 0.70)
}

// New edge-based confidence calculation (Phase 4)
export function calculateEdgeConfidence(
  factors: Array<{ normalized_value: number; weight_total_pct: number }>,
  scalingConstant: number = 2.5
): {
  edgeRaw: number
  edgePct: number
  confScore: number
} {
  // Calculate raw edge (directional sum)
  const edgeRaw = factors.reduce((sum, f) => sum + f.weight_total_pct * f.normalized_value, 0)
  
  // Convert to probability using sigmoid
  const edgePct = sigmoidScaled(edgeRaw, scalingConstant)
  
  // Scale to 0-5 visual scale
  const confScore = 5 * edgePct
  
  return {
    edgeRaw: Math.round(edgeRaw * 1000) / 1000, // Round to 3 decimal places
    edgePct: Math.round(edgePct * 1000) / 1000,
    confScore: Math.round(confScore * 100) / 100
  }
}

// Delta 100 calculation for legacy compatibility
export function delta100(
  f1: number, f2: number, f3: number, f4: number, f5: number,
  f6val: number, f7val: number,
  weights: {
    f1: number
    f2: number
    f3: number
    f4: number
    f5: number
    f6: number
    f7: number
  }
): number {
  return (
    f1 * weights.f1 +
    f2 * weights.f2 +
    f3 * weights.f3 +
    f4 * weights.f4 +
    f5 * weights.f5 +
    f6val * weights.f6 +
    f7val * weights.f7
  )
}

// Pace and prediction calculations
export function calculatePaceAndPredictions(
  paceExp: number,
  delta100: number,
  leagueAverages: typeof LEAGUE_AVERAGES.NBA
): {
  pace_exp: number
  delta_100_value: number
  spread_pred_points: number
  total_pred_points: number
  scores: { home_pts: number; away_pts: number }
  winner: string
  conf7_score_value: number
} {
  const spreadPred = delta100 * 0.5 // Convert delta100 to spread points
  const totalPred = paceExp + (delta100 * 0.1) // Adjust total based on pace and delta
  
  // Calculate individual scores (simplified)
  const homePts = Math.round(leagueAverages.ORtg + spreadPred)
  const awayPts = Math.round(leagueAverages.ORtg - spreadPred)
  
  return {
    pace_exp: Math.round(paceExp * 100) / 100,
    delta_100_value: Math.round(delta100 * 100) / 100,
    spread_pred_points: Math.round(spreadPred * 100) / 100,
    total_pred_points: Math.round(totalPred * 100) / 100,
    scores: {
      home_pts: homePts,
      away_pts: awayPts
    },
    winner: homePts > awayPts ? 'home' : 'away',
    conf7_score_value: Math.round(Math.abs(delta100) * 100) / 100
  }
}

// Market mismatch calculation
export function calculateMarketMismatch(
  predictedTotal: number,
  marketLine: number,
  confidence: number
): {
  mismatch_points: number
  mismatch_pct: number
  units: number
} {
  const mismatchPoints = predictedTotal - marketLine
  const mismatchPct = (mismatchPoints / marketLine) * 100
  
  // Units based on confidence and mismatch
  let units = 0
  if (Math.abs(mismatchPct) > 0.03) { // 3% threshold
    if (confidence >= 4.0) units = 3
    else if (confidence >= 3.0) units = 2
    else if (confidence >= 2.0) units = 1
  }
  
  return {
    mismatch_points: Math.round(mismatchPoints * 100) / 100,
    mismatch_pct: Math.round(mismatchPct * 100) / 100,
    units
  }
}

// Legacy math functions for compatibility
export function applyCap(value: number, cap: number): number {
  return clamp(value, -cap, cap)
}

export function paceHarmonic(homePace: number, awayPace: number): number {
  return 2 / (1/homePace + 1/awayPace)
}

export function spreadFromDelta(delta: number, pace: number): number {
  return delta * 0.5
}

export function totalFromORtgs(homeOrtg: number, awayOrtg: number, pace: number): number {
  return (homeOrtg + awayOrtg) * pace / 200
}

export function scoresFromSpreadTotal(spread: number, total: number): { home: number; away: number } {
  const home = (total + spread) / 2
  const away = (total - spread) / 2
  return { home: Math.round(home), away: Math.round(away) }
}

export function conf7(spread: number): number {
  return Math.abs(spread) * 0.1
}