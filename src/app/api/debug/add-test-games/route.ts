import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('[add-test-games] Adding test NBA games for TODAY...')
    
    const supabase = getSupabaseAdmin()
    
    // Use TODAY's date (October 25, 2025) - the games you mentioned are playing tonight
    const today = '2025-10-25'
    
    console.log(`[add-test-games] Adding games for date: ${today}`)
    
    // Add the 4 games you mentioned
    const testGames = [
      {
        id: `test-game-1-${Date.now()}`,
        sport: 'nba',
        home_team: { name: 'Lakers', abbreviation: 'LAL' },
        away_team: { name: 'Timberwolves', abbreviation: 'MIN' },
        game_date: today,
        game_time: '21:00:00', // 9:00 PM CT
        status: 'scheduled',
        odds: {
          'draftkings': {
            total: { line: 225.5, over: -110, under: -110 },
            spread: { line: -2.5, home: -110, away: -110 },
            moneyline: { home: -130, away: +110 }
          },
          'fanduel': {
            total: { line: 225.0, over: -108, under: -112 },
            spread: { line: -2.0, home: -108, away: -112 },
            moneyline: { home: -125, away: +105 }
          }
        }
      },
      {
        id: `test-game-2-${Date.now()}`,
        sport: 'nba',
        home_team: { name: 'Trail Blazers', abbreviation: 'POR' },
        away_team: { name: 'Warriors', abbreviation: 'GSW' },
        game_date: today,
        game_time: '21:00:00', // 9:00 PM CT
        status: 'scheduled',
        odds: {
          'draftkings': {
            total: { line: 220.5, over: -110, under: -110 },
            spread: { line: 8.5, home: -110, away: -110 },
            moneyline: { home: +300, away: -400 }
          },
          'fanduel': {
            total: { line: 220.0, over: -108, under: -112 },
            spread: { line: 8.0, home: -108, away: -112 },
            moneyline: { home: +320, away: -420 }
          }
        }
      },
      {
        id: `test-game-3-${Date.now()}`,
        sport: 'nba',
        home_team: { name: 'Kings', abbreviation: 'SAC' },
        away_team: { name: 'Jazz', abbreviation: 'UTA' },
        game_date: today,
        game_time: '21:00:00', // 9:00 PM CT
        status: 'scheduled',
        odds: {
          'draftkings': {
            total: { line: 230.5, over: -110, under: -110 },
            spread: { line: -4.5, home: -110, away: -110 },
            moneyline: { home: -180, away: +155 }
          },
          'fanduel': {
            total: { line: 230.0, over: -108, under: -112 },
            spread: { line: -4.0, home: -108, away: -112 },
            moneyline: { home: -175, away: +150 }
          }
        }
      },
      {
        id: `test-game-4-${Date.now()}`,
        sport: 'nba',
        home_team: { name: 'Clippers', abbreviation: 'LAC' },
        away_team: { name: 'Suns', abbreviation: 'PHX' },
        game_date: today,
        game_time: '21:30:00', // 9:30 PM CT
        status: 'scheduled',
        odds: {
          'draftkings': {
            total: { line: 235.5, over: -110, under: -110 },
            spread: { line: -1.5, home: -110, away: -110 },
            moneyline: { home: -120, away: +100 }
          },
          'fanduel': {
            total: { line: 235.0, over: -108, under: -112 },
            spread: { line: -1.0, home: -108, away: -112 },
            moneyline: { home: -115, away: -105 }
          }
        }
      }
    ]
    
    let storedCount = 0
    
    for (const game of testGames) {
      try {
        // Insert game using the smart upsert function
        const { data: gameResult, error: upsertError } = await supabase
          .rpc('upsert_game_smart', {
            p_sport: game.sport,
            p_league: 'NBA',
            p_home_team: game.home_team,
            p_away_team: game.away_team,
            p_game_date: game.game_date,
            p_game_time: game.game_time,
            p_game_start_timestamp: new Date(`${game.game_date}T${game.game_time}`).toISOString(),
            p_status: game.status,
            p_odds: game.odds,
            p_api_event_id: game.id,
            p_venue: null,
            p_weather: null
          })
        
        if (upsertError) {
          console.error(`Error upserting game ${game.home_team.name} vs ${game.away_team.name}:`, upsertError.message)
          continue
        }
        
        storedCount++
        console.log(`✅ Stored test game: ${game.away_team.name} @ ${game.home_team.name}`)
        
      } catch (error) {
        console.error(`Error processing test game ${game.home_team.name} vs ${game.away_team.name}:`, error)
        continue
      }
    }
    
    console.log(`[add-test-games] Successfully stored ${storedCount} test NBA games`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${storedCount} test NBA games for today`,
      gamesStored: storedCount,
      games: testGames.map(g => `${g.away_team.name} @ ${g.home_team.name}`)
    })
    
  } catch (error: any) {
    console.error('[add-test-games] Unexpected error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}
