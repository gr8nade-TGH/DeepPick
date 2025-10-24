import { NextRequest, NextResponse } from 'next/server'
import { fetchNBATeamStats } from '@/lib/data-sources/nba-stats-api'

export async function GET(request: NextRequest) {
  try {
    console.log('[TEST-NBA-STATS] Starting test...')
    
    // Test with Denver Nuggets
    const result = await fetchNBATeamStats('Denver Nuggets')
    
    console.log('[TEST-NBA-STATS] Result:', result)
    
    return NextResponse.json({
      success: true,
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
