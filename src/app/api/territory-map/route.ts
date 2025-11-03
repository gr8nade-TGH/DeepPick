import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { TerritoryData } from '@/components/territorymap/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/territory-map
 *
 * Returns territory data for all NBA teams based on capper performance
 */
export async function GET() {
  try {
    const supabase = getSupabase()

    // Fetch all picks with their outcomes grouped by team
    const { data: picks, error } = await supabase
      .from('picks')
      .select('*')
      .eq('sport', 'NBA')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching picks:', error)
      return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 })
    }

    // Calculate territory data for each team
    const territoryMap = new Map<string, TerritoryData>()
    const pickIdMap: Record<string, string> = {}

    // Process picks to build territory data
    for (const pick of picks || []) {
      // Extract team abbreviation from matchup (e.g., "LAL vs GSW" -> "LAL")
      const teamMatch = pick.matchup?.match(/^([A-Z]{2,3})/)
      if (!teamMatch) continue

      const teamAbbr = teamMatch[1]

      // Get existing territory or create new one
      let territory = territoryMap.get(teamAbbr)
      if (!territory) {
        territory = {
          teamAbbr,
          state: 'unclaimed',
          capperUsername: pick.capper_username || 'Unknown',
          units: 0,
          wins: 0,
          losses: 0,
          pushes: 0
        }
        territoryMap.set(teamAbbr, territory)
      }

      // Update stats based on outcome
      if (pick.outcome === 'WIN') {
        territory.wins = (territory.wins || 0) + 1
        territory.units = (territory.units || 0) + (pick.units || 1)
      } else if (pick.outcome === 'LOSS') {
        territory.losses = (territory.losses || 0) + 1
        territory.units = (territory.units || 0) - (pick.units || 1)
      } else if (pick.outcome === 'PUSH') {
        territory.pushes = (territory.pushes || 0) + 1
      }

      // Check if this is an active pick (no outcome yet)
      if (!pick.outcome && pick.pick_status === 'CURRENT') {
        territory.state = 'active'
        territory.activePick = {
          gameId: pick.id,
          opponent: pick.matchup?.split(' vs ')[1] || pick.matchup?.split(' @ ')[1] || 'TBD',
          gameTime: pick.game_start_time || new Date().toISOString(),
          prediction: pick.selection || 'N/A',
          confidence: pick.confidence || 5,
          betType: pick.bet_type as 'TOTAL' | 'SPREAD',
          line: pick.line || 0
        }
        // Store pick ID for insight modal
        pickIdMap[teamAbbr] = pick.id
      }

      // Determine territory tier based on units
      if (territory.units && territory.units > 0) {
        territory.state = territory.state === 'active' ? 'active' : 'claimed'
        if (territory.units >= 20) {
          territory.tier = 'dominant'
        } else if (territory.units >= 10) {
          territory.tier = 'strong'
        } else {
          territory.tier = 'weak'
        }
      }
    }

    // Convert map to array
    const territories = Array.from(territoryMap.values())

    // Add unclaimed territories for teams with no picks
    const allNBATeams = [
      'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
      'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
      'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
    ]

    for (const teamAbbr of allNBATeams) {
      if (!territoryMap.has(teamAbbr)) {
        territories.push({
          teamAbbr,
          state: 'unclaimed'
        })
      }
    }

    return NextResponse.json({
      territories,
      pickIdMap,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Territory map API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

