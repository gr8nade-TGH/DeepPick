import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

const GetPicksSchema = z.object({
  capper: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parse = GetPicksSchema.safeParse({
      capper: searchParams.get('capper'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    })

    if (!parse.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: parse.error.issues
      }, { status: 400 })
    }

    const { capper, limit, offset } = parse.data
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
        created_at,
        games!inner(
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