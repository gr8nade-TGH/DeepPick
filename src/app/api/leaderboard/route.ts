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

    // Fetch all graded picks (with optional date filter)
    let picksQuery = admin
      .from('picks')
      .select('capper, user_id, status, units, net_units, is_system_pick')
      .in('status', ['won', 'lost', 'push'])

    if (dateFilter) {
      picksQuery = picksQuery.gte('created_at', dateFilter.toISOString())
    }

    const { data: picks, error: picksError } = await picksQuery

    if (picksError) {
      console.error('[Leaderboard] Error fetching picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch picks'
      }, { status: 500 })
    }

    // Fetch all user profiles (to get roles and filter FREE users)
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name, username, role, avatar_url')
      .in('role', ['capper', 'admin']) // Only CAPPER and ADMIN

    if (profilesError) {
      console.error('[Leaderboard] Error fetching profiles:', profilesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch profiles'
      }, { status: 500 })
    }

    // Create a map of user_id -> profile
    const profileMap = new Map(profiles.map(p => [p.id, p]))

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

    // System cappers
    const SYSTEM_CAPPERS = [
      { id: 'shiva', name: 'SHIVA' },
      { id: 'ifrit', name: 'IFRIT' },
      { id: 'nexus', name: 'NEXUS' },
      { id: 'cerberus', name: 'CERBERUS' },
      { id: 'deeppick', name: 'DeepPick' },
    ]

    // Initialize system cappers
    SYSTEM_CAPPERS.forEach(capper => {
      capperStats.set(capper.id, {
        id: capper.id,
        name: capper.name,
        type: 'system',
        wins: 0,
        losses: 0,
        pushes: 0,
        totalPicks: 0,
        netUnits: 0,
        unitsBet: 0
      })
    })

    // Process picks
    picks.forEach(pick => {
      let capperId: string
      let capperName: string
      let capperType: 'system' | 'user'
      let profile: any = null

      if (pick.is_system_pick) {
        // System pick
        capperId = pick.capper
        capperName = SYSTEM_CAPPERS.find(c => c.id === capperId)?.name || capperId.toUpperCase()
        capperType = 'system'
      } else {
        // User pick
        if (!pick.user_id) return // Skip if no user_id
        profile = profileMap.get(pick.user_id)
        if (!profile) return // Skip if user not found or is FREE

        capperId = pick.user_id
        capperName = profile.username || profile.full_name || 'Unknown User'
        capperType = 'user'
      }

      // Get or create stats entry
      if (!capperStats.has(capperId)) {
        capperStats.set(capperId, {
          id: capperId,
          name: capperName,
          type: capperType,
          role: profile?.role,
          avatar_url: profile?.avatar_url,
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
        role: stats.role,
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

