import { NextResponse } from 'next/server'
import { TheOddsAPIService } from '@/lib/api/the-odds-api'

export async function GET() {
  try {
    const oddsAPI = TheOddsAPIService.getInstance()
    
    // Check if API key is available
    if (!process.env.THE_ODDS_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'THE_ODDS_API_KEY not found in environment variables',
        message: 'Please add your The Odds API key to .env.local',
        setup_instructions: {
          step1: 'Get API key from https://the-odds-api.com/',
          step2: 'Add THE_ODDS_API_KEY=your_key_here to .env.local',
          step3: 'Restart the development server'
        }
      })
    }
    
    // Test getting available sports
    const sports = await oddsAPI.getSports()
    const activeSports = sports.filter(sport => sport.active)
    
    // Test getting NFL odds
    const nflOdds = await oddsAPI.getOdds('americanfootball_nfl', ['us'], ['h2h', 'spreads', 'totals'])
    
    return NextResponse.json({
      success: true,
      data: {
        available_sports: activeSports.length,
        sports: activeSports.slice(0, 10), // First 10 sports
        nfl_games: nflOdds.length,
        sample_nfl_game: nflOdds[0] || null
      },
      message: 'The Odds API integration working successfully'
    })
    
  } catch (error) {
    console.error('❌ Error testing The Odds API:', error)
    return NextResponse.json({ 
      error: 'Failed to test The Odds API',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}