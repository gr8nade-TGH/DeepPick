import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cappers/team-dominance?capperId=xxx
 *
 * Returns a capper's top 3 teams based on SPREAD pick performance (net units)
 * Also includes their rank for each team compared to other cappers
 *
 * v2: Fixed JSON parsing for game_snapshot
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
    // Note: Supabase has a default limit of 1000 rows, but we explicitly set higher to ensure all picks
    const { data: allPicks, error: allPicksError } = await admin
      .from('picks')
      .select('capper, game_snapshot, status, units, net_units')
      .eq('pick_type', 'spread')
      .in('status', ['won', 'lost', 'push'])
      .order('created_at', { ascending: false })
      .limit(5000)

    console.log('[TeamDominance] Fetched picks:', allPicks?.length || 0)

    // Debug: log first few picks with full details
    if (allPicks && allPicks.length > 0) {
      console.log('[TeamDominance] First 3 picks raw:', allPicks.slice(0, 3).map(p => ({
        capper: p.capper,
        snapshotType: typeof p.game_snapshot,
        snapshotKeys: p.game_snapshot ? Object.keys(p.game_snapshot as object) : [],
        rawSnapshot: JSON.stringify(p.game_snapshot).substring(0, 200)
      })))
    }

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

    // Helper to parse game_snapshot (handles both string and object)
    const parseGameSnapshot = (snapshot: any): any => {
      if (!snapshot) return null
      if (typeof snapshot === 'string') {
        try {
          return JSON.parse(snapshot)
        } catch {
          return null
        }
      }
      return snapshot
    }

    // Helper to extract team abbreviation
    const extractTeamAbbr = (teamData: any): string | undefined => {
      if (!teamData) return undefined
      if (typeof teamData === 'string') {
        try {
          return JSON.parse(teamData).abbreviation
        } catch {
          return undefined
        }
      }
      return teamData.abbreviation
    }

    // Debug counters
    let processedCount = 0
    let skippedNoSnapshot = 0
    let skippedParseFailure = 0
    let skippedNoTeams = 0

    // Process all picks
    allPicks?.forEach(pick => {
      if (!pick.game_snapshot) {
        skippedNoSnapshot++
        return
      }

      const snapshot = parseGameSnapshot(pick.game_snapshot)
      if (!snapshot) {
        skippedParseFailure++
        return
      }

      const homeTeam = extractTeamAbbr(snapshot.home_team)
      const awayTeam = extractTeamAbbr(snapshot.away_team)

      if (!homeTeam || !awayTeam) {
        skippedNoTeams++
        // Log why this is failing
        if (processedCount < 3) {
          console.log('[TeamDominance] Skip - no teams:', {
            capper: pick.capper,
            homeTeamRaw: snapshot.home_team,
            awayTeamRaw: snapshot.away_team,
            homeTeamExtracted: homeTeam,
            awayTeamExtracted: awayTeam
          })
        }
        return
      }

      processedCount++

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

    console.log('[TeamDominance] Processing summary:', {
      totalPicks: allPicks?.length || 0,
      processedCount,
      skippedNoSnapshot,
      skippedParseFailure,
      skippedNoTeams
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

    // Debug: check what cappers exist for first team with data
    let debugCapperList: string[] = []
    for (const team of allNBATeams) {
      const capperMap = teamStats.get(team)!
      if (capperMap.size > 0) {
        debugCapperList = Array.from(capperMap.keys())
        break
      }
    }

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

    // Sort by net units
    const sortedTeams = capperTeamData.sort((a, b) => b.netUnits - a.netUnits)
    const top3Teams = sortedTeams.slice(0, 3)

    // Check if caller wants all teams
    const includeAll = searchParams.get('all') === '1' || searchParams.get('includeAll') === 'true'

    console.log('[TeamDominance] Results for', capperId, ':', {
      totalTeams: capperTeamData.length,
      top3: top3Teams,
      includeAll
    })

    // Include debug info if requested
    const includeDebug = searchParams.get('debug') === '1'

    return NextResponse.json({
      success: true,
      capperId,
      topTeams: top3Teams,
      allTeams: includeAll ? sortedTeams : undefined, // Include all teams if requested
      totalTeams: capperTeamData.length,
      ...(includeDebug && {
        debug: {
          totalPicksFetched: allPicks?.length || 0,
          processedCount,
          skippedNoSnapshot,
          skippedParseFailure,
          skippedNoTeams,
          requestedCapperId: capperId,
          requestedCapperIdLower: capperId.toLowerCase(),
          cappersInData: debugCapperList,
          samplePick: allPicks?.[0] ? {
            capper: allPicks[0].capper,
            snapshotType: typeof allPicks[0].game_snapshot,
            snapshotKeys: allPicks[0].game_snapshot ? Object.keys(allPicks[0].game_snapshot as object) : []
          } : null
        }
      })
    })

  } catch (error) {
    console.error('[TeamDominance] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

