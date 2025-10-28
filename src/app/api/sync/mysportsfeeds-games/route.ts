/**
 * Sync MySportsFeeds games and odds to database
 * POST /api/sync/mysportsfeeds-games
 */

import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { fetchOddsGameLines } from '@/lib/data-sources/mysportsfeeds-api'


export async function POST() {
  try {
    const supabase = getSupabase()
    
    // Get today's date in YYYYMMDD format
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0')
    
    console.log(`[Sync Games] Fetching MySportsFeeds odds data for ${dateStr}...`)
    
    // Fetch odds (which includes game information)
    const odds = await fetchOddsGameLines(dateStr)
    
    console.log(`[Sync Games] Got ${odds.gameLines?.length || 0} games with odds`)
    
    // Process games from odds data
    const games = odds.gameLines || []
    let synced = 0
    
    for (const gameLine of games) {
      try {
        const gameData = gameLine.game
        const gameId = gameData?.id?.toString()
        const homeTeam = gameData?.homeTeamAbbreviation
        const awayTeam = gameData?.awayTeamAbbreviation
        const startTime = gameData?.startTime
        
        if (!gameId || !homeTeam || !awayTeam || !startTime) {
          console.warn(`[Sync Games] Skipping game ${gameId} - missing required fields`)
          continue
        }
        
        // Parse game odds if available
        let oddsData: any = null
        
        if (gameLine.lines && gameLine.lines.length > 0) {
          // Extract lines from the first available sportsbook
          const lines = gameLine.lines[0]
          oddsData = {} as any
          
          // Add spread, total, moneylines if available
          if (lines.spreads) {
            const spread = lines.spreads[0]
            oddsData.spread = {
              home: spread?.spread?.homeLine?.point,
              away: spread?.spread?.awayLine?.point
            }
          }
          
          if (lines.totals) {
            const total = lines.totals[0]
            oddsData.total = {
              over: total?.total?.overLine?.point,
              under: total?.total?.underLine?.point
            }
          }
          
          if (lines.moneyLines) {
            const ml = lines.moneyLines[0]
            oddsData.moneyline = {
              home: ml?.moneyLine?.homeLine?.decimal,
              away: ml?.moneyLine?.awayLine?.decimal
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
          console.error(`[Sync Games] Error upserting game ${gameId}:`, error)
        } else {
          synced++
        }
      } catch (error) {
        console.error(`[Sync Games] Error processing game:`, error)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Synced ${synced} games from MySportsFeeds`,
      date: dateStr,
      gamesProcessed: games.length,
      gamesSynced: synced
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

