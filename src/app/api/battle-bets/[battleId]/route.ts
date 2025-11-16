import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { calculateTotalDefenseDots, distributeDefenseDots } from '@/lib/battle-bets/defense-dots'

/**
 * Get a single battle by ID
 * 
 * GET /api/battle-bets/[battleId]
 * 
 * Returns:
 * - battle: Battle matchup with enriched capper data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { battleId: string } }
) {
  try {
    const { battleId } = params

    console.log(`[Battle Detail] Fetching battle: ${battleId}`)

    const supabase = getSupabaseAdmin()

    // Get battle data
    const { data: battle, error: battleError } = await supabase
      .from('battle_matchups')
      .select('*')
      .eq('id', battleId)
      .single()

    if (battleError || !battle) {
      console.error('[Battle Detail] Battle not found:', battleError)
      return NextResponse.json({
        success: false,
        error: 'Battle not found'
      }, { status: 404 })
    }

    console.log(`[Battle Detail] Found battle: ${battle.id}`)

    // Enrich battle with capper data
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

      const enrichedBattle = {
        ...battle,
        game,
        left_capper: leftCapperData,
        right_capper: rightCapperData
      }

      return NextResponse.json({
        success: true,
        battle: enrichedBattle
      })
    } catch (enrichError) {
      console.error(`[Battle Detail] Error enriching battle:`, enrichError)
      return NextResponse.json({
        success: true,
        battle: {
          ...battle,
          game: null,
          left_capper: null,
          right_capper: null
        }
      })
    }
  } catch (error) {
    console.error('[Battle Detail] Fatal error:', error)
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
      .eq('capper', capperId.toLowerCase())
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
    console.error(`[Battle Detail] Error getting capper performance for ${capperId}:`, error)

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
        defenseDots: { knight: 0, wizard: 0, tower: 0, trebuchet: 0, shield: 0 }
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

