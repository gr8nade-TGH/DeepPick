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
    // Note: runs table has 'capper' field in metadata JSONB, not a direct capper_id column
    const { data: runs, error } = await supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit * 2) // Fetch more to filter by metadata

    if (error) {
      console.error('[RunsAPI] Database error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch runs' },
        { status: 500 }
      )
    }

    // Filter runs by capper (stored in metadata.capper)
    const filteredRuns = (runs || [])
      .filter((run: any) => run.metadata?.capper === capperId)
      .slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      runs: filteredRuns,
      count: filteredRuns.length
    })
  } catch (error) {
    console.error('[RunsAPI] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

