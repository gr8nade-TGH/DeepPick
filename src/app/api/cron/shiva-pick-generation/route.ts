import { shivaPickGenerationManager } from '@/lib/services/shiva-pick-generation-manager'
import { pickGenerationService } from '@/lib/services/pick-generation-service'

/**
 * Automated cron job for SHIVA pick generation
 * This would be deployed as a Vercel cron job or similar
 */
export async function shivaPickGenerationCron() {
  try {
    console.log('[SHIVA_CRON] Starting automated pick generation...')
    
    // Clean up expired cooldown records (run daily)
    await pickGenerationService.cleanupExpiredCooldowns(48)
    
    // Generate picks for available games
    await shivaPickGenerationManager.generatePicksForAvailableGames()
    
    // Log recent status
    await shivaPickGenerationManager.getRecentStatus()
    
    console.log('[SHIVA_CRON] Automated pick generation completed')
    
  } catch (error) {
    console.error('[SHIVA_CRON] Error in automated pick generation:', error)
    throw error
  }
}

// Example usage in a Vercel cron job
// This would go in your Vercel cron configuration
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify cron secret (security)
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await shivaPickGenerationCron()
    res.status(200).json({ success: true, message: 'Pick generation completed' })
  } catch (error) {
    console.error('[SHIVA_CRON] Cron job failed:', error)
    res.status(500).json({ error: 'Pick generation failed' })
  }
}
