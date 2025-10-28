/**
 * Test MySportsFeeds API Connection
 * GET /api/test/mysportsfeeds
 */

import { testMySportsFeedsConnection, fetchScoreboard } from '@/lib/data-sources/mysportsfeeds-api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Test connection
    await testMySportsFeedsConnection()
    
    // Try to fetch today's scoreboard
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    console.log(`[MySportsFeeds Test] Fetching scoreboard for ${today}...`)
    
    const scoreboardData = await fetchScoreboard(today)
    
    return NextResponse.json({
      success: true,
      message: 'MySportsFeeds API connection successful!',
      sampleData: scoreboardData,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[MySportsFeeds Test] Error:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

