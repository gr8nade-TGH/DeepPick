/**
 * Sharp Factor Engine
 * 
 * Professional sports betting approach:
 * - Effect sizes (not abstract scores)
 * - Reliability weighting with shrinkage
 * - Market deviation baseline
 * - Expected value calculation
 */

import type {
  SharpFactor,
  BetUnit,
  FactorCategory,
  LeagueParameters,
} from '@/types/sharp-betting'

// ============================================================================
// SHARP FACTOR ENGINE
// ============================================================================

export class SharpFactorEngine {
  private factors: SharpFactor[] = []
  private leagueParams: LeagueParameters

  constructor(leagueParams: LeagueParameters) {
    this.leagueParams = leagueParams
  }

  /**
   * Add a sharp factor with automatic reliability calculation
   */
  addFactor(config: {
    name: string
    category: FactorCategory
    effectSize: number  // Points or log-odds deviation from market
    unit: BetUnit
    marketBaseline: number
    sampleSize: number
    recency: number  // 0-1
    dataQuality: number  // 0-1
    learnedWeight?: number  // Default 1.0
    softCap?: number  // Default based on category
    reasoning: string
    rawData?: any
    sources: string[]
    statmuseQuery?: string
    statmuseResponse?: string
    statmuseFailed?: boolean
    residualized?: boolean
  }): void {
    // Get shrinkage K for this category
    const shrinkageK = this.getShrinkageK(config.category)
    
    // Calculate reliability
    const reliability = calculateReliability(
      config.sampleSize,
      shrinkageK,
      config.recency,
      config.dataQuality
    )
    
    // Get soft cap (default based on category)
    const softCap = config.softCap ?? this.getDefaultSoftCap(config.category, config.unit)
    
    // Calculate contribution: clip(weight * effect, ±cap) * reliability
    const learnedWeight = config.learnedWeight ?? 1.0
    const clippedEffect = Math.max(-softCap, Math.min(softCap, learnedWeight * config.effectSize))
    const contribution = clippedEffect * reliability
    
    // Determine impact type
    const impactType = contribution > 0.1 ? 'positive' : contribution < -0.1 ? 'negative' : 'neutral'
    
    const factor: SharpFactor = {
      name: config.name,
      category: config.category,
      effectSize: config.effectSize,
      unit: config.unit,
      marketBaseline: config.marketBaseline,
      sampleSize: config.sampleSize,
      recency: config.recency,
      dataQuality: config.dataQuality,
      reliability,
      shrinkageK,
      learnedWeight,
      softCap,
      contribution,
      residualized: config.residualized ?? false,
      reasoning: config.reasoning,
      rawData: config.rawData ?? {},
      sources: config.sources,
      statmuseQuery: config.statmuseQuery,
      statmuseResponse: config.statmuseResponse,
      statmuseFailed: config.statmuseFailed,
      impactType,
    }
    
    this.factors.push(factor)
  }

  /**
   * Get all factors
   */
  getAllFactors(): SharpFactor[] {
    return this.factors
  }

  /**
   * Get total contribution (sum of all factor contributions)
   */
  getTotalContribution(): number {
    return this.factors.reduce((sum, f) => sum + f.contribution, 0)
  }

  /**
   * Get factors for a specific bet type
   */
  getFactorsByBetType(unit: BetUnit): SharpFactor[] {
    return this.factors.filter(f => f.unit === unit)
  }

  /**
   * Get shrinkage K parameter for a category
   */
  private getShrinkageK(category: FactorCategory): number {
    switch (category) {
      case 'form':
        return this.leagueParams.shrinkageKRecentForm
      case 'injuries':
        return this.leagueParams.shrinkageKInjuries
      case 'weather':
        return this.leagueParams.shrinkageKWeather
      case 'matchup':
        return this.leagueParams.shrinkageKMatchup
      case 'ai_research':
        return this.leagueParams.shrinkageKAiResearch
      default:
        return 40  // Default moderate shrinkage
    }
  }

  /**
   * Get default soft cap for a category
   */
  private getDefaultSoftCap(category: FactorCategory, unit: BetUnit): number {
    if (unit === 'points') {
      // Points-based caps
      switch (category) {
        case 'vegas':
          return 5.0  // Vegas comparison can shift up to 5 points
        case 'form':
          return 3.0  // Recent form up to 3 points
        case 'injuries':
          return 4.0  // Major injuries up to 4 points
        case 'matchup':
          return 3.0  // Matchup advantages up to 3 points
        case 'weather':
          return 2.0  // Weather up to 2 points
        case 'ai_research':
          return 2.0  // AI narrative factors capped at 2 points
        default:
          return 2.5
      }
    } else {
      // Log-odds caps
      switch (category) {
        case 'vegas':
          return 0.5  // Vegas can shift log-odds by 0.5
        case 'form':
          return 0.3
        case 'injuries':
          return 0.4
        case 'matchup':
          return 0.3
        case 'weather':
          return 0.2
        case 'ai_research':
          return 0.2  // Narrative capped lower
        default:
          return 0.25
      }
    }
  }

  /**
   * Get a summary for logging
   */
  getSummary(): string {
    const total = this.getTotalContribution()
    const count = this.factors.length
    const avgReliability = this.factors.reduce((sum, f) => sum + f.reliability, 0) / count
    
    return `${count} factors analyzed | Total contribution: ${total.toFixed(3)} | Avg reliability: ${avgReliability.toFixed(2)}`
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate reliability using shrinkage
 * Formula: sqrt(n / (n + k)) * recency * dataQuality
 */
export function calculateReliability(
  sampleSize: number,
  shrinkageK: number,
  recency: number,
  dataQuality: number
): number {
  // Sample size reliability with shrinkage
  const sampleReliability = Math.sqrt(sampleSize / (sampleSize + shrinkageK))
  
  // Combined reliability
  return sampleReliability * recency * dataQuality
}

/**
 * Convert effect size to probability
 */
export function effectToProbability(
  effectSize: number,
  unit: BetUnit,
  sigma: number
): number {
  if (unit === 'points') {
    // Normal CDF: Φ(Δ / σ)
    return normalCDF(effectSize / sigma)
  } else {
    // Sigmoid for log-odds
    return sigmoid(effectSize)
  }
}

/**
 * Normal CDF (cumulative distribution function)
 * Approximation using error function
 */
function normalCDF(x: number): number {
  // Using approximation: Φ(x) ≈ 0.5 * (1 + erf(x / √2))
  return 0.5 * (1 + erf(x / Math.sqrt(2)))
}

/**
 * Error function approximation (Abramowitz and Stegun)
 */
function erf(x: number): number {
  // Constants
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  // Save sign of x
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x)
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return sign * y
}

/**
 * Sigmoid function
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Convert American odds to decimal payout
 */
export function oddsToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    // Underdog: +150 → 2.50
    return 1 + americanOdds / 100
  } else {
    // Favorite: -150 → 1.67
    return 1 + 100 / Math.abs(americanOdds)
  }
}

/**
 * Convert American odds to implied probability
 */
export function oddsToImpliedProb(americanOdds: number, removeVig: boolean = true): number {
  let prob: number
  
  if (americanOdds > 0) {
    // Underdog
    prob = 100 / (americanOdds + 100)
  } else {
    // Favorite
    prob = Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
  }
  
  // Simple vig removal: assume 4.5% vig, split evenly
  if (removeVig) {
    prob = prob * 0.9775  // Remove ~2.25% vig
  }
  
  return prob
}

/**
 * Calculate expected value
 */
export function calculateEV(
  probability: number,
  americanOdds: number,
  stake: number = 1
): number {
  const decimalPayout = oddsToDecimal(americanOdds)
  
  // EV = p * (payout - stake) - (1 - p) * stake
  // Simplified: EV = p * payout - stake
  return probability * decimalPayout * stake - stake
}

/**
 * Check if pick meets threshold
 */
export function meetsThreshold(
  betType: 'spread' | 'total' | 'moneyline',
  effectSize: number,
  ev: number,
  odds: number,
  params: LeagueParameters
): { meets: boolean; reason: string } {
  const reasons: string[] = []
  let meets = true

  if (betType === 'spread') {
    // Spread thresholds
    if (Math.abs(effectSize) < params.minSpreadDeviation) {
      meets = false
      reasons.push(`Deviation ${Math.abs(effectSize).toFixed(2)} < ${params.minSpreadDeviation} points`)
    }
    if (ev < params.minEvSpread) {
      meets = false
      reasons.push(`EV ${(ev * 100).toFixed(2)}% < ${(params.minEvSpread * 100).toFixed(1)}%`)
    }
  } else if (betType === 'total') {
    // Total thresholds
    if (Math.abs(effectSize) < params.minTotalDeviation) {
      meets = false
      reasons.push(`Deviation ${Math.abs(effectSize).toFixed(2)} < ${params.minTotalDeviation} points`)
    }
    if (ev < params.minEvTotal) {
      meets = false
      reasons.push(`EV ${(ev * 100).toFixed(2)}% < ${(params.minEvTotal * 100).toFixed(1)}%`)
    }
  } else {
    // Moneyline thresholds
    const isFavorite = odds < 0
    const minEv = isFavorite ? params.minEvMoneylineFav : params.minEvMoneylineDog
    
    if (ev < minEv) {
      meets = false
      reasons.push(`EV ${(ev * 100).toFixed(2)}% < ${(minEv * 100).toFixed(1)}%`)
    }
    
    // Don't lay worse than max
    if (isFavorite && odds < params.maxMoneylineLay) {
      meets = false
      reasons.push(`Laying ${odds} worse than ${params.maxMoneylineLay}`)
    }
  }

  return {
    meets,
    reason: meets ? 'All thresholds met' : reasons.join('; '),
  }
}

/**
 * Residualize feature against market
 * Returns the part of the feature not explained by the market line
 */
export function residualize(
  rawFeature: number,
  marketLine: number,
  historicalData: Array<{ feature: number; line: number }>
): number {
  // Simple linear regression: feature = α + β * line + ε
  // We return the residual ε
  
  if (historicalData.length < 10) {
    // Not enough data for reliable residualization
    return rawFeature
  }
  
  // Calculate means
  const meanFeature = historicalData.reduce((sum, d) => sum + d.feature, 0) / historicalData.length
  const meanLine = historicalData.reduce((sum, d) => sum + d.line, 0) / historicalData.length
  
  // Calculate slope (β)
  let numerator = 0
  let denominator = 0
  for (const d of historicalData) {
    numerator += (d.line - meanLine) * (d.feature - meanFeature)
    denominator += (d.line - meanLine) ** 2
  }
  const slope = denominator > 0 ? numerator / denominator : 0
  
  // Calculate intercept (α)
  const intercept = meanFeature - slope * meanLine
  
  // Predicted value
  const predicted = intercept + slope * marketLine
  
  // Residual (what market doesn't explain)
  return rawFeature - predicted
}

/**
 * Deduplicate factors by semantic similarity
 * Keeps the factor with highest reliability
 */
export function deduplicateFactors(factors: SharpFactor[]): SharpFactor[] {
  const groups: Map<string, SharpFactor[]> = new Map()
  
  // Group by normalized name
  for (const factor of factors) {
    const key = normalizeFactorName(factor.name)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(factor)
  }
  
  // Keep best from each group
  const deduplicated: SharpFactor[] = []
  for (const [key, group] of groups) {
    if (group.length === 1) {
      deduplicated.push(group[0])
    } else {
      // Keep highest reliability
      const best = group.reduce((prev, curr) =>
        curr.reliability > prev.reliability ? curr : prev
      )
      
      // Merge reasoning if multiple similar factors
      const allReasoning = group.map(f => f.reasoning).join(' | ')
      best.reasoning = allReasoning
      
      deduplicated.push(best)
    }
  }
  
  return deduplicated
}

/**
 * Normalize factor name for deduplication
 */
function normalizeFactorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()
}

/**
 * Get default league parameters
 */
export function getDefaultLeagueParams(sport: string, league: string): LeagueParameters {
  const defaults: Record<string, LeagueParameters> = {
    'basketball:NBA': {
      sport: 'basketball',
      league: 'NBA',
      spreadSigma: 12.5,
      totalSigma: 14.0,
      minSpreadDeviation: 0.75,
      minTotalDeviation: 2.0,
      minEvSpread: 0.015,
      minEvTotal: 0.015,
      minEvMoneylineDog: 0.025,
      minEvMoneylineFav: 0.035,
      maxMoneylineLay: -250,
      shrinkageKRecentForm: 30,
      shrinkageKInjuries: 10,
      shrinkageKWeather: 20,
      shrinkageKMatchup: 40,
      shrinkageKAiResearch: 50,
    },
    'american_football:NFL': {
      sport: 'american_football',
      league: 'NFL',
      spreadSigma: 13.8,
      totalSigma: 13.5,
      minSpreadDeviation: 0.70,
      minTotalDeviation: 1.5,
      minEvSpread: 0.015,
      minEvTotal: 0.015,
      minEvMoneylineDog: 0.025,
      minEvMoneylineFav: 0.035,
      maxMoneylineLay: -250,
      shrinkageKRecentForm: 20,
      shrinkageKInjuries: 8,
      shrinkageKWeather: 15,
      shrinkageKMatchup: 30,
      shrinkageKAiResearch: 40,
    },
  }
  
  const key = `${sport}:${league}`
  return defaults[key] ?? defaults['basketball:NBA']  // Fallback to NBA
}

