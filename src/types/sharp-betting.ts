/**
 * Sharp Betting System Types
 * 
 * Professional sports betting approach based on:
 * - Market deviation analysis
 * - Effect size quantification
 * - Reliability-weighted contributions
 * - Expected value calculation
 */

// ============================================================================
// CORE SHARP BETTING TYPES
// ============================================================================

export type BetUnit = 'points' | 'log_odds'
export type BetType = 'spread' | 'total' | 'moneyline'
export type FactorCategory = 'vegas' | 'form' | 'matchup' | 'context' | 'ai_research' | 'weather' | 'injuries'

/**
 * Sharp Factor - Effect-based factor representation
 * Each factor quantifies how much it shifts the true line from the market
 */
export interface SharpFactor {
  // Identification
  name: string
  category: FactorCategory
  
  // Effect size (core of sharp betting)
  effectSize: number  // Deviation from market in points or log-odds
  unit: BetUnit  // What unit the effect is measured in
  marketBaseline: number  // The market line this compares against
  
  // Reliability components
  sampleSize: number  // Number of data points (games, possessions, etc.)
  recency: number  // 0-1, how fresh is this data (1 = today, 0 = ancient)
  dataQuality: number  // 0-1, confidence in data source (1 = official stats, 0 = rumor)
  reliability: number  // Calculated: sqrt(n / (n + k)) * recency * dataQuality
  shrinkageK: number  // The k parameter used for this factor type
  
  // Weighting
  learnedWeight: number  // From backtesting/ridge regression (default 1.0)
  softCap: number  // Maximum absolute effect allowed (prevents outliers)
  
  // Final contribution
  contribution: number  // clip(learnedWeight * effectSize, ±softCap) * reliability
  
  // Residualization (avoiding double-counting)
  residualized: boolean  // Was this residualized against the market?
  
  // Transparency
  reasoning: string
  rawData: {
    teamA?: Record<string, any>  // Your pick's team data
    teamB?: Record<string, any>  // Opponent's data
    context?: Record<string, any>  // Additional context
  }
  sources: string[]
  
  // StatMuse integration
  statmuseQuery?: string
  statmuseResponse?: string
  statmuseFailed?: boolean
  
  // Display
  displayOrder?: number
  impactType: 'positive' | 'negative' | 'neutral'
}

/**
 * Prediction Head - One of three bet type predictions
 * Converts factor contributions → probability → expected value
 */
export interface PredictionHead {
  // Bet type
  betType: BetType
  
  // Market baseline
  marketLine: number  // Current market number (spread, total, or fair log-odds)
  marketOdds: number  // American odds at the market line
  marketImpliedProb: number  // Implied probability (vig-removed)
  
  // Our prediction
  predictedDeviation: number  // Sum of factor contributions
  trueLine: number  // marketLine + predictedDeviation
  factors: SharpFactor[]  // Factors contributing to this head
  
  // Probability calculation
  coverProbability: number  // For spread/total: Φ(Δ / σ)
  winProbability: number  // For moneyline or derived from spread
  leagueSigma: number  // League-specific σ used in calculation
  
  // Expected value
  offeredOdds: number  // Actual odds available to bet
  offeredImpliedProb: number  // Implied prob from offered odds
  decimalPayout: number  // Payout multiplier (e.g., 1.91 for -110)
  expectedValue: number  // EV = p * payout - (1-p) * stake
  evPercentage: number  // EV as percentage (EV * 100)
  
  // Thresholds & gating
  meetsDeviationThreshold: boolean  // e.g., |Δ| ≥ 0.75
  meetsEvThreshold: boolean  // e.g., EV ≥ +1.5%
  meetsOddsThreshold: boolean  // e.g., not laying worse than -250
  overallThresholdMet: boolean  // All gates passed
  thresholdReason: string  // Why passed/failed
  
  // Ranking
  rank: number  // 1 = best EV among three heads
  isSelected: boolean  // Was this chosen for actual pick?
}

/**
 * Three Prediction Heads - Complete bet evaluation
 */
export interface ThreePredictionHeads {
  spreadHead: PredictionHead
  totalHead: PredictionHead
  moneylineHead: PredictionHead
  
  // Best pick selection
  bestPick: PredictionHead | null  // Highest EV that meets all thresholds
  allMeetThreshold: boolean  // Do any heads meet threshold?
  
  // Summary
  highestEv: number
  recommendedBetType: BetType | null
}

/**
 * League Parameters - Sport/league specific settings
 */
export interface LeagueParameters {
  sport: string
  league: string
  
  // Standard deviations
  spreadSigma: number  // For margin calculations
  totalSigma: number  // For total calculations
  
  // Gating thresholds
  minSpreadDeviation: number  // e.g., 0.75 for NBA
  minTotalDeviation: number  // e.g., 2.0 for NBA
  minEvSpread: number  // e.g., 0.015 (1.5%)
  minEvTotal: number
  minEvMoneylineDog: number  // e.g., 0.025 (2.5%)
  minEvMoneylineFav: number  // e.g., 0.035 (3.5%)
  maxMoneylineLay: number  // e.g., -250
  
  // Shrinkage parameters (k values)
  shrinkageKRecentForm: number  // e.g., 30 games
  shrinkageKInjuries: number  // e.g., 10 games
  shrinkageKWeather: number  // e.g., 20 games
  shrinkageKMatchup: number  // e.g., 40 games
  shrinkageKAiResearch: number  // e.g., 50 (higher = more conservative)
}

/**
 * Market Deviation - For tracking and learning
 */
export interface MarketDeviation {
  gameId: string
  capper: string
  factorName: string
  betType: BetType
  
  // Market context
  marketLineAtPrediction: number
  marketLineAtGameTime: number
  actualResult: number
  
  // Factor performance
  predictedEffect: number
  actualEffect: number
  predictionError: number
  
  // Model learning
  contributedToCorrectPick: boolean
  factorReliabilityScore: number
  suggestedWeightAdjustment: number
}

// ============================================================================
// UTILITY FUNCTIONS TYPE SIGNATURES
// ============================================================================

/**
 * Calculate reliability using shrinkage
 */
export type CalculateReliabilityFn = (
  sampleSize: number,
  shrinkageK: number,
  recency: number,
  dataQuality: number
) => number

/**
 * Convert effect size to probability
 */
export type EffectToProbabilityFn = (
  effectSize: number,
  unit: BetUnit,
  sigma: number
) => number

/**
 * Calculate expected value
 */
export type CalculateEVFn = (
  probability: number,
  americanOdds: number,
  stake?: number
) => number

/**
 * Convert American odds to decimal payout
 */
export type OddsToDecimalFn = (americanOdds: number) => number

/**
 * Convert American odds to implied probability (vig-removed)
 */
export type OddsToImpliedProbFn = (americanOdds: number, removeVig?: boolean) => number

/**
 * Check if pick meets threshold
 */
export type MeetsThresholdFn = (
  betType: BetType,
  effectSize: number,
  ev: number,
  odds: number,
  params: LeagueParameters
) => { meets: boolean; reason: string }

/**
 * Residualize feature against market
 */
export type ResidualizeFn = (
  rawFeature: number,
  marketLine: number,
  historicalData: Array<{ feature: number; line: number }>
) => number

// ============================================================================
// FACTOR BUILDER HELPERS
// ============================================================================

/**
 * Helper for building sharp factors
 */
export interface SharpFactorBuilder {
  withName(name: string): this
  withCategory(category: FactorCategory): this
  withEffect(size: number, unit: BetUnit): this
  withMarketBaseline(baseline: number): this
  withSampleSize(size: number): this
  withRecency(recency: number): this
  withDataQuality(quality: number): this
  withShrinkageK(k: number): this
  withWeight(weight: number): this
  withCap(cap: number): this
  withReasoning(reasoning: string): this
  withData(data: any): this
  withSources(...sources: string[]): this
  withStatMuse(query: string, response: string, failed?: boolean): this
  build(): SharpFactor
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * AI Research Response (updated for sharp betting)
 */
export interface SharpAIResearchResponse {
  factors: SharpFactor[]
  totalContribution: number  // Sum of all contributions
  runNumber: number
  model: string
  tokensUsed: number
  cost: number
  duration: number
  statMuseQueries: number
}

/**
 * Pick Generation Response (sharp betting)
 */
export interface SharpPickResponse {
  pick: {
    betType: BetType
    selection: string
    predictionHead: PredictionHead
    factors: SharpFactor[]
    expectedValue: number
    evPercentage: number
    winProbability: number
    trueLine: number
    marketLine: number
    deviation: number
  } | null
  
  allHeads: ThreePredictionHeads
  log: {
    steps: Array<any>
    aiResearch: {
      run1: SharpAIResearchResponse
      run2: SharpAIResearchResponse
      totalFactors: number
      totalRetries: number
    } | null
  }
  
  noPick: boolean
  noPickReason?: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Sharp betting configuration
 */
export interface SharpBettingConfig {
  enableResidualization: boolean
  enableDeepSearch: boolean
  minFactorsRequired: number
  maxAiRetries: number
  retryDelaySeconds: number
  leagueParams: LeagueParameters
}

