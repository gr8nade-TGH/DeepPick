/**
 * Test MySportsFeeds API Connection
 * GET /api/test/mysportsfeeds
 */

import { fetchOddsGameLines } from '@/lib/data-sources/mysportsfeeds-api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Get today's date in YYYYMMDD format
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    console.log(`[MySportsFeeds Test] Testing odds for date: ${today}...`)
    
    // Try to fetch odds game lines
    const oddsData = await fetchOddsGameLines(today)
    
    return NextResponse.json({
      success: true,
      message: 'MySportsFeeds Odds API successful!',
      testDate: today,
      lastUpdatedOn: oddsData.lastUpdatedOn,
      gamesWithOdds: oddsData.gamelines?.length || 0,
      sampleData: oddsData,
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
