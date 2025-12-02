/**
 * COMPREHENSIVE TIER GRADING SYSTEM
 * Shared utility for calculating pick tiers based on multiple factors.
 * This file is used by both server routes and client components.
 *
 * 5 Tiers (Legendary = Top):
 * 🏆 Legendary (≥85, requires 4+ units)
 * 💎 Epic (≥75, requires 3+ units)
 * 💠 Rare (≥65, requires 2+ units)
 * ✦ Uncommon (≥55)
 * ◆ Common (<55)
 */

export type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'

export interface TierGradeInput {
  baseConfidence: number        // Sharp Score (0-10 or 0-100)
  unitsRisked: number           // Units bet on this pick
  edgeVsMarket?: number         // |predicted - market| as percentage or points
  teamRecord?: { wins: number; losses: number; netUnits: number }
  recentForm?: { wins: number; losses: number; netUnits: number } // Last 10 picks
  currentLosingStreak?: number  // Consecutive losses (0 if none)
}

export interface TierBreakdown {
  sharpScore: number            // Base confidence (0-100)
  edgeBonus: number             // Edge vs market bonus (+0 to +15)
  teamRecordBonus: number       // Team-specific record (-10 to +10)
  recentFormBonus: number       // Last 10 picks (-5 to +5)
  losingStreakPenalty: number   // Consecutive losses (0 to -10)
  rawScore: number              // Sum before unit gates
  unitGateApplied: boolean      // Was tier demoted due to insufficient units?
  originalTier?: RarityTier     // Tier before unit gate (if demoted)
  insufficientHistory: boolean  // Missing team record or recent form data
  missingTeamRecord: boolean    // No team-specific pick history
  missingRecentForm: boolean    // No recent form data (less than 5 picks)
}

export interface TierGradeResult {
  tier: RarityTier
  tierScore: number
  breakdown: TierBreakdown
}

/**
 * Calculate tier grade based on comprehensive inputs.
 *
 * Formula (0-100 scale):
 * - Sharp Score: Base confidence normalized to 0-100
 * - Edge vs Market: +0 to +15 (bigger edge = more bonus)
 * - Team Record: -10 to +10 (W-L and net units on this team)
 * - Recent Form: -5 to +5 (last 10 picks performance)
 * - Losing Streak: 0 to -10 (consecutive losses penalty)
 *
 * Unit Gates (applied after score calculation):
 * - Legendary requires 4+ units (else → Epic)
 * - Epic requires 3+ units (else → Rare)
 * - Rare requires 2+ units (else → Uncommon)
 */
export function calculateTierGrade(input: TierGradeInput): TierGradeResult {
  // Normalize baseConfidence to 0-100 scale if it's on 0-10 scale
  const sharpScore = input.baseConfidence <= 10 ? input.baseConfidence * 10 : input.baseConfidence

  // ===== EDGE VS MARKET BONUS (max +15 points) =====
  // Edge is typically 0-5+ points difference from market
  let edgeBonus = 0
  if (input.edgeVsMarket !== undefined) {
    const absEdge = Math.abs(input.edgeVsMarket)
    if (absEdge >= 5) {
      edgeBonus = 15
    } else if (absEdge >= 4) {
      edgeBonus = 12
    } else if (absEdge >= 3) {
      edgeBonus = 9
    } else if (absEdge >= 2) {
      edgeBonus = 6
    } else if (absEdge >= 1) {
      edgeBonus = 3
    }
  }

  // ===== TEAM RECORD BONUS (max +10 points, min -10) =====
  let teamRecordBonus = 0
  if (input.teamRecord && (input.teamRecord.wins + input.teamRecord.losses) >= 3) {
    const winRate = input.teamRecord.wins / (input.teamRecord.wins + input.teamRecord.losses)
    const netUnits = input.teamRecord.netUnits

    // Combine win rate and net units
    if (winRate >= 0.65 && netUnits > 5) {
      teamRecordBonus = 10
    } else if (winRate >= 0.60 && netUnits > 3) {
      teamRecordBonus = 7
    } else if (winRate >= 0.55 && netUnits > 0) {
      teamRecordBonus = 4
    } else if (winRate >= 0.50 && netUnits >= 0) {
      teamRecordBonus = 1
    } else if (winRate < 0.45 || netUnits < -5) {
      teamRecordBonus = -10
    } else if (winRate < 0.50 || netUnits < 0) {
      teamRecordBonus = -5
    }
  }

  // ===== RECENT FORM BONUS (max +5 points, min -5) =====
  let recentFormBonus = 0
  if (input.recentForm && (input.recentForm.wins + input.recentForm.losses) >= 5) {
    const winRate = input.recentForm.wins / (input.recentForm.wins + input.recentForm.losses)
    const netUnits = input.recentForm.netUnits

    if (winRate >= 0.70 && netUnits > 3) {
      recentFormBonus = 5
    } else if (winRate >= 0.60 && netUnits > 1) {
      recentFormBonus = 3
    } else if (winRate >= 0.55 && netUnits > 0) {
      recentFormBonus = 1
    } else if (winRate < 0.40 || netUnits < -3) {
      recentFormBonus = -5
    } else if (winRate < 0.50 || netUnits < 0) {
      recentFormBonus = -2
    }
  }

  // ===== LOSING STREAK PENALTY (max -10 points) =====
  let losingStreakPenalty = 0
  if (input.currentLosingStreak !== undefined && input.currentLosingStreak >= 3) {
    if (input.currentLosingStreak >= 6) {
      losingStreakPenalty = -10
    } else if (input.currentLosingStreak >= 5) {
      losingStreakPenalty = -7
    } else if (input.currentLosingStreak >= 4) {
      losingStreakPenalty = -5
    } else if (input.currentLosingStreak >= 3) {
      losingStreakPenalty = -3
    }
  }

  // Calculate raw score
  const rawScore = sharpScore + edgeBonus + teamRecordBonus + recentFormBonus + losingStreakPenalty

  // Check for insufficient history (missing team record OR recent form)
  const missingTeamRecord = !input.teamRecord
  const missingRecentForm = !input.recentForm
  const insufficientHistory = missingTeamRecord || missingRecentForm

  // Determine tier from raw score
  let tier: RarityTier
  if (rawScore >= 85) {
    tier = 'Legendary'
  } else if (rawScore >= 75) {
    tier = 'Epic'
  } else if (rawScore >= 65) {
    tier = 'Rare'
  } else if (rawScore >= 55) {
    tier = 'Uncommon'
  } else {
    tier = 'Common'
  }

  // Store original tier before gates
  const originalTier = tier
  let unitGateApplied = false

  // ===== INSUFFICIENT HISTORY GATE =====
  // If missing team record or recent form, auto-grade as Common
  if (insufficientHistory && tier !== 'Common') {
    tier = 'Common'
  }

  // ===== UNIT GATES ===== (only apply if not already demoted to Common)
  if (!insufficientHistory) {
    // Legendary requires 4+ units, else demote to Epic
    if (tier === 'Legendary' && input.unitsRisked < 4) {
      tier = 'Epic'
      unitGateApplied = true
    }
    // Epic requires 3+ units, else demote to Rare
    if (tier === 'Epic' && input.unitsRisked < 3) {
      tier = 'Rare'
      unitGateApplied = true
    }
    // Rare requires 2+ units, else demote to Uncommon
    if (tier === 'Rare' && input.unitsRisked < 2) {
      tier = 'Uncommon'
      unitGateApplied = true
    }
  }

  const breakdown: TierBreakdown = {
    sharpScore,
    edgeBonus,
    teamRecordBonus,
    recentFormBonus,
    losingStreakPenalty,
    rawScore,
    unitGateApplied,
    originalTier: (unitGateApplied || insufficientHistory) ? originalTier : undefined,
    insufficientHistory,
    missingTeamRecord,
    missingRecentForm
  }

  return { tier, tierScore: rawScore, breakdown }
}

/**
 * Simple fallback: get rarity tier from confidence only (for legacy picks)
 *
 * IMPORTANT: Confidence can be on 0-10 scale (SHIVA system) or 0-100 scale (legacy)
 * We detect which scale and normalize accordingly.
 *
 * 5 Tiers (0-100 scale thresholds):
 * - Legendary: ≥85 (8.5 on 0-10)
 * - Epic: ≥75 (7.5 on 0-10)
 * - Rare: ≥65 (6.5 on 0-10)
 * - Uncommon: ≥55 (5.5 on 0-10)
 * - Common: <55
 */
export function getRarityTierFromConfidence(confidence: number): RarityTier {
  // Normalize to 0-100 scale if value appears to be on 0-10 scale
  const normalizedConf = confidence <= 10 ? confidence * 10 : confidence

  if (normalizedConf >= 85) return 'Legendary'
  if (normalizedConf >= 75) return 'Epic'
  if (normalizedConf >= 65) return 'Rare'
  if (normalizedConf >= 55) return 'Uncommon'
  return 'Common'
}

/**
 * Rarity style interface for visual styling
 */
export interface RarityStyle {
  tier: RarityTier
  borderColor: string
  bgGradient: string
  glowColor: string
  textColor: string
  badgeBg: string
  icon: string
}

/**
 * Get full rarity styling from confidence (for backwards compatibility)
 * Returns full style object with colors, gradients, etc.
 */
export function getRarityFromConfidence(confidence: number): RarityStyle {
  const tier = getRarityTierFromConfidence(confidence)
  return getRarityStyleFromTier(tier)
}

/**
 * Get visual styling for a tier
 */
export function getRarityStyleFromTier(tier: RarityTier): RarityStyle {
  switch (tier) {
    case 'Legendary':
      return {
        tier: 'Legendary',
        borderColor: '#FFD700',
        bgGradient: 'from-amber-950 via-yellow-950/50 to-amber-950',
        glowColor: 'rgba(255, 215, 0, 0.5)',
        textColor: 'text-amber-300',
        badgeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
        icon: '🏆'
      }
    case 'Epic':
      return {
        tier: 'Epic',
        borderColor: '#A855F7',
        bgGradient: 'from-purple-950 via-violet-950/50 to-purple-950',
        glowColor: 'rgba(168, 85, 247, 0.4)',
        textColor: 'text-purple-300',
        badgeBg: 'bg-gradient-to-r from-purple-500 to-violet-500',
        icon: '💎'
      }
    case 'Rare':
      return {
        tier: 'Rare',
        borderColor: '#3B82F6',
        bgGradient: 'from-blue-950 via-indigo-950/50 to-blue-950',
        glowColor: 'rgba(59, 130, 246, 0.35)',
        textColor: 'text-blue-300',
        badgeBg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
        icon: '💠'
      }
    case 'Uncommon':
      return {
        tier: 'Uncommon',
        borderColor: '#22C55E',
        bgGradient: 'from-green-950 via-emerald-950/50 to-green-950',
        glowColor: 'rgba(34, 197, 94, 0.3)',
        textColor: 'text-green-300',
        badgeBg: 'bg-gradient-to-r from-green-500 to-emerald-500',
        icon: '✦'
      }
    default:
      return {
        tier: 'Common',
        borderColor: '#6B7280',
        bgGradient: 'from-slate-900 via-gray-900/50 to-slate-900',
        glowColor: 'rgba(107, 114, 128, 0.2)',
        textColor: 'text-slate-300',
        badgeBg: 'bg-gradient-to-r from-slate-500 to-gray-500',
        icon: '◆'
      }
  }
}

/**
 * Format tier breakdown for tooltip display
 */
export function formatTierBreakdown(breakdown: TierBreakdown, units: number, betType?: string): string {
  const lines: string[] = []
  const betTypeLabel = betType ? betType.toUpperCase() : 'pick'

  lines.push(`📊 Sharp Score: ${breakdown.sharpScore.toFixed(1)}`)

  if (breakdown.edgeBonus !== 0) {
    lines.push(`📈 Edge vs Market: ${breakdown.edgeBonus > 0 ? '+' : ''}${breakdown.edgeBonus}`)
  }

  // Show team record status
  if (breakdown.missingTeamRecord) {
    lines.push(`🎯 Team Record: ⚠️ No ${betTypeLabel} history`)
  } else if (breakdown.teamRecordBonus !== 0) {
    lines.push(`🎯 Team Record: ${breakdown.teamRecordBonus > 0 ? '+' : ''}${breakdown.teamRecordBonus}`)
  } else {
    lines.push(`🎯 Team Record: +0 (neutral)`)
  }

  // Show recent form status
  if (breakdown.missingRecentForm) {
    lines.push(`🔥 Recent Form: ⚠️ <5 ${betTypeLabel} picks`)
  } else if (breakdown.recentFormBonus !== 0) {
    lines.push(`🔥 Recent Form: ${breakdown.recentFormBonus > 0 ? '+' : ''}${breakdown.recentFormBonus}`)
  } else {
    lines.push(`🔥 Recent Form: +0 (neutral)`)
  }

  if (breakdown.losingStreakPenalty !== 0) {
    lines.push(`⚠️ Losing Streak: ${breakdown.losingStreakPenalty}`)
  }

  lines.push(`───────────────`)
  lines.push(`Total Score: ${breakdown.rawScore.toFixed(1)}`)

  // Show insufficient history demotion
  if (breakdown.insufficientHistory && breakdown.originalTier && breakdown.originalTier !== 'Common') {
    lines.push(``)
    lines.push(`📉 Demoted to Common`)
    const missing: string[] = []
    if (breakdown.missingTeamRecord) missing.push('team record')
    if (breakdown.missingRecentForm) missing.push('recent form')
    lines.push(`   (missing ${missing.join(' & ')})`)
    lines.push(`   Build ${betTypeLabel} history to unlock higher tiers!`)
  } else if (breakdown.unitGateApplied && breakdown.originalTier) {
    lines.push(``)
    lines.push(`⛔ Demoted from ${breakdown.originalTier}`)
    lines.push(`   (needed ${getUnitRequirement(breakdown.originalTier)}+ units, had ${units})`)
  }

  return lines.join('\n')
}

/**
 * Get unit requirement for a tier
 */
export function getUnitRequirement(tier: RarityTier): number {
  switch (tier) {
    case 'Legendary': return 4
    case 'Epic': return 3
    case 'Rare': return 2
    default: return 0
  }
}

