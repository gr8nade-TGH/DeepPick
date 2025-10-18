import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const oddsApiKey = process.env.THE_ODDS_API_KEY

    if (!oddsApiKey) {
      return NextResponse.json({
        success: false,
        error: 'THE_ODDS_API_KEY not found in environment variables'
      })
    }

    // Test a simple API call to The Odds API
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h&oddsFormat=american&dateFormat=iso&commenceTimeFrom=${new Date().toISOString().split('T')[0]}T00:00:00Z&commenceTimeTo=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T23:59:59Z&bookmakers=draftkings`
    )

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API call failed: ${response.status} ${response.statusText}`
      })
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'API key is working',
      gamesFound: data.length,
      sampleGame: data[0] ? {
        id: data[0].id,
        home_team: data[0].home_team,
        away_team: data[0].away_team,
        commence_time: data[0].commence_time,
        bookmakers: data[0].bookmakers?.length || 0
      } : null
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
}
