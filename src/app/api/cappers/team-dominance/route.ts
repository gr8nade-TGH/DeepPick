import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cappers/team-dominance?capperId=xxx
 * 
 * Returns a capper's top 3 teams based on SPREAD pick performance (net units)
 * Also includes their rank for each team compared to other cappers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const capperId = searchParams.get('capperId')

    if (!capperId) {
      return NextResponse.json(
        { success: false, error: 'capperId is required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // All NBA teams
    const allNBATeams = [
      'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
      'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
      'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
    ]

    // Fetch ALL graded SPREAD picks for ALL cappers (to calculate rankings)
    const { data: allPicks, error: allPicksError } = await admin
      .from('picks')
      .select('capper, game_snapshot, status, units, net_units')
      .eq('pick_type', 'SPREAD')
      .in('status', ['won', 'lost', 'push'])

    if (allPicksError) {
      console.error('[TeamDominance] Error fetching picks:', allPicksError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch picks' },
        { status: 500 }
      )
    }

    // Calculate stats for each team for ALL cappers
    const teamStats = new Map<string, Map<string, { wins: number, losses: number, pushes: number, netUnits: number, totalPicks: number }>>()

    allNBATeams.forEach(team => {
      teamStats.set(team, new Map())
    })

    // Process all picks
    allPicks?.forEach(pick => {
      if (!pick.game_snapshot) return

      const snapshot = pick.game_snapshot as any
      const homeTeam = snapshot.home_team?.abbreviation
      const awayTeam = snapshot.away_team?.abbreviation

      if (!homeTeam || !awayTeam) return

      // Process for both teams involved in the game
      ;[homeTeam, awayTeam].forEach(team => {
        if (!allNBATeams.includes(team)) return

        const capperMap = teamStats.get(team)!
        if (!capperMap.has(pick.capper)) {
          capperMap.set(pick.capper, {
            wins: 0,
            losses: 0,
            pushes: 0,
            netUnits: 0,
            totalPicks: 0
          })
        }

        const stats = capperMap.get(pick.capper)!
        stats.totalPicks++

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
    })

    // Build leaderboards for each team and find this capper's stats
    const capperTeamData: Array<{
      team: string
      netUnits: number
      wins: number
      losses: number
      pushes: number
      totalPicks: number
      rank: number
      totalCappers: number
    }> = []

    allNBATeams.forEach(team => {
      const capperMap = teamStats.get(team)!
      const capperStats = capperMap.get(capperId.toLowerCase())

      if (!capperStats || capperStats.totalPicks === 0) return

      // Build leaderboard for this team
      const leaderboard = Array.from(capperMap.entries())
        .filter(([_, stats]) => stats.totalPicks > 0)
        .map(([capper, stats]) => ({
          capper,
          netUnits: stats.netUnits
        }))
        .sort((a, b) => b.netUnits - a.netUnits)

      // Find this capper's rank
      const rank = leaderboard.findIndex(entry => entry.capper === capperId.toLowerCase()) + 1

      capperTeamData.push({
        team,
        netUnits: parseFloat(capperStats.netUnits.toFixed(2)),
        wins: capperStats.wins,
        losses: capperStats.losses,
        pushes: capperStats.pushes,
        totalPicks: capperStats.totalPicks,
        rank,
        totalCappers: leaderboard.length
      })
    })

    // Sort by net units and take top 3
    const top3Teams = capperTeamData
      .sort((a, b) => b.netUnits - a.netUnits)
      .slice(0, 3)

    return NextResponse.json({
      success: true,
      capperId,
      topTeams: top3Teams,
      totalTeams: capperTeamData.length
    })

  } catch (error) {
    console.error('[TeamDominance] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

