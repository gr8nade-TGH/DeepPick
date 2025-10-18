import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// Map API sport keys to database enum values
function mapSportKey(apiSportKey: string): string {
  const sportMap: Record<string, string> = {
    'americanfootball_nfl': 'nfl',
    'basketball_nba': 'nba',
    'baseball_mlb': 'mlb',
    'icehockey_nhl': 'nhl',
    'soccer_epl': 'soccer',
  }
  return sportMap[apiSportKey] || apiSportKey
}

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

    // Fetch all sports (NFL, NBA, MLB)
    const sports = [
      { key: 'americanfootball_nfl', name: 'NFL' },
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'baseball_mlb', name: 'MLB' }
    ]
    
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    let storedCount = 0
    let totalEvents = 0
    
    for (const sport of sports) {
      console.log(`Fetching ${sport.name} odds...`)
      
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso&commenceTimeFrom=${today}T00:00:00Z&commenceTimeTo=${nextWeek}T23:59:59Z&bookmakers=draftkings,fanduel,williamhill_us,betmgm`
      )

      if (!response.ok) {
        console.error(`Failed to fetch ${sport.name} odds:`, response.statusText)
        continue
      }

      const events = await response.json()
      console.log(`Found ${events.length} ${sport.name} events`)
      totalEvents += events.length
      
      if (events.length === 0) {
        console.log(`No events found for ${sport.name}`)
        continue
      }

      for (const event of events.slice(0, 5)) { // Store first 5 per sport
      console.log(`Storing: ${event.home_team} vs ${event.away_team}`)
      
      try {
        // Extract odds from bookmakers
        const sportsbooks: any = {}
        
        for (const bookmaker of event.bookmakers || []) {
          const bookmakerOdds: any = {
            last_update: bookmaker.last_update
          }

          for (const market of bookmaker.markets || []) {
            if (market.key === 'h2h') {
              const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team)
              const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team)
              if (homeOutcome && awayOutcome) {
                bookmakerOdds.moneyline = { home: homeOutcome.price, away: awayOutcome.price }
              }
            } else if (market.key === 'spreads') {
              const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team)
              const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team)
              if (homeOutcome && awayOutcome && homeOutcome.point !== undefined) {
                bookmakerOdds.spread = { 
                  home: homeOutcome.price, 
                  away: awayOutcome.price, 
                  line: homeOutcome.point 
                }
              }
            } else if (market.key === 'totals') {
              const overOutcome = market.outcomes.find((o: any) => o.name === 'Over')
              const underOutcome = market.outcomes.find((o: any) => o.name === 'Under')
              if (overOutcome && underOutcome && overOutcome.point !== undefined) {
                bookmakerOdds.total = { 
                  over: overOutcome.price, 
                  under: underOutcome.price, 
                  line: overOutcome.point 
                }
              }
            }
          }

          sportsbooks[bookmaker.key] = bookmakerOdds
        }
        
        const { error } = await supabase
          .from('games')
          .upsert({
            id: crypto.randomUUID(), // Generate proper UUID
            sport: mapSportKey(sport.key),
            league: sport.name,
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
            odds: sportsbooks,
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
    }
    
    return NextResponse.json({
      success: true,
      message: `Stored ${storedCount} games successfully across NFL, NBA, MLB`,
      totalEvents,
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
