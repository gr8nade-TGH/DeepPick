import { getSupabaseAdmin } from '@/lib/supabase/server'

export interface PickGenerationResult {
  runId: string
  gameId: string
  capper: 'shiva' | 'nexus' | 'cerberus' | 'ifrit' | 'deeppick'
  betType: 'TOTAL' | 'SPREAD' | 'MONEYLINE'
  result: 'PICK_GENERATED' | 'PASS' | 'ERROR'
  units: number
  confidence?: number
  pickId?: string
}

export class PickGenerationService {
  private supabase = getSupabaseAdmin()

  /**
   * Check if a game can be processed for pick generation
   */
  async canGeneratePick(
    gameId: string,
    capper: string,
    betType: string,
    cooldownHours: number = 2
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('can_generate_pick', {
          p_game_id: gameId,
          p_capper: capper,
          p_bet_type: betType,
          p_cooldown_hours: cooldownHours
        })

      if (error) {
        console.error('[PickGenerationService] Error checking eligibility:', error)
        return false
      }

      return data === true
    } catch (error) {
      console.error('[PickGenerationService] Error in canGeneratePick:', error)
      return false
    }
  }

  /**
   * Record the result of a pick generation run
   */
  async recordPickGenerationResult(
    result: PickGenerationResult,
    cooldownHours: number = 2
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[PickGenerationService] Recording pick generation result:', {
        gameId: result.gameId,
        capper: result.capper,
        betType: result.betType,
        result: result.result,
        units: result.units,
        cooldownHours
      })

      const { error } = await this.supabase
        .rpc('record_pick_generation_result', {
          p_run_id: result.runId,
          p_game_id: result.gameId,
          p_capper: result.capper,
          p_bet_type: result.betType,
          p_result: result.result,
          p_units: result.units,
          p_confidence: result.confidence || null,
          p_pick_id: result.pickId || null,
          p_cooldown_hours: cooldownHours
        })

      if (error) {
        console.error('[PickGenerationService] Error recording result:', error)
        return { success: false, error: error.message }
      }

      console.log('[PickGenerationService] Successfully recorded pick generation result')
      return { success: true }
    } catch (error) {
      console.error('[PickGenerationService] Error in recordPickGenerationResult:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get available games for pick generation
   */
  async getAvailableGames(
    capper: string,
    betType: string = 'TOTAL',
    cooldownHours: number = 2,
    limit: number = 10
  ): Promise<{ games: any[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_available_games_for_pick_generation', {
          p_capper: capper,
          p_bet_type: betType,
          p_cooldown_hours: cooldownHours,
          p_limit: limit
        })

      if (error) {
        console.error('[PickGenerationService] Error getting available games:', error)
        return { games: [], error: error.message }
      }

      return { games: data || [] }
    } catch (error) {
      console.error('[PickGenerationService] Error in getAvailableGames:', error)
      return { 
        games: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get cooldown status for a specific game/capper/bet_type
   */
  async getCooldownStatus(
    gameId: string,
    capper: string,
    betType: string
  ): Promise<{ cooldown: any | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('pick_generation_cooldowns')
        .select('*')
        .eq('game_id', gameId)
        .eq('capper', capper)
        .eq('bet_type', betType)
        .gt('cooldown_until', new Date().toISOString())
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[PickGenerationService] Error getting cooldown status:', error)
        return { cooldown: null, error: error.message }
      }

      return { cooldown: data || null }
    } catch (error) {
      console.error('[PickGenerationService] Error in getCooldownStatus:', error)
      return { 
        cooldown: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Clean up expired cooldown records
   */
  async cleanupExpiredCooldowns(olderThanHours: number = 48): Promise<{ deleted: number; error?: string }> {
    try {
      const cutoffTime = new Date()
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours)

      const { data, error } = await this.supabase
        .from('pick_generation_cooldowns')
        .delete()
        .lt('cooldown_until', cutoffTime.toISOString())
        .select('id')

      if (error) {
        console.error('[PickGenerationService] Error cleaning up cooldowns:', error)
        return { deleted: 0, error: error.message }
      }

      const deletedCount = data?.length || 0
      console.log(`[PickGenerationService] Cleaned up ${deletedCount} expired cooldown records`)
      
      return { deleted: deletedCount }
    } catch (error) {
      console.error('[PickGenerationService] Error in cleanupExpiredCooldowns:', error)
      return { 
        deleted: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

export const pickGenerationService = new PickGenerationService()
