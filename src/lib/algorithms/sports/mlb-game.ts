import { OddsData, AlgorithmResult, AlgorithmModule } from '../algorithm-processor'

export class MLBGameAlgorithm implements AlgorithmModule {
  name = 'MLB Game Algorithm'
  sport = 'mlb'
  bet_type = 'game' as const

  async process(oddsData: OddsData): Promise<AlgorithmResult> {
    console.log(`⚾ Running MLB Game Algorithm for ${oddsData.home_team} vs ${oddsData.away_team}`)
    
    // Get AI research data for this game
    const researchData = await this.getAIResearchData(oddsData)
    
    // Analyze moneyline
    const moneylineAnalysis = this.analyzeMoneyline(oddsData, researchData)
    
    // Analyze run line (spread)
    const runLineAnalysis = this.analyzeRunLine(oddsData, researchData)
    
    // Analyze total runs
    const totalAnalysis = this.analyzeTotal(oddsData, researchData)
    
    // Determine best bet
    const bestBet = this.determineBestBet(moneylineAnalysis, runLineAnalysis, totalAnalysis)
    
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
    return {
      weather: { temperature: 72, wind_speed: 5, wind_direction: 'out', humidity: 0.6 },
      starting_pitchers: {
        home: { era: 3.45, whip: 1.20, k_per_9: 9.2, recent_form: 0.8 },
        away: { era: 4.12, whip: 1.35, k_per_9: 7.8, recent_form: 0.6 }
      },
      bullpen: { home: 3.80, away: 4.25 },
      offense: { home: 4.8, away: 4.2 },
      ballpark: { park_factor: 1.05, dimensions: 'hitter_friendly' }
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

  private analyzeRunLine(oddsData: OddsData, researchData: any): any {
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

  private determineBestBet(moneyline: any, runLine: any, total: any): any {
    const bets = [
      { type: 'moneyline', ...moneyline },
      { type: 'run_line', ...runLine },
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
        reasoning: 'No value found in any MLB betting option',
        data_points: []
      }
    }
    
    return {
      should_bet: true,
      confidence: bestBet.confidence,
      reasoning: this.generateReasoning(bestBet),
      bet_details: this.createBetDetails(bestBet, moneyline, runLine, total),
      data_points: this.generateDataPoints(bestBet)
    }
  }

  private createBetDetails(bestBet: any, moneyline: any, runLine: any, total: any): any {
    const odds = bestBet.type === 'moneyline' ? moneyline :
                 bestBet.type === 'run_line' ? runLine : total
    
    return {
      selection: this.formatSelection(bestBet, odds),
      odds: bestBet.best_side === 'home' || bestBet.best_side === 'over' ? odds.home : odds.away,
      units: this.calculateUnits(bestBet.confidence),
      bet_type: bestBet.type === 'run_line' ? 'spread' : bestBet.type,
      prop_type: undefined,
      player_name: undefined
    }
  }

  private formatSelection(bestBet: any, odds: any): string {
    if (bestBet.type === 'moneyline') {
      return bestBet.best_side === 'home' ? `${odds.home_team} ML` : `${odds.away_team} ML`
    } else if (bestBet.type === 'run_line') {
      const line = bestBet.line
      return bestBet.best_side === 'home' ? `${odds.home_team} ${line > 0 ? '+' : ''}${line}` : `${odds.away_team} ${line > 0 ? '+' : ''}${line}`
    } else {
      return bestBet.best_side === 'over' ? `Over ${bestBet.line}` : `Under ${bestBet.line}`
    }
  }

  private calculateUnits(confidence: number): number {
    if (confidence >= 85) return 2.5
    if (confidence >= 75) return 2.0
    if (confidence >= 65) return 1.5
    return 1.0
  }

  private calculateImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100)
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100)
    }
  }

  private calculateTrueProbability(researchData: any, side: string): number {
    const pitcher = researchData.starting_pitchers[side]
    const offense = researchData.offense[side]
    const ballpark = researchData.ballpark.park_factor
    
    // Simplified calculation
    const pitcherFactor = (5 - pitcher.era) / 5
    const offenseFactor = offense / 5
    const ballparkFactor = ballpark
    
    return (pitcherFactor + offenseFactor + ballparkFactor) / 3
  }

  private calculateExpectedMargin(researchData: any): number {
    const homeAdvantage = 0.5
    const pitcherDiff = researchData.starting_pitchers.home.era - researchData.starting_pitchers.away.era
    const offenseDiff = researchData.offense.home - researchData.offense.away
    
    return homeAdvantage - pitcherDiff + offenseDiff
  }

  private calculateCoverProbability(expectedMargin: number, line: number): number {
    const diff = expectedMargin - line
    return 0.5 + (diff * 0.05)
  }

  private calculateExpectedTotal(researchData: any): number {
    const baseTotal = 8.5
    const weatherFactor = this.getWeatherFactor(researchData.weather)
    const ballparkFactor = researchData.ballpark.park_factor
    const pitcherFactor = (researchData.starting_pitchers.home.era + researchData.starting_pitchers.away.era) / 2
    
    return baseTotal * weatherFactor * ballparkFactor * (5 / pitcherFactor)
  }

  private getWeatherFactor(weather: any): number {
    let factor = 1.0
    
    // Wind factor
    if (weather.wind_direction === 'out') {
      factor += weather.wind_speed * 0.02
    } else if (weather.wind_direction === 'in') {
      factor -= weather.wind_speed * 0.02
    }
    
    // Temperature factor
    if (weather.temperature > 80) {
      factor += 0.1
    } else if (weather.temperature < 60) {
      factor -= 0.1
    }
    
    return factor
  }

  private calculateOverProbability(expectedTotal: number, line: number): number {
    const diff = expectedTotal - line
    return 0.5 + (diff * 0.1)
  }

  private generateReasoning(bestBet: any): string {
    return `MLB Game Algorithm: ${bestBet.type} analysis shows ${bestBet.confidence.toFixed(1)}% confidence with ${(bestBet.value * 100).toFixed(1)}% edge`
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
