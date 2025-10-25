import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sport = searchParams.get('sport')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = getSupabase()
      .from('games_history')
      .select('*')
      .order('archived_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (sport && sport !== 'all') {
      query = query.eq('sport', sport)
    }

    const { data: games, error } = await query

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    const transformedGames = games?.map(game => ({
      id: game.id,
      sport: game.sport,
      league: game.league,
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.game_date,
      game_time: game.game_time,
      status: game.status,
      final_score: game.final_score,
      venue: game.venue,
      odds: game.odds,
      created_at: game.created_at,
      updated_at: game.updated_at,
      completed_at: game.completed_at,
      archived_at: game.archived_at,
      sportsbooks: game.odds ? Object.keys(game.odds) : []
    })) || []

    return NextResponse.json({
      success: true,
      data: transformedGames,
      pagination: {
        limit,
        offset,
        total: transformedGames.length
      }
    })

  } catch (error) {
    console.error('Error fetching games history:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

