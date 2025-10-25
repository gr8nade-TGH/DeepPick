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

interface ProcessedGame {
  gameId: string
  matchup: string
  sport: string
  action: 'processed'
  bookmakersAfter: string[]
  oddsChangesSummary: {
    largestSwing: number
  }
  afterSnapshot: any
  warnings?: string[]
}

export async function GET() {
  try {
    console.log('🚀 Starting enhanced game ingestion with smart deduplication...')
    
    const allOddsData: string[] = []
    const gameDetails: ProcessedGame[] = []
    let storedCount = 0
    let errorCount = 0
    
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
          continue
        }
        
        const data: OddsAPIEvent[] = await response.json()
        console.log(`📈 Fetched ${data.length} ${sport.name} events`)
        
        for (const event of data) {
          try {
            // Parse game details
            const gameStartTimestamp = new Date(event.commence_time).toISOString()
            const gameDate = event.commence_time.split('T')[0]
            const gameTime = event.commence_time.split('T')[1].substring(0, 8)
            const apiEventId = event.id
            const matchup = `${event.away_team} @ ${event.home_team}`
            
            // Determine game status
            let gameStatus = 'scheduled'
            const gameStartTime = new Date(event.commence_time)
            const now = new Date()
            
            if (now > gameStartTime) {
              // Game has started - check if it's live or final
              const hoursSinceStart = (now.getTime() - gameStartTime.getTime()) / (1000 * 60 * 60)
              
              if (hoursSinceStart < 4) {
                gameStatus = 'live'
              } else {
                gameStatus = 'final'
              }
            }
            
            // Process sportsbooks data
            const sportsbooks: any = {}
            
            for (const bookmaker of event.bookmakers) {
              const bookmakerData: any = {
                moneyline: {},
                spread: {},
                total: {}
              }
              
              for (const market of bookmaker.markets) {
                if (market.key === 'h2h') {
                  // Moneyline
                  for (const outcome of market.outcomes) {
                    bookmakerData.moneyline[outcome.name] = outcome.price
                  }
                } else if (market.key === 'spreads') {
                  // Spread
                  for (const outcome of market.outcomes) {
                    bookmakerData.spread[outcome.name] = {
                      price: outcome.price,
                      point: outcome.point
                    }
                  }
                } else if (market.key === 'totals') {
                  // Total
                  for (const outcome of market.outcomes) {
                    bookmakerData.total[outcome.name] = {
                      price: outcome.price,
                      point: outcome.point
                    }
                  }
                }
              }
              
              sportsbooks[bookmaker.key] = bookmakerData
            }
            
            // CHECK FOR EXISTING GAME FIRST
            const { data: existingGame } = await getSupabaseAdmin()
              .from('games')
              .select('id')
              .eq('sport', mapSportKey(sport.key))
              .eq('game_date', gameDate)
              .eq('home_team->>name', event.home_team)
              .eq('away_team->>name', event.away_team)
              .single()

            let gameResult, insertError

            if (existingGame) {
              // UPDATE EXISTING GAME
              const { data: updateResult, error: updateError } = await getSupabaseAdmin()
                .from('games')
                .update({
                  odds: sportsbooks,
                  status: gameStatus,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingGame.id)
                .select('id')
                .single()
              
              gameResult = updateResult
              insertError = updateError
            } else {
              // INSERT NEW GAME
              const { data: insertResult, error: insertErr } = await getSupabaseAdmin()
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
              
              gameResult = insertResult
              insertError = insertErr
            }
            
            if (insertError) {
              console.error(`❌ Error inserting game ${matchup}:`, insertError.message)
              errorCount++
              continue
            }
            
            const gameId = gameResult?.id
            
            // Track bookmakers for logging
            const bookmakersAfter = Object.keys(sportsbooks)
            const warnings: string[] = []
            
            // Check for missing odds data
            if (bookmakersAfter.length === 0) {
              warnings.push('No bookmakers returned odds for this game')
            }
            if (bookmakersAfter.length < 3) {
              warnings.push(`Only ${bookmakersAfter.length} bookmaker(s) available`)
            }
            
            // Track game processing
            storedCount++
            console.log(`✅ Processed game: ${matchup} (${gameDate} ${gameTime}) - ID: ${gameId}`)
            
            // Add detailed tracking for processed game
            gameDetails.push({
              gameId: gameId,
              matchup,
              sport: mapSportKey(sport.key),
              action: 'processed',
              bookmakersAfter,
              oddsChangesSummary: {
                largestSwing: 0 // Will be calculated if we have previous odds
              },
              afterSnapshot: sportsbooks,
              warnings: warnings.length > 0 ? warnings : undefined
            })
            
            // Add odds history record ONLY if game is scheduled (not live/final)
            if (gameId && gameStatus === 'scheduled') {
              const { error: historyError } = await getSupabaseAdmin()
                .from('odds_history')
                .insert({
                  game_id: gameId,
                  snapshot_data: sportsbooks,
                  bookmaker_count: bookmakersAfter.length,
                  created_at: new Date().toISOString()
                })
              
              if (historyError) {
                console.error(`❌ Error inserting odds history for ${matchup}:`, historyError.message)
              }
            }
            
            allOddsData.push(event.id)
            
          } catch (eventError) {
            console.error(`❌ Error processing event ${event.id}:`, eventError)
            errorCount++
          }
        }
        
      } catch (sportError) {
        console.error(`❌ Error processing ${sport.name}:`, sportError)
        errorCount++
      }
    }
    
    // Summary
    console.log(`\n📊 Ingestion Summary:`)
    console.log(`✅ Games processed: ${storedCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log(`📈 Total events fetched: ${allOddsData.length}`)
    
    return NextResponse.json({
      success: true,
      message: `Enhanced ingestion completed with smart deduplication`,
      summary: {
        gamesProcessed: storedCount,
        errors: errorCount,
        totalEventsFetched: allOddsData.length,
        gameDetails: gameDetails.slice(0, 10) // Show first 10 for debugging
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Critical error in enhanced ingestion:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}