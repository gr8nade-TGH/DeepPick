/**
 * Shiva NBA Engine (Score-First Approach)
 * 
 * Per spec: "Predict first, price second"
 * 
 * Flow:
 * 1. Score Prediction (pre-market) → true spread/total
 * 2. Factor Analysis → structural effects
 * 3. Three Prediction Heads → spread/total/ML
 * 4. EV Calculation → slippage test + edge attribution
 * 5. Gating → select best bet or pass
 * 6. Fractional Kelly → stake sizing
 */

import type { GameInput, ScorePrediction, SharpFactor, ThreePredictionHeads } from '@/types/sharp-betting'
import { NBAScoreModel } from './score-model'
import { NBAFactorCatalog } from './factor-catalog'
import { SharpFactorEngine, calculateReliability } from '@/lib/cappers/sharp-factor-engine'
import { PredictionHeadsCalculator } from '@/lib/betting/prediction-heads'
import { getDefaultLeagueParams } from '@/lib/cappers/sharp-factor-engine'
import { calculateKellyStake, kellyToUnits } from '@/lib/odds/math'

// ============================================================================
// SHIVA NBA ENGINE
// ============================================================================

export interface NBAEngineResult {
  scorePrediction: ScorePrediction
  factors: SharpFactor[]
  predictionHeads: ThreePredictionHeads
  pick: {
    betType: 'spread' | 'total' | 'moneyline' | null
    selection: string
    expectedValue: number
    evPercentage: number
    winProbability: number
    stake: number
    units: number
    trueLine: number
    marketLine: number
    deviation: number
    offeredOdds: number
  } | null
  noPick: boolean
  noPickReason: string
  log: {
    steps: Array<{
      step: number
      title: string
      description: string
      result?: string
      impact: 'positive' | 'negative' | 'neutral'
    }>
  }
}

export class ShivaNBAEngine {
  private scoreModel: NBAScoreModel
  private factorCatalog: NBAFactorCatalog
  private bankroll: number

  constructor(bankroll: number = 1000) {
    this.scoreModel = new NBAScoreModel()
    this.factorCatalog = new NBAFactorCatalog()
    this.bankroll = bankroll
  }

  /**
   * Main entry point: Analyze game and generate pick
   */
  async analyzeGame(game: GameInput): Promise<NBAEngineResult> {
    const log: NBAEngineResult['log'] = { steps: [] }
    let stepCounter = 1

    // STEP 1: Score Prediction (Pre-Market)
    log.steps.push({
      step: stepCounter++,
      title: 'Score Prediction (Pre-Market)',
      description: 'Predicting game scores BEFORE seeing market odds',
      impact: 'neutral',
    })

    const scorePrediction = await this.scoreModel.predictScore(game)

    log.steps.push({
      step: stepCounter++,
      title: 'Score Prediction Complete',
      description: `Predicted: ${game.homeTeam.abbreviation} ${scorePrediction.homeScore.toFixed(1)} - ${game.awayTeam.abbreviation} ${scorePrediction.awayScore.toFixed(1)}`,
      result: `True Spread: ${scorePrediction.trueSpread.toFixed(1)} | True Total: ${scorePrediction.trueTotal.toFixed(1)}`,
      impact: 'positive',
    })

    // STEP 2: Generate Structural Factors
    log.steps.push({
      step: stepCounter++,
      title: 'Generating Structural Factors',
      description: 'Building NBA-specific factors (lineup, shot profile, ref crew, schedule, scheme)',
      impact: 'neutral',
    })

    const structuralFactors = await this.factorCatalog.generateFactors(game, scorePrediction)

    // STEP 3: Initialize FactorEngine and calculate reliability
    const leagueParams = getDefaultLeagueParams('basketball', 'NBA')
    const factorEngine = new SharpFactorEngine(leagueParams)

    // Add all factors to engine (it calculates reliability and contribution)
    for (const factor of structuralFactors) {
      factorEngine.addFactor({
        name: factor.name,
        category: factor.category,
        effectSize: factor.effectSize,
        unit: factor.unit,
        marketBaseline: factor.marketBaseline,
        sampleSize: factor.sampleSize,
        recency: factor.recency,
        dataQuality: factor.dataQuality,
        learnedWeight: factor.learnedWeight,
        softCap: factor.softCap,
        reasoning: factor.reasoning,
        rawData: factor.rawData,
        sources: factor.sources,
        statmuseQuery: factor.statmuseQuery,
        statmuseResponse: factor.statmuseResponse,
        statmuseFailed: factor.statmuseFailed,
        residualized: factor.residualized,
      })
    }

    const allFactors = factorEngine.getAllFactors()

    log.steps.push({
      step: stepCounter++,
      title: 'Factors Generated',
      description: factorEngine.getSummary(),
      result: `${allFactors.length} factors ready for prediction heads`,
      impact: 'positive',
    })

    // STEP 4: Calculate Three Prediction Heads
    log.steps.push({
      step: stepCounter++,
      title: 'Calculating Prediction Heads',
      description: 'Converting factors → probabilities → EV for spread/total/ML',
      impact: 'neutral',
    })

    const headsCalculator = new PredictionHeadsCalculator(game, scorePrediction, allFactors, leagueParams)
    const predictionHeads = headsCalculator.calculate()

    log.steps.push({
      step: stepCounter++,
      title: 'Prediction Heads Complete',
      description: `Spread EV: ${predictionHeads.spreadHead.evPercentage.toFixed(2)}% | Total EV: ${predictionHeads.totalHead.evPercentage.toFixed(2)}% | ML EV: ${predictionHeads.moneylineHead.evPercentage.toFixed(2)}%`,
      result: `Best: ${predictionHeads.recommendedBetType || 'NONE'} (EV: ${predictionHeads.highestEv.toFixed(4)})`,
      impact: predictionHeads.allMeetThreshold ? 'positive' : 'negative',
    })

    // STEP 5: Check Gating & Select Pick
    if (!predictionHeads.bestPick) {
      const reasons = [
        predictionHeads.spreadHead.thresholdReason,
        predictionHeads.totalHead.thresholdReason,
        predictionHeads.moneylineHead.thresholdReason,
      ]

      log.steps.push({
        step: stepCounter++,
        title: 'No Pick Generated',
        description: 'None of the three heads met all threshold gates',
        result: reasons.join(' | '),
        impact: 'negative',
      })

      return {
        scorePrediction,
        factors: allFactors,
        predictionHeads,
        pick: null,
        noPick: true,
        noPickReason: 'No bet type met EV + magnitude + slippage + attribution thresholds',
        log,
      }
    }

    // STEP 6: Calculate Stake (Fractional Kelly)
    const bestHead = predictionHeads.bestPick
    const kellyStake = calculateKellyStake(
      bestHead.winProbability,
      bestHead.offeredOdds,
      this.bankroll,
      0.25 // 25% Kelly
    )
    const units = kellyToUnits(kellyStake, this.bankroll)

    log.steps.push({
      step: stepCounter++,
      title: 'Stake Calculated (Fractional Kelly)',
      description: `Kelly 0.25× on ${bestHead.winProbability.toFixed(3)} win probability`,
      result: `$${kellyStake.toFixed(2)} (${units}U)`,
      impact: 'positive',
    })

    // STEP 7: Format Selection String
    let selection = ''
    if (bestHead.betType === 'spread') {
      const side = bestHead.predictedDeviation > 0 ? game.homeTeam.abbreviation : game.awayTeam.abbreviation
      selection = `${side} ${bestHead.marketLine > 0 ? '+' : ''}${bestHead.marketLine}`
    } else if (bestHead.betType === 'total') {
      const overUnder = bestHead.predictedDeviation > 0 ? 'OVER' : 'UNDER'
      selection = `${overUnder} ${bestHead.marketLine}`
    } else {
      selection = game.homeTeam.abbreviation // Moneyline
    }

    log.steps.push({
      step: stepCounter++,
      title: 'Pick Generated!',
      description: `${bestHead.betType.toUpperCase()}: ${selection}`,
      result: `EV: ${bestHead.evPercentage.toFixed(2)}% | Units: ${units}`,
      impact: 'positive',
    })

    return {
      scorePrediction,
      factors: allFactors,
      predictionHeads,
      pick: {
        betType: bestHead.betType,
        selection,
        expectedValue: bestHead.expectedValue,
        evPercentage: bestHead.evPercentage,
        winProbability: bestHead.winProbability,
        stake: kellyStake,
        units,
        trueLine: bestHead.trueLine,
        marketLine: bestHead.marketLine,
        deviation: bestHead.predictedDeviation,
        offeredOdds: bestHead.offeredOdds,
      },
      noPick: false,
      noPickReason: '',
      log,
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create Shiva NBA engine instance
 */
export const createShivaNBAEngine = (bankroll?: number): ShivaNBAEngine => {
  return new ShivaNBAEngine(bankroll)
}

