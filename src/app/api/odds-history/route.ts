import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const gameId = searchParams.get('gameId')

    if (!gameId) {
      return NextResponse.json({
        success: false,
        error: 'gameId parameter is required'
      }, { status: 400 })
    }

    // Fetch odds history for this game, ordered by time
    const { data: history, error } = await getSupabase()
      .from('odds_history')
      .select('*')
      .eq('game_id', gameId)
      .order('captured_at', { ascending: true })

    if (error) {
      console.error('Error fetching odds history:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      history: history || []
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

