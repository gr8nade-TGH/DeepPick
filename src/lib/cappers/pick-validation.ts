/**
 * Pick Validation Utilities
 * 
 * Critical validation logic to prevent bad picks from being generated:
 * 1. Injury Gating - Block picks when star players are OUT
 * 2. Spread Line Validation - Ensure favorite/dog direction matches consensus
 * 3. Market Disagreement Detection - Flag large discrepancies
 */

import type { PlayerInjuryData } from '@/lib/data-sources/types/player-injury'

export interface InjuryGateResult {
  shouldBlock: boolean
  reason?: string
  starPlayerOut?: {
    name: string
    team: string
    ppg: number
    mpg: number
  }
}

export interface SpreadValidationResult {
  isValid: boolean
  reason?: string
  marketSpread: number
  predictedMargin: number
  favoriteTeam: string
}

/**
 * Check if a pick should be blocked due to star player injuries
 * 
 * Blocks picks when:
 * - Any player with >20 PPG is OUT
 * - Any player with >30 MPG is OUT
 * - Multiple key players (>15 PPG) are OUT
 * 
 * @param awayInjuries - Away team injury data
 * @param homeInjuries - Home team injury data
 * @param awayTeam - Away team name
 * @param homeTeam - Home team name
 * @returns InjuryGateResult with shouldBlock flag and reason
 */
export function checkInjuryGate(
  awayInjuries: PlayerInjuryData[],
  homeInjuries: PlayerInjuryData[],
  awayTeam: string,
  homeTeam: string
): InjuryGateResult {
  // Check away team for star players OUT
  for (const player of awayInjuries) {
    const status = player.player.currentInjury?.playingProbability?.toUpperCase()
    if (status !== 'OUT') continue

    const ppg = player.averages.avgPoints
    const mpg = player.averages.avgMinutes
    const name = `${player.player.firstName} ${player.player.lastName}`

    // Block if star player (>20 PPG or >30 MPG) is OUT
    if (ppg > 20 || mpg > 30) {
      return {
        shouldBlock: true,
        reason: `Star player ${name} (${ppg.toFixed(1)} PPG, ${mpg.toFixed(1)} MPG) is OUT for ${awayTeam}`,
        starPlayerOut: {
          name,
          team: awayTeam,
          ppg,
          mpg
        }
      }
    }
  }

  // Check home team for star players OUT
  for (const player of homeInjuries) {
    const status = player.player.currentInjury?.playingProbability?.toUpperCase()
    if (status !== 'OUT') continue

    const ppg = player.averages.avgPoints
    const mpg = player.averages.avgMinutes
    const name = `${player.player.firstName} ${player.player.lastName}`

    // Block if star player (>20 PPG or >30 MPG) is OUT
    if (ppg > 20 || mpg > 30) {
      return {
        shouldBlock: true,
        reason: `Star player ${name} (${ppg.toFixed(1)} PPG, ${mpg.toFixed(1)} MPG) is OUT for ${homeTeam}`,
        starPlayerOut: {
          name,
          team: homeTeam,
          ppg,
          mpg
        }
      }
    }
  }

  // Check for multiple key players OUT (>15 PPG)
  const awayKeyPlayersOut = awayInjuries.filter(p => {
    const status = p.player.currentInjury?.playingProbability?.toUpperCase()
    return status === 'OUT' && p.averages.avgPoints > 15
  })

  const homeKeyPlayersOut = homeInjuries.filter(p => {
    const status = p.player.currentInjury?.playingProbability?.toUpperCase()
    return status === 'OUT' && p.averages.avgPoints > 15
  })

  if (awayKeyPlayersOut.length >= 2) {
    const names = awayKeyPlayersOut.map(p => `${p.player.firstName} ${p.player.lastName}`).join(', ')
    return {
      shouldBlock: true,
      reason: `Multiple key players OUT for ${awayTeam}: ${names}`
    }
  }

  if (homeKeyPlayersOut.length >= 2) {
    const names = homeKeyPlayersOut.map(p => `${p.player.firstName} ${p.player.lastName}`).join(', ')
    return {
      shouldBlock: true,
      reason: `Multiple key players OUT for ${homeTeam}: ${names}`
    }
  }

  // No blocking conditions met
  return {
    shouldBlock: false
  }
}

/**
 * Validate spread line direction matches predicted margin
 * 
 * Ensures that:
 * - If we predict away team wins, we're betting on away team
 * - If we predict home team wins, we're betting on home team
 * - Predicted margin direction matches pick selection
 * 
 * @param predictedMargin - Predicted point margin (positive = away wins, negative = home wins)
 * @param marketSpread - Market spread line (from home perspective)
 * @param selection - Pick selection string (e.g., "Lakers -4.5")
 * @param awayTeam - Away team name
 * @param homeTeam - Home team name
 * @returns SpreadValidationResult with isValid flag
 */
export function validateSpreadDirection(
  predictedMargin: number,
  marketSpread: number,
  selection: string,
  awayTeam: string,
  homeTeam: string
): SpreadValidationResult {
  // Determine which team we're picking based on selection string
  const pickingAway = selection.includes(awayTeam)
  const pickingHome = selection.includes(homeTeam)

  if (!pickingAway && !pickingHome) {
    return {
      isValid: false,
      reason: `Selection "${selection}" does not clearly indicate away (${awayTeam}) or home (${homeTeam}) team`,
      marketSpread,
      predictedMargin,
      favoriteTeam: 'UNKNOWN'
    }
  }

  // Determine favorite from market spread
  // Negative spread = home favored, positive spread = away favored
  const marketFavoriteTeam = marketSpread < 0 ? homeTeam : awayTeam

  // Determine favorite from our prediction
  // Negative margin = home wins, positive margin = away wins
  const predictedWinner = predictedMargin > 0 ? awayTeam : homeTeam

  // Validation: Our predicted winner should match the team we're picking
  if (pickingAway && predictedMargin < 0) {
    return {
      isValid: false,
      reason: `Predicted margin ${predictedMargin.toFixed(1)} favors ${homeTeam}, but selection is ${awayTeam}`,
      marketSpread,
      predictedMargin,
      favoriteTeam: marketFavoriteTeam
    }
  }

  if (pickingHome && predictedMargin > 0) {
    return {
      isValid: false,
      reason: `Predicted margin ${predictedMargin.toFixed(1)} favors ${awayTeam}, but selection is ${homeTeam}`,
      marketSpread,
      predictedMargin,
      favoriteTeam: marketFavoriteTeam
    }
  }

  // All validations passed
  return {
    isValid: true,
    marketSpread,
    predictedMargin,
    favoriteTeam: marketFavoriteTeam
  }
}

