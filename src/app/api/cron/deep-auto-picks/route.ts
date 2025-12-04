import { NextRequest, NextResponse } from 'next/server'

/**
 * DEEP AUTO-PICKS CRON
 *
 * Runs every 10 minutes to automatically generate DEEP consensus picks
 * 
 * DEEP is the Factor Confluence Meta-Capper:
 * - Aggregates picks from profitable system cappers
 * - Analyzes factor confluence (which factors AGREE across cappers)
 * - Uses tier-weighted voting (Legendary pick > Common pick)
 * - Analyzes counter-thesis (WHY disagreeing cappers disagree)
 * - Only considers games within 4 hours of start time
 *
 * Timing:
 * - Runs every 10 minutes (after other cappers have generated picks)
 * - This gives SHIVA, SENTINEL, IFRIT etc. time to generate their picks first
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, verify the secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON:DEEP] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON:DEEP] 🧠 Starting Factor Confluence pick generation...')

    // Import dynamically to avoid cold start issues
    const { generateDeepPicks } = await import('@/lib/cappers/deep')
    
    const result = await generateDeepPicks()

    console.log(`[CRON:DEEP] Complete: ${result.picksGenerated.length} picks generated`)

    return NextResponse.json({
      success: result.success,
      message: `DEEP analyzed ${result.gamesAnalyzed} games, generated ${result.picksGenerated.length} picks`,
      timestamp: new Date().toISOString(),
      data: {
        gamesAnalyzed: result.gamesAnalyzed,
        picksGenerated: result.picksGenerated.map(p => ({
          gameId: p.gameId,
          selection: p.selection,
          units: p.units,
          contributingCappers: p.contributingCappers,
          topFactorAlignment: p.factorConfluence[0]?.factorName || 'N/A'
        })),
        errors: result.errors
      }
    })
  } catch (error: any) {
    console.error('[CRON:DEEP] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate DEEP picks',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

