import { NextResponse } from 'next/server'

/**
 * Direct test of The Odds API to see what endpoints work
 */
export async function GET() {
  try {
    const oddsApiKey = process.env.THE_ODDS_API_KEY

    if (!oddsApiKey) {
      return NextResponse.json({
        success: false,
        error: 'THE_ODDS_API_KEY not found'
      }, { status: 500 })
    }

    const tests = []

    // Test 1: Get list of sports
    try {
      const sportsUrl = `https://api.the-odds-api.com/v4/sports?apiKey=${oddsApiKey}`
      const sportsResponse = await fetch(sportsUrl)
      const sportsData = await sportsResponse.json()
      
      tests.push({
        test: 'List Sports',
        url: sportsUrl.replace(oddsApiKey, 'API_KEY'),
        status: sportsResponse.status,
        success: sportsResponse.ok,
        data: sportsResponse.ok ? sportsData.slice(0, 5) : sportsData // First 5 sports
      })
    } catch (e) {
      tests.push({
        test: 'List Sports',
        error: e instanceof Error ? e.message : 'Unknown error'
      })
    }

    // Test 2: Get MLB scores
    try {
      const mlbScoresUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/scores?apiKey=${oddsApiKey}&daysFrom=3`
      const mlbResponse = await fetch(mlbScoresUrl)
      let mlbData
      
      if (mlbResponse.ok) {
        mlbData = await mlbResponse.json()
      } else {
        mlbData = await mlbResponse.text()
      }
      
      tests.push({
        test: 'MLB Scores',
        url: mlbScoresUrl.replace(oddsApiKey, 'API_KEY'),
        status: mlbResponse.status,
        success: mlbResponse.ok,
        data: mlbResponse.ok ? mlbData.slice(0, 3) : mlbData // First 3 scores or error
      })
    } catch (e) {
      tests.push({
        test: 'MLB Scores',
        error: e instanceof Error ? e.message : 'Unknown error'
      })
    }

    // Test 3: Get MLB odds (for comparison)
    try {
      const mlbOddsUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h`
      const oddsResponse = await fetch(mlbOddsUrl)
      let oddsData
      
      if (oddsResponse.ok) {
        oddsData = await oddsResponse.json()
      } else {
        oddsData = await oddsResponse.text()
      }
      
      tests.push({
        test: 'MLB Odds',
        url: mlbOddsUrl.replace(oddsApiKey, 'API_KEY'),
        status: oddsResponse.status,
        success: oddsResponse.ok,
        data: oddsResponse.ok ? `Found ${oddsData.length} events` : oddsData
      })
    } catch (e) {
      tests.push({
        test: 'MLB Odds',
        error: e instanceof Error ? e.message : 'Unknown error'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'API tests completed',
      tests,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

