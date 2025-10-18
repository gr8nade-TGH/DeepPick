import { NextResponse } from 'next/server'

/**
 * Auto-refresh endpoint called by Vercel Cron
 * Runs every 5 minutes to:
 * 1. Fetch scores for completed games (triggers auto-grading)
 * 2. Archive old games
 * 3. Ingest fresh odds
 */
export async function GET() {
  try {
    console.log('🤖 [AUTO-REFRESH] Starting automated refresh cycle...')
    const startTime = Date.now()

    // Step 1: Fetch scores (this triggers auto-grading)
    console.log('🏆 [AUTO-REFRESH] Step 1: Fetching scores...')
    const scoresResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const scoresResult = await scoresResponse.json()
    console.log('📊 [AUTO-REFRESH] Scores result:', scoresResult)

    // Step 2: Archive old games
    console.log('🗄️ [AUTO-REFRESH] Step 2: Archiving old games...')
    const archiveResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/archive-games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const archiveResult = await archiveResponse.json()
    console.log('📦 [AUTO-REFRESH] Archive result:', archiveResult)

    // Step 3: Ingest fresh odds
    console.log('📈 [AUTO-REFRESH] Step 3: Ingesting fresh odds...')
    const ingestResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/simple-ingest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const ingestResult = await ingestResponse.json()
    console.log('✅ [AUTO-REFRESH] Ingest result:', ingestResult)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Auto-refresh completed successfully',
      duration: `${duration}ms`,
      results: {
        scores: {
          updatedCount: scoresResult.updatedCount || 0,
          success: scoresResult.success
        },
        archive: {
          archivedCount: archiveResult.archivedCount || 0,
          success: archiveResult.success
        },
        ingest: {
          storedCount: ingestResult.storedCount || 0,
          success: ingestResult.success
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [AUTO-REFRESH] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST() {
  return GET()
}

