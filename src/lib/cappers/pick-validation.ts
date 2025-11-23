/**
 * Pick Validation Utilities
 *
 * Critical validation logic to prevent bad picks from being generated:
 * 1. Spread Line Validation - Ensure favorite/dog direction matches consensus
 * 2. Market Disagreement Detection - Flag large discrepancies
 *
 * NOTE: Injury impact is handled by the S6 factor (Key Injuries & Availability),
 * not by blocking picks entirely. The S6 factor adds/subtracts confidence points
 * based on injury impact differential between teams.
 */

export interface SpreadValidationResult {
  isValid: boolean
  reason?: string
  marketSpread: number
  predictedMargin: number
  favoriteTeam: string
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

