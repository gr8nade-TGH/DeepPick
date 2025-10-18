import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Check the status of picks and their associated games
 */
export async function GET() {
  try {
    // Get all picks with their game data
    const { data: picks, error } = await supabaseAdmin
      .from('picks')
      .select(`
        *,
        games (
          id,
          home_team,
          away_team,
          status,
          final_score,
          completed_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Found ${picks?.length || 0} picks`,
      picks: picks?.map(pick => ({
        id: pick.id,
        selection: pick.selection,
        pick_status: pick.status,
        net_units: pick.net_units,
        graded_at: pick.graded_at,
        game: pick.games ? {
          status: pick.games.status,
          home_team: pick.games.home_team?.name,
          away_team: pick.games.away_team?.name,
          final_score: pick.games.final_score,
          completed_at: pick.games.completed_at
        } : 'Game not found or archived'
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

