import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

const GetPicksSchema = z.object({
  capper: z.string().optional(),
  status: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parse = GetPicksSchema.safeParse({
      capper: searchParams.get('capper') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined
    })

    if (!parse.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: parse.error.issues
      }, { status: 400 })
    }

    const { capper, status, limit, offset } = parse.data
    const supabase = await getSupabase()

    // Build query
    let query = supabase
      .from('picks')
      .select(`
        id,
        game_id,
        pick_type,
        selection,
        units,
        confidence,
        status,
        net_units,
        created_at,
        game:games(
          home_team,
          away_team
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by capper if provided
    if (capper) {
      query = query.eq('capper', capper.toLowerCase())
    }

    // Filter by status if provided
    if (status) {
      if (status === 'pending') {
        query = query.eq('status', 'pending')
      } else if (status === 'completed') {
        // For completed, include won, lost, and push
        query = query.in('status', ['won', 'lost', 'push'])
      } else {
        query = query.eq('status', status)
      }
    }

    const { data: picks, error } = await query

    if (error) {
      console.error('Error fetching picks:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch picks',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: picks || [],
      picks: picks || [],
      count: picks?.length || 0,
      capper: capper || 'all'
    })

  } catch (error) {
    console.error('Error in picks API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}