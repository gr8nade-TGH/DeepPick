import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    console.log('[add-games] Adding NBA games for today...')
    
    // Today's date
    const today = new Date().toISOString().split('T')[0]
    
    // The 4 games you mentioned (all in CT timezone)
    const games = [
      {
        id: 'game-timberwolves-lakers-' + Date.now(),
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
          },
          'betmgm': {
            total: { line: 225.5, over: -105, under: -115 },
            spread: { line: -2.5, home: -105, away: -115 },
            moneyline: { home: -135, away: +115 }
          },
          'caesars': {
            total: { line: 225.0, over: -110, under: -110 },
            spread: { line: -2.0, home: -110, away: -110 },
            moneyline: { home: -130, away: +110 }
          }
        }
      },
      {
        id: 'game-warriors-trailblazers-' + Date.now(),
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
          },
          'betmgm': {
            total: { line: 220.5, over: -105, under: -115 },
            spread: { line: 8.5, home: -105, away: -115 },
            moneyline: { home: +310, away: -410 }
          },
          'caesars': {
            total: { line: 220.0, over: -110, under: -110 },
            spread: { line: 8.0, home: -110, away: -110 },
            moneyline: { home: +300, away: -400 }
          }
        }
      },
      {
        id: 'game-jazz-kings-' + Date.now(),
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
          },
          'betmgm': {
            total: { line: 230.5, over: -105, under: -115 },
            spread: { line: -4.5, home: -105, away: -115 },
            moneyline: { home: -185, away: +160 }
          },
          'caesars': {
            total: { line: 230.0, over: -110, under: -110 },
            spread: { line: -4.0, home: -110, away: -110 },
            moneyline: { home: -180, away: +155 }
          }
        }
      },
      {
        id: 'game-suns-clippers-' + Date.now(),
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
          },
          'betmgm': {
            total: { line: 235.5, over: -105, under: -115 },
            spread: { line: -1.5, home: -105, away: -115 },
            moneyline: { home: -125, away: +105 }
          },
          'caesars': {
            total: { line: 235.0, over: -110, under: -110 },
            spread: { line: -1.0, home: -110, away: -110 },
            moneyline: { home: -120, away: +100 }
          }
        }
      }
    ]
    
    // Insert games
    const { data: insertedGames, error: insertError } = await supabase
      .from('games')
      .insert(games)
      .select('id, home_team, away_team, game_time')
    
    if (insertError) {
      console.error('Error inserting games:', insertError)
      return NextResponse.json({ 
        success: false, 
        error: insertError.message,
        details: 'Failed to insert games into database'
      }, { status: 500 })
    }
    
    console.log(`[add-games] Successfully added ${insertedGames?.length || 0} games`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${insertedGames?.length || 0} NBA games for today`,
      games: insertedGames || [],
      count: insertedGames?.length || 0
    })
    
  } catch (error: any) {
    console.error('[add-games] Unexpected error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}
