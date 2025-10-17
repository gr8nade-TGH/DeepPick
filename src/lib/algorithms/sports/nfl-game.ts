import { OddsData, AlgorithmResult, AlgorithmModule } from '../algorithm-processor'

export class NFLGameAlgorithm implements AlgorithmModule {
  name = 'NFL Game Algorithm'
  sport = 'nfl'
  bet_type = 'game' as const

  async process(oddsData: OddsData): Promise<AlgorithmResult> {
    console.log(`🏈 Running NFL Game Algorithm for ${oddsData.home_team} vs ${oddsData.away_team}`)
    
    // Get AI research data for this game
    const researchData = await this.getAIResearchData(oddsData)
    
    // Analyze moneyline
    const moneylineAnalysis = this.analyzeMoneyline(oddsData, researchData)
    
    // Analyze spread
    const spreadAnalysis = this.analyzeSpread(oddsData, researchData)
    
    // Analyze total
    const totalAnalysis = this.analyzeTotal(oddsData, researchData)
    
    // Determine best bet
    const bestBet = this.determineBestBet(moneylineAnalysis, spreadAnalysis, totalAnalysis)
    
    return {
      should_bet: bestBet.should_bet,
      confidence: bestBet.confidence,
      reasoning: bestBet.reasoning,
      bet_details: bestBet.bet_details,
      data_points: bestBet.data_points
    }
  }

  private async getAIResearchData(oddsData: OddsData): Promise<any> {
    // TODO: Integrate with AI research system
    // This would fetch weather, injuries, trends, etc.
    return {
      weather: { temperature: 45, wind_speed: 8, precipitation: 0.1 },
      injuries: { home: [], away: [] },
      trends: { home_ats: 8-4, away_ats: 6-6 },
      power_ratings: { home: 85, away: 78 }
    }
  }

  private analyzeMoneyline(oddsData: OddsData, researchData: any): any {
    if (!oddsData.odds.moneyline) return { value: 0, confidence: 0 }
    
    const { home, away } = oddsData.odds.moneyline
    const homeImplied = this.calculateImpliedProbability(home)
    const awayImplied = this.calculateImpliedProbability(away)
    
    // Calculate true probability based on research
    const homeTrueProb = this.calculateTrueProbability(researchData, 'home')
    const awayTrueProb = 1 - homeTrueProb
    
    const homeValue = homeTrueProb - homeImplied
    const awayValue = awayTrueProb - awayImplied
    
    return {
      home_value: homeValue,
      away_value: awayValue,
      best_side: homeValue > awayValue ? 'home' : 'away',
      value: Math.max(homeValue, awayValue),
      confidence: Math.abs(Math.max(homeValue, awayValue)) * 100
    }
  }

  private analyzeSpread(oddsData: OddsData, researchData: any): any {
    if (!oddsData.odds.spread) return { value: 0, confidence: 0 }
    
    const { line, home, away } = oddsData.odds.spread
    const homeImplied = this.calculateImpliedProbability(home)
    const awayImplied = this.calculateImpliedProbability(away)
    
    // Calculate expected margin based on research
    const expectedMargin = this.calculateExpectedMargin(researchData)
    const homeCoverProb = this.calculateCoverProbability(expectedMargin, line)
    const awayCoverProb = 1 - homeCoverProb
    
    const homeValue = homeCoverProb - homeImplied
    const awayValue = awayCoverProb - awayImplied
    
    return {
      line,
      home_value: homeValue,
      away_value: awayValue,
      best_side: homeValue > awayValue ? 'home' : 'away',
      value: Math.max(homeValue, awayValue),
      confidence: Math.abs(Math.max(homeValue, awayValue)) * 100
    }
  }

  private analyzeTotal(oddsData: OddsData, researchData: any): any {
    if (!oddsData.odds.total) return { value: 0, confidence: 0 }
    
    const { line, over, under } = oddsData.odds.total
    const overImplied = this.calculateImpliedProbability(over)
    const underImplied = this.calculateImpliedProbability(under)
    
    // Calculate expected total based on research
    const expectedTotal = this.calculateExpectedTotal(researchData)
    const overProb = this.calculateOverProbability(expectedTotal, line)
    const underProb = 1 - overProb
    
    const overValue = overProb - overImplied
    const underValue = underProb - underImplied
    
    return {
      line,
      over_value: overValue,
      under_value: underValue,
      best_side: overValue > underValue ? 'over' : 'under',
      value: Math.max(overValue, underValue),
      confidence: Math.abs(Math.max(overValue, underValue)) * 100
    }
  }

  private determineBestBet(moneyline: any, spread: any, total: any): any {
    const bets = [
      { type: 'moneyline', ...moneyline },
      { type: 'spread', ...spread },
      { type: 'total', ...total }
    ]
    
    // Find the bet with highest value and confidence
    const bestBet = bets.reduce((best, current) => {
      const currentScore = current.value * current.confidence
      const bestScore = best.value * best.confidence
      return currentScore > bestScore ? current : best
    })
    
    if (bestBet.value < 0.05 || bestBet.confidence < 60) {
      return {
        should_bet: false,
        confidence: 0,
        reasoning: 'No value found in any betting option',
        data_points: []
      }
    }
    
    return {
      should_bet: true,
      confidence: bestBet.confidence,
      reasoning: this.generateReasoning(bestBet),
      bet_details: this.createBetDetails(bestBet, moneyline, spread, total),
      data_points: this.generateDataPoints(bestBet)
    }
  }

  private createBetDetails(bestBet: any, moneyline: any, spread: any, total: any): any {
    const { home_team, away_team, odds } = bestBet.type === 'moneyline' ? 
      { home_team: 'home', away_team: 'away', odds: moneyline } :
      bestBet.type === 'spread' ?
      { home_team: 'home', away_team: 'away', odds: spread } :
      { home_team: 'over', away_team: 'under', odds: total }
    
    return {
      selection: this.formatSelection(bestBet, home_team, away_team),
      odds: bestBet.best_side === 'home' ? odds.home : odds.away,
      units: this.calculateUnits(bestBet.confidence),
      bet_type: bestBet.type,
      prop_type: undefined,
      player_name: undefined
    }
  }

  private formatSelection(bestBet: any, homeTeam: string, awayTeam: string): string {
    if (bestBet.type === 'moneyline') {
      return bestBet.best_side === 'home' ? `${homeTeam} ML` : `${awayTeam} ML`
    } else if (bestBet.type === 'spread') {
      const line = bestBet.line
      return bestBet.best_side === 'home' ? `${homeTeam} ${line > 0 ? '+' : ''}${line}` : `${awayTeam} ${line > 0 ? '+' : ''}${line}`
    } else {
      return bestBet.best_side === 'over' ? `Over ${bestBet.line}` : `Under ${bestBet.line}`
    }
  }

  private calculateUnits(confidence: number): number {
    if (confidence >= 85) return 3.0
    if (confidence >= 75) return 2.5
    if (confidence >= 65) return 2.0
    return 1.5
  }

  private calculateImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100)
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100)
    }
  }

  private calculateTrueProbability(researchData: any, side: string): number {
    // Simplified calculation - would be much more complex in reality
    const baseProb = 0.5
    const weatherFactor = researchData.weather.temperature < 32 ? 0.05 : 0
    const injuryFactor = researchData.injuries[side].length * 0.02
    return baseProb + weatherFactor - injuryFactor
  }

  private calculateExpectedMargin(researchData: any): number {
    // Simplified calculation
    return researchData.power_ratings.home - researchData.power_ratings.away
  }

  private calculateCoverProbability(expectedMargin: number, line: number): number {
    // Simplified calculation
    const diff = expectedMargin - line
    return 0.5 + (diff * 0.02)
  }

  private calculateExpectedTotal(researchData: any): number {
    // Simplified calculation
    return 45 + (researchData.weather.temperature - 50) * 0.1
  }

  private calculateOverProbability(expectedTotal: number, line: number): number {
    // Simplified calculation
    const diff = expectedTotal - line
    return 0.5 + (diff * 0.02)
  }

  private generateReasoning(bestBet: any): string {
    return `NFL Game Algorithm: ${bestBet.type} analysis shows ${bestBet.confidence.toFixed(1)}% confidence with ${(bestBet.value * 100).toFixed(1)}% edge`
  }

  private generateDataPoints(bestBet: any): string[] {
    return [
      `algorithm: ${this.name}`,
      `bet_type: ${bestBet.type}`,
      `value: ${(bestBet.value * 100).toFixed(1)}%`,
      `confidence: ${bestBet.confidence.toFixed(1)}%`
    ]
  }
}
