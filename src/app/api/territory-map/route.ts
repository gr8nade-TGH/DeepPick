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

    // Fetch pending SPREAD picks for active territories
    const { data: pendingPicks, error: pendingError } = await admin
      .from('picks')
      .select('id, capper, user_id, is_system_pick, game_snapshot, pick_type, selection, confidence')
      .eq('status', 'pending')
      .eq('pick_type', 'spread')

    if (pendingError) {
      console.error('[Territory Map] Error fetching pending picks:', pendingError)
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

      // Build leaderboard (top cappers by net units)
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

      // Check which cappers have pending picks for this team
      const cappersWithPicks = new Map<string, { pickId: string, gameTime: string, gameStatus: string }>()

        ; (pendingPicks || []).forEach(pick => {
          if (!pick.game_snapshot) return

          let homeTeam: string | undefined
          let awayTeam: string | undefined
          let gameTime: string | undefined
          let gameStatus: string | undefined

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

            // Get game time and status from game_snapshot
            gameTime = pick.game_snapshot.game_start_timestamp ||
              `${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`
            gameStatus = pick.game_snapshot.status || 'scheduled'
          } catch (e) {
            return
          }

          // Check if this pick is for this team
          const isForThisTeam = homeTeam === teamAbbr || awayTeam === teamAbbr
          if (!isForThisTeam) return

          // Store pick info by capper ID
          const capperId = pick.is_system_pick ? pick.capper : pick.user_id
          if (capperId) {
            cappersWithPicks.set(capperId, {
              pickId: pick.id,
              gameTime: gameTime || '',
              gameStatus: gameStatus || 'scheduled'
            })
          }
        })

      // DYNAMIC OWNERSHIP: Find highest-ranked capper with an active pick
      let displayCapper = leaderboard[0] // Default to #1
      let displayRank = 1
      let hasActivePick = false
      let activePickId: string | undefined
      let gameTime: string | undefined
      let gameStatus: string | undefined

      for (let i = 0; i < leaderboard.length; i++) {
        const capper = leaderboard[i]
        const pickInfo = cappersWithPicks.get(capper.id)

        if (pickInfo) {
          // Found a capper with an active pick
          displayCapper = capper
          displayRank = i + 1
          hasActivePick = true
          activePickId = pickInfo.pickId
          gameTime = pickInfo.gameTime
          gameStatus = pickInfo.gameStatus
          break
        }
      }

      // Only claim territory if top capper has positive units
      if (leaderboard[0].netUnits <= 0) {
        territories.push({
          teamAbbr,
          state: 'unclaimed'
        })
        continue
      }

      // Determine tier based on TOP capper's net units (not displayed capper)
      let tier: 'dominant' | 'strong' | 'weak' | undefined
      const topUnits = leaderboard[0].netUnits
      if (topUnits >= 20) {
        tier = 'dominant'
      } else if (topUnits >= 10) {
        tier = 'strong'
      } else if (topUnits > 0) {
        tier = 'weak'
      }

      // Build leaderboard data for tooltip (top 3)
      const leaderboardData = leaderboard.slice(0, 3).map((capper, idx) => ({
        rank: idx + 1,
        capperId: capper.id,
        capperName: capper.name,
        netUnits: parseFloat(capper.netUnits.toFixed(2)),
        wins: capper.wins,
        losses: capper.losses,
        pushes: capper.pushes,
        totalPicks: capper.totalPicks,
        hasActivePick: cappersWithPicks.has(capper.id),
        activePickId: cappersWithPicks.get(capper.id)?.pickId
      }))

      const territoryData: TerritoryData = {
        teamAbbr,
        state: hasActivePick ? 'active' : 'claimed',
        tier,
        capperUsername: displayCapper.name,
        capperRank: displayRank,
        units: parseFloat(displayCapper.netUnits.toFixed(2)),
        wins: displayCapper.wins,
        losses: displayCapper.losses,
        pushes: displayCapper.pushes,
        leaderboard: leaderboardData,
        gameTime: gameTime,
        gameStatus: gameStatus
      }

      // Store pick ID for modal
      if (activePickId) {
        pickIdMap[teamAbbr] = activePickId
      }

      territories.push(territoryData)
    }

    // Extract active matchups from pending picks (games with active picks)
    const activeMatchupsMap = new Map<string, { homeTeam: string, awayTeam: string, gameTime: string, status: string }>()

      ; (pendingPicks || []).forEach(pick => {
        if (!pick.game_snapshot) return

        try {
          let homeTeam: string | undefined
          let awayTeam: string | undefined
          let gameTime: string | undefined
          let gameStatus: string | undefined
          let gameId: string | undefined

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

          gameTime = pick.game_snapshot.game_start_timestamp ||
            `${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`
          gameStatus = pick.game_snapshot.status || 'scheduled'
          gameId = pick.game_snapshot.game_id || `${homeTeam}-${awayTeam}-${pick.game_snapshot.game_date}`

          if (homeTeam && awayTeam && gameId) {
            // Use gameId as key to avoid duplicates
            if (!activeMatchupsMap.has(gameId)) {
              activeMatchupsMap.set(gameId, {
                homeTeam,
                awayTeam,
                gameTime: gameTime || '',
                status: gameStatus
              })
            }
          }
        } catch (e) {
          console.error('[Territory Map] Error parsing game snapshot for matchup:', e)
        }
      })

    // Convert map to array
    const activeMatchups = Array.from(activeMatchupsMap.entries()).map(([gameId, data]) => ({
      gameId,
      ...data
    }))

    console.log('[Territory Map] Active matchups from pending picks:', {
      matchupsCount: activeMatchups.length,
      matchups: activeMatchups
    })

    return NextResponse.json({
      territories,
      pickIdMap,
      activeMatchups,
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

