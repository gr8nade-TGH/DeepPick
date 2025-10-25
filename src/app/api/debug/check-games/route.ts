import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Get all NBA games for today
    const today = new Date().toISOString().split('T')[0]
    
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        id,
        home_team,
        away_team,
        game_date,
        game_time,
        status,
        odds
      `)
      .eq('sport', 'nba')
      .eq('game_date', today)
      .order('game_time', { ascending: true })
    
    if (error) {
      console.error('Supabase error fetching games:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch games', details: error.message },
        { status: 500 }
      )
    }
    
    // Also check for games with existing picks
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('id, game_id, pick_type, status, capper')
      .eq('capper', 'shiva')
      .in('status', ['pending', 'won', 'lost', 'push'])
    
    if (picksError) {
      console.error('Supabase error fetching picks:', picksError)
    }
    
    return NextResponse.json({ 
      success: true, 
      games: games || [],
      picks: picks || [],
      gameCount: games?.length || 0,
      pickCount: picks?.length || 0,
      today
    })
  } catch (e) {
    console.error('[check-games] API error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
