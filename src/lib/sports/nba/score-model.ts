/**
 * NBA Score Prediction Model
 * 
 * Per spec: "Predict first, price second"
 * Predicts team scores BEFORE seeing market odds using:
 * - Possession-based approach (possessions × efficiency)
 * - Offensive/defensive ratings
 * - Pace prediction
 * - Lineup impact (on/off)
 * - Context (rest, travel, altitude)
 */

import type { 
  IScoreModel, 
  GameInput, 
  ScorePrediction,
} from '@/types/sharp-betting'
import { estimateVariance, buildVarianceContext } from '@/lib/odds/variance'
import { phi } from '@/lib/odds/math'

// ============================================================================
// NBA SCORE MODEL
// ============================================================================

export class NBAScoreModel implements IScoreModel {
  sport = 'basketball'
  league = 'NBA'
  
  /**
   * Predict game score before seeing market odds
   * 
   * Methodology:
   * 1. Predict pace (possessions per 48 min)
   * 2. Predict offensive/defensive efficiency for each team
   * 3. Calculate expected points: possessions × (OffRtg / 100)
   * 4. Apply context adjustments (rest, travel, altitude, lineups)
   * 5. Derive spread, total, and win probability
   */
  async predictScore(game: GameInput): Promise<ScorePrediction> {
    // 1. Predict pace
    const pace = this.predictPace(game)
    
    // 2. Get team efficiencies (from recent stats)
    const homeOffRtg = this.getOffensiveRating(game.homeTeam)
    const homeDefRtg = this.getDefensiveRating(game.homeTeam)
    const awayOffRtg = this.getOffensiveRating(game.awayTeam)
    const awayDefRtg = this.getDefensiveRating(game.awayTeam)
    
    // 3. Calculate base expected points
    // Points = Possessions × (OffRtg / 100)
    // But we adjust for opponent defense
    const homeBasePts = pace * (homeOffRtg / 100) * (awayDefRtg / 100)
    const awayBasePts = pace * (awayOffRtg / 100) * (homeDefRtg / 100)
    
    // 4. Apply context adjustments
    const homeAdjustments = this.getContextAdjustments(game, 'home')
    const awayAdjustments = this.getContextAdjustments(game, 'away')
    
    const homeScore = homeBasePts + homeAdjustments.totalEffect
    const awayScore = awayBasePts + awayAdjustments.totalEffect
    
    // 5. Calculate derived metrics
    const trueSpread = homeScore - awayScore
    const trueTotal = homeScore + awayScore
    
    // 6. Estimate win probability from spread
    const varContext = buildVarianceContext(game)
    const { sigmaSpread, sigmaTotal } = estimateVariance(varContext)
    const winProbTrue = phi(-trueSpread / sigmaSpread)
    
    return {
      homeScore,
      awayScore,
      trueSpread,
      trueTotal,
      winProbTrue,
      sigmaSpread,
      sigmaTotal,
      homePace: pace,
      awayPace: pace,
      gameContext: {
        homeAdjustments,
        awayAdjustments,
        baseHomeOffRtg: homeOffRtg,
        baseHomeDefRtg: homeDefRtg,
        baseAwayOffRtg: awayOffRtg,
        baseAwayDefRtg: awayDefRtg,
      },
    }
  }
  
  /**
   * Estimate variance (delegates to variance module)
   */
  estimateVariance(context: Record<string, any>): { sigmaSpread: number; sigmaTotal: number } {
    return estimateVariance({
      sport: this.sport,
      league: this.league,
      ...context,
    })
  }
  
  // ========================================================================
  // PACE PREDICTION
  // ========================================================================
  
  /**
   * Predict game pace (possessions per 48 minutes)
   */
  private predictPace(game: GameInput): number {
    // Get team pace preferences
    const homePace = game.homeTeam.stats?.pace ?? 100  // Default NBA average
    const awayPace = game.awayTeam.stats?.pace ?? 100
    
    // Weighted average (home team has slight influence)
    let predictedPace = (homePace * 0.52 + awayPace * 0.48)
    
    // Adjust for context
    // Back-to-back typically slows pace
    if (game.homeTeam.stats?.isBackToBack || game.awayTeam.stats?.isBackToBack) {
      predictedPace -= 2.0
    }
    
    // Altitude (Denver/Utah) increases pace
    if (game.venue && ['Denver', 'Utah', 'Salt Lake City'].some(v => game.venue?.includes(v))) {
      predictedPace += 1.5
    }
    
    return predictedPace
  }
  
  // ========================================================================
  // TEAM RATINGS
  // ========================================================================
  
  /**
   * Get offensive rating (points per 100 possessions)
   */
  private getOffensiveRating(team: any): number {
    // Try to get from recent stats
    if (team.stats?.offensiveRating) {
      return team.stats.offensiveRating
    }
    
    // Fallback: estimate from basic stats
    if (team.stats?.ppg && team.stats?.pace) {
      // Convert PPG to per-100-possession rating
      return (team.stats.ppg / team.stats.pace) * 100
    }
    
    // Default to league average
    return 110  // NBA average ~110
  }
  
  /**
   * Get defensive rating (points allowed per 100 possessions)
   */
  private getDefensiveRating(team: any): number {
    // Try to get from recent stats
    if (team.stats?.defensiveRating) {
      return team.stats.defensiveRating
    }
    
    // Fallback: estimate from basic stats
    if (team.stats?.oppPpg && team.stats?.pace) {
      return (team.stats.oppPpg / team.stats.pace) * 100
    }
    
    // Default to league average
    return 110
  }
  
  // ========================================================================
  // CONTEXT ADJUSTMENTS
  // ========================================================================
  
  /**
   * Get context-based adjustments (rest, travel, altitude, lineups)
   */
  private getContextAdjustments(
    game: GameInput,
    side: 'home' | 'away'
  ): { totalEffect: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {}
    
    const team = side === 'home' ? game.homeTeam : game.awayTeam
    const isHome = side === 'home'
    
    // Home court advantage (~2.5 points)
    if (isHome) {
      breakdown.homeAdvantage = 2.5
    } else {
      breakdown.homeAdvantage = 0
    }
    
    // Rest advantage (b2b penalty)
    if (team.stats?.isBackToBack) {
      breakdown.restPenalty = -2.0  // Fatigue effect
    } else if (team.stats?.daysRest && team.stats.daysRest >= 3) {
      breakdown.restBonus = 0.5  // Well-rested
    }
    
    // Travel penalty
    if (team.stats?.travelDistance && team.stats.travelDistance > 1500) {
      breakdown.travelPenalty = -1.0  // Long road trip
    }
    
    // Altitude advantage (Denver/Utah home games only)
    if (isHome && game.venue && ['Denver', 'Utah', 'Salt Lake City'].some(v => game.venue?.includes(v))) {
      breakdown.altitudeAdvantage = 1.5
    } else if (!isHome && game.venue && ['Denver', 'Utah', 'Salt Lake City'].some(v => game.venue?.includes(v))) {
      breakdown.altitudePenalty = -1.0  // Visitors struggle
    }
    
    // Lineup adjustments (if we have on/off data)
    if (team.stats?.lineupNetRating) {
      // This would come from detailed lineup analytics
      // For now, placeholder
      breakdown.lineupEffect = team.stats.lineupNetRating * 0.1
    }
    
    // Injury impact (major players out)
    if (game.injuries) {
      const teamInjuries = game.injuries.filter(inj => {
        // Filter to this team's injuries (would need team ID matching)
        return inj.status === 'out' && (inj.impact ?? 0) > 20  // Major contributor
      })
      
      if (teamInjuries.length > 0) {
        const totalImpact = teamInjuries.reduce((sum, inj) => sum + (inj.impact ?? 0), 0)
        breakdown.injuryPenalty = -(totalImpact / 48) * 3  // Convert minutes to point impact
      }
    }
    
    // Sum all adjustments
    const totalEffect = Object.values(breakdown).reduce((sum, val) => sum + val, 0)
    
    return { totalEffect, breakdown }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create NBA score model instance
 */
export const createNBAScoreModel = (): NBAScoreModel => {
  return new NBAScoreModel()
}

