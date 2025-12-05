/**
 * S3: Shooting Efficiency + Clutch Momentum
 *
 * Combines shooting efficiency (eFG% + FTr) with recent performance momentum
 * to predict spread outcomes. Teams that shoot efficiently AND are trending up
 * are more likely to beat the spread.
 *
 * SPREAD FACTOR - Returns awayScore/homeScore (NOT overScore/underScore)
 */

import { NBAStatsBundle, RunCtx } from './types'

/**
 * Calculate shooting efficiency + momentum points for SPREAD prediction
 *
 * Formula:
 * 1. Shooting Efficiency (60% weight):
 *    - eFG% (70%) + FTr (30%) = Shooting Score
 *    - Differential = Away Shooting Score - Home Shooting Score
 *
 * 2. Clutch Momentum (40% weight):
 *    - Compare last 3 games ORtg vs last 10 games ORtg
 *    - Positive momentum = team heating up (better recent performance)
 *    - Negative momentum = team cooling down (worse recent performance)
 *    - Differential = Away Momentum - Home Momentum
 *
 * 3. Combined Signal:
 *    - Efficiency Signal (60%) + Momentum Signal (40%)
 *    - Apply tanh scaling for smooth saturation
 *
 * Positive signal → Away team advantage
 * Negative signal → Home team advantage
 */
export function calculateShootingEfficiencyMomentumPoints(params: {
  awayEfg: number
  awayFtr: number
  awayORtgLast3: number
  awayORtgLast10: number
  homeEfg: number
  homeFtr: number
  homeORtgLast3: number
  homeORtgLast10: number
}): {
  signal: number
  awayScore: number
  homeScore: number
  shootingDiff: number
  momentumDiff: number
  awayShootingScore: number
  homeShootingScore: number
  awayMomentum: number
  homeMomentum: number
  efficiencySignal: number
  momentumSignal: number
} {
  const {
    awayEfg,
    awayFtr,
    awayORtgLast3,
    awayORtgLast10,
    homeEfg,
    homeFtr,
    homeORtgLast3,
    homeORtgLast10
  } = params

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Input parameters:', {
    awayEfg: awayEfg.toFixed(3),
    awayFtr: awayFtr.toFixed(3),
    awayORtgLast3: awayORtgLast3.toFixed(1),
    awayORtgLast10: awayORtgLast10.toFixed(1),
    homeEfg: homeEfg.toFixed(3),
    homeFtr: homeFtr.toFixed(3),
    homeORtgLast3: homeORtgLast3.toFixed(1),
    homeORtgLast10: homeORtgLast10.toFixed(1)
  })

  // Component 1: Shooting Efficiency (eFG% 70% + FTr 30%)
  const awayShootingScore = (awayEfg * 0.7) + (awayFtr * 0.3)
  const homeShootingScore = (homeEfg * 0.7) + (homeFtr * 0.3)
  const shootingDiff = awayShootingScore - homeShootingScore

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Shooting efficiency:', {
    awayShootingScore: awayShootingScore.toFixed(3),
    homeShootingScore: homeShootingScore.toFixed(3),
    shootingDiff: shootingDiff.toFixed(3)
  })

  // Component 2: Clutch Momentum (recent 3 games vs 10 games)
  // Positive momentum = heating up (last 3 > last 10)
  // Negative momentum = cooling down (last 3 < last 10)
  const awayMomentum = awayORtgLast10 > 0 ? (awayORtgLast3 - awayORtgLast10) / awayORtgLast10 : 0
  const homeMomentum = homeORtgLast10 > 0 ? (homeORtgLast3 - homeORtgLast10) / homeORtgLast10 : 0
  const momentumDiff = awayMomentum - homeMomentum

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Momentum analysis:', {
    awayMomentum: (awayMomentum * 100).toFixed(1) + '%',
    homeMomentum: (homeMomentum * 100).toFixed(1) + '%',
    momentumDiff: (momentumDiff * 100).toFixed(1) + '%',
    awayTrend: awayMomentum > 0 ? 'HEATING UP' : awayMomentum < 0 ? 'COOLING DOWN' : 'STABLE',
    homeTrend: homeMomentum > 0 ? 'HEATING UP' : homeMomentum < 0 ? 'COOLING DOWN' : 'STABLE'
  })

  // Combine signals with proper weighting
  const efficiencySignal = shootingDiff * 100 // Scale to points impact
  const momentumSignal = momentumDiff * 50 // Scale momentum impact (50 points = 100% momentum swing)
  const combinedSignal = (efficiencySignal * 0.6) + (momentumSignal * 0.4)

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Signal combination:', {
    efficiencySignal: efficiencySignal.toFixed(2),
    momentumSignal: momentumSignal.toFixed(2),
    combinedSignal: combinedSignal.toFixed(2)
  })

  // Apply tanh scaling for smooth saturation
  // Dividing by 6.0 means ±6 point impact reaches ~76% saturation
  const signal = Math.tanh(combinedSignal / 6.0)

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Scaled signal:', {
    signal: signal.toFixed(3),
    direction: signal > 0 ? 'AWAY' : signal < 0 ? 'HOME' : 'NEUTRAL'
  })

  // Convert to awayScore/homeScore (max 5.0 points each)
  const awayScore = signal > 0 ? Math.abs(signal) * 5.0 : 0
  const homeScore = signal < 0 ? Math.abs(signal) * 5.0 : 0

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Final scores:', {
    awayScore: awayScore.toFixed(2),
    homeScore: homeScore.toFixed(2)
  })

  return {
    signal,
    awayScore,
    homeScore,
    shootingDiff,
    momentumDiff,
    awayShootingScore,
    homeShootingScore,
    awayMomentum,
    homeMomentum,
    efficiencySignal,
    momentumSignal
  }
}

/**
 * Compute S3 (Shooting Efficiency + Momentum) for orchestrator
 * Fetches last 3 games data for momentum calculation
 */
export function computeShootingEfficiencyMomentum(bundle: NBAStatsBundle, ctx: RunCtx): any {
  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Computing shooting efficiency + momentum...')

  // Validate required data from bundle (last 10 games AND last 3 games for momentum)
  // Use typeof checks to allow 0 values (which are valid) while catching undefined/null
  if (typeof bundle.awayEfg !== 'number' || typeof bundle.awayFtr !== 'number' ||
    typeof bundle.homeEfg !== 'number' || typeof bundle.homeFtr !== 'number' ||
    typeof bundle.awayORtgLast10 !== 'number' || typeof bundle.homeORtgLast10 !== 'number' ||
    typeof bundle.awayORtgLast3 !== 'number' || typeof bundle.homeORtgLast3 !== 'number') {
    console.error('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Missing data:', {
      awayEfg: bundle.awayEfg,
      awayFtr: bundle.awayFtr,
      homeEfg: bundle.homeEfg,
      homeFtr: bundle.homeFtr,
      awayORtgLast10: bundle.awayORtgLast10,
      homeORtgLast10: bundle.homeORtgLast10,
      awayORtgLast3: bundle.awayORtgLast3,
      homeORtgLast3: bundle.homeORtgLast3
    })
    throw new Error('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Missing shooting efficiency or momentum data in bundle')
  }

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Using bundle data for momentum:', {
    awayORtg3: bundle.awayORtgLast3.toFixed(1),
    homeORtg3: bundle.homeORtgLast3.toFixed(1)
  })

  const result = calculateShootingEfficiencyMomentumPoints({
    awayEfg: bundle.awayEfg,
    awayFtr: bundle.awayFtr,
    awayORtgLast3: bundle.awayORtgLast3,
    awayORtgLast10: bundle.awayORtgLast10,
    homeEfg: bundle.homeEfg,
    homeFtr: bundle.homeFtr,
    homeORtgLast3: bundle.homeORtgLast3,
    homeORtgLast10: bundle.homeORtgLast10
  })

  console.log('[S3:SHOOTING_EFFICIENCY_MOMENTUM] Result:', {
    signal: result.signal.toFixed(3),
    awayScore: result.awayScore.toFixed(2),
    homeScore: result.homeScore.toFixed(2),
    shootingDiff: result.shootingDiff.toFixed(3),
    momentumDiff: (result.momentumDiff * 100).toFixed(1) + '%'
  })

  // Return in the format expected by the orchestrator
  return {
    key: 'shootingEfficiencyMomentum',
    name: 'Shooting Efficiency + Momentum',
    shortName: 'SHOOT',
    normalized_value: parseFloat(result.signal.toFixed(3)),
    parsed_values_json: {
      points: Math.max(result.awayScore, result.homeScore),
      awayScore: parseFloat(result.awayScore.toFixed(2)),
      homeScore: parseFloat(result.homeScore.toFixed(2)),
      signal: parseFloat(result.signal.toFixed(3))
    },
    raw_values_json: {
      shootingDiff: parseFloat(result.shootingDiff.toFixed(3)),
      momentumDiff: parseFloat(result.momentumDiff.toFixed(3)),
      awayShootingScore: parseFloat(result.awayShootingScore.toFixed(3)),
      homeShootingScore: parseFloat(result.homeShootingScore.toFixed(3)),
      awayMomentum: parseFloat(result.awayMomentum.toFixed(3)),
      homeMomentum: parseFloat(result.homeMomentum.toFixed(3)),
      efficiencySignal: parseFloat(result.efficiencySignal.toFixed(2)),
      momentumSignal: parseFloat(result.momentumSignal.toFixed(2)),
      awayTrend: result.awayMomentum > 0.02 ? 'HEATING_UP' : result.awayMomentum < -0.02 ? 'COOLING_DOWN' : 'STABLE',
      homeTrend: result.homeMomentum > 0.02 ? 'HEATING_UP' : result.homeMomentum < -0.02 ? 'COOLING_DOWN' : 'STABLE'
    },
    caps_applied: false,
    cap_reason: null,
    notes: `Shooting: ${result.shootingDiff > 0 ? 'Away' : 'Home'} +${Math.abs(result.shootingDiff).toFixed(3)} | Momentum: ${result.momentumDiff > 0 ? 'Away' : 'Home'} ${(result.momentumDiff * 100).toFixed(1)}%`
  }
}

