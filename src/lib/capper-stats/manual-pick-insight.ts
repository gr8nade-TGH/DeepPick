/**
 * Manual Pick Insight Generator
 * Generates insight card data for manual picks by analyzing capper's historical performance.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export interface RecordStats {
  wins: number
  losses: number
  pushes: number
  total: number
  winPct: number
  netUnits: number
}

export interface LastPick {
  selection: string
  result: 'won' | 'lost' | 'push'
  date: string
  netUnits: number
}

export interface ManualPickInsightData {
  capper: string
  pickType: 'SPREAD' | 'TOTAL'
  selection: string
  units: number
  betTypeRecord: RecordStats
  streak: { type: 'W' | 'L' | 'none'; count: number }
  matchupRecord: RecordStats | null
  lastMatchupPick: LastPick | null
  spread?: {
    teamRecord: RecordStats
    lastTeamPick: LastPick | null
    homeRecord: RecordStats
    awayRecord: RecordStats
    favoriteRecord: RecordStats
    underdogRecord: RecordStats
  }
  totals?: {
    overRecord: RecordStats
    underRecord: RecordStats
    teamGamesRecord: RecordStats
    lastTeamGamePick: LastPick | null
  }
  generatedAt: string
}

// ============================================================================
// HELPERS
// ============================================================================

function calcRecord(picks: any[]): RecordStats {
  const wins = picks.filter(p => p.status === 'won').length
  const losses = picks.filter(p => p.status === 'lost').length
  const pushes = picks.filter(p => p.status === 'push').length
  const total = wins + losses + pushes
  const netUnits = picks.reduce((sum, p) => sum + (p.net_units || 0), 0)
  const decisive = wins + losses
  return {
    wins,
    losses,
    pushes,
    total,
    winPct: decisive > 0 ? Math.round((wins / decisive) * 100) : 0,
    netUnits: Math.round(netUnits * 100) / 100
  }
}

function parseSpreadTeam(selection: string): string | null {
  const match = selection.match(/^([A-Z]{2,3})\s/)
  return match ? match[1] : null
}

function parseSpreadNumber(selection: string): number | null {
  const match = selection.match(/([+-]?\d+\.?\d*)$/)
  return match ? parseFloat(match[1]) : null
}

function parseOverUnder(selection: string): 'over' | 'under' | null {
  if (selection.toLowerCase().startsWith('over')) return 'over'
  if (selection.toLowerCase().startsWith('under')) return 'under'
  return null
}

function calcStreak(picks: any[]): { type: 'W' | 'L' | 'none'; count: number } {
  if (picks.length === 0) return { type: 'none', count: 0 }
  const decisive = picks.filter(p => p.status === 'won' || p.status === 'lost')
  if (decisive.length === 0) return { type: 'none', count: 0 }
  const streakType = decisive[0].status === 'won' ? 'W' : 'L'
  let count = 0
  for (const p of decisive) {
    if ((streakType === 'W' && p.status === 'won') || (streakType === 'L' && p.status === 'lost')) {
      count++
    } else break
  }
  return { type: streakType, count }
}

function toLastPick(pick: any): LastPick {
  return {
    selection: pick.selection,
    result: pick.status as 'won' | 'lost' | 'push',
    date: new Date(pick.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    netUnits: pick.net_units || 0
  }
}

function pickInvolvesTeam(pick: any, teamAbbr: string): boolean {
  const snapshot = pick.game_snapshot || {}
  const homeAbbr = snapshot.home_team?.abbreviation?.toUpperCase()
  const awayAbbr = snapshot.away_team?.abbreviation?.toUpperCase()
  return homeAbbr === teamAbbr || awayAbbr === teamAbbr
}

function isHomeBet(pick: any): boolean {
  const team = parseSpreadTeam(pick.selection)
  if (!team) return false
  const snapshot = pick.game_snapshot || {}
  return snapshot.home_team?.abbreviation?.toUpperCase() === team
}

function isFavoriteBet(pick: any): boolean {
  const spreadNum = parseSpreadNumber(pick.selection)
  return spreadNum !== null && spreadNum < 0
}

// ============================================================================
// SPREAD STATS GENERATOR
// ============================================================================

function generateSpreadStats(
  picks: any[],
  selection: string,
  homeTeam: { abbreviation: string },
  awayTeam: { abbreviation: string }
) {
  const bettingTeam = parseSpreadTeam(selection)
  const teamPicks = bettingTeam
    ? picks.filter(p => parseSpreadTeam(p.selection) === bettingTeam)
    : []
  const homePicks = picks.filter(p => isHomeBet(p))
  const awayPicks = picks.filter(p => !isHomeBet(p))
  const favPicks = picks.filter(p => isFavoriteBet(p))
  const dogPicks = picks.filter(p => !isFavoriteBet(p))

  return {
    teamRecord: calcRecord(teamPicks),
    lastTeamPick: teamPicks.length > 0 ? toLastPick(teamPicks[0]) : null,
    homeRecord: calcRecord(homePicks),
    awayRecord: calcRecord(awayPicks),
    favoriteRecord: calcRecord(favPicks),
    underdogRecord: calcRecord(dogPicks)
  }
}

// ============================================================================
// TOTALS STATS GENERATOR
// ============================================================================

function generateTotalsStats(
  picks: any[],
  homeTeam: { abbreviation: string },
  awayTeam: { abbreviation: string }
) {
  const overPicks = picks.filter(p => parseOverUnder(p.selection) === 'over')
  const underPicks = picks.filter(p => parseOverUnder(p.selection) === 'under')
  const teamGamePicks = picks.filter(p =>
    pickInvolvesTeam(p, homeTeam.abbreviation) || pickInvolvesTeam(p, awayTeam.abbreviation)
  )

  return {
    overRecord: calcRecord(overPicks),
    underRecord: calcRecord(underPicks),
    teamGamesRecord: calcRecord(teamGamePicks),
    lastTeamGamePick: teamGamePicks.length > 0 ? toLastPick(teamGamePicks[0]) : null
  }
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export async function generateManualPickInsight(
  capper: string,
  pickType: 'spread' | 'total',
  selection: string,
  units: number,
  homeTeam: { name: string; abbreviation: string },
  awayTeam: { name: string; abbreviation: string }
): Promise<ManualPickInsightData> {
  const supabase = getSupabaseAdmin()
  const betType = pickType.toUpperCase() as 'SPREAD' | 'TOTAL'

  // Fetch all graded picks for this capper and bet type
  const { data: allPicks, error } = await supabase
    .from('picks')
    .select('id, selection, status, units, net_units, created_at, game_snapshot')
    .eq('capper', capper.toLowerCase())
    .eq('pick_type', pickType)
    .in('status', ['won', 'lost', 'push'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[ManualPickInsight] Error fetching picks:', error)
  }

  const picks = allPicks || []
  const betTypeRecord = calcRecord(picks)
  const streak = calcStreak(picks)

  // Head-to-head matchup record
  const matchupPicks = picks.filter(p => {
    const snapshot = p.game_snapshot || {}
    const home = snapshot.home_team?.abbreviation?.toUpperCase()
    const away = snapshot.away_team?.abbreviation?.toUpperCase()
    return (
      (home === homeTeam.abbreviation && away === awayTeam.abbreviation) ||
      (home === awayTeam.abbreviation && away === homeTeam.abbreviation)
    )
  })

  const result: ManualPickInsightData = {
    capper,
    pickType: betType,
    selection,
    units,
    betTypeRecord,
    streak,
    matchupRecord: matchupPicks.length > 0 ? calcRecord(matchupPicks) : null,
    lastMatchupPick: matchupPicks.length > 0 ? toLastPick(matchupPicks[0]) : null,
    generatedAt: new Date().toISOString()
  }

  if (betType === 'SPREAD') {
    result.spread = generateSpreadStats(picks, selection, homeTeam, awayTeam)
  } else {
    result.totals = generateTotalsStats(picks, homeTeam, awayTeam)
  }

  return result
}