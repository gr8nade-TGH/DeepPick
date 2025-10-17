import { env } from '@/lib/env'

export interface TheOddsAPIEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: TheOddsAPIBookmaker[]
}

export interface TheOddsAPIBookmaker {
  key: string
  title: string
  last_update: string
  markets: TheOddsAPIMarket[]
}

export interface TheOddsAPIMarket {
  key: string
  last_update: string
  outcomes: TheOddsAPIOutcome[]
  point?: number
}

export interface TheOddsAPIOutcome {
  name: string
  price: number
  description?: string
  point?: number
}

export interface TheOddsAPISport {
  key: string
  group: string
  title: string
  description: string
  active: boolean
  has_outrights: boolean
}

export class TheOddsAPIService {
  private static instance: TheOddsAPIService
  private readonly baseUrl = 'https://api.the-odds-api.com/v4'
  private readonly apiKey: string

  constructor() {
    this.apiKey = env.THE_ODDS_API_KEY || ''
    if (!this.apiKey) {
      console.warn('⚠️ THE_ODDS_API_KEY not found in environment variables')
    }
  }

  static getInstance(): TheOddsAPIService {
    if (!TheOddsAPIService.instance) {
      TheOddsAPIService.instance = new TheOddsAPIService()
    }
    return TheOddsAPIService.instance
  }

  async getSports(): Promise<TheOddsAPISport[]> {
    const response = await this.makeRequest('/sports/')
    return response.data || response
  }

  async getOdds(
    sport: string,
    regions: string[] = ['us'],
    markets: string[] = ['h2h', 'spreads', 'totals'],
    oddsFormat: 'american' | 'decimal' = 'american'
  ): Promise<TheOddsAPIEvent[]> {
    const params = new URLSearchParams({
      regions: regions.join(','),
      markets: markets.join(','),
      oddsFormat,
      apiKey: this.apiKey
    })

    const response = await this.makeRequest(`/sports/${sport}/odds?${params}`)
    return response.data || response
  }

  async getScores(
    sport: string,
    daysFrom: number = 1
  ): Promise<any[]> {
    const params = new URLSearchParams({
      daysFrom: daysFrom.toString(),
      apiKey: this.apiKey
    })

    const response = await this.makeRequest(`/sports/${sport}/scores?${params}`)
    return response.data || response
  }

  async getEventOdds(
    sport: string,
    eventId: string,
    regions: string[] = ['us'],
    markets: string[] = ['h2h', 'spreads', 'totals', 'player_points', 'player_pass_tds', 'player_rush_yards'],
    oddsFormat: 'american' | 'decimal' = 'american'
  ): Promise<TheOddsAPIEvent> {
    const params = new URLSearchParams({
      regions: regions.join(','),
      markets: markets.join(','),
      oddsFormat,
      apiKey: this.apiKey
    })

    const response = await this.makeRequest(`/sports/${sport}/events/${eventId}/odds?${params}`)
    return response.data || response
  }

  async getHistoricalOdds(
    sport: string,
    eventId: string,
    date: string,
    regions: string[] = ['us'],
    markets: string[] = ['h2h', 'spreads', 'totals'],
    oddsFormat: 'american' | 'decimal' = 'american'
  ): Promise<any> {
    const params = new URLSearchParams({
      date,
      regions: regions.join(','),
      markets: markets.join(','),
      oddsFormat,
      apiKey: this.apiKey
    })

    const response = await this.makeRequest(`/historical/sports/${sport}/events/${eventId}/odds?${params}`)
    return response.data || response
  }

  private async makeRequest(endpoint: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('The Odds API key is required')
    }

    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before making more requests.')
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Log usage headers for monitoring
      const requestsRemaining = response.headers.get('x-requests-remaining')
      const requestsUsed = response.headers.get('x-requests-used')
      
      if (requestsRemaining) {
        console.log(`📊 The Odds API: ${requestsUsed} used, ${requestsRemaining} remaining`)
      }

      return data
    } catch (error) {
      console.error('The Odds API request failed:', error)
      throw error
    }
  }

  // Helper method to convert The Odds API format to our internal format
  convertToInternalFormat(event: TheOddsAPIEvent): any {
    const odds: any = {
      moneyline: {},
      spread: {},
      total: {},
      player_props: []
    }

    // Process each bookmaker's markets
    for (const bookmaker of event.bookmakers) {
      for (const market of bookmaker.markets) {
        switch (market.key) {
          case 'h2h':
            this.processMoneylineMarket(market, odds.moneyline)
            break
          case 'spreads':
            this.processSpreadMarket(market, odds.spread)
            break
          case 'totals':
            this.processTotalMarket(market, odds.total)
            break
          case 'player_points':
          case 'player_pass_tds':
          case 'player_rush_yards':
          case 'player_receiving_yards':
            this.processPlayerPropMarket(market, odds.player_props)
            break
        }
      }
    }

    return {
      game_id: event.id,
      sport: this.mapSportKey(event.sport_key),
      league: event.sport_title,
      home_team: event.home_team,
      away_team: event.away_team,
      game_date: event.commence_time.split('T')[0],
      game_time: event.commence_time.split('T')[1]?.split('.')[0] || '00:00:00',
      odds,
      last_updated: new Date().toISOString(),
      source: 'the_odds_api'
    }
  }

  private processMoneylineMarket(market: TheOddsAPIMarket, odds: any): void {
    for (const outcome of market.outcomes) {
      odds[outcome.name.toLowerCase().includes('home') ? 'home' : 'away'] = outcome.price
    }
  }

  private processSpreadMarket(market: TheOddsAPIMarket, odds: any): void {
    for (const outcome of market.outcomes) {
      if (outcome.point !== undefined) {
        odds.line = outcome.point
        odds[outcome.name.toLowerCase().includes('home') ? 'home' : 'away'] = outcome.price
      }
    }
  }

  private processTotalMarket(market: TheOddsAPIMarket, odds: any): void {
    for (const outcome of market.outcomes) {
      if (outcome.point !== undefined) {
        odds.line = outcome.point
        odds[outcome.name.toLowerCase()] = outcome.price
      }
    }
  }

  private processPlayerPropMarket(market: TheOddsAPIMarket, playerProps: any[]): void {
    const propType = this.mapPropType(market.key)
    const prop: any = {
      prop_type: propType,
      line: market.outcomes[0]?.point || 0,
      over_odds: 0,
      under_odds: 0
    }

    for (const outcome of market.outcomes) {
      if (outcome.description) {
        prop.player_name = outcome.description
        if (outcome.name.toLowerCase() === 'over') {
          prop.over_odds = outcome.price
        } else if (outcome.name.toLowerCase() === 'under') {
          prop.under_odds = outcome.price
        }
      }
    }

    if (prop.player_name && prop.over_odds && prop.under_odds) {
      playerProps.push(prop)
    }
  }

  private mapSportKey(sportKey: string): string {
    const sportMap: { [key: string]: string } = {
      'americanfootball_nfl': 'nfl',
      'basketball_nba': 'nba',
      'baseball_mlb': 'mlb',
      'icehockey_nhl': 'nhl',
      'americanfootball_ncaaf': 'ncaaf',
      'basketball_ncaab': 'ncaab'
    }
    return sportMap[sportKey] || sportKey
  }

  private mapPropType(marketKey: string): string {
    const propMap: { [key: string]: string } = {
      'player_points': 'points',
      'player_pass_tds': 'passing_touchdowns',
      'player_rush_yards': 'rushing_yards',
      'player_receiving_yards': 'receiving_yards'
    }
    return propMap[marketKey] || marketKey
  }
}
