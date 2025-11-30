import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Accomplishment {
  type: 'hot_streak' | 'territory_king' | 'milestone' | 'top_performer'
  title: string
  description: string
  capper: string
  capperName: string
  icon: string
  color: string
  value?: number
  team?: string
}

const CAPPER_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  'shiva': { name: 'SHIVA', icon: '🔱', color: 'from-blue-500 to-cyan-500' },
  'ifrit': { name: 'IFRIT', icon: '🔥', color: 'from-orange-500 to-red-500' },
  'sentinel': { name: 'SENTINEL', icon: '🛡️', color: 'from-blue-600 to-indigo-700' },
  'nexus': { name: 'NEXUS', icon: '🔷', color: 'from-purple-500 to-pink-500' },
  'blitz': { name: 'BLITZ', icon: '⚡', color: 'from-yellow-600 to-orange-700' },
  'titan': { name: 'TITAN', icon: '🏔️', color: 'from-gray-600 to-slate-700' },
  'thief': { name: 'THIEF', icon: '🎭', color: 'from-violet-600 to-purple-700' },
  'cerberus': { name: 'CERBERUS', icon: '🐺', color: 'from-red-500 to-orange-500' },
  'picksmith': { name: 'PICKSMITH', icon: '⚒️', color: 'from-amber-500 to-orange-600' },
  'gr8nade': { name: 'gr8nade', icon: '💎', color: 'from-lime-500 to-green-600' },
  'marshal-harris': { name: 'Marshal Harris', icon: '🎖️', color: 'from-emerald-500 to-teal-600' },
}

const NBA_TEAM_NAMES: Record<string, string> = {
  'ATL': 'Atlanta Hawks', 'BOS': 'Boston Celtics', 'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets', 'CHI': 'Chicago Bulls', 'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks', 'DEN': 'Denver Nuggets', 'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors', 'HOU': 'Houston Rockets', 'IND': 'Indiana Pacers',
  'LAC': 'LA Clippers', 'LAL': 'Los Angeles Lakers', 'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat', 'MIL': 'Milwaukee Bucks', 'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans', 'NYK': 'New York Knicks', 'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic', 'PHI': 'Philadelphia 76ers', 'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers', 'SAC': 'Sacramento Kings', 'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors', 'UTA': 'Utah Jazz', 'WAS': 'Washington Wizards'
}

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    const accomplishments: Accomplishment[] = []

    // 1. Fetch hot streaks (consecutive wins for each capper)
    const { data: recentPicks } = await admin
      .from('picks')
      .select('capper, status, net_units, created_at')
      .in('status', ['won', 'lost', 'push'])
      .order('created_at', { ascending: false })
      .limit(500)

    // Calculate current win streaks per capper
    const capperStreaks = new Map<string, { streak: number; units: number }>()
    const capperPicksOrdered = new Map<string, Array<{ status: string; net_units: number }>>()

    recentPicks?.forEach(pick => {
      const capper = pick.capper?.toLowerCase()
      if (!capper) return
      if (!capperPicksOrdered.has(capper)) {
        capperPicksOrdered.set(capper, [])
      }
      capperPicksOrdered.get(capper)!.push({ status: pick.status, net_units: pick.net_units || 0 })
    })

    capperPicksOrdered.forEach((picks, capper) => {
      let streak = 0
      let units = 0
      for (const pick of picks) {
        if (pick.status === 'won') {
          streak++
          units += pick.net_units
        } else if (pick.status === 'lost') {
          break // Streak ends on a loss
        }
        // Pushes don't affect streak
      }
      if (streak >= 3) {
        capperStreaks.set(capper, { streak, units })
      }
    })

    // Add hot streak accomplishments
    capperStreaks.forEach(({ streak, units }, capper) => {
      const display = CAPPER_DISPLAY[capper] || { name: capper, icon: '🎯', color: 'from-gray-500 to-gray-600' }
      accomplishments.push({
        type: 'hot_streak',
        title: `${display.name} on FIRE!`,
        description: `${streak} Win Streak +${units.toFixed(1)}U!`,
        capper,
        capperName: display.name,
        icon: '🔥',
        color: display.color,
        value: streak
      })
    })

    // 2. Fetch territory kings - query directly instead of internal API call
    try {
      const { data: teamDominance } = await admin
        .from('capper_team_stats')
        .select('capper, team, wins, losses, pushes, net_units')
        .gte('wins', 2) // At least 2 wins to own territory
        .order('net_units', { ascending: false })

      // Group by team, find best capper for each team (highest net_units with 2+ wins)
      const teamOwners = new Map<string, { capper: string; wins: number; losses: number; netUnits: number }>()

      teamDominance?.forEach((stat) => {
        const team = stat.team?.toUpperCase()
        if (!team) return

        // Only take first (best) capper for each team
        if (!teamOwners.has(team)) {
          teamOwners.set(team, {
            capper: stat.capper?.toLowerCase() || '',
            wins: stat.wins || 0,
            losses: stat.losses || 0,
            netUnits: stat.net_units || 0
          })
        }
      })

      // Add territory king accomplishments
      teamOwners.forEach((owner, team) => {
        // Only show if they have a positive record
        if (owner.wins > owner.losses && owner.netUnits > 0) {
          const display = CAPPER_DISPLAY[owner.capper] || { name: owner.capper, icon: '🎯', color: 'from-gray-500 to-gray-600' }
          const teamName = NBA_TEAM_NAMES[team] || team
          accomplishments.push({
            type: 'territory_king',
            title: `${display.name} is the King`,
            description: `of ${teamName} Territory`,
            capper: owner.capper,
            capperName: display.name,
            icon: '👑',
            color: display.color,
            team: team
          })
        }
      })
    } catch (err) {
      console.error('[Accomplishments] Failed to fetch territory data:', err)
      // Continue without territory data
    }

    // 3. Check for milestone accomplishments (100+ units, 100+ picks, etc.)
    const { data: capperStats } = await admin
      .from('capper_stats')
      .select('capper, display_name, net_units, total_picks, wins')

    capperStats?.forEach(stats => {
      const capper = stats.capper?.toLowerCase()
      const display = CAPPER_DISPLAY[capper] || { name: stats.display_name || capper, icon: '🎯', color: 'from-gray-500 to-gray-600' }

      if (stats.net_units >= 50) {
        accomplishments.push({
          type: 'milestone',
          title: `${display.name} Legend!`,
          description: `+${stats.net_units.toFixed(0)}U Profit All-Time`,
          capper, capperName: display.name, icon: '💰', color: display.color, value: stats.net_units
        })
      }
      if (stats.wins >= 50) {
        accomplishments.push({
          type: 'milestone',
          title: `${display.name} Machine!`,
          description: `${stats.wins} Career Wins`,
          capper, capperName: display.name, icon: '🏆', color: display.color, value: stats.wins
        })
      }
    })

    // Sort: hot streaks first, then territories, then milestones
    const sortOrder = { 'hot_streak': 0, 'territory_king': 1, 'top_performer': 2, 'milestone': 3 }
    accomplishments.sort((a, b) => {
      const orderDiff = sortOrder[a.type] - sortOrder[b.type]
      if (orderDiff !== 0) return orderDiff
      return (b.value || 0) - (a.value || 0)
    })

    return NextResponse.json({ success: true, accomplishments: accomplishments.slice(0, 10) })
  } catch (error) {
    console.error('[Accomplishments] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch accomplishments' }, { status: 500 })
  }
}

