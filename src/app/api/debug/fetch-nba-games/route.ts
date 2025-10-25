import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('[fetch-nba-games] Starting NBA games fetch...')
    
    // Check if we have Odds API key
    if (!process.env.ODDS_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'ODDS_API_KEY not configured' 
      }, { status: 500 })
    }
    
    // Fetch NBA games from Odds API
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`
    )
    
    if (!response.ok) {
      console.error('Failed to fetch NBA odds:', response.status, response.statusText)
      return NextResponse.json({ 
        success: false, 
        error: `Odds API error: ${response.status} ${response.statusText}` 
      }, { status: 500 })
    }
    
    const events = await response.json()
    console.log(`[fetch-nba-games] Fetched ${events.length} NBA events`)
    
    if (events.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No NBA games found for today',
        games: []
      })
    }
    
    // Process and store games
    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]
    let storedCount = 0
    
    for (const event of events) {
      try {
        // Parse game time
        const gameTime = new Date(event.commence_time)
        const gameDate = gameTime.toISOString().split('T')[0]
        const gameTimeStr = gameTime.toTimeString().split(' ')[0]
        
        // Only process games for today
        if (gameDate !== today) {
          continue
        }
        
        // Process odds from bookmakers
        const sportsbooks: any = {}
        for (const bookmaker of event.bookmakers) {
          const bookKey = bookmaker.key
          const bookOdds: any = {}
          
          // Process each market
          for (const market of bookmaker.markets) {
            if (market.key === 'h2h') {
              // Moneyline
              const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team)
              const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team)
              if (homeOutcome && awayOutcome) {
                bookOdds.moneyline = {
                  home: homeOutcome.price,
                  away: awayOutcome.price
                }
              }
            } else if (market.key === 'spreads') {
              // Spread
              const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team)
              const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team)
              if (homeOutcome && awayOutcome) {
                bookOdds.spread = {
                  line: homeOutcome.point || 0,
                  home: homeOutcome.price,
                  away: awayOutcome.price
                }
              }
            } else if (market.key === 'totals') {
              // Total
              const overOutcome = market.outcomes.find((o: any) => o.name === 'Over')
              const underOutcome = market.outcomes.find((o: any) => o.name === 'Under')
              if (overOutcome && underOutcome) {
                bookOdds.total = {
                  line: overOutcome.point || 0,
                  over: overOutcome.price,
                  under: underOutcome.price
                }
              }
            }
          }
          
          if (Object.keys(bookOdds).length > 0) {
            sportsbooks[bookKey] = bookOdds
          }
        }
        
        // Insert game using the smart upsert function
        const { data: gameResult, error: upsertError } = await supabase
          .rpc('upsert_game_smart', {
            p_sport: 'nba',
            p_league: 'NBA',
            p_home_team: { 
              name: event.home_team, 
              abbreviation: event.home_team.substring(0, 3).toUpperCase()
            },
            p_away_team: { 
              name: event.away_team, 
              abbreviation: event.away_team.substring(0, 3).toUpperCase()
            },
            p_game_date: gameDate,
            p_game_time: gameTimeStr,
            p_game_start_timestamp: event.commence_time,
            p_status: 'scheduled',
            p_odds: sportsbooks,
            p_api_event_id: event.id,
            p_venue: null,
            p_weather: null
          })
        
        if (upsertError) {
          console.error(`Error upserting game ${event.home_team} vs ${event.away_team}:`, upsertError.message)
          continue
        }
        
        storedCount++
        console.log(`✅ Stored game: ${event.away_team} @ ${event.home_team} (${gameDate} ${gameTimeStr})`)
        
      } catch (error) {
        console.error(`Error processing game ${event.home_team} vs ${event.away_team}:`, error)
        continue
      }
    }
    
    console.log(`[fetch-nba-games] Successfully stored ${storedCount} NBA games`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully fetched and stored ${storedCount} NBA games for today`,
      gamesStored: storedCount,
      totalEvents: events.length
    })
    
  } catch (error: any) {
    console.error('[fetch-nba-games] Unexpected error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}
