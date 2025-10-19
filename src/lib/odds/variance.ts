/**
 * Variance Estimation
 * Per spec: Context-aware sigma estimation for spread and total
 */

import type { GameInput } from '@/types/sharp-betting'

// ============================================================================
// VARIANCE CONTEXT
// ============================================================================

export interface VarianceContext {
  sport: string
  league: string
  
  // Game context
  pace?: number  // Possessions/plays per game
  isBackToBack?: boolean
  altitude?: boolean  // DEN/UTA for NBA
  weather?: {
    wind?: number
    precipitation?: number
    temp?: number
  }
  
  // Volatility factors
  injuryUncertainty?: number  // 0-1, how uncertain are lineups
  refCrewVolatility?: number  // Some refs increase variance
  
  // Historical
  recentVariance?: number  // Trailing variance for these teams
}

// ============================================================================
// BASE SIGMA VALUES (per spec)
// ============================================================================

const BASE_SIGMA: Record<string, { spread: number; total: number }> = {
  'basketball:NBA': {
    spread: 12.5,  // Points
    total: 14.0,
  },
  'basketball:NCAAB': {
    spread: 13.5,
    total: 15.0,
  },
  'american_football:NFL': {
    spread: 13.8,
    total: 13.5,
  },
  'american_football:NCAAF': {
    spread: 14.5,
    total: 14.0,
  },
  'baseball:MLB': {
    spread: 1.8,  // Run line
    total: 2.2,  // Total runs
  },
  'hockey:NHL': {
    spread: 1.2,  // Puck line
    total: 1.5,  // Total goals
  },
}

// ============================================================================
// SIGMA ESTIMATION FUNCTIONS
// ============================================================================

/**
 * Get base sigma for sport/league
 */
export const getBaseSigma = (
  sport: string,
  league: string
): { spread: number; total: number } => {
  const key = `${sport}:${league}`
  return BASE_SIGMA[key] ?? BASE_SIGMA['basketball:NBA']  // Fallback
}

/**
 * Estimate spread sigma with context adjustments
 */
export const estimateSigmaSpread = (context: VarianceContext): number => {
  const base = getBaseSigma(context.sport, context.league)
  let sigma = base.spread
  
  // NBA-specific adjustments
  if (context.sport === 'basketball') {
    // High pace increases variance slightly
    if (context.pace && context.pace > 105) {
      sigma *= 1.05  // +5% for high pace
    } else if (context.pace && context.pace < 95) {
      sigma *= 0.95  // -5% for slow pace
    }
    
    // Altitude (DEN/UTA)
    if (context.altitude) {
      sigma *= 1.08  // +8% for altitude
    }
    
    // Back-to-back
    if (context.isBackToBack) {
      sigma *= 1.03  // +3% for b2b fatigue variance
    }
    
    // Injury uncertainty
    if (context.injuryUncertainty && context.injuryUncertainty > 0.3) {
      sigma *= (1 + context.injuryUncertainty * 0.15)  // Up to +15%
    }
  }
  
  // NFL-specific adjustments
  if (context.sport === 'american_football') {
    // Weather impact
    if (context.weather) {
      const { wind, precipitation } = context.weather
      
      // Wind increases variance
      if (wind && wind > 15) {
        sigma *= 1.10  // +10% for high wind
      }
      
      // Rain/snow
      if (precipitation && precipitation > 0.3) {
        sigma *= 1.12  // +12% for wet conditions
      }
    }
  }
  
  // Use recent variance if available
  if (context.recentVariance && context.recentVariance > 0) {
    // Blend 70% base, 30% recent
    sigma = 0.7 * sigma + 0.3 * context.recentVariance
  }
  
  return sigma
}

/**
 * Estimate total sigma with context adjustments
 */
export const estimateSigmaTotal = (context: VarianceContext): number => {
  const base = getBaseSigma(context.sport, context.league)
  let sigma = base.total
  
  // NBA-specific adjustments
  if (context.sport === 'basketball') {
    // High pace increases total variance more
    if (context.pace && context.pace > 105) {
      sigma *= 1.10  // +10% for high pace
    } else if (context.pace && context.pace < 95) {
      sigma *= 0.90  // -10% for slow pace
    }
    
    // Altitude
    if (context.altitude) {
      sigma *= 1.05  // +5% for altitude
    }
    
    // Ref crew volatility (pace/foul rate affects totals)
    if (context.refCrewVolatility && context.refCrewVolatility > 0.5) {
      sigma *= 1.08  // +8% for high-variance ref crew
    }
  }
  
  // NFL-specific adjustments
  if (context.sport === 'american_football') {
    // Weather
    if (context.weather) {
      const { wind, precipitation } = context.weather
      
      // Wind/rain suppresses scoring AND increases variance
      if (wind && wind > 15) {
        sigma *= 1.08  // More volatile in wind
      }
      if (precipitation && precipitation > 0.3) {
        sigma *= 1.10
      }
    }
  }
  
  // MLB-specific adjustments
  if (context.sport === 'baseball') {
    // Bullpen uncertainty increases total variance
    if (context.injuryUncertainty && context.injuryUncertainty > 0.4) {
      sigma *= 1.15  // Bullpen games are volatile
    }
  }
  
  return sigma
}

/**
 * Estimate both sigmas at once
 */
export const estimateVariance = (
  context: VarianceContext
): { sigmaSpread: number; sigmaTotal: number } => {
  return {
    sigmaSpread: estimateSigmaSpread(context),
    sigmaTotal: estimateSigmaTotal(context),
  }
}

/**
 * Build variance context from game input
 */
export const buildVarianceContext = (game: GameInput): VarianceContext => {
  const context: VarianceContext = {
    sport: game.sport,
    league: game.league,
  }
  
  // Extract pace if available (NBA)
  if (game.homeTeam.stats?.pace) {
    const avgPace = (game.homeTeam.stats.pace + (game.awayTeam.stats?.pace ?? game.homeTeam.stats.pace)) / 2
    context.pace = avgPace
  }
  
  // Check for altitude venues
  if (game.venue && ['Denver', 'Utah', 'Salt Lake City'].some(v => game.venue?.includes(v))) {
    context.altitude = true
  }
  
  // Weather
  if (game.weather) {
    context.weather = {
      wind: game.weather.wind,
      precipitation: game.weather.precipitation,
      temp: game.weather.temp,
    }
  }
  
  // Injury uncertainty (more injuries = more uncertainty)
  if (game.injuries && game.injuries.length > 0) {
    const uncertainInjuries = game.injuries.filter(
      i => i.status === 'questionable' || i.status === 'doubtful'
    ).length
    context.injuryUncertainty = Math.min(uncertainInjuries * 0.2, 1.0)
  }
  
  return context
}

/**
 * Historical variance calculation (for calibration)
 * This would be used with real historical data
 */
export const calculateHistoricalVariance = (
  results: Array<{ actualMargin: number; closingSpread: number }>
): number => {
  if (results.length < 10) return 0  // Not enough data
  
  // Calculate variance of (actual - predicted)
  const errors = results.map(r => r.actualMargin - r.closingSpread)
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length
  const variance = errors.reduce((sum, err) => sum + Math.pow(err - mean, 2), 0) / errors.length
  
  return Math.sqrt(variance)  // Return std dev
}

