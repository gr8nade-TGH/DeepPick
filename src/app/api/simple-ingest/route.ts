import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { logApiCall, logIngestion, GameChangeDetail } from '@/lib/monitoring/api-logger'

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

// Helper: Calculate largest odds swing between before/after
function calculateLargestSwing(beforeOdds: any, afterOdds: any): number {
  if (!beforeOdds || !afterOdds) return 0
  
  let maxSwing = 0
  const bookmakers = Object.keys(afterOdds)
  
  for (const book of bookmakers) {
    const before = beforeOdds[book]
    const after = afterOdds[book]
    
    if (!before || !after) continue
    
    // Check moneyline swings
    if (before.moneyline && after.moneyline) {
      const homeSwing = Math.abs((after.moneyline.home || 0) - (before.moneyline.home || 0))
      const awaySwing = Math.abs((after.moneyline.away || 0) - (before.moneyline.away || 0))
      maxSwing = Math.max(maxSwing, homeSwing, awaySwing)
    }
  }
  
  return Math.round(maxSwing)
}

// Helper: Check if odds changed
function hasOddsChanged(beforeOdds: any, afterOdds: any, market: 'moneyline' | 'spread' | 'total'): boolean {
  if (!beforeOdds || !afterOdds) return true
  
  const bookmakers = Object.keys(afterOdds)
  for (const book of bookmakers) {
    const before = beforeOdds[book]?.[market]
    const after = afterOdds[book]?.[market]
    
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      return true
    }
  }
  return false
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
    const gameDetails: GameChangeDetail[] = [] // NEW: Track detailed changes
    const processingStart = Date.now() // Track processing time
    
    for (const sport of sports) {
      console.log(`Fetching ${sport.name} odds...`)
      
      const apiCallStart = Date.now()
      const endpoint = `/v4/sports/${sport.key}/odds`
      
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso&commenceTimeFrom=${today}T00:00:00Z&commenceTimeTo=${nextWeek}T23:59:59Z&bookmakers=draftkings,fanduel,williamhill_us,betmgm`
      )
      
      const apiCallTime = Date.now() - apiCallStart
      const responseStatus = response.status
      
      // Get API usage from headers
      const apiCallsRemaining = response.headers.get('x-requests-remaining')
      const apiCallsUsed = response.headers.get('x-requests-used')

      if (!response.ok) {
        console.error(`Failed to fetch ${sport.name} odds:`, response.statusText)
        
        // Log failed API call
        await logApiCall({
          apiProvider: 'the_odds_api',
          endpoint,
          responseStatus,
          responseTimeMs: apiCallTime,
          success: false,
          errorMessage: response.statusText,
          triggeredBy: 'cron',
          apiCallsRemaining: apiCallsRemaining ? parseInt(apiCallsRemaining) : undefined,
          apiCallsUsed: apiCallsUsed ? parseInt(apiCallsUsed) : undefined,
        })
        
        continue
      }

      const events = await response.json()
      console.log(`Found ${events.length} ${sport.name} events`)
      totalEvents += events.length
      
      // Extract bookmakers and sports from response
      const bookmakers = events.length > 0 ? Array.from(new Set(events[0].bookmakers?.map((b: any) => b.key) || [])) : []
      
      // Log successful API call
      const apiCallId = await logApiCall({
        apiProvider: 'the_odds_api',
        endpoint,
        responseStatus,
        responseTimeMs: apiCallTime,
        eventsReceived: events.length,
        bookmakersReceived: bookmakers as string[],
        sportsReceived: [sport.key],
        dataSnapshot: events[0] || null,
        success: true,
        triggeredBy: 'cron',
        apiCallsRemaining: apiCallsRemaining ? parseInt(apiCallsRemaining) : undefined,
        apiCallsUsed: apiCallsUsed ? parseInt(apiCallsUsed) : undefined,
        notes: `Fetched ${sport.name} odds`
      })
      
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
        const apiEventId = event.id // Store API's unique event ID
        
        // Determine game status based on commence time
        const commenceTime = new Date(event.commence_time)
        const now = new Date()
        let gameStatus = 'scheduled'
        
        // Game is live if current time is past commence time but within ~4 hours
        const hoursSinceStart = (now.getTime() - commenceTime.getTime()) / (1000 * 60 * 60)
        if (hoursSinceStart > 0 && hoursSinceStart < 4) {
          gameStatus = 'live'
        } else if (hoursSinceStart >= 4) {
          // Game likely completed - will be updated by score fetch
          gameStatus = 'scheduled' // Keep as scheduled until score fetch confirms
        }
        
        const matchup = `${event.away_team} @ ${event.home_team}`
        
        // Check if game already exists (match by home/away teams and date)
        const { data: existingGames } = await getSupabaseAdmin()
          .from('games')
          .select('id, status, odds, home_team, away_team')
          .eq('sport', mapSportKey(sport.key))
          .eq('game_date', gameDate)
        
        let gameId: string | null = null
        
        // Find exact match by team names - FIXED: Actually match teams!
        const existingGame = existingGames?.find((g: any) => {
          const homeMatch = g.home_team?.name === event.home_team
          const awayMatch = g.away_team?.name === event.away_team
          return homeMatch && awayMatch
        })
        
        // Debug logging
        if (existingGames && existingGames.length > 0 && !existingGame) {
          console.log(`⚠️ No match found for ${matchup}. Existing games on ${gameDate}:`, 
            existingGames.map((g: any) => `${g.away_team?.name} @ ${g.home_team?.name}`))
        }
        
        // NEW: Track bookmakers for detailed logging
        const bookmakersBefore = existingGame?.odds ? Object.keys(existingGame.odds) : undefined
        const bookmakersAfter = Object.keys(sportsbooks)
        
        // NEW: Detect changes and warnings
        const warnings: string[] = []
        let largestSwing = 0
        
        if (existingGame) {
          largestSwing = calculateLargestSwing(existingGame.odds, sportsbooks)
          
          if (largestSwing > 100) {
            warnings.push(`Large odds swing: ${largestSwing} points`)
          }
          
          if (bookmakersBefore && bookmakersBefore.length !== bookmakersAfter.length) {
            const missing = bookmakersBefore.filter(b => !bookmakersAfter.includes(b))
            const added = bookmakersAfter.filter(b => !bookmakersBefore.includes(b))
            
            if (missing.length > 0) {
              warnings.push(`Bookmakers dropped: ${missing.join(', ')}`)
            }
            if (added.length > 0) {
              warnings.push(`Bookmakers added: ${added.join(', ')}`)
            }
          }
        }
        
        // Check for missing odds data
        if (bookmakersAfter.length === 0) {
          warnings.push('No bookmakers returned odds for this game')
        }
        if (bookmakersAfter.length < 3) {
          warnings.push(`Only ${bookmakersAfter.length} bookmaker(s) available`)
        }
        
        if (existingGame) {
          // Update existing game
          gameId = existingGame.id
          const { error: updateError } = await getSupabaseAdmin()
            .from('games')
            .update({
              odds: sportsbooks,
              status: gameStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', gameId)
          
          if (updateError) {
            console.error(`❌ Error updating game:`, updateError.message)
          } else {
            updatedCount++
            console.log(`🔄 Updated existing game (status: ${gameStatus})`)
            
            // NEW: Add detailed tracking for updated game
            gameDetails.push({
              gameId: gameId!,
              matchup,
              sport: mapSportKey(sport.key),
              action: 'updated',
              bookmakersBefore,
              bookmakersAfter,
              oddsChangesSummary: {
                moneylineChanged: hasOddsChanged(existingGame.odds, sportsbooks, 'moneyline'),
                spreadChanged: hasOddsChanged(existingGame.odds, sportsbooks, 'spread'),
                totalChanged: hasOddsChanged(existingGame.odds, sportsbooks, 'total'),
                largestSwing
              },
              beforeSnapshot: existingGame.odds,
              afterSnapshot: sportsbooks,
              warnings: warnings.length > 0 ? warnings : undefined
            })
          }
        } else {
          // Insert new game
          gameId = crypto.randomUUID()
          
          console.log(`➕ Creating NEW game: ${matchup} (${gameDate} ${gameTime}) - API ID: ${apiEventId}`)
          
          const { error: insertError } = await getSupabaseAdmin()
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
              status: gameStatus,
              odds: sportsbooks,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (insertError) {
            console.error(`❌ Error inserting game:`, insertError.message)
            warnings.push(`Failed to insert: ${insertError.message}`)
          } else {
            storedCount++
            console.log(`✅ Inserted new game (status: ${gameStatus}, bookmakers: ${bookmakersAfter.length})`)
            
            // NEW: Add detailed tracking for new game
            gameDetails.push({
              gameId,
              matchup,
              sport: mapSportKey(sport.key),
              action: 'added',
              bookmakersAfter,
              oddsChangesSummary: {
                moneylineChanged: false,
                spreadChanged: false,
                totalChanged: false,
                largestSwing: 0
              },
              afterSnapshot: sportsbooks,
              warnings: warnings.length > 0 ? warnings : undefined
            })
          }
        }
        
        // Add odds history record ONLY if game is scheduled (not live)
        if (gameId && gameStatus === 'scheduled') {
          const { error: historyError } = await getSupabaseAdmin()
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
        } else if (gameId && gameStatus === 'live') {
          console.log(`⏩ Skipping history for live game`)
        }
      } catch (err) {
        console.error(`❌ Exception processing ${event.id}:`, err)
      }
    }
    }
    
    // Log ingestion results (optional - won't crash if table doesn't exist)
    try {
      const processingTimeMs = Date.now() - processingStart
      
      await logIngestion({
        gamesAdded: storedCount,
        gamesUpdated: updatedCount,
        oddsHistoryRecordsCreated: historyCount,
        processingTimeMs,
        success: true,
        gameDetails // NEW: Include detailed game-by-game tracking
      })
      
      console.log(`📊 Logged ingestion with ${gameDetails.length} game details`)
    } catch (logError) {
      console.warn('⚠️ Could not log ingestion (table may not exist yet):', logError)
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
