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
    const debugMode = searchParams.get('debug') === '1'
    const offset = (page - 1) * limit

    console.log(
      `[Active Battles] Fetching page ${page} (limit: ${limit}, offset: ${offset}, capperId: ${capperId || 'all'}, debug=${debugMode})`
    )


    if (debugMode) {
      const now = Date.now()
      const today = new Date(now)
      const gameDate = today.toISOString().slice(0, 10)

      // Create debug cappers with multiple team records so they have HP on any team
      const shiva = createDebugCapperWithMultipleTeams('shiva', 'SHIVA AI', '#f97316', [
        { team: 'LAL', units: 24, wins: 12, losses: 3, pushes: 1 },
        { team: 'MIA', units: 18, wins: 9, losses: 4, pushes: 0 },
        { team: 'BOS', units: 15, wins: 8, losses: 3, pushes: 1 }
      ])
      const ifrit = createDebugCapperWithMultipleTeams('ifrit', 'IFRIT AI', '#ef4444', [
        { team: 'PHX', units: 18, wins: 10, losses: 4, pushes: 0 },
        { team: 'GSW', units: 21, wins: 11, losses: 3, pushes: 1 },
        { team: 'DEN', units: 16, wins: 9, losses: 4, pushes: 0 }
      ])
      const oracle = createDebugCapperWithMultipleTeams('oracle', 'ORACLE AI', '#22c55e', [
        { team: 'BOS', units: 20, wins: 11, losses: 4, pushes: 0 },
        { team: 'MIA', units: 17, wins: 9, losses: 3, pushes: 1 },
        { team: 'DEN', units: 19, wins: 10, losses: 4, pushes: 0 }
      ])

      const battles = [
        {
          id: 'debug-1',
          game_id: 'debug-game-1',
          left_capper_id: 'shiva',
          right_capper_id: 'ifrit',
          left_team: 'LAL',
          right_team: 'PHX',
          spread: -4.5,
          status: 'scheduled',
          current_quarter: 0,
          left_hp: 100,
          right_hp: 100,
          left_score: 0,
          right_score: 0,
          game_start_time: new Date(now + 30 * 60_000).toISOString(),
          q1_end_time: null,
          q2_end_time: null,
          halftime_end_time: null,
          q3_end_time: null,
          q4_end_time: null,
          winner: null,
          game: {
            id: 'debug-game-1',
            game_date: gameDate,
            game_time: '7:00 PM',
            home_team: { name: 'Los Angeles Lakers', abbreviation: 'LAL' },
            away_team: { name: 'Phoenix Suns', abbreviation: 'PHX' }
          },
          left_capper: shiva,
          right_capper: ifrit
        },
        {
          id: 'debug-2',
          game_id: 'debug-game-2',
          left_capper_id: 'oracle',
          right_capper_id: 'shiva',
          left_team: 'BOS',
          right_team: 'MIA',
          spread: -3.5,
          status: 'q2_pending',
          current_quarter: 1,
          left_hp: 95,
          right_hp: 92,
          left_score: 58,
          right_score: 54,
          game_start_time: today.toISOString(),
          q1_end_time: null,
          q2_end_time: new Date(now + (4 * 60 + 21) * 1000).toISOString(),
          halftime_end_time: null,
          q3_end_time: null,
          q4_end_time: null,
          winner: null,
          game: {
            id: 'debug-game-2',
            game_date: gameDate,
            game_time: '7:30 PM',
            home_team: { name: 'Boston Celtics', abbreviation: 'BOS' },
            away_team: { name: 'Miami Heat', abbreviation: 'MIA' }
          },
          left_capper: oracle,
          right_capper: shiva
        },
        {
          id: 'debug-3',
          game_id: 'debug-game-3',
          left_capper_id: 'ifrit',
          right_capper_id: 'oracle',
          left_team: 'GSW',
          right_team: 'DEN',
          spread: 2.5,
          status: 'q4_pending',
          current_quarter: 3,
          left_hp: 88,
          right_hp: 90,
          left_score: 102,
          right_score: 104,
          game_start_time: today.toISOString(),
          q1_end_time: null,
          q2_end_time: null,
          halftime_end_time: null,
          q3_end_time: null,
          q4_end_time: new Date(now + (7 * 60 + 43) * 1000).toISOString(),
          winner: null,
          game: {
            id: 'debug-game-3',
            game_date: gameDate,
            game_time: '8:00 PM',
            home_team: { name: 'Golden State Warriors', abbreviation: 'GSW' },
            away_team: { name: 'Denver Nuggets', abbreviation: 'DEN' }
          },
          left_capper: ifrit,
          right_capper: oracle
        },
        {
          id: 'debug-4',
          game_id: 'debug-game-4',
          left_capper_id: 'shiva',
          right_capper_id: 'opponent',
          left_team: 'DAL',
          right_team: 'NYK',
          spread: -1.5,
          status: 'scheduled',
          current_quarter: 0,
          left_hp: 100,
          right_hp: 100,
          left_score: 0,
          right_score: 0,
          game_start_time: null,
          q1_end_time: null,
          q2_end_time: null,
          halftime_end_time: null,
          q3_end_time: null,
          q4_end_time: null,
          winner: null,
          game: {
            id: 'debug-game-4',
            game_date: gameDate,
            game_time: '9:00 PM',
            home_team: { name: 'Dallas Mavericks', abbreviation: 'DAL' },
            away_team: { name: 'New York Knicks', abbreviation: 'NYK' }
          },
          left_capper: shiva,
          right_capper: null
        }
      ]

      return NextResponse.json({
        success: true,
        battles,
        pagination: {
          page: 1,
          limit: battles.length,
          total: battles.length,
          totalPages: 1
        }
      })
    }

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

    const activeBattles = battles || []
    console.log(`[Active Battles] Found ${activeBattles.length} active battle_matchups on page ${page}`)

    // Enrich each battle with capper data
    const enrichedBattles = await Promise.all(
      activeBattles.map(async (battle) => {
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

    let finalBattles = enrichedBattles

    // If there are open slots on the first page, fill them with single-capper "FINDING OPPONENT" games
    if (page === 1 && enrichedBattles.length < limit) {
      const pendingBattles = await getPendingSingleCapperBattles(supabase, {
        maxCount: limit - enrichedBattles.length,
        capperId: capperId || undefined,
        excludeGameIds: activeBattles.map((b: any) => b.game_id)
      })

      if (pendingBattles.length > 0) {
        console.log(`[Active Battles] Added ${pendingBattles.length} pending single-capper battles`)
        finalBattles = [...enrichedBattles, ...pendingBattles]
      }
    }

    return NextResponse.json({
      success: true,
      battles: finalBattles,
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

    // Get overall capper stats (all teams) - case-insensitive
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


/**
 * Build "single-capper" battles for games where a capper has a SPREAD pick
 * but no battle_matchups row exists yet.
 *
 * These are used to show the "FINDING OPPONENT..." state in the arena.
 */
async function getPendingSingleCapperBattles(
  supabase: any,
  options: {
    maxCount: number
    capperId?: string
    excludeGameIds?: string[]
  }
) {
  const { maxCount, capperId, excludeGameIds = [] } = options

  if (maxCount <= 0) {
    return []
  }

  const excludeSet = new Set(excludeGameIds)
  const nowIso = new Date().toISOString()

  // Look for upcoming scheduled NBA games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, home_team, away_team, spread_line, game_start_timestamp, status, sport')
    .eq('sport', 'nba')
    .eq('status', 'scheduled')
    .gte('game_start_timestamp', nowIso)
    .order('game_start_timestamp', { ascending: true })
    .limit(20)

  if (gamesError) {
    console.error('[Active Battles] Error fetching games for pending battles:', gamesError)
    return []
  }

  if (!games || games.length === 0) {
    return []
  }

  const pendingBattles: any[] = []

  for (const game of games) {
    if (pendingBattles.length >= maxCount) break
    if (excludeSet.has(game.id)) continue

    let picksQuery = supabase
      .from('picks')
      .select('id, capper, selection, pick_type, units, status')
      .eq('game_id', game.id)
      .eq('pick_type', 'spread')
      .eq('status', 'pending')

    if (capperId) {
      picksQuery = picksQuery.eq('capper', capperId)
    }

    const { data: picks, error: picksError } = await picksQuery

    if (picksError) {
      console.error(`[Active Battles] Error fetching picks for pending game ${game.id}:`, picksError)
      continue
    }

    if (!picks || picks.length === 0) {
      continue
    }

    // Take the first pending pick for this game to represent the single capper
    const primaryPick = picks[0]

    const homeAbbr = (game.home_team as any)?.abbreviation || 'HOME'
    const awayAbbr = (game.away_team as any)?.abbreviation || 'AWAY'

    const spreadValue = game.spread_line ? Number(game.spread_line) : 0

    const leftCapperData = await getCapperPerformance(
      supabase,
      primaryPick.capper,
      homeAbbr
    )

    pendingBattles.push({
      id: `pending-${game.id}-${primaryPick.capper}`,
      game_id: game.id,
      left_capper_id: primaryPick.capper,
      right_capper_id: 'opponent',
      left_team: homeAbbr,
      right_team: awayAbbr,
      spread: spreadValue,
      status: 'scheduled',
      game_start_time: null,
      game,
      left_capper: leftCapperData,
      right_capper: null
    })
  }

  return pendingBattles
}

/**
 * Create debug capper with multiple team records
 * This ensures cappers have HP on any team they battle on
 */
function createDebugCapperWithMultipleTeams(
  id: string,
  displayName: string,
  colorTheme: string,
  teams: Array<{ team: string; units: number; wins: number; losses: number; pushes: number }>
) {
  // Use first team as primary for teamPerformance display
  const primaryTeam = teams[0]
  const totalPicks = primaryTeam.wins + primaryTeam.losses + primaryTeam.pushes
  const winRate = (primaryTeam.wins + primaryTeam.losses) > 0
    ? (primaryTeam.wins / (primaryTeam.wins + primaryTeam.losses)) * 100
    : 0
  const defenseDots = distributeDefenseDots(calculateTotalDefenseDots(primaryTeam.units))

  return {
    id,
    name: id.toUpperCase(),
    displayName,
    colorTheme,
    // Add teamRecords array for ALL teams (enables HP on any team)
    teamRecords: teams.map(t => ({
      teamId: t.team,
      units: t.units,
      wins: t.wins,
      losses: t.losses,
      pushes: t.pushes
    })),
    teamPerformance: {
      team: primaryTeam.team,
      wins: primaryTeam.wins,
      losses: primaryTeam.losses,
      pushes: primaryTeam.pushes,
      totalPicks,
      netUnits: primaryTeam.units,
      winRate,
      defenseDots
    },
    overallPerformance: {
      wins: primaryTeam.wins,
      losses: primaryTeam.losses,
      pushes: primaryTeam.pushes,
      totalPicks,
      netUnits: primaryTeam.units,
      winRate
    }
  }
}

function createDebugCapper(
  id: string,
  displayName: string,
  colorTheme: string,
  teamAbbr: string,
  netUnits: number,
  wins: number,
  losses: number,
  pushes: number
) {
  const totalPicks = wins + losses + pushes
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0
  const defenseDots = distributeDefenseDots(calculateTotalDefenseDots(netUnits))

  return {
    id,
    name: id.toUpperCase(),
    displayName,
    colorTheme,
    // Add teamRecords array for proper HP calculation
    teamRecords: [
      {
        teamId: teamAbbr,
        units: netUnits,
        wins,
        losses,
        pushes
      }
    ],
    teamPerformance: {
      team: teamAbbr,
      wins,
      losses,
      pushes,
      totalPicks,
      netUnits,
      winRate,
      defenseDots
    },
    overallPerformance: {
      wins,
      losses,
      pushes,
      totalPicks,
      netUnits,
      winRate
    }
  }
}

