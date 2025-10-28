/**
 * Sync MySportsFeeds games and odds to database
 * POST /api/sync/mysportsfeeds-games
 */

import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { fetchOddsGameLines } from '@/lib/data-sources/mysportsfeeds-api'


export async function POST() {
  try {
    console.log(`[Sync Games] Starting...`)
    
    const supabase = getSupabase()
    
    // Get today's date in YYYYMMDD format
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0')
    
    console.log(`[Sync Games] Fetching MySportsFeeds odds data for ${dateStr}...`)
    
    // Fetch odds (which includes game information)
    let odds
    try {
      odds = await fetchOddsGameLines(dateStr)
      console.log(`[Sync Games] Got ${odds.gameLines?.length || 0} games with odds`)
    } catch (fetchError) {
      console.error('[Sync Games] Error fetching odds:', fetchError)
      return NextResponse.json({
        success: false,
        error: `Failed to fetch odds: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      }, { status: 500 })
    }
    
    // Process games from odds data
    const games = odds.gameLines || []
    let synced = 0
    
    const errors: string[] = []
    
    for (const gameLine of games) {
      try {
        const gameData = gameLine.game
        const gameId = gameData?.id?.toString()
        const homeTeam = gameData?.homeTeamAbbreviation
        const awayTeam = gameData?.awayTeamAbbreviation
        const startTime = gameData?.startTime
        
        if (!gameId || !homeTeam || !awayTeam || !startTime) {
          errors.push(`Skipping game ${gameId} - missing required fields`)
          continue
        }
        
        // Parse game odds if available
        let oddsData: any = null
        
        if (gameLine.lines && gameLine.lines.length > 0) {
          // Extract lines from the first available sportsbook
          const lines = gameLine.lines[0]
          oddsData = {} as any
          
          // Add spread, total, moneylines if available (MySportsFeeds structure)
          if (lines.pointSpreads && lines.pointSpreads.length > 0) {
            // Get the most recent FULL game segment spread
            const fullSpread = lines.pointSpreads.find((s: any) => s.pointSpread?.gameSegment === 'FULL')
            if (fullSpread) {
              oddsData.spread = {
                home: fullSpread.pointSpread?.homeLine?.decimal,
                away: fullSpread.pointSpread?.awayLine?.decimal,
                line: fullSpread.pointSpread?.homeSpread || -fullSpread.pointSpread?.awaySpread
              }
            }
          }
          
          if (lines.overUnders && lines.overUnders.length > 0) {
            // Get the most recent FULL game segment total
            const fullOverUnder = lines.overUnders.find((o: any) => o.overUnder?.gameSegment === 'FULL')
            if (fullOverUnder) {
              oddsData.total = {
                over: fullOverUnder.overUnder?.overLine?.decimal,
                under: fullOverUnder.overUnder?.underLine?.decimal,
                line: fullOverUnder.overUnder?.overUnder
              }
            }
          }
          
          if (lines.moneyLines && lines.moneyLines.length > 0) {
            // Get the most recent FULL game segment moneyline
            const fullML = lines.moneyLines.find((m: any) => m.moneyLine?.gameSegment === 'FULL')
            if (fullML) {
              oddsData.moneyline = {
                home: fullML.moneyLine?.homeLine?.decimal,
                away: fullML.moneyLine?.awayLine?.decimal
              }
            }
          }
        }
        
        // Upsert game to database
        const { error } = await supabase
          .from('games')
          .upsert({
            id: `msf_${gameId}`,
            sport: 'nba',
            home_team: { name: homeTeam, abbreviation: homeTeam },
            away_team: { name: awayTeam, abbreviation: awayTeam },
            game_date: startTime.split('T')[0],
            game_time: startTime.split('T')[1].split('.')[0],
            status: 'scheduled',
            odds: oddsData,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
        
        if (error) {
          errors.push(`Error upserting game ${gameId}: ${error.message}`)
        } else {
          synced++
        }
      } catch (error) {
        errors.push(`Error processing game: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Synced ${synced} games from MySportsFeeds`,
      date: dateStr,
      gamesProcessed: games.length,
      gamesSynced: synced,
      errors: errors,
      debug: {
        responseSample: JSON.stringify(odds).substring(0, 500),
        firstGameSample: games.length > 0 ? games[0] : null
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Sync Games] Error:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

