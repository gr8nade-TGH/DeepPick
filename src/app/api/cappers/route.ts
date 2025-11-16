import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/cappers
 * 
 * Get list of cappers
 * 
 * Query params:
 * - system: Filter for system cappers (true/false)
 * - active: Filter for active cappers (true/false)
 * - limit: Max results (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const systemOnly = searchParams.get('system') === 'true'
    const activeOnly = searchParams.get('active') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('cappers')
      .select('*')
      .order('display_name', { ascending: true })
      .limit(limit)

    // Apply filters
    if (systemOnly) {
      query = query.eq('is_system', true)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: cappers, error } = await query

    if (error) {
      console.error('[Cappers API] Error fetching cappers:', error)
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cappers: cappers || []
    })

  } catch (error) {
    console.error('[Cappers API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

