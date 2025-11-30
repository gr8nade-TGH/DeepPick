import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cappers/team-stats
 * 
 * Returns team-specific records for all cappers
 * Used by pick grid to show capper records for specific teams
 * 
 * Returns: { [capperId]: { [team]: { wins, losses, netUnits } } }
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()

    // All NBA teams
    const allNBATeams = [
      'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
      'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
      'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
    ]

    // Fetch ALL graded picks (SPREAD + TOTAL) for ALL cappers
    const { data: allPicks, error: picksError } = await admin
      .from('picks')
      .select('capper, game_snapshot, status, units, net_units, pick_type, selection')
      .in('status', ['won', 'lost', 'push'])
      .order('created_at', { ascending: false })
      .limit(10000)

    if (picksError) {
      console.error('[TeamStats] Error fetching picks:', picksError)
      return NextResponse.json({ success: false, error: 'Failed to fetch picks' }, { status: 500 })
    }

    // Helper to parse game_snapshot
    const parseGameSnapshot = (snapshot: any): any => {
      if (!snapshot) return null
      if (typeof snapshot === 'string') {
        try { return JSON.parse(snapshot) } catch { return null }
      }
      return snapshot
    }

    // Helper to extract team abbreviation
    const extractTeamAbbr = (teamData: any): string | undefined => {
      if (!teamData) return undefined
      if (typeof teamData === 'string') {
        try { return JSON.parse(teamData).abbreviation } catch { return undefined }
      }
      return teamData.abbreviation
    }

    // Extract team from selection (e.g., "HOU -11.5" -> "HOU")
    const extractTeamFromSelection = (selection: string): string | null => {
      if (!selection) return null
      const match = selection.trim().toUpperCase().match(/^([A-Z]{2,3})\s/)
      return match ? match[1] : null
    }

    // Build stats: { capperId: { team: { wins, losses, netUnits } } }
    const capperTeamStats: Record<string, Record<string, { wins: number; losses: number; netUnits: number }>> = {}

    allPicks?.forEach(pick => {
      const capperId = pick.capper?.toUpperCase()
      if (!capperId) return

      // Determine which team this pick is for
      let team: string | null = null

      // For SPREAD picks, extract team from selection
      if (pick.pick_type === 'spread') {
        team = extractTeamFromSelection(pick.selection)
      }

      // If we couldn't get team from selection, try from game_snapshot (both teams)
      if (!team && pick.game_snapshot) {
        const snapshot = parseGameSnapshot(pick.game_snapshot)
        if (snapshot) {
          const homeTeam = extractTeamAbbr(snapshot.home_team)
          const awayTeam = extractTeamAbbr(snapshot.away_team)
          // For TOTAL picks, credit both teams
          if (pick.pick_type === 'total' && homeTeam && awayTeam) {
            [homeTeam, awayTeam].forEach(t => {
              if (!allNBATeams.includes(t)) return
              if (!capperTeamStats[capperId]) capperTeamStats[capperId] = {}
              if (!capperTeamStats[capperId][t]) capperTeamStats[capperId][t] = { wins: 0, losses: 0, netUnits: 0 }
              if (pick.status === 'won') {
                capperTeamStats[capperId][t].wins++
                capperTeamStats[capperId][t].netUnits += (pick.net_units || 0) / 2
              } else if (pick.status === 'lost') {
                capperTeamStats[capperId][t].losses++
                capperTeamStats[capperId][t].netUnits += (pick.net_units || 0) / 2
              }
            })
            return
          }
        }
      }

      // Validate team
      if (!team || !allNBATeams.includes(team)) return

      // Initialize capper and team if needed
      if (!capperTeamStats[capperId]) capperTeamStats[capperId] = {}
      if (!capperTeamStats[capperId][team]) capperTeamStats[capperId][team] = { wins: 0, losses: 0, netUnits: 0 }

      // Update stats
      if (pick.status === 'won') {
        capperTeamStats[capperId][team].wins++
        capperTeamStats[capperId][team].netUnits += pick.net_units || 0
      } else if (pick.status === 'lost') {
        capperTeamStats[capperId][team].losses++
        capperTeamStats[capperId][team].netUnits += pick.net_units || 0
      }
    })

    return NextResponse.json({
      success: true,
      data: capperTeamStats,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // Cache for 5 mins
      }
    })

  } catch (error) {
    console.error('[TeamStats] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

