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

/**
 * THREE-UNIT SYSTEM (per spec)
 * - points_spread: Effect on margin (home - away)
 * - points_total: Effect on sum of points
 * - logodds_win: Effect on log-odds of win (for moneyline)
 */
export type FactorUnit = 'points_spread' | 'points_total' | 'logodds_win'
export type BetType = 'spread' | 'total' | 'moneyline'
export type FactorCategory = 
  | 'lineup'      // Lineup synergy, on/off, personnel
  | 'matchup'     // Style, scheme, personnel mismatches
  | 'context'     // Rest, travel, altitude, schedule
  | 'officials'   // Ref crew, umpire zone
  | 'environment' // Weather, park, surface
  | 'market'      // Line movement, closing line value
  | 'ai_research' // AI-discovered narrative factors

/**
 * Sharp Factor - Effect-based factor representation
 * Each factor quantifies how much it shifts the true line from the market
 */
export interface SharpFactor {
  // Identification
  name: string
  category: FactorCategory
  
  // Effect size (core of sharp betting)
  effectSize: number  // Deviation from market in points_spread, points_total, or logodds_win
  unit: FactorUnit  // What unit the effect is measured in
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
  unit: FactorUnit,
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
  withEffect(size: number, unit: FactorUnit): this
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

// ============================================================================
// SPORT-AGNOSTIC INTERFACES (for multi-sport extensibility)
// ============================================================================

/**
 * Score Prediction Output (pre-market)
 * Sport-specific models must produce this
 */
export interface ScorePrediction {
  homeScore: number  // Expected points/goals for home team
  awayScore: number  // Expected points/goals for away team
  trueSpread: number  // homeScore - awayScore
  trueTotal: number  // homeScore + awayScore
  winProbTrue: number  // Probability home team wins (0-1)
  
  // Variance estimates (for probability calculations)
  sigmaSpread: number  // Std dev of margin
  sigmaTotal: number  // Std dev of total
  
  // Context used
  homePace?: number  // Possessions/plays/pace metric
  awayPace?: number
  gameContext?: Record<string, any>  // B2B, altitude, weather, etc.
}

/**
 * Sport-Specific Score Model Interface
 * Each sport implements this
 */
export interface IScoreModel {
  sport: string
  league: string
  
  /**
   * Predict game score BEFORE seeing market odds
   */
  predictScore(game: GameInput): Promise<ScorePrediction>
  
  /**
   * Estimate variance parameters based on context
   */
  estimateVariance(context: Record<string, any>): { sigmaSpread: number; sigmaTotal: number }
}

/**
 * Sport-Specific Factor Catalog Interface
 * Each sport implements different "clever" factors
 */
export interface IFactorCatalog {
  sport: string
  league: string
  
  /**
   * Generate all sport-specific factors
   */
  generateFactors(game: GameInput, scorePrediction: ScorePrediction): Promise<SharpFactor[]>
  
  /**
   * List of available factor types
   */
  getFactorTypes(): FactorType[]
}

/**
 * Factor Type Definition
 */
export interface FactorType {
  key: string  // Unique identifier
  name: string  // Display name
  category: FactorCategory
  unit: FactorUnit  // Which head it contributes to
  defaultCap: number  // Default soft cap
  defaultWeight: number  // Default learned weight
  shrinkageK: number  // Shrinkage parameter for this factor
  description: string
}

/**
 * Game Input (standardized across sports)
 */
export interface GameInput {
  id: string
  sport: string
  league: string
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  gameDate: string
  gameTime: string
  
  // Market data (average across books)
  spread?: number  // Negative means home favored
  total?: number
  homeMoneyline?: number  // American odds
  awayMoneyline?: number  // American odds
  
  // Context
  venue?: string
  weather?: WeatherInfo
  injuries?: InjuryInfo[]
  
  // Historical data for residualization
  recentGames?: any[]
}

export interface TeamInfo {
  id: string
  name: string
  abbreviation: string
  
  // Recent performance
  record?: string
  recentForm?: number[]  // Last N game results
  
  // Ratings/stats (sport-specific)
  stats?: Record<string, any>
}

export interface WeatherInfo {
  temp?: number
  wind?: number
  precipitation?: number
  conditions?: string
}

export interface InjuryInfo {
  player: string
  position: string
  status: 'out' | 'questionable' | 'doubtful' | 'probable'
  impact?: number  // Estimated impact in minutes/plays
}

/**
 * Edge Attribution Breakdown
 */
export interface EdgeAttribution {
  totalDelta: number
  structuralDelta: number  // From non-price factors
  priceDelta: number  // From line movement
  structuralPercentage: number  // Must be 40-60% per spec
  passesAttributionRule: boolean
}

