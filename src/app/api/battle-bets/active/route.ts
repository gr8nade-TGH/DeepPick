import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { calculateTotalDefenseDots, distributeDefenseDots } from '@/lib/battle-bets/defense-dots'

/**
 * Get active battle matchups with pagination
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 4, max: 10)
 * - capperId: Filter battles for a specific capper (optional)
 *
 * Returns:
 * - battles: Array of battle matchups with enriched capper data
 * - pagination: { page, limit, total, totalPages }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '4'), 10)
    const capperId = searchParams.get('capperId') // Optional filter
    const offset = (page - 1) * limit

    console.log(`[Active Battles] Fetching page ${page} (limit: ${limit}, offset: ${offset}, capperId: ${capperId || 'all'})`)

    const supabase = getSupabaseAdmin()

    // Build query for counting battles
    let countQuery = supabase
      .from('battle_matchups')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'complete')

    // Filter by capper if provided
    if (capperId) {
      countQuery = countQuery.or(`left_capper_id.eq.${capperId},right_capper_id.eq.${capperId}`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('[Active Battles] Error counting battles:', countError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${countError.message}`
      }, { status: 500 })
    }

    const totalBattles = count || 0
    const totalPages = Math.ceil(totalBattles / limit)

    console.log(`[Active Battles] Total battles: ${totalBattles}, Total pages: ${totalPages}`)

    // Build query for fetching battles
    let battlesQuery = supabase
      .from('battle_matchups')
      .select('*')
      .neq('status', 'complete')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by capper if provided
    if (capperId) {
      battlesQuery = battlesQuery.or(`left_capper_id.eq.${capperId},right_capper_id.eq.${capperId}`)
    }

    const { data: battles, error: battlesError } = await battlesQuery

    if (battlesError) {
      console.error('[Active Battles] Error fetching battles:', battlesError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${battlesError.message}`
      }, { status: 500 })
    }

    if (!battles || battles.length === 0) {
      console.log('[Active Battles] No active battles found')
      return NextResponse.json({
        success: true,
        battles: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }

    console.log(`[Active Battles] Found ${battles.length} battles on page ${page}`)

    // Enrich each battle with capper data
    const enrichedBattles = await Promise.all(
      battles.map(async (battle) => {
        try {
          // Get game info
          const { data: game } = await supabase
            .from('games')
            .select('*')
            .eq('id', battle.game_id)
            .single()

          // Get left capper performance with this team
          const leftCapperData = await getCapperPerformance(
            supabase,
            battle.left_capper_id,
            battle.left_team
          )

          // Get right capper performance with this team
          const rightCapperData = await getCapperPerformance(
            supabase,
            battle.right_capper_id,
            battle.right_team
          )

          return {
            ...battle,
            game,
            left_capper: leftCapperData,
            right_capper: rightCapperData
          }
        } catch (enrichError) {
          console.error(`[Active Battles] Error enriching battle ${battle.id}:`, enrichError)
          return {
            ...battle,
            game: null,
            left_capper: null,
            right_capper: null
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      battles: enrichedBattles,
      pagination: {
        page,
        limit,
        total: totalBattles,
        totalPages
      }
    })
  } catch (error) {
    console.error('[Active Battles] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * Get capper performance data for a specific team
 * 
 * Returns:
 * - Capper profile (name, display name)
 * - Performance stats (wins, losses, net units, win rate)
 * - Defense dot distribution
 */
async function getCapperPerformance(
  supabase: any,
  capperId: string,
  teamAbbr: string
) {
  try {
    // Get capper profile
    const { data: profile } = await supabase
      .from('capper_profiles')
      .select('capper_id, display_name, description, color_theme')
      .eq('capper_id', capperId)
      .single()

    // Get all GRADED picks for this capper with this team
    // A pick involves a team if either home or away team matches
    const { data: allPicks } = await supabase
      .from('picks')
      .select('id, status, units, net_units, game_snapshot, pick_type')
      .eq('capper', capperId)
      .in('status', ['won', 'lost', 'push'])

    // Filter picks that involve this team
    const teamPicks = allPicks?.filter((pick: any) => {
      if (!pick.game_snapshot) return false
      const snapshot = pick.game_snapshot as any
      const homeTeam = snapshot.home_team?.abbreviation
      const awayTeam = snapshot.away_team?.abbreviation
      return homeTeam === teamAbbr || awayTeam === teamAbbr
    }) || []

    // Calculate performance stats
    const wins = teamPicks.filter((p: any) => p.status === 'won').length
    const losses = teamPicks.filter((p: any) => p.status === 'lost').length
    const pushes = teamPicks.filter((p: any) => p.status === 'push').length
    const totalPicks = teamPicks.length
    const netUnits = teamPicks.reduce((sum: number, p: any) => sum + (p.net_units || 0), 0)
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0

    // Calculate defense dots
    const totalDefenseDots = calculateTotalDefenseDots(netUnits)
    const defenseDotDistribution = distributeDefenseDots(totalDefenseDots)

    // Get overall capper stats (all teams)
    const { data: allCapperPicks } = await supabase
      .from('picks')
      .select('id, status, units, net_units')
      .eq('capper', capperId)
      .in('status', ['won', 'lost', 'push'])

    const overallWins = allCapperPicks?.filter((p: any) => p.status === 'won').length || 0
    const overallLosses = allCapperPicks?.filter((p: any) => p.status === 'lost').length || 0
    const overallPushes = allCapperPicks?.filter((p: any) => p.status === 'push').length || 0
    const overallNetUnits = allCapperPicks?.reduce((sum: number, p: any) => sum + (p.net_units || 0), 0) || 0
    const overallWinRate = (overallWins + overallLosses) > 0 ? (overallWins / (overallWins + overallLosses)) * 100 : 0

    return {
      id: capperId,
      name: capperId.toUpperCase(),
      displayName: profile?.display_name || capperId.toUpperCase(),
      colorTheme: profile?.color_theme || '#3b82f6',

      // Team-specific performance
      teamPerformance: {
        team: teamAbbr,
        wins,
        losses,
        pushes,
        totalPicks,
        netUnits,
        winRate,
        defenseDots: defenseDotDistribution
      },

      // Overall performance
      overallPerformance: {
        wins: overallWins,
        losses: overallLosses,
        pushes: overallPushes,
        totalPicks: allCapperPicks?.length || 0,
        netUnits: overallNetUnits,
        winRate: overallWinRate
      }
    }
  } catch (error) {
    console.error(`[Active Battles] Error getting capper performance for ${capperId}:`, error)

    // Return default data if error
    return {
      id: capperId,
      name: capperId.toUpperCase(),
      displayName: capperId.toUpperCase(),
      colorTheme: '#3b82f6',
      teamPerformance: {
        team: teamAbbr,
        wins: 0,
        losses: 0,
        pushes: 0,
        totalPicks: 0,
        netUnits: 0,
        winRate: 0,
        defenseDots: distributeDefenseDots(5) // Default: 1 dot per stat
      },
      overallPerformance: {
        wins: 0,
        losses: 0,
        pushes: 0,
        totalPicks: 0,
        netUnits: 0,
        winRate: 0
      }
    }
  }
}

