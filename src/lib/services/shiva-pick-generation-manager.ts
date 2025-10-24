import { pickGenerationService, PickGenerationResult, PickResult } from '@/lib/services/pick-generation-service'
import { capper_type } from '@/lib/database.types'

/**
 * Example integration of pick generation logic into SHIVA pipeline
 * This shows how to use the database logic to prevent duplicate picks and manage cooldowns
 */
export class ShivaPickGenerationManager {
  private capper: capper_type = 'shiva'
  private betType: 'TOTAL' = 'TOTAL'
  private cooldownHours: number = 2

  /**
   * Main entry point for automated pick generation
   * This would be called by a cron job or automated system
   */
  async generatePicksForAvailableGames(): Promise<void> {
    try {
      console.log(`[ShivaPickGenerationManager] Starting automated pick generation for ${this.capper}`)
      
      // Get games available for pick generation
      const availableGames = await pickGenerationService.getAvailableGames(
        this.capper,
        this.betType,
        this.cooldownHours,
        5 // Limit to 5 games per run
      )

      if (availableGames.length === 0) {
        console.log(`[ShivaPickGenerationManager] No games available for ${this.capper} pick generation`)
        return
      }

      console.log(`[ShivaPickGenerationManager] Found ${availableGames.length} games available for pick generation`)

      // Process each available game
      for (const game of availableGames) {
        await this.processGameForPickGeneration(game)
      }

    } catch (error) {
      console.error('[ShivaPickGenerationManager] Error in automated pick generation:', error)
    }
  }

  /**
   * Process a single game for pick generation
   * @param game - The game to process
   */
  private async processGameForPickGeneration(game: any): Promise<void> {
    const { game_id, home_team, away_team } = game
    
    try {
      console.log(`[ShivaPickGenerationManager] Processing ${away_team} @ ${home_team} (${game_id})`)

      // Double-check eligibility (race condition protection)
      const canGenerate = await pickGenerationService.canGeneratePick(
        game_id,
        this.capper,
        this.betType,
        this.cooldownHours
      )

      if (!canGenerate) {
        console.log(`[ShivaPickGenerationManager] Game ${game_id} no longer eligible, skipping`)
        return
      }

      // Create a new run ID for this attempt
      const runId = crypto.randomUUID()
      
      // Run the SHIVA pipeline
      const result = await this.runShivaPipeline(runId, game_id, game)
      
      // Record the result
      await pickGenerationService.recordPickGenerationResult(result, this.cooldownHours)

      console.log(`[ShivaPickGenerationManager] Completed ${result.result} for ${game_id}`)

    } catch (error) {
      console.error(`[ShivaPickGenerationManager] Error processing game ${game_id}:`, error)
      
      // Record the error
      const errorResult: PickGenerationResult = {
        runId: crypto.randomUUID(),
        gameId: game_id,
        capper: this.capper,
        betType: this.betType,
        result: 'ERROR',
        units: 0
      }
      
      await pickGenerationService.recordPickGenerationResult(errorResult, this.cooldownHours)
    }
  }

  /**
   * Run the SHIVA pipeline for a specific game
   * This would integrate with your existing SHIVA pipeline
   * @param runId - Unique run identifier
   * @param gameId - The game ID
   * @param game - Game details
   * @returns Pick generation result
   */
  private async runShivaPipeline(runId: string, gameId: string, game: any): Promise<PickGenerationResult> {
    try {
      // This would integrate with your existing SHIVA pipeline
      // For now, this is a placeholder that simulates the pipeline
      
      console.log(`[ShivaPickGenerationManager] Running SHIVA pipeline for ${gameId}`)
      
      // Simulate pipeline execution
      // In reality, this would call your existing SHIVA steps
      const mockResult = await this.simulateShivaPipeline(game)
      
      return {
        runId,
        gameId,
        capper: this.capper,
        betType: this.betType,
        result: mockResult.units > 0 ? 'PICK_GENERATED' : 'PASS',
        units: mockResult.units,
        confidence: mockResult.confidence,
        pickId: mockResult.pickId
      }

    } catch (error) {
      console.error(`[ShivaPickGenerationManager] SHIVA pipeline failed for ${gameId}:`, error)
      throw error
    }
  }

  /**
   * Simulate SHIVA pipeline execution
   * This would be replaced with actual SHIVA pipeline calls
   * @param game - Game details
   * @returns Mock result
   */
  private async simulateShivaPipeline(game: any): Promise<{
    units: number
    confidence: number
    pickId?: string
  }> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock logic - in reality this would run your actual SHIVA pipeline
    const randomConfidence = Math.random() * 5 - 2 // -2 to +3
    const units = randomConfidence > 1 ? Math.floor(randomConfidence) : 0
    
    return {
      units,
      confidence: randomConfidence,
      pickId: units > 0 ? crypto.randomUUID() : undefined
    }
  }

  /**
   * Get status of recent pick generation attempts
   */
  async getRecentStatus(): Promise<void> {
    try {
      const recentAttempts = await pickGenerationService.getRecentAttempts(this.capper, 24)
      
      console.log(`[ShivaPickGenerationManager] Recent attempts (24h):`)
      console.log(`  Total attempts: ${recentAttempts.length}`)
      
      const picksGenerated = recentAttempts.filter(a => a.result === 'PICK_GENERATED').length
      const passes = recentAttempts.filter(a => a.result === 'PASS').length
      const errors = recentAttempts.filter(a => a.result === 'ERROR').length
      
      console.log(`  Picks generated: ${picksGenerated}`)
      console.log(`  Passes: ${passes}`)
      console.log(`  Errors: ${errors}`)
      
    } catch (error) {
      console.error('[ShivaPickGenerationManager] Error getting recent status:', error)
    }
  }
}

// Export singleton instance
export const shivaPickGenerationManager = new ShivaPickGenerationManager()
