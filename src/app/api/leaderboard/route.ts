import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getSystemCapperMap } from '@/lib/cappers/system-cappers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard
 * 
 * Returns leaderboard data for all cappers (system + users)
 * Filters out FREE users (only shows CAPPER and ADMIN roles)
 * 
 * Query params:
 * - period: '7d' | '30d' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const period = searchParams.get('period') || 'all'
    const teamFilter = searchParams.get('team') || null // Team abbreviation (e.g., 'LAL')
    const betTypeFilter = searchParams.get('bet_type') || null // Bet type (e.g., 'total', 'spread')

    const admin = getSupabaseAdmin()

    // OPTIMIZATION: Use materialized view for all-time stats with no filters
    // This is the most common case and provides consistent data across the app
    if (period === 'all' && !teamFilter && !betTypeFilter) {
      const { data: capperStats, error: statsError } = await admin
        .from('capper_stats')
        .select('*')
        .order('net_units', { ascending: false })

      if (statsError) {
        console.error('[Leaderboard] Error fetching capper stats:', statsError)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch leaderboard'
        }, { status: 500 })
      }

      console.log(`[Leaderboard] Using materialized view: ${capperStats?.length || 0} cappers`)

      // Transform to leaderboard format
      const leaderboard = capperStats?.map((stats, index) => ({
        id: stats.capper,
        name: stats.display_name,
        type: stats.is_system_capper ? 'system' : 'user',
        avatar_url: stats.avatar_url,
        wins: stats.wins,
        losses: stats.losses,
        pushes: stats.pushes,
        totalPicks: stats.total_picks,
        netUnits: parseFloat(stats.net_units),
        winRate: parseFloat(stats.win_rate),
        roi: parseFloat(stats.roi),
        rank: index + 1
      })) || []

      return NextResponse.json({
        success: true,
        data: leaderboard,
        count: leaderboard.length,
        period,
        source: 'materialized_view'
      })
    }

    // For filtered queries (period, team, bet_type), calculate from picks
    console.log(`[Leaderboard] Using picks calculation for filtered query: period=${period}, team=${teamFilter}, bet_type=${betTypeFilter}`)

    // Calculate date filter based on period
    let dateFilter: Date | null = null
    if (period === '7d') {
      dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - 7)
    } else if (period === '30d') {
      dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - 30)
    }

    // Fetch all picks (with optional date filter)
    // CRITICAL: Use .select('*') like /api/performance does, then filter in JavaScript
    // This ensures we don't miss any picks due to column selection issues
    let picksQuery = admin
      .from('picks')
      .select('*')

    if (dateFilter) {
      picksQuery = picksQuery.gte('created_at', dateFilter.toISOString())
    }

    const { data: allPicksRaw, error: picksError } = await picksQuery

    if (picksError) {
      console.error('[Leaderboard] Error fetching picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch picks'
      }, { status: 500 })
    }

    // Filter to graded picks in JavaScript (like /api/performance does)
    const allPicks = allPicksRaw?.filter(p => p.status === 'won' || p.status === 'lost' || p.status === 'push') || []

    // Filter picks by team if team filter is provided
    let picks = allPicks
    if (teamFilter) {
      console.log(`[Leaderboard] Filtering by team: ${teamFilter}`)
      console.log(`[Leaderboard] Total picks before team filter: ${allPicks.length}`)
      picks = picks.filter(pick => {
        const homeTeam = pick.game_snapshot?.home_team?.abbreviation
        const awayTeam = pick.game_snapshot?.away_team?.abbreviation
        // Include pick if either home or away team matches the filter
        return homeTeam === teamFilter || awayTeam === teamFilter
      })
      console.log(`[Leaderboard] Total picks after team filter: ${picks.length}`)
    }

    // Filter picks by bet type if bet type filter is provided
    if (betTypeFilter) {
      console.log(`[Leaderboard] Filtering by bet type: ${betTypeFilter}`)
      console.log(`[Leaderboard] Total picks before bet type filter: ${picks.length}`)
      picks = picks.filter(pick => {
        return pick.pick_type === betTypeFilter
      })
      console.log(`[Leaderboard] Total picks after bet type filter: ${picks.length}`)
    }

    // Fetch all user cappers (from user_cappers table)
    const { data: userCappers, error: userCappersError } = await admin
      .from('user_cappers')
      .select('capper_id, display_name, avatar_url')

    if (userCappersError) {
      console.error('[Leaderboard] Error fetching user cappers:', userCappersError)
    }

    // Create a map of capper_id -> user capper info
    const userCapperMap = new Map(userCappers?.map(c => [c.capper_id, c]) || [])

    // Group picks by capper/user
    const capperStats = new Map<string, {
      id: string
      name: string
      type: 'system' | 'user'
      role?: string
      avatar_url?: string
      wins: number
      losses: number
      pushes: number
      totalPicks: number
      netUnits: number
      unitsBet: number
    }>()

    // Get system cappers from database (cached)
    const systemCapperMap = await getSystemCapperMap()

    // Process picks - use capper field for ALL picks
    picks.forEach(pick => {
      const capperId = pick.capper.toLowerCase()

      // Determine if system or user capper
      const isSystemCapper = systemCapperMap.has(capperId)
      const capperType: 'system' | 'user' = isSystemCapper ? 'system' : 'user'

      // Get capper name
      let capperName: string
      let avatarUrl: string | undefined

      if (isSystemCapper) {
        capperName = systemCapperMap.get(capperId)!
      } else {
        const userCapper = userCapperMap.get(capperId)
        capperName = userCapper?.display_name || capperId.toUpperCase()
        avatarUrl = userCapper?.avatar_url || undefined
      }

      // Get or create stats entry
      if (!capperStats.has(capperId)) {
        capperStats.set(capperId, {
          id: capperId,
          name: capperName,
          type: capperType,
          avatar_url: avatarUrl,
          wins: 0,
          losses: 0,
          pushes: 0,
          totalPicks: 0,
          netUnits: 0,
          unitsBet: 0
        })
      }

      const stats = capperStats.get(capperId)!

      // Update stats
      stats.totalPicks++
      stats.unitsBet += pick.units || 0

      if (pick.status === 'won') {
        stats.wins++
        stats.netUnits += pick.net_units || 0
      } else if (pick.status === 'lost') {
        stats.losses++
        stats.netUnits += pick.net_units || 0
      } else if (pick.status === 'push') {
        stats.pushes++
      }
    })

    // Convert to array and calculate derived metrics
    const leaderboard = Array.from(capperStats.values())
      .filter(stats => stats.totalPicks > 0) // Only show cappers with picks
      .map(stats => ({
        id: stats.id,
        name: stats.name,
        type: stats.type,
        avatar_url: stats.avatar_url,
        wins: stats.wins,
        losses: stats.losses,
        pushes: stats.pushes,
        totalPicks: stats.totalPicks,
        netUnits: parseFloat(stats.netUnits.toFixed(2)),
        winRate: stats.totalPicks > 0
          ? parseFloat(((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1))
          : 0,
        roi: stats.unitsBet > 0
          ? parseFloat(((stats.netUnits / stats.unitsBet) * 100).toFixed(1))
          : 0
      }))
      .sort((a, b) => b.netUnits - a.netUnits) // Sort by net units
      .map((capper, index) => ({
        ...capper,
        rank: index + 1
      }))

    return NextResponse.json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
      period,
      source: 'picks_calculation'
    })

  } catch (error) {
    console.error('[Leaderboard] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

