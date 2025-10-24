import { getSupabaseAdmin } from '@/lib/supabase/server'
import { capper_type } from '@/lib/database.types'

export type BetType = 'TOTAL' | 'SPREAD' | 'MONEYLINE'
export type PickResult = 'PICK_GENERATED' | 'PASS' | 'ERROR'

export interface AvailableGame {
  game_id: string
  home_team: string
  away_team: string
  game_time: string
  total_line: number
  spread_line: number
}

export interface PickGenerationResult {
  runId: string
  gameId: string
  capper: capper_type
  betType: BetType
  result: PickResult
  units: number
  confidence?: number
  pickId?: string
}

/**
 * Service for managing automated pick generation logic
 * Handles cooldown periods, duplicate prevention, and capper-specific tracking
 */
export class PickGenerationService {
  private supabase = getSupabaseAdmin()

  /**
   * Check if a game can be processed for pick generation
   * @param gameId - The game ID to check
   * @param capper - Which capper is attempting to generate picks
   * @param betType - Type of bet (TOTAL, SPREAD, MONEYLINE)
   * @param cooldownHours - Hours to wait after a PASS (default: 2)
   * @returns true if pick generation is allowed
   */
  async canGeneratePick(
    gameId: string,
    capper: capper_type,
    betType: BetType,
    cooldownHours: number = 2
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('can_generate_pick', {
        p_game_id: gameId,
        p_capper: capper,
        p_bet_type: betType,
        p_cooldown_hours: cooldownHours
      })

      if (error) {
        console.error('[PickGenerationService] Error checking pick eligibility:', error)
        return false
      }

      return data === true
    } catch (error) {
      console.error('[PickGenerationService] Exception checking pick eligibility:', error)
      return false
    }
  }

  /**
   * Get games available for pick generation
   * @param capper - Which capper is requesting games
   * @param betType - Type of bet to generate (default: TOTAL)
   * @param cooldownHours - Hours to wait after a PASS (default: 2)
   * @param limit - Maximum number of games to return (default: 10)
   * @returns Array of available games
   */
  async getAvailableGames(
    capper: capper_type,
    betType: BetType = 'TOTAL',
    cooldownHours: number = 2,
    limit: number = 10
  ): Promise<AvailableGame[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_available_games_for_pick_generation', {
        p_capper: capper,
        p_bet_type: betType,
        p_cooldown_hours: cooldownHours,
        p_limit: limit
      })

      if (error) {
        console.error('[PickGenerationService] Error getting available games:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('[PickGenerationService] Exception getting available games:', error)
      return []
    }
  }

  /**
   * Record the result of a pick generation run
   * @param result - The pick generation result
   * @param cooldownHours - Hours to wait before allowing another attempt (default: 2)
   */
  async recordPickGenerationResult(
    result: PickGenerationResult,
    cooldownHours: number = 2
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('record_pick_generation_result', {
        p_run_id: result.runId,
        p_game_id: result.gameId,
        p_capper: result.capper,
        p_bet_type: result.betType,
        p_result: result.result,
        p_units: result.units,
        p_confidence: result.confidence,
        p_pick_id: result.pickId,
        p_cooldown_hours: cooldownHours
      })

      if (error) {
        console.error('[PickGenerationService] Error recording pick generation result:', error)
        throw error
      }

      console.log(`[PickGenerationService] Recorded ${result.result} for ${result.capper} on game ${result.gameId}`)
    } catch (error) {
      console.error('[PickGenerationService] Exception recording pick generation result:', error)
      throw error
    }
  }

  /**
   * Get recent pick generation attempts for a capper
   * @param capper - Which capper to check
   * @param hours - How many hours back to look (default: 24)
   * @returns Array of recent attempts
   */
  async getRecentAttempts(
    capper: capper_type,
    hours: number = 24
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('pick_generation_cooldowns')
        .select('*')
        .eq('capper', capper)
        .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[PickGenerationService] Error getting recent attempts:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('[PickGenerationService] Exception getting recent attempts:', error)
      return []
    }
  }

  /**
   * Get cooldown status for a specific game/capper/betType combination
   * @param gameId - The game ID
   * @param capper - Which capper
   * @param betType - Type of bet
   * @returns Cooldown information or null if no cooldown
   */
  async getCooldownStatus(
    gameId: string,
    capper: capper_type,
    betType: BetType
  ): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('pick_generation_cooldowns')
        .select('*')
        .eq('game_id', gameId)
        .eq('capper', capper)
        .eq('bet_type', betType)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[PickGenerationService] Error getting cooldown status:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('[PickGenerationService] Exception getting cooldown status:', error)
      return null
    }
  }

  /**
   * Clean up expired cooldown records
   * @param hoursOld - Remove records older than this many hours (default: 48)
   */
  async cleanupExpiredCooldowns(hoursOld: number = 48): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString()
      
      const { error } = await this.supabase
        .from('pick_generation_cooldowns')
        .delete()
        .lt('created_at', cutoffTime)

      if (error) {
        console.error('[PickGenerationService] Error cleaning up expired cooldowns:', error)
        throw error
      }

      console.log(`[PickGenerationService] Cleaned up cooldown records older than ${hoursOld} hours`)
    } catch (error) {
      console.error('[PickGenerationService] Exception cleaning up expired cooldowns:', error)
      throw error
    }
  }
}

// Export singleton instance
export const pickGenerationService = new PickGenerationService()
