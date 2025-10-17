import { OddsData, AlgorithmResult, AlgorithmModule } from '../algorithm-processor'

export class NFLPlayerAlgorithm implements AlgorithmModule {
  name = 'NFL Player Props Algorithm'
  sport = 'nfl'
  bet_type = 'player' as const

  async process(oddsData: OddsData): Promise<AlgorithmResult> {
    console.log(`🏈 Running NFL Player Props Algorithm for ${oddsData.home_team} vs ${oddsData.away_team}`)
    
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
        reasoning: 'No valuable player props found',
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
      recent_form: { avg: 75.5, trend: 'up' },
      matchup_history: { avg: 82.3, games: 3 },
      weather_impact: { factor: 0.95 },
      injury_status: 'healthy',
      snap_share: 0.85,
      target_share: 0.25
    }
  }

  private calculateExpectedValue(prop: any, playerData: any): number {
    // Different calculations based on prop type
    switch (prop.prop_type) {
      case 'passing_yards':
        return this.calculatePassingYards(playerData)
      case 'receiving_yards':
        return this.calculateReceivingYards(playerData)
      case 'rushing_yards':
        return this.calculateRushingYards(playerData)
      case 'receptions':
        return this.calculateReceptions(playerData)
      case 'touchdowns':
        return this.calculateTouchdowns(playerData)
      default:
        return prop.line * 0.5 // Default to line midpoint
    }
  }

  private calculatePassingYards(playerData: any): number {
    const baseYards = playerData.recent_form.avg
    const weatherFactor = playerData.weather_impact.factor
    const matchupFactor = playerData.matchup_history.avg / 100
    return baseYards * weatherFactor * matchupFactor
  }

  private calculateReceivingYards(playerData: any): number {
    const baseYards = playerData.recent_form.avg
    const targetFactor = playerData.target_share * 100
    const weatherFactor = playerData.weather_impact.factor
    return baseYards * (targetFactor / 25) * weatherFactor
  }

  private calculateRushingYards(playerData: any): number {
    const baseYards = playerData.recent_form.avg
    const snapFactor = playerData.snap_share
    const weatherFactor = playerData.weather_impact.factor
    return baseYards * snapFactor * weatherFactor
  }

  private calculateReceptions(playerData: any): number {
    const baseReceptions = playerData.recent_form.avg
    const targetFactor = playerData.target_share
    return baseReceptions * targetFactor * 4 // Scale factor
  }

  private calculateTouchdowns(playerData: any): number {
    const baseTDs = playerData.recent_form.avg / 100
    const redZoneFactor = 1.2
    return baseTDs * redZoneFactor
  }

  private calculateOverProbability(expectedValue: number, line: number, propType: string): number {
    // Different calculations based on prop type
    const variance = this.getPropVariance(propType)
    const diff = expectedValue - line
    return 0.5 + (diff / (variance * 2))
  }

  private getPropVariance(propType: string): number {
    const variances: { [key: string]: number } = {
      'passing_yards': 50,
      'receiving_yards': 30,
      'rushing_yards': 25,
      'receptions': 2,
      'touchdowns': 0.5
    }
    return variances[propType] || 20
  }

  private calculateImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100)
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100)
    }
  }

  private calculateUnits(confidence: number): number {
    if (confidence >= 85) return 2.5
    if (confidence >= 75) return 2.0
    if (confidence >= 65) return 1.5
    return 1.0
  }

  private generatePropReasoning(prop: any, side: string, value: number, confidence: number, playerData: any): string {
    return `NFL Player Props: ${prop.player_name} ${prop.prop_type} ${side} ${prop.line} - ${confidence.toFixed(1)}% confidence, ${(value * 100).toFixed(1)}% edge`
  }

  private generatePropDataPoints(prop: any, playerData: any, value: number, confidence: number): string[] {
    return [
      `algorithm: ${this.name}`,
      `player: ${prop.player_name}`,
      `prop_type: ${prop.prop_type}`,
      `value: ${(value * 100).toFixed(1)}%`,
      `confidence: ${confidence.toFixed(1)}%`,
      `recent_form: ${playerData.recent_form.avg}`,
      `injury_status: ${playerData.injury_status}`
    ]
  }
}
