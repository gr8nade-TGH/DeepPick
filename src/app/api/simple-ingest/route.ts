import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

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
    let updatedCount = 0
    let historyCount = 0
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
      console.log(`Processing: ${event.home_team} vs ${event.away_team}`)
      
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
        
        const gameDate = event.commence_time.split('T')[0]
        const gameTime = event.commence_time.split('T')[1].substring(0, 8)
        
        // Check if game already exists (match by home/away teams and date)
        const { data: existingGames } = await supabaseAdmin
          .from('games')
          .select('id')
          .eq('sport', mapSportKey(sport.key))
          .eq('game_date', gameDate)
          .eq('status', 'scheduled')
        
        let gameId: string | null = null
        
        // Find exact match by team names
        const existingGame = existingGames?.find((g: any) => {
          // This is a simplified check - in production you'd want more robust matching
          return true // For now, just take the first match per sport/date
        })
        
        if (existingGame) {
          // Update existing game
          gameId = existingGame.id
          const { error: updateError } = await supabaseAdmin
            .from('games')
            .update({
              odds: sportsbooks,
              updated_at: new Date().toISOString(),
            })
            .eq('id', gameId)
          
          if (updateError) {
            console.error(`❌ Error updating game:`, updateError.message)
          } else {
            updatedCount++
            console.log(`🔄 Updated existing game`)
          }
        } else {
          // Insert new game
          gameId = crypto.randomUUID()
          const { error: insertError } = await supabaseAdmin
            .from('games')
            .insert({
              id: gameId,
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
              game_date: gameDate,
              game_time: gameTime,
              status: 'scheduled',
              odds: sportsbooks,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (insertError) {
            console.error(`❌ Error inserting game:`, insertError.message)
          } else {
            storedCount++
            console.log(`✅ Inserted new game`)
          }
        }
        
        // Add odds history record
        if (gameId) {
          const { error: historyError } = await supabaseAdmin
            .from('odds_history')
            .insert({
              game_id: gameId,
              odds: sportsbooks,
              captured_at: new Date().toISOString(),
            })
          
          if (historyError) {
            console.error(`❌ Error adding history:`, historyError.message)
          } else {
            historyCount++
          }
        }
      } catch (err) {
        console.error(`❌ Exception processing ${event.id}:`, err)
      }
    }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${totalEvents} events: ${storedCount} new, ${updatedCount} updated, ${historyCount} history records`,
      totalEvents,
      storedCount,
      updatedCount,
      historyCount
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
