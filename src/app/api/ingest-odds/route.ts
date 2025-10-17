import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting odds ingestion directly...')
    
    const oddsApiKey = process.env.THE_ODDS_API_KEY

    if (!oddsApiKey) {
      throw new Error('THE_ODDS_API_KEY not found in environment variables')
    }

    // Fetch odds from The Odds API directly
    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb']
    const allOddsData: any[] = []
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    for (const sport of sports) {
      try {
        console.log(`Fetching ${sport} odds...`)
        
        const response = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso&commenceTimeFrom=${today}T00:00:00Z&commenceTimeTo=${nextWeek}T23:59:59Z&bookmakers=draftkings,fanduel,caesars,betmgm,pointsbet`
        )

        if (!response.ok) {
          console.error(`Failed to fetch ${sport} odds:`, response.statusText)
          continue
        }

        const events = await response.json()
        console.log(`Fetched ${events.length} ${sport} events`)
        
        // Convert and store each event
        for (const event of events) {
          const sportsbooks: any = {}

          for (const bookmaker of event.bookmakers) {
            const bookmakerOdds: any = {
              last_update: bookmaker.last_update
            }

            for (const market of bookmaker.markets) {
              if (market.key === 'h2h') {
                const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team)
                const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team)
                if (homeOutcome && awayOutcome) {
                  bookmakerOdds.moneyline = { home: homeOutcome.price, away: awayOutcome.price }
                }
              } else if (market.key === 'spreads') {
                const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team)
                const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team)
                if (homeOutcome && awayOutcome && homeOutcome.point !== undefined && awayOutcome.point !== undefined) {
                  bookmakerOdds.spread = { home: homeOutcome.price, away: awayOutcome.price, line: homeOutcome.point }
                }
              } else if (market.key === 'totals') {
                const overOutcome = market.outcomes.find((o: any) => o.name === 'Over')
                const underOutcome = market.outcomes.find((o: any) => o.name === 'Under')
                if (overOutcome && underOutcome && overOutcome.point !== undefined) {
                  bookmakerOdds.total = { over: overOutcome.price, under: underOutcome.price, line: overOutcome.point }
                }
              }
            }

            sportsbooks[bookmaker.key] = bookmakerOdds
          }

          // Store in Supabase
          const { error: gameError } = await supabase
            .from('games')
            .upsert({
              id: event.id,
              sport: event.sport_key,
              league: event.sport_title,
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

          if (gameError) {
            console.error(`Error upserting game ${event.id}:`, gameError.message)
          } else {
            allOddsData.push(event.id)
          }
        }
      } catch (error) {
        console.error(`Error fetching ${sport} odds:`, error)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${allOddsData.length} games with odds data`,
      gamesProcessed: allOddsData.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Error in odds ingestion:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
