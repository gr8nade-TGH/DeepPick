import { supabase } from '@/lib/supabase/server'
import { TheOddsAPIService } from '@/lib/api/the-odds-api'

export interface OddsData {
  game_id: string
  sport: string
  league: string
  home_team: string
  away_team: string
  game_date: string
  game_time: string
  odds: {
    moneyline?: { home: number; away: number }
    spread?: { home: number; away: number; line: number }
    total?: { over: number; under: number; line: number }
    player_props?: Array<{
      player_name: string
      prop_type: string
      line: number
      over_odds: number
      under_odds: number
    }>
  }
  last_updated: string
  source: string
}

export interface GameData {
  id: string
  sport: string
  league: string
  home_team: any
  away_team: any
  game_date: string
  game_time: string
  status: string
  venue?: string
  weather?: any
  odds: any
  created_at: string
  updated_at: string
}

export class OddsIngestionService {
  private static instance: OddsIngestionService
  private refreshInterval: NodeJS.Timeout | null = null
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): OddsIngestionService {
    if (!OddsIngestionService.instance) {
      OddsIngestionService.instance = new OddsIngestionService()
    }
    return OddsIngestionService.instance
  }

  async startIngestion(): Promise<void> {
    console.log('🚀 Starting odds data ingestion pipeline...')
    
    // Run immediately
    await this.ingestOddsData()
    
    // Then run every 5 minutes
    this.refreshInterval = setInterval(async () => {
      await this.ingestOddsData()
    }, this.REFRESH_INTERVAL)
  }

  stopIngestion(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
      console.log('⏹️ Stopped odds data ingestion pipeline')
    }
  }

  private async ingestOddsData(): Promise<void> {
    try {
      console.log('📊 Ingesting fresh odds data from The Odds API...')
      
      const oddsAPI = TheOddsAPIService.getInstance()
      
      // Fetch from multiple sports
      const [nflData, nbaData, mlbData] = await Promise.allSettled([
        this.fetchNFLData(oddsAPI),
        this.fetchNBAData(oddsAPI),
        this.fetchMLBData(oddsAPI)
      ])

      // Process and store data
      const allOddsData: OddsData[] = []
      
      if (nflData.status === 'fulfilled') allOddsData.push(...nflData.value)
      if (nbaData.status === 'fulfilled') allOddsData.push(...nbaData.value)
      if (mlbData.status === 'fulfilled') allOddsData.push(...mlbData.value)

      // Store in database
      await this.storeOddsData(allOddsData)
      
      // Trigger algorithm processing
      await this.triggerAlgorithmProcessing(allOddsData)
      
      console.log(`✅ Ingested ${allOddsData.length} games with fresh odds`)
    } catch (error) {
      console.error('❌ Error ingesting odds data:', error)
    }
  }

  private async fetchNFLData(oddsAPI: TheOddsAPIService): Promise<OddsData[]> {
    try {
      const events = await oddsAPI.getOdds(
        'americanfootball_nfl',
        ['us'],
        ['h2h', 'spreads', 'totals', 'player_pass_tds', 'player_rush_yards', 'player_receiving_yards']
      )
      
      return events.map(event => oddsAPI.convertToInternalFormat(event))
    } catch (error) {
      console.error('Error fetching NFL data:', error)
      return []
    }
  }

  private async fetchNBAData(oddsAPI: TheOddsAPIService): Promise<OddsData[]> {
    try {
      const events = await oddsAPI.getOdds(
        'basketball_nba',
        ['us'],
        ['h2h', 'spreads', 'totals', 'player_points', 'player_assists', 'player_rebounds']
      )
      
      return events.map(event => oddsAPI.convertToInternalFormat(event))
    } catch (error) {
      console.error('Error fetching NBA data:', error)
      return []
    }
  }

  private async fetchMLBData(oddsAPI: TheOddsAPIService): Promise<OddsData[]> {
    try {
      const events = await oddsAPI.getOdds(
        'baseball_mlb',
        ['us'],
        ['h2h', 'spreads', 'totals']
      )
      
      return events.map(event => oddsAPI.convertToInternalFormat(event))
    } catch (error) {
      console.error('Error fetching MLB data:', error)
      return []
    }
  }

  private async storeOddsData(oddsData: OddsData[]): Promise<void> {
    for (const data of oddsData) {
      // Upsert game data
      const { error: gameError } = await supabase
        .from('games')
        .upsert({
          id: data.game_id,
          sport: data.sport,
          league: data.league,
          home_team: { name: data.home_team },
          away_team: { name: data.away_team },
          game_date: data.game_date,
          game_time: data.game_time,
          status: 'scheduled',
          odds: data.odds,
          updated_at: new Date().toISOString()
        })

      if (gameError) {
        console.error(`Error storing game ${data.game_id}:`, gameError)
      }
    }
  }

  private async triggerAlgorithmProcessing(oddsData: OddsData[]): Promise<void> {
    // Trigger all algorithm modules
    const { AlgorithmProcessor } = await import('./algorithm-processor')
    const processor = AlgorithmProcessor.getInstance()
    
    for (const data of oddsData) {
      await processor.processGame(data)
    }
  }
}
