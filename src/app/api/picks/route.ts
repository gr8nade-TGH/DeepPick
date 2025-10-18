import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// Mark this route as dynamic (uses request parameters)
export const dynamic = 'force-dynamic'

// GET /api/picks - Get all picks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const sport = searchParams.get('sport')
    const capper = searchParams.get('capper')

    let query = supabase
      .from('picks')
      .select(`
        *,
        games (
          status,
          final_score
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      if (status === 'completed') {
        // Completed = won, lost, or push
        query = query.in('status', ['won', 'lost', 'push'])
      } else {
        query = query.eq('status', status)
      }
    }

    if (sport) {
      query = query.eq('sport', sport)
    }

    if (capper && capper !== 'all') {
      query = query.eq('capper', capper)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('❌ Picks query error:', error)
      return NextResponse.json({ 
        error: error.message,
        details: error,
        capper: capper
      }, { status: 500 })
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
        game_id: body.game_id,
        pick_type: body.pick_type,
        selection: body.selection,
        odds: body.odds,
        units: body.units,
        game_snapshot: body.game_snapshot,
        is_system_pick: body.is_system_pick ?? true,
        confidence: body.confidence,
        reasoning: body.reasoning,
        algorithm_version: body.algorithm_version
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
