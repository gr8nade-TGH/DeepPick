/**
 * S6: Key Injuries & Availability - Spread (Deterministic)
 * 
 * Calculates injury impact on spread outcome using deterministic formula
 * Different logic from TOTALS - focuses on competitive balance shift
 * 
 * Formula:
 * - Player Impact: (PPG / 10) + (MPG / 48) × 2
 * - Status Adjustments: OUT=100%, DOUBTFUL=75%, QUESTIONABLE=50%, PROBABLE=25%
 * - Multiple Injuries: 2+=1.3x, 3+=1.5x multiplier
 * - Net Differential: Away Impact - Home Impact
 * 
 * Signal Interpretation:
 * - Positive signal → AWAY ATS advantage (home has more injuries)
 * - Negative signal → HOME ATS advantage (away has more injuries)
 */

import type { PlayerInjuryData } from '@/lib/data-sources/types/player-injury'
import { fetchTeamPlayerStats } from '@/lib/data-sources/mysportsfeeds-players'

export interface InjuryAvailabilitySpreadInput {
  awayTeam: string
  homeTeam: string
}

export interface InjuryAvailabilitySpreadOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayImpact: number
    homeImpact: number
    netDifferential: number
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
  impact: number
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
 * Calculate injury impact for a single team (SPREAD version)
 * 
 * Formula: (PPG / 10) + (MPG / 48) × 2
 * 
 * Examples:
 * - 30 PPG, 36 MPG: (30/10) + (36/48)×2 = 3.0 + 1.5 = 4.5 points
 * - 20 PPG, 32 MPG: (20/10) + (32/48)×2 = 2.0 + 1.33 = 3.33 points
 * - 15 PPG, 28 MPG: (15/10) + (28/48)×2 = 1.5 + 1.17 = 2.67 points
 * - 10 PPG, 20 MPG: (10/10) + (20/48)×2 = 1.0 + 0.83 = 1.83 points
 */
function calculateTeamInjuryImpact(injuries: PlayerInjuryData[]): {
  totalImpact: number
  injuryDetails: InjuryDetail[]
} {
  const injuryDetails: InjuryDetail[] = []
  let totalImpact = 0

  // Filter to only injured players (OUT, DOUBTFUL, QUESTIONABLE, PROBABLE)
  const injuredPlayers = injuries.filter(p => {
    const status = p.player.currentInjury?.playingProbability
    return status && ['OUT', 'DOUBTFUL', 'QUESTIONABLE', 'PROBABLE'].includes(status.toUpperCase())
  })

  for (const player of injuredPlayers) {
    const ppg = player.averages.avgPoints
    const mpg = player.averages.avgMinutes
    const status = player.player.currentInjury?.playingProbability || 'UNKNOWN'
    const position = player.player.primaryPosition || 'UNKNOWN'

    // Only consider players with significant minutes (15+ MPG)
    if (mpg < 15) continue

    // Calculate base impact: (PPG / 10) + (MPG / 48) × 2
    const baseImpact = (ppg / 10) + (mpg / 48) * 2

    // Apply status multiplier
    const statusMultiplier = getStatusMultiplier(status)
    const adjustedImpact = baseImpact * statusMultiplier

    totalImpact += adjustedImpact

    injuryDetails.push({
      playerName: player.player.firstName + ' ' + player.player.lastName,
      position,
      ppg,
      mpg,
      status,
      impact: adjustedImpact
    })
  }

  // Apply multiple injuries multiplier
  if (injuredPlayers.length >= 3) {
    totalImpact *= 1.5
  } else if (injuredPlayers.length >= 2) {
    totalImpact *= 1.3
  }

  return {
    totalImpact,
    injuryDetails
  }
}

/**
 * Calculate injury availability factor points for SPREAD
 */
export async function calculateInjuryAvailabilitySpreadPoints(
  input: InjuryAvailabilitySpreadInput
): Promise<InjuryAvailabilitySpreadOutput> {
  const { awayTeam, homeTeam } = input
  const MAX_POINTS = 5.0
  const SCALE = 5.0 // Scaling factor for tanh (5 points = strong signal)

  try {
    // Fetch injury data for both teams
    const [awayPlayers, homePlayers] = await Promise.all([
      fetchTeamPlayerStats(awayTeam),
      fetchTeamPlayerStats(homeTeam)
    ])

    // Calculate impact for each team
    const awayResult = calculateTeamInjuryImpact(awayPlayers)
    const homeResult = calculateTeamInjuryImpact(homePlayers)

    // Net differential (positive = away has more injuries, home gets ATS edge)
    const netDifferential = awayResult.totalImpact - homeResult.totalImpact

    // Calculate signal using tanh for smooth saturation
    // Negative because more injuries = disadvantage
    const rawSignal = -tanh(netDifferential / SCALE)
    const signal = clamp(rawSignal, -1, 1)

    // Convert to scores
    let awayScore = 0
    let homeScore = 0

    if (signal > 0) {
      // Positive signal → AWAY ATS advantage (home has more injuries)
      awayScore = Math.abs(signal) * MAX_POINTS
    } else if (signal < 0) {
      // Negative signal → HOME ATS advantage (away has more injuries)
      homeScore = Math.abs(signal) * MAX_POINTS
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
        const topInjury = awayResult.injuryDetails[0]
        parts.push(`${awayTeam}: ${topInjury.playerName} ${topInjury.status} (${topInjury.ppg.toFixed(1)} PPG)`)
      }
      if (homeInjuryCount > 0) {
        const topInjury = homeResult.injuryDetails[0]
        parts.push(`${homeTeam}: ${topInjury.playerName} ${topInjury.status} (${topInjury.ppg.toFixed(1)} PPG)`)
      }

      // Add net differential summary
      if (Math.abs(netDifferential) > 2) {
        const advantageTeam = netDifferential > 0 ? homeTeam : awayTeam
        parts.push(`${advantageTeam} gets ATS edge (${Math.abs(netDifferential).toFixed(1)} pt diff)`)
      }

      reasoning = parts.join(', ')
    }

    return {
      awayScore,
      homeScore,
      signal,
      meta: {
        awayImpact: awayResult.totalImpact,
        homeImpact: homeResult.totalImpact,
        netDifferential,
        awayInjuries: awayResult.injuryDetails,
        homeInjuries: homeResult.injuryDetails,
        reasoning
      }
    }

  } catch (error) {
    console.error('[S6 Injury Availability Spread] Error:', error)

    // Return neutral on error
    return {
      awayScore: 0,
      homeScore: 0,
      signal: 0,
      meta: {
        awayImpact: 0,
        homeImpact: 0,
        netDifferential: 0,
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
export async function computeInjuryAvailabilitySpread(bundle: any, ctx: any): Promise<any> {
  // Handle case where bundle is null (factor disabled)
  if (!bundle || !ctx) {
    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Spread',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        awayScore: 0,
        homeScore: 0
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
      name: 'Key Injuries & Availability - Spread',
      normalized_value: 0,
      raw_values_json: {},
      parsed_values_json: {
        awayScore: 0,
        homeScore: 0
      },
      caps_applied: false,
      cap_reason: null,
      notes: 'Missing team names in context'
    }
  }

  // Calculate injury impact
  const result = await calculateInjuryAvailabilitySpreadPoints({ awayTeam, homeTeam })

  // Build notes string
  const notes = result.meta.reasoning

  return {
    factor_no: 6,
    key: 'injuryAvailability',
    name: 'Key Injuries & Availability - Spread',
    normalized_value: result.signal,
    raw_values_json: {
      awayImpact: result.meta.awayImpact,
      homeImpact: result.meta.homeImpact,
      netDifferential: result.meta.netDifferential,
      awayInjuries: result.meta.awayInjuries,
      homeInjuries: result.meta.homeInjuries
    },
    parsed_values_json: {
      awayScore: result.awayScore,
      homeScore: result.homeScore,
      signal: result.signal,
      awayImpact: result.meta.awayImpact,
      homeImpact: result.meta.homeImpact,
      netDifferential: result.meta.netDifferential
    },
    caps_applied: false,
    cap_reason: null,
    notes
  }
}

