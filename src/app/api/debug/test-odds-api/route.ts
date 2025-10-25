import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('[test-odds-api] Testing Odds API connection...')
    
    // Check if we have Odds API key
    if (!process.env.ODDS_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'ODDS_API_KEY not configured',
        details: 'The ODDS_API_KEY environment variable is not set'
      }, { status: 500 })
    }
    
    console.log('[test-odds-api] ODDS_API_KEY found, testing API call...')
    
    // Test NBA games fetch
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`
    )
    
    if (!response.ok) {
      console.error('Odds API error:', response.status, response.statusText)
      return NextResponse.json({ 
        success: false, 
        error: `Odds API error: ${response.status} ${response.statusText}`,
        details: 'Failed to fetch from The Odds API'
      }, { status: 500 })
    }
    
    const events = await response.json()
    console.log(`[test-odds-api] Successfully fetched ${events.length} NBA events`)
    
    // Process events to show what we got
    const processedEvents = events.map((event: any) => ({
      id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
      bookmakers_count: event.bookmakers?.length || 0,
      markets: event.bookmakers?.[0]?.markets?.map((m: any) => m.key) || []
    }))
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully connected to Odds API`,
      totalEvents: events.length,
      events: processedEvents,
      rawSample: events[0] || null
    })
    
  } catch (error: any) {
    console.error('[test-odds-api] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred while testing Odds API'
    }, { status: 500 })
  }
}
