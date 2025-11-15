import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/runs
 * 
 * Fetches execution runs for a capper
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const capperId = searchParams.get('capper_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!capperId) {
      return NextResponse.json(
        { success: false, error: 'capper_id is required' },
        { status: 400 }
      )
    }

    const supabase = await getSupabase()

    // Fetch runs for the capper
    const { data: runs, error } = await supabase
      .from('runs')
      .select('*')
      .eq('capper_id', capperId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[RunsAPI] Database error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch runs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      runs: runs || [],
      count: runs?.length || 0
    })
  } catch (error) {
    console.error('[RunsAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

