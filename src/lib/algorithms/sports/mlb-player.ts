import { OddsData, AlgorithmResult, AlgorithmModule } from '../algorithm-processor'

export class MLBPlayerAlgorithm implements AlgorithmModule {
  name = 'MLB Player Props Algorithm'
  sport = 'mlb'
  bet_type = 'player' as const

  async process(oddsData: OddsData): Promise<AlgorithmResult> {
    console.log(`⚾ Running MLB Player Props Algorithm for ${oddsData.home_team} vs ${oddsData.away_team}`)
    
    if (!oddsData.odds.player_props || oddsData.odds.player_props.length === 0) {
      return {
        should_bet: false,
        confidence: 0,
        reasoning: 'No player props available for this game',
        data_points: []
      }
    }
    
    const bestProps: any[] = []
    
    // Analyze each player prop
    for (const prop of oddsData.odds.player_props) {
      const analysis = await this.analyzePlayerProp(prop, oddsData)
      if (analysis.value > 0.05 && analysis.confidence > 60) {
        bestProps.push({ ...analysis, prop })
      }
    }
    
    if (bestProps.length === 0) {
      return {
        should_bet: false,
        confidence: 0,
        reasoning: 'No valuable MLB player props found',
        data_points: []
      }
    }
    
    // Find the best prop
    const bestProp = bestProps.reduce((best, current) => 
      (current.value * current.confidence) > (best.value * best.confidence) ? current : best
    )
    
    return {
      should_bet: true,
      confidence: bestProp.confidence,
      reasoning: bestProp.reasoning,
      bet_details: {
        selection: `${bestProp.prop.player_name} ${bestProp.prop.prop_type} ${bestProp.side} ${bestProp.prop.line}`,
        odds: bestProp.side === 'over' ? bestProp.prop.over_odds : bestProp.prop.under_odds,
        units: this.calculateUnits(bestProp.confidence),
        bet_type: 'player_prop',
        prop_type: bestProp.prop.prop_type,
        player_name: bestProp.prop.player_name
      },
      data_points: bestProp.data_points
    }
  }

  private async analyzePlayerProp(prop: any, oddsData: OddsData): Promise<any> {
    // Get player-specific research data
    const playerData = await this.getPlayerResearchData(prop.player_name, oddsData)
    
    // Calculate expected performance
    const expectedValue = this.calculateExpectedValue(prop, playerData)
    
    // Calculate implied probabilities
    const overImplied = this.calculateImpliedProbability(prop.over_odds)
    const underImplied = this.calculateImpliedProbability(prop.under_odds)
    
    // Calculate true probabilities
    const overProb = this.calculateOverProbability(expectedValue, prop.line, prop.prop_type)
    const underProb = 1 - overProb
    
    // Calculate value
    const overValue = overProb - overImplied
    const underValue = underProb - underImplied
    
    const bestSide = overValue > underValue ? 'over' : 'under'
    const value = Math.max(overValue, underValue)
    const confidence = Math.abs(value) * 100
    
    return {
      value,
      confidence,
      side: bestSide,
      reasoning: this.generatePropReasoning(prop, bestSide, value, confidence, playerData),
      data_points: this.generatePropDataPoints(prop, playerData, value, confidence)
    }
  }

  private async getPlayerResearchData(playerName: string, oddsData: OddsData): Promise<any> {
    // TODO: Integrate with AI research system for player-specific data
    return {
      recent_form: { avg: 0.285, trend: 'up' },
      vs_pitcher: { avg: 0.320, at_bats: 15 },
      ballpark_factor: 1.05,
      weather_impact: { factor: 0.98 },
      injury_status: 'healthy',
      lineup_position: 3,
      handedness: 'right',
      pitcher_handedness: 'right'
    }
  }

  private calculateExpectedValue(prop: any, playerData: any): number {
    // Different calculations based on prop type
    switch (prop.prop_type) {
      case 'hits':
        return this.calculateHits(playerData)
      case 'runs':
        return this.calculateRuns(playerData)
      case 'rbis':
        return this.calculateRBIs(playerData)
      case 'strikeouts':
        return this.calculateStrikeouts(playerData)
      case 'home_runs':
        return this.calculateHomeRuns(playerData)
      case 'total_bases':
        return this.calculateTotalBases(playerData)
      default:
        return prop.line * 0.5 // Default to line midpoint
    }
  }

  private calculateHits(playerData: any): number {
    const baseAvg = playerData.recent_form.avg
    const vsPitcherFactor = playerData.vs_pitcher.avg / playerData.recent_form.avg
    const ballparkFactor = playerData.ballpark_factor
    const weatherFactor = playerData.weather_impact.factor
    const handednessFactor = this.getHandednessFactor(playerData.handedness, playerData.pitcher_handedness)
    
    return baseAvg * vsPitcherFactor * ballparkFactor * weatherFactor * handednessFactor
  }

  private calculateRuns(playerData: any): number {
    const hits = this.calculateHits(playerData)
    const lineupFactor = this.getLineupFactor(playerData.lineup_position)
    return hits * lineupFactor
  }

  private calculateRBIs(playerData: any): number {
    const hits = this.calculateHits(playerData)
    const lineupFactor = this.getLineupFactor(playerData.lineup_position)
    const powerFactor = 1.2 // Higher for RBI opportunities
    return hits * lineupFactor * powerFactor
  }

  private calculateStrikeouts(playerData: any): number {
    const baseKRate = 0.25 // Average strikeout rate
    const vsPitcherFactor = playerData.vs_pitcher.avg < playerData.recent_form.avg ? 1.2 : 0.8
    const handednessFactor = this.getHandednessFactor(playerData.handedness, playerData.pitcher_handedness)
    
    return baseKRate * vsPitcherFactor * handednessFactor
  }

  private calculateHomeRuns(playerData: any): number {
    const baseHRRate = 0.05 // Average home run rate
    const ballparkFactor = playerData.ballpark_factor
    const weatherFactor = playerData.weather_impact.factor
    const powerFactor = 1.3
    
    return baseHRRate * ballparkFactor * weatherFactor * powerFactor
  }

  private calculateTotalBases(playerData: any): number {
    const hits = this.calculateHits(playerData)
    const homeRuns = this.calculateHomeRuns(playerData)
    const doubles = hits * 0.2
    const triples = hits * 0.05
    
    return (hits - homeRuns - doubles - triples) + (doubles * 2) + (triples * 3) + (homeRuns * 4)
  }

  private getHandednessFactor(batterHand: string, pitcherHand: string): number {
    // Righty vs Righty: 1.0
    // Righty vs Lefty: 1.1
    // Lefty vs Righty: 1.1
    // Lefty vs Lefty: 0.9
    if (batterHand === pitcherHand) {
      return batterHand === 'left' ? 0.9 : 1.0
    }
    return 1.1
  }

  private getLineupFactor(position: number): number {
    // Higher positions get more at-bats and run opportunities
    const factors = [1.2, 1.1, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]
    return factors[position - 1] || 0.7
  }

  private calculateOverProbability(expectedValue: number, line: number, propType: string): number {
    // Different calculations based on prop type
    const variance = this.getPropVariance(propType)
    const diff = expectedValue - line
    return 0.5 + (diff / (variance * 2))
  }

  private getPropVariance(propType: string): number {
    const variances: { [key: string]: number } = {
      'hits': 0.3,
      'runs': 0.2,
      'rbis': 0.25,
      'strikeouts': 0.2,
      'home_runs': 0.1,
      'total_bases': 0.4
    }
    return variances[propType] || 0.2
  }

  private calculateImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100)
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100)
    }
  }

  private calculateUnits(confidence: number): number {
    if (confidence >= 85) return 2.0
    if (confidence >= 75) return 1.5
    if (confidence >= 65) return 1.0
    return 0.5
  }

  private generatePropReasoning(prop: any, side: string, value: number, confidence: number, playerData: any): string {
    return `MLB Player Props: ${prop.player_name} ${prop.prop_type} ${side} ${prop.line} - ${confidence.toFixed(1)}% confidence, ${(value * 100).toFixed(1)}% edge`
  }

  private generatePropDataPoints(prop: any, playerData: any, value: number, confidence: number): string[] {
    return [
      `algorithm: ${this.name}`,
      `player: ${prop.player_name}`,
      `prop_type: ${prop.prop_type}`,
      `value: ${(value * 100).toFixed(1)}%`,
      `confidence: ${confidence.toFixed(1)}%`,
      `recent_form: ${playerData.recent_form.avg}`,
      `vs_pitcher: ${playerData.vs_pitcher.avg}`,
      `ballpark_factor: ${playerData.ballpark_factor}`
    ]
  }
}
