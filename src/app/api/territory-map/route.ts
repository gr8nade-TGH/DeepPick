import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { TerritoryData } from '@/components/territorymap/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/territory-map
 *
 * Returns territory data for all NBA teams based on capper SPREAD performance
 * The "king" of each team is determined by the top-ranked capper for SPREAD picks involving that team
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    // All NBA teams
    const allNBATeams = [
      'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
      'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
      'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
    ]

    // Fetch all graded SPREAD picks with game_snapshot
    const { data: allPicks, error: picksError } = await admin
      .from('picks')
      .select('capper, user_id, status, units, net_units, is_system_pick, game_snapshot, pick_type')
      .in('status', ['won', 'lost', 'push'])
      .eq('pick_type', 'spread') // Only SPREAD picks

    if (picksError) {
      console.error('[Territory Map] Error fetching picks:', picksError)
      return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 })
    }



    // Fetch user profiles for user cappers
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name, username, role, avatar_url')
      .in('role', ['capper', 'admin'])

    if (profilesError) {
      console.error('[Territory Map] Error fetching profiles:', profilesError)
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // System cappers
    const SYSTEM_CAPPERS = [
      { id: 'shiva', name: 'SHIVA' },
      { id: 'ifrit', name: 'IFRIT' },
      { id: 'nexus', name: 'NEXUS' },
      { id: 'cerberus', name: 'CERBERUS' },
      { id: 'deeppick', name: 'DeepPick' },
    ]

    // For each team, calculate leaderboard and find the king
    const territories: TerritoryData[] = []
    const pickIdMap: Record<string, string> = {}

    for (const teamAbbr of allNBATeams) {
      // Filter picks for this team (home or away)
      const teamPicks = allPicks.filter(pick => {
        if (!pick.game_snapshot) return false

        // game_snapshot.home_team and away_team are JSON strings, need to parse
        let homeTeam: string | undefined
        let awayTeam: string | undefined

        try {
          if (typeof pick.game_snapshot.home_team === 'string') {
            homeTeam = JSON.parse(pick.game_snapshot.home_team).abbreviation
          } else {
            homeTeam = pick.game_snapshot.home_team?.abbreviation
          }

          if (typeof pick.game_snapshot.away_team === 'string') {
            awayTeam = JSON.parse(pick.game_snapshot.away_team).abbreviation
          } else {
            awayTeam = pick.game_snapshot.away_team?.abbreviation
          }
        } catch (e) {
          console.error('[Territory Map] Error parsing team data:', e)
          return false
        }

        return homeTeam === teamAbbr || awayTeam === teamAbbr
      })

      if (teamPicks.length === 0) {
        // No picks for this team - unclaimed
        territories.push({
          teamAbbr,
          state: 'unclaimed'
        })
        continue
      }

      // Calculate stats for each capper on this team
      const capperStats = new Map<string, {
        id: string
        name: string
        type: 'system' | 'user'
        wins: number
        losses: number
        pushes: number
        totalPicks: number
        netUnits: number
        unitsBet: number
      }>()

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

      // Process picks for this team
      teamPicks.forEach(pick => {
        let capperId: string
        let capperName: string
        let capperType: 'system' | 'user'
        let profile: any = null

        if (pick.is_system_pick) {
          capperId = pick.capper
          capperName = SYSTEM_CAPPERS.find(c => c.id === capperId)?.name || capperId.toUpperCase()
          capperType = 'system'
        } else {
          if (!pick.user_id) return
          profile = profileMap.get(pick.user_id)
          if (!profile) return

          capperId = pick.user_id
          capperName = profile.username || profile.full_name || 'Unknown User'
          capperType = 'user'
        }

        if (!capperStats.has(capperId)) {
          capperStats.set(capperId, {
            id: capperId,
            name: capperName,
            type: capperType,
            wins: 0,
            losses: 0,
            pushes: 0,
            totalPicks: 0,
            netUnits: 0,
            unitsBet: 0
          })
        }

        const stats = capperStats.get(capperId)!
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

      // Find the king (top capper by net units)
      const leaderboard = Array.from(capperStats.values())
        .filter(stats => stats.totalPicks > 0)
        .sort((a, b) => b.netUnits - a.netUnits)

      if (leaderboard.length === 0) {
        territories.push({
          teamAbbr,
          state: 'unclaimed'
        })
        continue
      }

      const king = leaderboard[0]

      // Only claim territory if king has positive units
      if (king.netUnits <= 0) {
        // No one has positive performance - unclaimed
        territories.push({
          teamAbbr,
          state: 'unclaimed'
        })
        continue
      }

      // Determine tier based on net units
      let tier: 'dominant' | 'strong' | 'weak' | undefined
      if (king.netUnits >= 20) {
        tier = 'dominant'
      } else if (king.netUnits >= 10) {
        tier = 'strong'
      } else if (king.netUnits > 0) {
        tier = 'weak'
      }

      const territoryData: TerritoryData = {
        teamAbbr,
        state: 'claimed',
        tier,
        capperUsername: king.name,
        units: parseFloat(king.netUnits.toFixed(2)),
        wins: king.wins,
        losses: king.losses,
        pushes: king.pushes
      }

      territories.push(territoryData)
    }

    return NextResponse.json({
      territories,
      pickIdMap,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Territory Map] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

