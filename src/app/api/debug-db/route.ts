import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get ALL games without any filters
    const { data: allGames, error } = await getSupabaseAdmin()
      .from('games')
      .select('id, sport, home_team, away_team, game_date, game_time, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      totalGames: allGames?.length || 0,
      games: allGames?.map(g => ({
        id: g.id.substring(0, 8),
        sport: g.sport,
        matchup: `${g.away_team?.name} @ ${g.home_team?.name}`,
        date: g.game_date,
        time: g.game_time,
        status: g.status,
        created: new Date(g.created_at).toLocaleTimeString(),
        updated: new Date(g.updated_at).toLocaleTimeString()
      }))
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

