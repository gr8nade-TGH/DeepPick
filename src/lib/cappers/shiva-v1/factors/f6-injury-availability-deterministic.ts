/**
 * F6: Key Injuries & Availability - Totals (Deterministic)
 * 
 * Calculates injury impact on game total using deterministic formula
 * Replaces AI-powered analysis with consistent, fast calculation
 * 
 * Formula:
 * - Offensive Impact: PPG / 10 (direct scoring loss)
 * - Defensive Impact: Position-based (rim protectors, perimeter defenders)
 * - Status Adjustments: OUT=100%, DOUBTFUL=75%, QUESTIONABLE=50%, PROBABLE=25%
 * - Multiple Injuries: 2+=1.3x, 3+=1.5x multiplier
 * 
 * Signal Interpretation:
 * - Negative signal → UNDER (injuries reduce scoring)
 * - Positive signal → OVER (defensive injuries increase scoring)
 */

import type { PlayerInjuryData } from '@/lib/data-sources/types/player-injury'
import { fetchTeamPlayerStats } from '@/lib/data-sources/mysportsfeeds-players'

export interface InjuryAvailabilityInput {
  awayTeam: string
  homeTeam: string
}

export interface InjuryAvailabilityOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    awayImpact: number
    homeImpact: number
    totalImpact: number
    awayInjuries: InjuryDetail[]
    homeInjuries: InjuryDetail[]
    reasoning: string
  }
}

export interface InjuryDetail {
  playerName: string
  position: string
  ppg: number
  mpg: number
  status: string
  offensiveImpact: number
  defensiveImpact: number
  totalImpact: number
}

/**
 * Helper function to clamp a value between min and max
 */
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * Helper function to calculate hyperbolic tangent
 */
function tanh(x: number): number {
  const e2x = Math.exp(2 * x)
  return (e2x - 1) / (e2x + 1)
}

/**
 * Get status multiplier based on injury probability
 */
function getStatusMultiplier(status: string | undefined): number {
  if (!status) return 0

  const statusUpper = status.toUpperCase()

  if (statusUpper === 'OUT') return 1.0 // 100%
  if (statusUpper === 'DOUBTFUL') return 0.75 // 75%
  if (statusUpper === 'QUESTIONABLE') return 0.5 // 50%
  if (statusUpper === 'PROBABLE') return 0.25 // 25%

  return 0 // Unknown status = no impact
}

/**
 * Calculate defensive impact based on position and stats
 * Centers and power forwards have higher defensive impact (rim protection)
 */
function calculateDefensiveImpact(
  position: string,
  mpg: number,
  blocks: number,
  steals: number
): number {
  const posUpper = position.toUpperCase()

  // Base defensive value by position
  let baseDefense = 0
  if (posUpper.includes('C')) {
    baseDefense = 2.5 // Centers (rim protection)
  } else if (posUpper.includes('PF') || posUpper.includes('F')) {
    baseDefense = 1.5 // Forwards (versatile defense)
  } else if (posUpper.includes('SG') || posUpper.includes('G')) {
    baseDefense = 1.0 // Guards (perimeter defense)
  }

  // Adjust for minutes played (starters have more impact)
  const minutesFactor = Math.min(mpg / 36, 1.0) // Cap at 36 MPG

  // Adjust for defensive stats (blocks + steals)
  const defensiveStats = (blocks + steals) / 2
  const statsFactor = Math.min(defensiveStats / 1.5, 1.5) // Cap at 1.5x

  return baseDefense * minutesFactor * statsFactor
}

/**
 * Calculate injury impact for a single team
 */
function calculateTeamInjuryImpact(injuries: PlayerInjuryData[]): {
  totalImpact: number
  injuryDetails: InjuryDetail[]
} {
  const injuryDetails: InjuryDetail[] = []
  let totalOffensiveImpact = 0
  let totalDefensiveImpact = 0

  // Filter to only injured players (OUT, DOUBTFUL, QUESTIONABLE, PROBABLE)
  const injuredPlayers = injuries.filter(p => {
    const status = p.player.currentInjury?.playingProbability
    return status && ['OUT', 'DOUBTFUL', 'QUESTIONABLE', 'PROBABLE'].includes(status.toUpperCase())
  })

  for (const player of injuredPlayers) {
    const ppg = player.averages.avgPoints
    const mpg = player.averages.avgMinutes
    const blocks = player.averages.avgBlocks
    const steals = player.averages.avgSteals
    const status = player.player.currentInjury?.playingProbability || 'UNKNOWN'
    const position = player.player.primaryPosition || 'UNKNOWN'

    // Only consider players with significant minutes (15+ MPG)
    if (mpg < 15) continue

    // Calculate offensive impact (PPG-based)
    const offensiveImpact = ppg / 10

    // Calculate defensive impact (position + stats based)
    const defensiveImpact = calculateDefensiveImpact(position, mpg, blocks, steals)

    // Apply status multiplier
    const statusMultiplier = getStatusMultiplier(status)
    const adjustedOffensive = offensiveImpact * statusMultiplier
    const adjustedDefensive = defensiveImpact * statusMultiplier

    // Total impact for this player
    // Offensive injuries = negative (fewer points)
    // Defensive injuries = positive (easier to score)
    const playerTotalImpact = -adjustedOffensive + adjustedDefensive

    totalOffensiveImpact += adjustedOffensive
    totalDefensiveImpact += adjustedDefensive

    injuryDetails.push({
      playerName: player.player.firstName + ' ' + player.player.lastName,
      position,
      ppg,
      mpg,
      status,
      offensiveImpact: adjustedOffensive,
      defensiveImpact: adjustedDefensive,
      totalImpact: playerTotalImpact
    })
  }

  // Net impact: defensive injuries increase scoring, offensive injuries decrease it
  let netImpact = totalDefensiveImpact - totalOffensiveImpact

  // Apply multiple injuries multiplier
  if (injuredPlayers.length >= 3) {
    netImpact *= 1.5
  } else if (injuredPlayers.length >= 2) {
    netImpact *= 1.3
  }

  return {
    totalImpact: netImpact,
    injuryDetails
  }
}

/**
 * Calculate injury availability factor points
 */
export async function calculateInjuryAvailabilityPoints(
  input: InjuryAvailabilityInput
): Promise<InjuryAvailabilityOutput> {
  const { awayTeam, homeTeam } = input
  const MAX_POINTS = 5.0
  const SCALE = 8.0 // Scaling factor for tanh

  try {
    // Fetch injury data for both teams
    const [awayPlayers, homePlayers] = await Promise.all([
      fetchTeamPlayerStats(awayTeam),
      fetchTeamPlayerStats(homeTeam)
    ])

    // Calculate impact for each team
    const awayResult = calculateTeamInjuryImpact(awayPlayers)
    const homeResult = calculateTeamInjuryImpact(homePlayers)

    // Total impact (positive = more scoring, negative = less scoring)
    const totalImpact = awayResult.totalImpact + homeResult.totalImpact

    // Calculate signal using tanh for smooth saturation
    const rawSignal = tanh(totalImpact / SCALE)
    const signal = clamp(rawSignal, -1, 1)

    // Convert to scores
    let overScore = 0
    let underScore = 0

    if (signal > 0) {
      // Positive signal → OVER (defensive injuries increase scoring)
      overScore = Math.abs(signal) * MAX_POINTS
    } else if (signal < 0) {
      // Negative signal → UNDER (offensive injuries decrease scoring)
      underScore = Math.abs(signal) * MAX_POINTS
    }

    // Build reasoning
    const awayInjuryCount = awayResult.injuryDetails.length
    const homeInjuryCount = homeResult.injuryDetails.length
    const totalInjuryCount = awayInjuryCount + homeInjuryCount

    let reasoning = ''
    if (totalInjuryCount === 0) {
      reasoning = 'No significant injuries for either team'
    } else {
      const parts: string[] = []
      if (awayInjuryCount > 0) {
        parts.push(`${awayTeam}: ${awayInjuryCount} injured (${awayResult.totalImpact > 0 ? '+' : ''}${awayResult.totalImpact.toFixed(1)} pts)`)
      }
      if (homeInjuryCount > 0) {
        parts.push(`${homeTeam}: ${homeInjuryCount} injured (${homeResult.totalImpact > 0 ? '+' : ''}${homeResult.totalImpact.toFixed(1)} pts)`)
      }
      reasoning = parts.join(', ')
    }

    return {
      overScore,
      underScore,
      signal,
      meta: {
        awayImpact: awayResult.totalImpact,
        homeImpact: homeResult.totalImpact,
        totalImpact,
        awayInjuries: awayResult.injuryDetails,
        homeInjuries: homeResult.injuryDetails,
        reasoning
      }
    }

  } catch (error) {
    console.error('[F6 Injury Availability] Error:', error)

    // Return neutral on error
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        awayImpact: 0,
        homeImpact: 0,
        totalImpact: 0,
        awayInjuries: [],
        homeInjuries: [],
        reasoning: `Error fetching injury data: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

/**
 * Legacy wrapper function for compatibility with orchestrator
 */
export async function computeInjuryAvailability(bundle: any, ctx: any): Promise<any> {
  // Handle case where bundle is null (factor disabled)
  if (!bundle || !ctx) {
    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Totals',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        overScore: 0,
        underScore: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Factor disabled - no data bundle'
    }
  }

  // Extract team names from context
  const awayTeam = ctx.away
  const homeTeam = ctx.home

  if (!awayTeam || !homeTeam) {
    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Totals',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        overScore: 0,
        underScore: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Missing team names in context'
    }
  }

  // Calculate injury impact
  const result = await calculateInjuryAvailabilityPoints({ awayTeam, homeTeam })

  // Build notes string
  const notes = result.meta.reasoning

  return {
    factor_no: 6,
    key: 'injuryAvailability',
    name: 'Key Injuries & Availability - Totals',
    normalized_value: result.signal,
    raw_values_json: {
      awayImpact: result.meta.awayImpact,
      homeImpact: result.meta.homeImpact,
      totalImpact: result.meta.totalImpact,
      awayInjuries: result.meta.awayInjuries,
      homeInjuries: result.meta.homeInjuries
    },
    parsed_values_json: {
      overScore: result.overScore,
      underScore: result.underScore,
      signal: result.signal,
      awayImpact: result.meta.awayImpact,
      homeImpact: result.meta.homeImpact,
      totalImpact: result.meta.totalImpact
    },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

