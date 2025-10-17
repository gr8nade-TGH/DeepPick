import { OddsData } from '../data-pipeline/odds-ingestion'
import { NFLGameAlgorithm } from './sports/nfl-game'
import { NFLPlayerAlgorithm } from './sports/nfl-player'
import { MLBGameAlgorithm } from './sports/mlb-game'
import { MLBPlayerAlgorithm } from './sports/mlb-player'

export interface AlgorithmResult {
  should_bet: boolean
  confidence: number
  reasoning: string
  bet_details?: {
    selection: string
    odds: number
    units: number
    bet_type: string
    prop_type?: string
    player_name?: string
  }
  data_points: string[]
}

export interface AlgorithmModule {
  name: string
  sport: string
  bet_type: 'game' | 'player'
  process(oddsData: OddsData): Promise<AlgorithmResult>
}

export class AlgorithmProcessor {
  private static instance: AlgorithmProcessor
  private algorithms: Map<string, AlgorithmModule> = new Map()

  static getInstance(): AlgorithmProcessor {
    if (!AlgorithmProcessor.instance) {
      AlgorithmProcessor.instance = new AlgorithmProcessor()
    }
    return AlgorithmProcessor.instance
  }

  constructor() {
    this.initializeAlgorithms()
  }

  private initializeAlgorithms(): void {
    // Initialize all algorithm modules
    this.algorithms.set('nfl-game', new NFLGameAlgorithm())
    this.algorithms.set('nfl-player', new NFLPlayerAlgorithm())
    this.algorithms.set('mlb-game', new MLBGameAlgorithm())
    this.algorithms.set('mlb-player', new MLBPlayerAlgorithm())
  }

  async processGame(oddsData: OddsData): Promise<void> {
    console.log(`🔍 Processing game: ${oddsData.home_team} vs ${oddsData.away_team}`)
    
    const results: AlgorithmResult[] = []
    
    // Run all applicable algorithms
    for (const [key, algorithm] of this.algorithms) {
      if (this.isAlgorithmApplicable(algorithm, oddsData)) {
        try {
          const result = await algorithm.process(oddsData)
          results.push(result)
          
          console.log(`📊 ${algorithm.name}: ${result.should_bet ? 'BET' : 'NO BET'} (${result.confidence}% confidence)`)
          
          // If algorithm recommends a bet, create it
          if (result.should_bet && result.bet_details) {
            await this.createPick(result, oddsData)
          }
        } catch (error) {
          console.error(`❌ Error in ${algorithm.name}:`, error)
        }
      }
    }
    
    console.log(`✅ Processed ${results.length} algorithms for ${oddsData.sport} game`)
  }

  private isAlgorithmApplicable(algorithm: AlgorithmModule, oddsData: OddsData): boolean {
    return algorithm.sport === oddsData.sport
  }

  private async createPick(result: AlgorithmResult, oddsData: OddsData): Promise<void> {
    if (!result.bet_details) return

    const { supabase } = await import('@/lib/supabase/server')
    
    // Check for duplicate bets
    const isDuplicate = await this.checkForDuplicateBet(oddsData.game_id, result.bet_details)
    if (isDuplicate) {
      console.log('🚫 Duplicate bet prevented:', result.bet_details.selection)
      return
    }

    // Create the pick
    const { error } = await supabase
      .from('picks')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user
        game_id: oddsData.game_id,
        sport: oddsData.sport,
        bet_type: result.bet_details.bet_type,
        selection: result.bet_details.selection,
        odds: result.bet_details.odds,
        confidence: this.mapConfidenceToLevel(result.confidence),
        units: result.bet_details.units,
        potential_payout: this.calculatePayout(result.bet_details.odds, result.bet_details.units),
        status: 'pending',
        reasoning: result.reasoning,
        data_points: result.data_points
      })

    if (error) {
      console.error('❌ Error creating pick:', error)
    } else {
      console.log('✅ Pick created:', result.bet_details.selection)
    }
  }

  private async checkForDuplicateBet(gameId: string, betDetails: any): Promise<boolean> {
    const { supabase } = await import('@/lib/supabase/server')
    
    const { data, error } = await supabase
      .from('picks')
      .select('id')
      .eq('game_id', gameId)
      .eq('selection', betDetails.selection)
      .eq('status', 'pending')

    if (error) {
      console.error('Error checking for duplicates:', error)
      return true // Err on the side of caution
    }

    return (data?.length || 0) > 0
  }

  private mapConfidenceToLevel(confidence: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (confidence >= 85) return 'very_high'
    if (confidence >= 70) return 'high'
    if (confidence >= 55) return 'medium'
    return 'low'
  }

  private calculatePayout(odds: number, units: number): number {
    if (odds > 0) {
      return units * (odds / 100)
    } else {
      return units * (100 / Math.abs(odds))
    }
  }
}
