import { NextRequest, NextResponse } from 'next/server'
import { fetchNBATeamStats } from '@/lib/data-sources/nba-stats-api'

export async function GET(request: NextRequest) {
  try {
    console.log('[TEST-NBA-STATS] Testing NBA Stats API...')
    
    // Test with Golden State Warriors
    const result = await fetchNBATeamStats('Golden State Warriors')
    
    console.log('[TEST-NBA-STATS] API Result:', {
      ok: result.ok,
      cached: result.cached,
      latencyMs: result.latencyMs,
      error: result.error,
      data: result.data ? {
        teamName: result.data.teamName,
        pace: result.data.pace,
        offensiveRating: result.data.offensiveRating,
        defensiveRating: result.data.defensiveRating
      } : null
    })
    
    return NextResponse.json({
      success: result.ok,
      result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('[TEST-NBA-STATS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
