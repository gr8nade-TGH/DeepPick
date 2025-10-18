import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// GET /api/picks - Get all picks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const sport = searchParams.get('sport')

    let query = supabase
      .from('picks')
      .select(`
        *,
        pick_results(*),
        games(
          home_team,
          away_team,
          game_date,
          game_time
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (sport) {
      query = query.eq('sport', sport)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch picks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/picks - Create a new pick
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('picks')
      .insert([{
        user_id: body.user_id || '00000000-0000-0000-0000-000000000000', // Mock user for now
        game_id: body.game_id,
        sport: body.sport,
        bet_type: body.bet_type,
        selection: body.selection,
        odds: body.odds,
        confidence: body.confidence,
        units: body.units,
        potential_payout: body.potential_payout,
        reasoning: body.reasoning,
        data_points: body.data_points || []
      }])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data?.[0]
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to create pick',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
