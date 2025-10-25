import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Check if games table exists and has data
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .limit(5)
    
    if (gamesError) {
      return NextResponse.json({
        error: 'Database error',
        details: gamesError.message,
        code: gamesError.code
      }, { status: 500 })
    }
    
    // Check games with NBA sport specifically
    const { data: nbaGames, error: nbaError } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'nba')
      .limit(5)
    
    return NextResponse.json({
      total_games: games?.length || 0,
      sample_games: games?.slice(0, 2) || [],
      nba_games: nbaGames?.length || 0,
      sample_nba_games: nbaGames?.slice(0, 2) || [],
      nba_error: nbaError?.message || null
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
