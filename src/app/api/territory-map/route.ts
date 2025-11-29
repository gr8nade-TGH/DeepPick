import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { TerritoryData } from '@/components/territorymap/types'
import { getSystemCapperMap } from '@/lib/cappers/system-cappers'

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

    // Get system cappers from database (cached)
    const systemCapperMap = await getSystemCapperMap()

    // All NBA teams
    const allNBATeams = [
      'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
      'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
      'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
    ]

    // Fetch all graded SPREAD picks with game_snapshot
    // Note: Supabase has a default limit, so we explicitly set a high limit to ensure all picks are fetched
    const { data: allPicks, error: picksError } = await admin
      .from('picks')
      .select('capper, user_id, status, units, net_units, is_system_pick, game_snapshot, pick_type')
      .in('status', ['won', 'lost', 'push'])
      .eq('pick_type', 'spread') // Only SPREAD picks
      .order('created_at', { ascending: false })
      .limit(5000)

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
      .limit(5000)

    if (pendingError) {
      console.error('[Territory Map] Error fetching pending picks:', pendingError)
    }



    // Fetch user cappers from user_cappers table
    const { data: userCappers, error: userCappersError } = await admin
      .from('user_cappers')
      .select('capper_id, display_name, avatar_url')

    if (userCappersError) {
      console.error('[Territory Map] Error fetching user cappers:', userCappersError)
    }

    const userCapperMap = new Map(userCappers?.map(c => [c.capper_id.toLowerCase(), c]) || [])

    // Helper function to safely extract team abbreviation from game_snapshot
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

    // Helper function to parse game_snapshot (handles both string and object)
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

    // For each team, calculate leaderboard and find the king
    const territories: TerritoryData[] = []
    const pickIdMap: Record<string, string> = {}

    // Comprehensive debug logging
    console.log('[Territory Map] Total graded SPREAD picks:', allPicks.length)

    if (allPicks.length > 0) {
      const samplePick = allPicks[0]
      const sampleSnapshot = parseGameSnapshot(samplePick.game_snapshot)
      console.log('[Territory Map] Sample pick debug:', {
        capper: samplePick.capper,
        snapshotType: typeof samplePick.game_snapshot,
        parsedSnapshot: sampleSnapshot ? 'valid' : 'null',
        homeTeamType: typeof sampleSnapshot?.home_team,
        homeTeamAbbr: extractTeamAbbr(sampleSnapshot?.home_team),
        awayTeamType: typeof sampleSnapshot?.away_team,
        awayTeamAbbr: extractTeamAbbr(sampleSnapshot?.away_team)
      })
    }

    // Pre-process: count picks per team to debug
    const teamPickCounts: Record<string, number> = {}
    allPicks.forEach(pick => {
      const snapshot = parseGameSnapshot(pick.game_snapshot)
      if (snapshot) {
        const homeTeam = extractTeamAbbr(snapshot.home_team)
        const awayTeam = extractTeamAbbr(snapshot.away_team)
        if (homeTeam) teamPickCounts[homeTeam] = (teamPickCounts[homeTeam] || 0) + 1
        if (awayTeam) teamPickCounts[awayTeam] = (teamPickCounts[awayTeam] || 0) + 1
      }
    })
    console.log('[Territory Map] Picks per team:', teamPickCounts)

    for (const teamAbbr of allNBATeams) {
      // Filter picks for this team (home or away)
      const teamPicks = allPicks.filter(pick => {
        const snapshot = parseGameSnapshot(pick.game_snapshot)
        if (!snapshot) return false

        const homeTeam = extractTeamAbbr(snapshot.home_team)
        const awayTeam = extractTeamAbbr(snapshot.away_team)

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

      // Process picks for this team (no pre-initialization - only add cappers with actual picks)
      teamPicks.forEach(pick => {
        const capperId = pick.capper.toLowerCase()

        // Determine if system or user capper
        const isSystemCapper = systemCapperMap.has(capperId)
        const capperType: 'system' | 'user' = isSystemCapper ? 'system' : 'user'

        // Get capper name
        let capperName: string
        if (isSystemCapper) {
          capperName = systemCapperMap.get(capperId)!
        } else {
          const userCapper = userCapperMap.get(capperId)
          capperName = userCapper?.display_name || capperId.toUpperCase()
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
          const snapshot = parseGameSnapshot(pick.game_snapshot)
          if (!snapshot) return

          const homeTeam = extractTeamAbbr(snapshot.home_team)
          const awayTeam = extractTeamAbbr(snapshot.away_team)

          // Get game time and status from game_snapshot
          const gameTime = snapshot.game_start_timestamp ||
            `${snapshot.game_date}T${snapshot.game_time}`
          const gameStatus = snapshot.status || 'scheduled'

          // Check if this pick is for this team
          const isForThisTeam = homeTeam === teamAbbr || awayTeam === teamAbbr
          if (!isForThisTeam) return

          // Store pick info by capper ID (use pick.capper field)
          const capperId = pick.capper.toLowerCase()
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
        const snapshot = parseGameSnapshot(pick.game_snapshot)
        if (!snapshot) return

        const homeTeam = extractTeamAbbr(snapshot.home_team)
        const awayTeam = extractTeamAbbr(snapshot.away_team)

        const gameTime = snapshot.game_start_timestamp ||
          `${snapshot.game_date}T${snapshot.game_time}`
        const gameStatus = snapshot.status || 'scheduled'
        const gameId = snapshot.game_id || `${homeTeam}-${awayTeam}-${snapshot.game_date}`

        if (homeTeam && awayTeam && gameId) {
          // Use gameId as key to avoid duplicates
          if (!activeMatchupsMap.has(gameId)) {
            activeMatchupsMap.set(gameId, {
              homeTeam,
              awayTeam,
              gameTime: gameTime || '',
              status: gameStatus || 'scheduled'
            })
          }
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

