import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('🚀 Simple odds ingestion starting...')
    
    const oddsApiKey = process.env.THE_ODDS_API_KEY

    if (!oddsApiKey) {
      return NextResponse.json({
        success: false,
        error: 'THE_ODDS_API_KEY not found'
      })
    }

    // Test with just NFL for now
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h&oddsFormat=american&dateFormat=iso&commenceTimeFrom=${new Date().toISOString().split('T')[0]}T00:00:00Z&commenceTimeTo=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T23:59:59Z&bookmakers=draftkings`
    )

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API call failed: ${response.status} ${response.statusText}`
      })
    }

    const events = await response.json()
    console.log(`Found ${events.length} NFL events`)

    let storedCount = 0
    for (const event of events.slice(0, 3)) { // Just store first 3 for testing
      console.log(`Storing: ${event.home_team} vs ${event.away_team}`)
      
      try {
        const { error } = await supabase
          .from('games')
          .upsert({
            id: crypto.randomUUID(), // Generate proper UUID
            sport: 'americanfootball_nfl',
            league: 'NFL',
            home_team: { 
              name: event.home_team, 
              abbreviation: event.home_team.substring(0, 3).toUpperCase() 
            },
            away_team: { 
              name: event.away_team, 
              abbreviation: event.away_team.substring(0, 3).toUpperCase() 
            },
            game_date: event.commence_time.split('T')[0],
            game_time: event.commence_time.split('T')[1].substring(0, 8),
            status: 'scheduled',
            odds: { test: 'data' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })

        if (error) {
          console.error(`❌ Error storing ${event.id}:`, error.message)
          console.error(`❌ Full error:`, error)
        } else {
          storedCount++
          console.log(`✅ Stored ${event.id}`)
        }
      } catch (err) {
        console.error(`❌ Exception storing ${event.id}:`, err)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Stored ${storedCount} games successfully`,
      totalEvents: events.length,
      storedCount
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
