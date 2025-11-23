import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

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

    // Filter to graded picks in JavaScript (like /api/performance does)
    const allPicks = allPicksRaw?.filter(p => p.status === 'won' || p.status === 'lost' || p.status === 'push') || []

    if (picksError) {
      console.error('[Leaderboard] Error fetching picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch picks'
      }, { status: 500 })
    }

    console.log(`[Leaderboard] Total graded picks fetched: ${allPicks?.length || 0}`)
    console.log(`[Leaderboard] Period filter: ${period}, Date filter: ${dateFilter?.toISOString() || 'none'}`)

    // Debug: Count picks per capper
    const picksPerCapper = new Map<string, number>()
    allPicks?.forEach(pick => {
      const capperId = pick.capper?.toLowerCase() || 'unknown'
      picksPerCapper.set(capperId, (picksPerCapper.get(capperId) || 0) + 1)
    })
    console.log('[Leaderboard] Picks per capper:', Object.fromEntries(picksPerCapper))

    // Debug: Check if Sentinel picks exist and show sample
    const sentinelSample = allPicks?.find(p => p.capper?.toLowerCase() === 'sentinel')
    if (sentinelSample) {
      console.log('[Leaderboard] Sample Sentinel pick:', {
        capper: sentinelSample.capper,
        status: sentinelSample.status,
        pick_type: sentinelSample.pick_type
      })
    } else {
      console.log('[Leaderboard] NO Sentinel picks found in query result!')
    }

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

    // System cappers (known list)
    const SYSTEM_CAPPERS = [
      { id: 'shiva', name: 'SHIVA' },
      { id: 'ifrit', name: 'IFRIT' },
      { id: 'oracle', name: 'ORACLE' },
      { id: 'sentinel', name: 'SENTINEL' },
      { id: 'nexus', name: 'NEXUS' },
      { id: 'blitz', name: 'BLITZ' },
      { id: 'titan', name: 'TITAN' },
      { id: 'thief', name: 'THIEF' },
      { id: 'cerberus', name: 'CERBERUS' },
      { id: 'deeppick', name: 'DeepPick' },
    ]

    // Create a map for quick system capper lookup
    const systemCapperMap = new Map(SYSTEM_CAPPERS.map(c => [c.id, c.name]))

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
      period
    })

  } catch (error) {
    console.error('[Leaderboard] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

