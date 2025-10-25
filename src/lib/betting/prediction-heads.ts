/**
 * Three Prediction Heads
 * 
 * Per spec: "Three prediction heads (one per bet type)"
 * - Spread head: predicts Δspread_points
 * - Total head: predicts Δtotal_points  
 * - Moneyline head: predicts Δlogit
 * 
 * Each converts factor contributions → probability → EV → gating
 */

import type {
  PredictionHead,
  ThreePredictionHeads,
  SharpFactor,
  LeagueParameters,
  GameInput,
  ScorePrediction,
} from '@/types/sharp-betting'
import {
  phi,
  sigmoid,
  getFairMarketLogit,
  calculateEV,
  testSlippage,
  calculateEdgeAttribution,
  kellyToUnits,
  spreadToWinProb,
} from '@/lib/odds/math'

// ============================================================================
// PREDICTION HEADS CLASS
// ============================================================================

export class PredictionHeadsCalculator {
  private game: GameInput
  private scorePrediction: ScorePrediction
  private factors: SharpFactor[]
  private leagueParams: LeagueParameters

  constructor(
    game: GameInput,
    scorePrediction: ScorePrediction,
    factors: SharpFactor[],
    leagueParams: LeagueParameters
  ) {
    this.game = game
    this.scorePrediction = scorePrediction
    this.factors = factors
    this.leagueParams = leagueParams
  }

  /**
   * Calculate all three heads and select best pick
   */
  calculate(): ThreePredictionHeads {
    const spreadHead = this.calculateSpreadHead()
    const totalHead = this.calculateTotalHead()
    const moneylineHead = this.calculateMoneylineHead()

    // Rank by EV
    const heads = [spreadHead, totalHead, moneylineHead]
      .filter(h => h.overallThresholdMet)
      .sort((a, b) => b.expectedValue - a.expectedValue)

    heads.forEach((h, idx) => {
      h.rank = idx + 1
      h.isSelected = idx === 0
    })

    const bestPick = heads[0] || null
    const allMeetThreshold = heads.length > 0
    const highestEv = bestPick?.expectedValue ?? 0
    const recommendedBetType = bestPick?.betType ?? null

    return {
      spreadHead,
      totalHead,
      moneylineHead,
      bestPick,
      allMeetThreshold,
      highestEv,
      recommendedBetType,
    }
  }

  // ========================================================================
  // SPREAD HEAD
  // ========================================================================

  private calculateSpreadHead(): PredictionHead {
    // 1. Sum factors measured in points_spread
    const spreadFactors = this.factors.filter(f => f.unit === 'points_spread')
    const predictedDeviation = spreadFactors.reduce((sum, f) => sum + f.contribution, 0)

    // 2. Market baseline
    const marketLine = this.game.spread ?? 0
    const marketOdds = -110 // Typical spread odds
    const trueLine = marketLine + predictedDeviation

    // 3. Convert to probability
    // Φ(Δ / σ)
    const coverProbability = phi(predictedDeviation / this.scorePrediction.sigmaSpread)

    // Also derive win probability from spread
    const winProbability = spreadToWinProb(trueLine, this.scorePrediction.sigmaSpread)

    // 4. Calculate EV
    const offeredOdds = marketOdds // Use market odds (average)
    const expectedValue = calculateEV(coverProbability, offeredOdds)
    const evPercentage = expectedValue * 100

    // 5. Slippage test
    const slippageTest = testSlippage(coverProbability, offeredOdds, 3)

    // 6. Edge attribution
    const structuralFactors = spreadFactors.filter(f => f.category !== 'market')
    const priceFactors = spreadFactors.filter(f => f.category === 'market')
    const structuralDelta = structuralFactors.reduce((sum, f) => sum + f.contribution, 0)
    const priceDelta = priceFactors.reduce((sum, f) => sum + f.contribution, 0)
    const attribution = calculateEdgeAttribution(predictedDeviation, structuralDelta, priceDelta, 0.40)

    // 7. Threshold checks
    const meetsDeviationThreshold = Math.abs(predictedDeviation) >= this.leagueParams.minSpreadDeviation
    const meetsEvThreshold = expectedValue >= this.leagueParams.minEvSpread
    const meetsOddsThreshold = true // Spread is typically -110, always acceptable
    const overallThresholdMet =
      meetsDeviationThreshold &&
      meetsEvThreshold &&
      meetsOddsThreshold &&
      slippageTest.passesSlippageTest &&
      attribution.passesAttributionRule

    // 8. Threshold reason
    const reasons: string[] = []
    if (!meetsDeviationThreshold)
      reasons.push(`|Δ| ${Math.abs(predictedDeviation).toFixed(2)} < ${this.leagueParams.minSpreadDeviation}`)
    if (!meetsEvThreshold)
      reasons.push(`EV ${evPercentage.toFixed(2)}% < ${(this.leagueParams.minEvSpread * 100).toFixed(1)}%`)
    if (!slippageTest.passesSlippageTest)
      reasons.push('Fails slippage test')
    if (!attribution.passesAttributionRule)
      reasons.push(attribution.reason)

    const thresholdReason = overallThresholdMet ? 'All gates passed ✓' : reasons.join('; ')

    return {
      betType: 'spread',
      marketLine,
      marketOdds,
      marketImpliedProb: 0.5238, // -110 = 52.38% with vig
      predictedDeviation,
      trueLine,
      factors: spreadFactors,
      coverProbability,
      winProbability,
      leagueSigma: this.scorePrediction.sigmaSpread,
      offeredOdds,
      offeredImpliedProb: 0.5238,
      decimalPayout: 1.909, // -110
      expectedValue,
      evPercentage,
      meetsDeviationThreshold,
      meetsEvThreshold,
      meetsOddsThreshold,
      overallThresholdMet,
      thresholdReason,
      rank: 0, // Will be set later
      isSelected: false,
    }
  }

  // ========================================================================
  // TOTAL HEAD
  // ========================================================================

  private calculateTotalHead(): PredictionHead {
    // 1. Sum factors measured in points_total
    const totalFactors = this.factors.filter(f => f.unit === 'points_total')
    const predictedDeviation = totalFactors.reduce((sum, f) => sum + f.contribution, 0)

    // 2. Market baseline
    const marketLine = this.game.total ?? this.scorePrediction.trueTotal
    const marketOdds = -110
    const trueLine = marketLine + predictedDeviation

    // 3. Convert to probability (over)
    const coverProbability = phi(predictedDeviation / this.scorePrediction.sigmaTotal)

    // 4. Calculate EV
    const offeredOdds = marketOdds
    const expectedValue = calculateEV(coverProbability, offeredOdds)
    const evPercentage = expectedValue * 100

    // 5. Slippage test
    const slippageTest = testSlippage(coverProbability, offeredOdds, 3)

    // 6. Edge attribution
    const structuralFactors = totalFactors.filter(f => f.category !== 'market')
    const priceFactors = totalFactors.filter(f => f.category === 'market')
    const structuralDelta = structuralFactors.reduce((sum, f) => sum + f.contribution, 0)
    const priceDelta = priceFactors.reduce((sum, f) => sum + f.contribution, 0)
    const attribution = calculateEdgeAttribution(predictedDeviation, structuralDelta, priceDelta, 0.40)

    // 7. Threshold checks
    const meetsDeviationThreshold = Math.abs(predictedDeviation) >= this.leagueParams.minTotalDeviation
    const meetsEvThreshold = expectedValue >= this.leagueParams.minEvTotal
    const meetsOddsThreshold = true
    const overallThresholdMet =
      meetsDeviationThreshold &&
      meetsEvThreshold &&
      meetsOddsThreshold &&
      slippageTest.passesSlippageTest &&
      attribution.passesAttributionRule

    // 8. Threshold reason
    const reasons: string[] = []
    if (!meetsDeviationThreshold)
      reasons.push(`|Δ| ${Math.abs(predictedDeviation).toFixed(2)} < ${this.leagueParams.minTotalDeviation}`)
    if (!meetsEvThreshold)
      reasons.push(`EV ${evPercentage.toFixed(2)}% < ${(this.leagueParams.minEvTotal * 100).toFixed(1)}%`)
    if (!slippageTest.passesSlippageTest)
      reasons.push('Fails slippage test')
    if (!attribution.passesAttributionRule)
      reasons.push(attribution.reason)

    const thresholdReason = overallThresholdMet ? 'All gates passed ✓' : reasons.join('; ')

    return {
      betType: 'total',
      marketLine,
      marketOdds,
      marketImpliedProb: 0.5238,
      predictedDeviation,
      trueLine,
      factors: totalFactors,
      coverProbability,
      winProbability: coverProbability, // For total, "win" = over
      leagueSigma: this.scorePrediction.sigmaTotal,
      offeredOdds,
      offeredImpliedProb: 0.5238,
      decimalPayout: 1.909,
      expectedValue,
      evPercentage,
      meetsDeviationThreshold,
      meetsEvThreshold,
      meetsOddsThreshold,
      overallThresholdMet,
      thresholdReason,
      rank: 0,
      isSelected: false,
    }
  }

  // ========================================================================
  // MONEYLINE HEAD
  // ========================================================================

  private calculateMoneylineHead(): PredictionHead {
    // 1. Sum factors measured in logodds_win
    const mlFactors = this.factors.filter(f => f.unit === 'logodds_win')
    const predictedDeviation = mlFactors.reduce((sum, f) => sum + f.contribution, 0)

    // 2. Market baseline (log-odds, vig-removed)
    const homeOdds = this.game.homeMoneyline ?? -110
    const awayOdds = this.game.awayMoneyline ?? -110
    const marketLogit = getFairMarketLogit(homeOdds, awayOdds)
    const trueLine = marketLogit + predictedDeviation

    // 3. Convert to probability
    const winProbability = sigmoid(trueLine)

    // 4. Calculate EV
    const offeredOdds = homeOdds // Betting on home team
    const expectedValue = calculateEV(winProbability, offeredOdds)
    const evPercentage = expectedValue * 100

    // 5. Slippage test
    const slippageTest = testSlippage(winProbability, offeredOdds, 3)

    // 6. Edge attribution
    const structuralFactors = mlFactors.filter(f => f.category !== 'market')
    const priceFactors = mlFactors.filter(f => f.category === 'market')
    const structuralDelta = structuralFactors.reduce((sum, f) => sum + f.contribution, 0)
    const priceDelta = priceFactors.reduce((sum, f) => sum + f.contribution, 0)
    const attribution = calculateEdgeAttribution(predictedDeviation, structuralDelta, priceDelta, 0.40)

    // 7. Threshold checks
    const isFavorite = homeOdds < 0
    const minEv = isFavorite ? this.leagueParams.minEvMoneylineFav : this.leagueParams.minEvMoneylineDog

    const meetsDeviationThreshold = true // No magnitude requirement for ML
    const meetsEvThreshold = expectedValue >= minEv
    const meetsOddsThreshold =
      !isFavorite || (isFavorite && homeOdds >= this.leagueParams.maxMoneylineLay)
    const overallThresholdMet =
      meetsDeviationThreshold &&
      meetsEvThreshold &&
      meetsOddsThreshold &&
      slippageTest.passesSlippageTest &&
      attribution.passesAttributionRule

    // 8. Threshold reason
    const reasons: string[] = []
    if (!meetsEvThreshold)
      reasons.push(`EV ${evPercentage.toFixed(2)}% < ${(minEv * 100).toFixed(1)}%`)
    if (!meetsOddsThreshold)
      reasons.push(`Laying ${homeOdds} worse than ${this.leagueParams.maxMoneylineLay}`)
    if (!slippageTest.passesSlippageTest)
      reasons.push('Fails slippage test')
    if (!attribution.passesAttributionRule)
      reasons.push(attribution.reason)

    const thresholdReason = overallThresholdMet ? 'All gates passed ✓' : reasons.join('; ')

    return {
      betType: 'moneyline',
      marketLine: marketLogit,
      marketOdds: homeOdds,
      marketImpliedProb: 0.5,
      predictedDeviation,
      trueLine,
      factors: mlFactors,
      coverProbability: winProbability,
      winProbability,
      leagueSigma: 0, // Not applicable for ML
      offeredOdds: homeOdds,
      offeredImpliedProb: 0.5,
      decimalPayout: 1.909,
      expectedValue,
      evPercentage,
      meetsDeviationThreshold,
      meetsEvThreshold,
      meetsOddsThreshold,
      overallThresholdMet,
      thresholdReason,
      rank: 0,
      isSelected: false,
    }
  }
}

// ============================================================================
// COMBINE FACTORS UTILITY
// ============================================================================

/**
 * Combine factors into total contribution for a specific unit
 * Per spec: contrib_j = clip(w_j * effect_j, ±cap_j) × reliability_j
 */
export function combineFactors(factors: SharpFactor[], unit: 'points_spread' | 'points_total' | 'logodds_win'): number {
  return factors
    .filter(f => f.unit === unit)
    .reduce((sum, f) => sum + f.contribution, 0)
}

