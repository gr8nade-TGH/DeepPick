import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('🔍 Debug: Checking games in database...')
    
    // Get all games (no filters)
    const { data: allGames, error: allError } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (allError) {
      throw new Error(`Supabase error: ${allError.message}`)
    }

    // Get upcoming games (with filters)
    const today = new Date().toISOString().split('T')[0]
    const { data: upcomingGames, error: upcomingError } = await supabase
      .from('games')
      .select('*')
      .gte('game_date', today)
      .in('status', ['scheduled', 'live'])
      .order('game_date', { ascending: true })
      .limit(10)

    if (upcomingError) {
      throw new Error(`Upcoming games error: ${upcomingError.message}`)
    }

    return NextResponse.json({
      success: true,
      debug: {
        totalGames: allGames?.length || 0,
        upcomingGames: upcomingGames?.length || 0,
        allGames: allGames?.map(g => ({
          id: g.id,
          sport: g.sport,
          home_team: g.home_team,
          away_team: g.away_team,
          game_date: g.game_date,
          status: g.status,
          created_at: g.created_at
        })) || [],
        upcomingGamesData: upcomingGames?.map(g => ({
          id: g.id,
          sport: g.sport,
          home_team: g.home_team,
          away_team: g.away_team,
          game_date: g.game_date,
          status: g.status,
          created_at: g.created_at
        })) || []
      }
    })

  } catch (error) {
    console.error('❌ Debug error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
