import { NextRequest, NextResponse } from 'next/server'

/**
 * PICKSMITH AUTO-PICKS CRON
 *
 * Runs every 10 minutes to automatically generate PICKSMITH consensus picks
 * 
 * PICKSMITH is different from other cappers:
 * - Doesn't analyze games directly
 * - Monitors picks from other system cappers with positive unit records
 * - Generates picks when 2+ profitable cappers agree on the same side
 * - Only considers games within 4 hours of start time
 *
 * Timing:
 * - Runs every 10 minutes (after other cappers have had time to generate picks)
 * - Only processes games within 4 hours of start
 * - This gives SHIVA, SENTINEL, IFRIT etc. time to generate their picks first
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const executionTime = new Date().toISOString()
  console.log(`\n🔨 [PICKSMITH-CRON] Starting execution at ${executionTime}`)
  
  try {
    // Determine base URL for internal API calls
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
    
    console.log(`🌐 [PICKSMITH-CRON] Using base URL: ${baseUrl}`)
    
    // Call the PICKSMITH generate endpoint
    const generateUrl = `${baseUrl}/api/picksmith/generate`
    console.log(`📡 [PICKSMITH-CRON] Calling: ${generateUrl}`)
    
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DeepPick-PICKSMITH-Cron/1.0',
        'X-Cron-Execution': executionTime
      }
    })
    
    const result = await response.json()
    
    console.log(`📊 [PICKSMITH-CRON] Result:`, JSON.stringify(result, null, 2))
    
    if (!result.success) {
      console.error(`❌ [PICKSMITH-CRON] Generation failed:`, result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'PICKSMITH generation failed',
        timestamp: executionTime
      }, { status: 500 })
    }
    
    const summary = {
      success: true,
      timestamp: executionTime,
      gamesAnalyzed: result.data?.gamesAnalyzed || 0,
      picksGenerated: result.data?.picksGenerated?.length || 0,
      picks: result.data?.picksGenerated?.map((p: any) => ({
        game: p.gameId,
        type: p.pickType,
        selection: p.selection,
        units: p.units,
        cappers: p.contributingCappers
      })) || [],
      errors: result.data?.errors || []
    }
    
    console.log(`✅ [PICKSMITH-CRON] Complete:`, JSON.stringify(summary, null, 2))
    
    return NextResponse.json(summary)
    
  } catch (error) {
    console.error('❌ [PICKSMITH-CRON] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}

