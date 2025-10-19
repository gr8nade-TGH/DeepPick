/**
 * Factor Engine - Bipolar Scoring System
 * 
 * Implements sophisticated factor analysis with -5 to +5 scoring.
 * Each factor compares BOTH teams and can help OR hurt the pick.
 */

import { CapperGame } from './shared-logic'

// ============================================================================
// TYPES
// ============================================================================

export interface FactorData {
  teamA: any // Pick team's data
  teamB: any // Opponent's data
  context?: any // Additional context
}

export interface Factor {
  name: string
  category: 'vegas' | 'form' | 'matchup' | 'context' | 'ai_research'
  weight: number // Max contribution (0.0 to 1.0, e.g., 0.30 = 30%)
  
  // Raw data
  data: FactorData
  
  // Scoring
  rawScore: number // -1.0 to +1.0 (before weight)
  weightedScore: number // -weight to +weight (after applying weight)
  percentage: number // For UI display (0-100)
  
  // Transparency
  reasoning: string
  sources: string[]
  
  // StatMuse (optional)
  statmuseQuery?: string
  statmuseResponse?: string
  statmuseFailed?: boolean
  
  // Display
  displayOrder: number
  impactType: 'positive' | 'negative' | 'neutral'
}

export interface FactorWeights {
  vegasEdge: number // 30%
  recentForm: number // 15%
  headToHead: number // 10%
  offensiveVsDefensive: number // 15%
  injuriesRest: number // 10%
  homeAway: number // 10%
  paceStyle: number // 5%
  weather: number // 5%
}

// ============================================================================
// FACTOR ENGINE CLASS
// ============================================================================

export class FactorEngine {
  private factors: Factor[] = []
  
  // Default factor weights (can be customized per capper)
  private weights: FactorWeights = {
    vegasEdge: 0.30,
    recentForm: 0.15,
    headToHead: 0.10,
    offensiveVsDefensive: 0.15,
    injuriesRest: 0.10,
    homeAway: 0.10,
    paceStyle: 0.05,
    weather: 0.05
  }
  
  constructor(customWeights?: Partial<FactorWeights>) {
    if (customWeights) {
      this.weights = { ...this.weights, ...customWeights }
    }
  }
  
  /**
   * Add a factor to the analysis
   */
  addFactor(factor: Omit<Factor, 'weightedScore' | 'percentage' | 'displayOrder' | 'impactType'>): void {
    // Calculate weighted score
    const weightedScore = factor.rawScore * factor.weight
    
    // Calculate percentage contribution (relative to max possible score of 10)
    const percentage = Math.round((Math.abs(weightedScore) / 10) * 100)
    
    // Determine impact type
    const impactType: 'positive' | 'negative' | 'neutral' = 
      weightedScore > 0.5 ? 'positive' :
      weightedScore < -0.5 ? 'negative' :
      'neutral'
    
    this.factors.push({
      ...factor,
      weightedScore,
      percentage,
      displayOrder: this.factors.length + 1,
      impactType
    })
  }
  
  /**
   * Calculate total confidence from all factors
   * Range: -10 to +10 (need +7.0 minimum to generate pick)
   */
  getTotalConfidence(): number {
    const total = this.factors.reduce((sum, factor) => sum + factor.weightedScore, 0)
    // Clamp to -10 to +10 range
    return Math.max(-10, Math.min(10, total))
  }
  
  /**
   * Get all factors sorted by absolute impact (highest first)
   */
  getFactorsSortedByImpact(): Factor[] {
    return [...this.factors].sort((a, b) => 
      Math.abs(b.weightedScore) - Math.abs(a.weightedScore)
    )
  }
  
  /**
   * Get positive factors only
   */
  getPositiveFactors(): Factor[] {
    return this.factors.filter(f => f.weightedScore > 0)
  }
  
  /**
   * Get negative factors only
   */
  getNegativeFactors(): Factor[] {
    return this.factors.filter(f => f.weightedScore < 0)
  }
  
  /**
   * Get all factors for database storage
   */
  getAllFactors(): Factor[] {
    return this.factors
  }
  
  /**
   * Generate summary for UI
   */
  getSummary(): string {
    const total = this.getTotalConfidence()
    const positive = this.getPositiveFactors()
    const negative = this.getNegativeFactors()
    
    return `${positive.length} factors favor this pick (+${positive.reduce((s, f) => s + f.weightedScore, 0).toFixed(1)}), ` +
           `${negative.length} factors against (${negative.reduce((s, f) => s + f.weightedScore, 0).toFixed(1)}). ` +
           `Total confidence: ${total.toFixed(1)}/10`
  }
}

// ============================================================================
// SCORING HELPERS
// ============================================================================

/**
 * Score recent form by comparing both teams' last N games
 * Returns: -1.0 to +1.0
 */
export function scoreRecentForm(
  teamARecord: { wins: number; losses: number; pointDiff: number },
  teamBRecord: { wins: number; losses: number; pointDiff: number }
): number {
  // Calculate win percentages
  const teamAWinPct = teamARecord.wins / (teamARecord.wins + teamARecord.losses)
  const teamBWinPct = teamBRecord.wins / (teamBRecord.wins + teamBRecord.losses)
  
  // Compare win percentages
  const winPctDiff = teamAWinPct - teamBWinPct
  
  // Compare point differentials (normalized)
  const pointDiffDiff = (teamARecord.pointDiff - teamBRecord.pointDiff) / 20 // Scale to ~-1 to +1
  
  // Average the two metrics
  const score = (winPctDiff + pointDiffDiff) / 2
  
  // Clamp to -1 to +1
  return Math.max(-1, Math.min(1, score))
}

/**
 * Score injuries impact (context-aware)
 * Returns: -1.0 to +1.0
 */
export function scoreInjuries(
  teamAInjuries: string[], // List of injured players
  teamBInjuries: string[],
  teamAStarters: string[], // List of starters
  teamBStarters: string[]
): number {
  // Count starter injuries (more impactful)
  const teamAStarterInjuries = teamAInjuries.filter(p => teamAStarters.includes(p)).length
  const teamBStarterInjuries = teamBInjuries.filter(p => teamBStarters.includes(p)).length
  
  // Simple comparison
  if (teamAStarterInjuries > teamBStarterInjuries) {
    return -0.5 * teamAStarterInjuries // Negative impact
  } else if (teamBStarterInjuries > teamAStarterInjuries) {
    return +0.5 * teamBStarterInjuries // Positive impact (opponent hurt)
  }
  
  // Check bench injuries
  const teamABenchInjuries = teamAInjuries.length - teamAStarterInjuries
  const teamBBenchInjuries = teamBInjuries.length - teamBStarterInjuries
  
  const diff = teamBBenchInjuries - teamABenchInjuries
  return Math.max(-1, Math.min(1, diff * 0.2)) // Less impactful than starters
}

/**
 * Score weather impact (context-aware)
 * Only matters if one team is significantly better in that weather
 * Returns: -1.0 to +1.0
 */
export function scoreWeather(
  weather: 'clear' | 'rain' | 'snow' | 'wind' | 'dome',
  teamAWeatherRecord?: { wins: number; losses: number }, // Record in this weather
  teamBWeatherRecord?: { wins: number; losses: number }
): number {
  // Indoor game = no weather impact
  if (weather === 'clear' || weather === 'dome') return 0
  
  // No weather data = assume neutral
  if (!teamAWeatherRecord || !teamBWeatherRecord) return 0
  
  // Calculate win percentages in bad weather
  const teamAWinPct = teamAWeatherRecord.wins / (teamAWeatherRecord.wins + teamAWeatherRecord.losses)
  const teamBWinPct = teamBWeatherRecord.wins / (teamBWeatherRecord.wins + teamBWeatherRecord.losses)
  
  const diff = teamAWinPct - teamBWinPct
  
  // Only significant if difference is > 20%
  if (Math.abs(diff) < 0.2) return 0
  
  // Scale to -1 to +1
  return Math.max(-1, Math.min(1, diff * 2))
}

/**
 * Score offensive vs defensive matchup
 * Compares Team A offense vs Team B defense
 * Returns: -1.0 to +1.0
 */
export function scoreOffensiveVsDefensive(
  teamAOffensiveRating: number, // Points per 100 possessions
  teamBDefensiveRating: number, // Points allowed per 100 possessions
  leagueAvgOffensive: number = 110,
  leagueAvgDefensive: number = 110
): number {
  // Normalize ratings to league average
  const teamAOffenseVsAvg = (teamAOffensiveRating - leagueAvgOffensive) / leagueAvgOffensive
  const teamBDefenseVsAvg = (teamBDefensiveRating - leagueAvgDefensive) / leagueAvgDefensive
  
  // Positive offense vs poor defense = good matchup
  // Poor offense vs good defense = bad matchup
  const matchupScore = teamAOffenseVsAvg - teamBDefenseVsAvg
  
  // Scale to -1 to +1
  return Math.max(-1, Math.min(1, matchupScore * 2))
}

/**
 * Score Vegas edge (most important factor)
 * Compares prediction vs Vegas line
 * Returns: -1.0 to +1.0
 */
export function scoreVegasEdge(
  predictedValue: number, // Your prediction (total, spread, etc.)
  vegasLine: number, // Vegas line
  maxExpectedDiff: number = 15 // Max reasonable difference
): number {
  const diff = predictedValue - vegasLine
  
  // Scale to -1 to +1
  const score = diff / maxExpectedDiff
  
  return Math.max(-1, Math.min(1, score))
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
const engine = new FactorEngine()

// Add Vegas edge factor
engine.addFactor({
  name: 'Vegas Total Edge',
  category: 'vegas',
  weight: 0.30,
  data: {
    teamA: { predictedTotal: 125 },
    teamB: { predictedTotal: 125 },
    context: { vegasTotal: 110, difference: 15 }
  },
  rawScore: 0.8, // Strong edge
  reasoning: 'Predicted total 15 points higher than Vegas (125 vs 110)',
  sources: ['Shiva Prediction Model', 'The Odds API']
})

// Add recent form factor
engine.addFactor({
  name: 'Recent Form Comparison',
  category: 'form',
  weight: 0.15,
  data: {
    teamA: { record: '8-2', pointDiff: +12.5 },
    teamB: { record: '4-6', pointDiff: -8.2 }
  },
  rawScore: 0.7, // Team A much better
  reasoning: 'Team A significantly outperforming in last 10 games',
  sources: ['Historical Data']
})

// Add negative factor (injuries)
engine.addFactor({
  name: 'Injuries & Rest',
  category: 'context',
  weight: 0.10,
  data: {
    teamA: { injuries: ['LeBron James'], starters: true },
    teamB: { injuries: [], starters: false }
  },
  rawScore: -0.8, // Hurts the pick
  reasoning: 'Key starter out for Team A',
  sources: ['Injury Report']
})

console.log(engine.getTotalConfidence()) // ~7.5
console.log(engine.getSummary())
*/

