import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Get the most recent pick
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select(`
        *,
        games (
          id,
          status,
          final_score,
          home_team,
          away_team,
          game_date
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)

    if (picksError) {
      return NextResponse.json({
        success: false,
        error: picksError.message
      })
    }

    const pick = picks?.[0]

    if (!pick) {
      return NextResponse.json({
        success: false,
        error: 'No picks found'
      })
    }

    // Also check if the game exists separately
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', pick.game_id)
      .single()

    return NextResponse.json({
      success: true,
      pick,
      gameExists: !!game,
      gameError: gameError?.message || null,
      game
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

