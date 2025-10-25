import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getTeamAbbreviation } from '@/lib/team-abbreviations'

// Helper function to map sport keys
function mapSportKey(sportKey: string): string {
  const sportMap: { [key: string]: string } = {
    'basketball_nba': 'nba',
    'americanfootball_nfl': 'nfl',
    'baseball_mlb': 'mlb'
  }
  return sportMap[sportKey] || sportKey
}

// Types for The Odds API response
interface OddsAPIEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Array<{
    key: string
    title: string
    last_update: string
    markets: Array<{
      key: string
      last_update: string
      outcomes: Array<{
        name: string
        price: number
        point?: number
      }>
    }>
  }>
}

export async function GET() {
  try {
    console.log('🚀 Starting FIXED game ingestion...')
    
    let storedCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    // Sports to process
    const sports = [
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'americanfootball_nfl', name: 'NFL' },
      { key: 'baseball_mlb', name: 'MLB' }
    ]
    
    for (const sport of sports) {
      try {
        console.log(`\n📊 Processing ${sport.name}...`)
        
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?apiKey=${process.env.THE_ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`)
        
        if (!response.ok) {
          console.error(`❌ Failed to fetch ${sport.name} odds:`, response.status, response.statusText)
          errors.push(`Failed to fetch ${sport.name}: ${response.status}`)
          continue
        }
        
        const data: OddsAPIEvent[] = await response.json()
        console.log(`📈 Fetched ${data.length} ${sport.name} events`)
        
        for (const event of data) {
          try {
            // Parse game time
            const gameDateTime = new Date(event.commence_time)
            const gameDate = gameDateTime.toISOString().split('T')[0]
            const gameTime = gameDateTime.toISOString().split('T')[1].split('.')[0]
            const gameStartTimestamp = gameDateTime.toISOString()
            
            // Determine game status
            const now = new Date()
            const gameStatus = gameDateTime > now ? 'scheduled' : 'live'
            
            // Process bookmakers and odds
            const sportsbooks: any = {}
            
            for (const bookmaker of event.bookmakers) {
              const bookKey = bookmaker.key
              const bookOdds: any = {}
              
              // Process each market
              for (const market of bookmaker.markets) {
                if (market.key === 'h2h') {
                  // Moneyline
                  for (const outcome of market.outcomes) {
                    if (outcome.name === event.home_team) {
                      bookOdds.ml_home = outcome.price
                    } else if (outcome.name === event.away_team) {
                      bookOdds.ml_away = outcome.price
                    }
                  }
                } else if (market.key === 'spreads') {
                  // Spread
                  for (const outcome of market.outcomes) {
                    if (outcome.point !== undefined) {
                      bookOdds.spread_team = outcome.name
                      bookOdds.spread_line = outcome.point
                    }
                  }
                } else if (market.key === 'totals') {
                  // Total
                  for (const outcome of market.outcomes) {
                    if (outcome.point !== undefined) {
                      bookOdds.total_line = outcome.point
                      break // Just need one total line
                    }
                  }
                }
              }
              
              if (Object.keys(bookOdds).length > 0) {
                sportsbooks[bookKey] = bookOdds
              }
            }
            
            const matchup = `${event.away_team} @ ${event.home_team}`
            
            // SIMPLE INSERT (no complex function needed)
            const { data: gameResult, error: insertError } = await getSupabaseAdmin()
              .from('games')
              .insert({
                sport: mapSportKey(sport.key),
                league: sport.name,
                home_team: { 
                  name: event.home_team, 
                  abbreviation: getTeamAbbreviation(event.home_team)
                },
                away_team: { 
                  name: event.away_team, 
                  abbreviation: getTeamAbbreviation(event.away_team)
                },
                game_date: gameDate,
                game_time: gameTime,
                game_start_timestamp: gameStartTimestamp,
                status: gameStatus,
                odds: sportsbooks,
                api_event_id: event.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('id')
              .single()
            
            if (insertError) {
              console.error(`❌ Error inserting game ${matchup}:`, insertError.message)
              errors.push(`Error inserting ${matchup}: ${insertError.message}`)
              errorCount++
              continue
            }
            
            storedCount++
            console.log(`✅ Processed game: ${matchup} (${gameDate} ${gameTime}) - ID: ${gameResult.id}`)
            
          } catch (eventError) {
            console.error(`❌ Error processing event:`, eventError)
            errors.push(`Event processing error: ${eventError}`)
            errorCount++
          }
        }
      } catch (sportError) {
        console.error(`❌ Error processing ${sport.name}:`, sportError)
        errors.push(`Sport processing error: ${sportError}`)
        errorCount++
      }
    }
    
    console.log(`📈 Total events processed: ${storedCount}`)
    console.log(`❌ Total errors: ${errorCount}`)
    
    return NextResponse.json({
      success: true,
      message: `FIXED ingestion completed successfully`,
      summary: {
        gamesProcessed: storedCount,
        errors: errorCount,
        totalEventsFetched: storedCount + errorCount,
        errorDetails: errors.slice(0, 10) // Show first 10 errors
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Critical error in FIXED ingestion:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
