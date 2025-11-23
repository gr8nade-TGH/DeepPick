import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/capper-stats
 * 
 * Single source of truth for capper statistics.
 * Uses the capper_stats materialized view which is automatically
 * refreshed when picks are graded.
 * 
 * Query params:
 * - capper: specific capper ID (optional)
 * - limit: number of cappers to return (default: all)
 * - sort: 'roi' | 'net_units' | 'win_rate' (default: 'net_units')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const capperId = searchParams.get('capper')
    const limit = searchParams.get('limit')
    const sort = searchParams.get('sort') || 'net_units'

    const admin = getSupabaseAdmin()

    // Build query
    let query = admin
      .from('capper_stats')
      .select('*')

    // Filter by specific capper if requested
    if (capperId) {
      query = query.eq('capper', capperId.toLowerCase())
    }

    // Sort
    if (sort === 'roi') {
      query = query.order('roi', { ascending: false })
    } else if (sort === 'win_rate') {
      query = query.order('win_rate', { ascending: false })
    } else {
      query = query.order('net_units', { ascending: false })
    }

    // Limit
    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const { data, error } = await query

    if (error) {
      console.error('[CapperStats] Error fetching stats:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch capper stats'
      }, { status: 500 })
    }

    // If requesting a specific capper, return single object
    if (capperId) {
      const stats = data?.[0] || null
      if (!stats) {
        return NextResponse.json({
          success: false,
          error: 'Capper not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    // Otherwise return array with rank
    const statsWithRank = data?.map((stats, index) => ({
      ...stats,
      rank: index + 1
    })) || []

    return NextResponse.json({
      success: true,
      data: statsWithRank
    })

  } catch (error) {
    console.error('[CapperStats] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * POST /api/capper-stats/refresh
 * 
 * Manually refresh the materialized view.
 * Useful for admin tools or debugging.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()

    // Refresh the materialized view
    const { error } = await admin.rpc('refresh_materialized_view', {
      view_name: 'capper_stats'
    })

    if (error) {
      console.error('[CapperStats] Error refreshing view:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to refresh capper stats'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Capper stats refreshed successfully'
    })

  } catch (error) {
    console.error('[CapperStats] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

