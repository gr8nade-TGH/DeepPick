/**
 * Sync MySportsFeeds games and odds to database
 * POST /api/sync/mysportsfeeds-games
 */

import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { fetchOddsGameLines, fetchScoreboard } from '@/lib/data-sources/mysportsfeeds-api'


export async function POST() {
  try {
    const supabase = getSupabase()
    
    // Get today's date in YYYYMMDD format
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0')
    
    console.log(`[Sync Games] Fetching MySportsFeeds data for ${dateStr}...`)
    
    // Fetch scoreboard and odds
    const [scoreboard, odds] = await Promise.all([
      fetchScoreboard(dateStr),
      fetchOddsGameLines(dateStr)
    ])
    
    console.log(`[Sync Games] Got ${scoreboard.scoreboard?.games?.length || 0} games from scoreboard`)
    console.log(`[Sync Games] Got ${odds.gamelines?.length || 0} games with odds`)
    
    // Create a map of odds by game ID
    const oddsMap = new Map()
    if (odds.gamelines) {
      for (const gameLine of odds.gamelines) {
        const gameId = gameLine.game?.id
        if (gameId) {
          oddsMap.set(gameId, gameLine)
        }
      }
    }
    
    // Process games from scoreboard
    const games = scoreboard.scoreboard?.games || []
    let synced = 0
    
    for (const game of games) {
      try {
        const gameId = game.id.toString()
        const homeTeam = game.homeTeam?.abbreviation
        const awayTeam = game.awayTeam?.abbreviation
        const startTime = game.startTime
        
        if (!homeTeam || !awayTeam || !startTime) {
          console.warn(`[Sync Games] Skipping game ${gameId} - missing required fields`)
          continue
        }
        
        // Parse game odds if available
        const gameOdds = oddsMap.get(game.id)
        let oddsData = null
        
        if (gameOdds?.lines) {
          // Extract lines from the first available sportsbook
          const lines = gameOdds.lines[0]
          oddsData = {}
          
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

