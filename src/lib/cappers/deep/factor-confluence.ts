/**
 * DEEP Factor Confluence Analysis
 * 
 * The HEART of DEEP - analyzes which FACTORS agree across cappers.
 * This is what makes "Deep Pick" truly DEEP.
 * 
 * Key insight: If 3 cappers agree on OVER, but they all identify
 * "Pace Differential" as the key driver, that's a MUCH stronger signal
 * than if each capper has a different top factor.
 */

import type {
  CapperPick,
  FactorConfluence,
  CounterThesisAnalysis,
  FactorContribution
} from './types'

/**
 * Analyze factor confluence across agreeing cappers
 * Returns which factors are shared as top drivers
 */
export function analyzeFactorConfluence(
  agreeingPicks: CapperPick[]
): FactorConfluence[] {
  const factorMentions = new Map<string, {
    name: string
    cappers: string[]
    contributions: number[]
  }>()

  // Collect all factor mentions from agreeing cappers
  for (const pick of agreeingPicks) {
    if (!pick.topFactors?.length) continue

    for (const factor of pick.topFactors) {
      if (!factorMentions.has(factor.key)) {
        factorMentions.set(factor.key, {
          name: factor.name,
          cappers: [],
          contributions: []
        })
      }

      const entry = factorMentions.get(factor.key)!
      entry.cappers.push(pick.capperName)
      entry.contributions.push(factor.normalizedValue)
    }
  }

  // Convert to FactorConfluence array and calculate alignment scores
  const confluence: FactorConfluence[] = []
  const totalCappers = agreeingPicks.length

  for (const [key, data] of factorMentions) {
    const avgContribution = data.contributions.length > 0
      ? data.contributions.reduce((a, b) => a + b, 0) / data.contributions.length
      : 0

    // Alignment score: What % of cappers share this as a top factor?
    // Also consider if contributions are in the same direction
    const sameDirection = data.contributions.every(c => c >= 0) || 
                          data.contributions.every(c => c <= 0)
    const mentionRatio = data.cappers.length / totalCappers
    const alignmentScore = sameDirection ? mentionRatio : mentionRatio * 0.5

    confluence.push({
      factorKey: key,
      factorName: data.name,
      agreeingCappers: data.cappers,
      totalMentions: data.cappers.length,
      avgContribution: Math.round(avgContribution * 100) / 100,
      alignmentScore: Math.round(alignmentScore * 100) / 100
    })
  }

  // Sort by alignment score (most aligned first)
  return confluence.sort((a, b) => {
    if (b.alignmentScore !== a.alignmentScore) {
      return b.alignmentScore - a.alignmentScore
    }
    return b.totalMentions - a.totalMentions
  })
}

/**
 * Calculate factor alignment points for tier grading
 * Based on how aligned the TOP FACTORS are among agreeing cappers
 * 
 * Max points: 3
 */
export function calculateFactorAlignmentPoints(
  confluence: FactorConfluence[],
  totalCappers: number
): number {
  if (confluence.length === 0 || totalCappers < 2) return 0

  // Get top factor confluence
  const topFactor = confluence[0]
  if (!topFactor) return 0

  // If ALL cappers share the same top factor → 3 points
  if (topFactor.totalMentions === totalCappers && topFactor.alignmentScore >= 0.9) {
    return 3.0
  }

  // If most (≥75%) cappers share top factor → 2 points
  if (topFactor.alignmentScore >= 0.75) {
    return 2.0
  }

  // If majority (≥50%) share top factor → 1.5 points
  if (topFactor.alignmentScore >= 0.5) {
    return 1.5
  }

  // Some alignment exists → 1 point
  if (topFactor.totalMentions >= 2) {
    return 1.0
  }

  // No meaningful alignment → 0.5 points (at least they agree on direction)
  return 0.5
}

/**
 * Analyze the counter-thesis from disagreeing cappers
 * Understanding WHY they disagree helps assess risk
 */
export function analyzeCounterThesis(
  disagreeingPicks: CapperPick[]
): CounterThesisAnalysis | null {
  if (disagreeingPicks.length === 0) return null

  // Get the strongest disagreeing pick (highest tier)
  const sortedByTier = [...disagreeingPicks].sort((a, b) => 
    (b.tierScore || 0) - (a.tierScore || 0)
  )
  const strongestDissenter = sortedByTier[0]

  // Get their top factor
  const topFactor = strongestDissenter.topFactors?.[0] || null

  // Determine counter strength
  let counterStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK'
  let reason = ''

  if (strongestDissenter.tierScore && strongestDissenter.tierScore >= 7) {
    counterStrength = 'STRONG'
    reason = `${strongestDissenter.tier} tier pick with high confidence`
  } else if (strongestDissenter.tierScore && strongestDissenter.tierScore >= 5) {
    counterStrength = 'MODERATE'
    reason = `${strongestDissenter.tier} tier pick with moderate confidence`
  } else {
    counterStrength = 'WEAK'
    reason = `${strongestDissenter.tier || 'Common'} tier pick - lower confidence`
  }

  // Add factor context if available
  if (topFactor) {
    reason += ` (driven by ${topFactor.name})`
  }

  return {
    disagreeingCapper: strongestDissenter.capperName,
    tier: strongestDissenter.tier || 'Common',
    tierScore: strongestDissenter.tierScore || 0,
    topFactor,
    counterStrength,
    reason
  }
}

