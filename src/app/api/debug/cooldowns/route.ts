import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check cooldowns for a specific game
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId') || 'eb23c261-6916-4f4a-9bac-59c93aa333c3'

    const supabase = getSupabaseAdmin()

    // Get cooldowns for this game
    const { data: cooldowns, error: cooldownsError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (cooldownsError) {
      return NextResponse.json({
        success: false,
        error: cooldownsError.message
      }, { status: 500 })
    }

    // Get game info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError) {
      return NextResponse.json({
        success: false,
        error: gameError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      game: {
        id: game.id,
        matchup: `${game.away_team} @ ${game.home_team}`,
        game_date: game.game_date,
        game_time: game.game_time,
        status: game.status
      },
      cooldowns: cooldowns.map(c => ({
        bet_type: c.bet_type,
        result: c.result,
        units: c.units,
        confidence_score: c.confidence_score,
        reason: c.reason,
        cooldown_until: c.cooldown_until,
        created_at: c.created_at,
        is_expired: new Date(c.cooldown_until) < new Date()
      })),
      current_time: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

