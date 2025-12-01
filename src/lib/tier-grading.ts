/**
 * COMPREHENSIVE TIER GRADING SYSTEM
 * Shared utility for calculating pick tiers based on multiple factors.
 * This file is used by both server routes and client components.
 */

export type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Elite'

export interface TierGradeInput {
  baseConfidence: number
  unitsRisked: number
  teamRecord?: { wins: number; losses: number; netUnits: number }
  last7DaysRecord?: { wins: number; losses: number; netUnits: number }
}

export interface TierGradeResult {
  tier: RarityTier
  tierScore: number
  bonuses: { units: number; teamRecord: number; hotStreak: number }
}

/**
 * Calculate tier grade based on comprehensive inputs.
 *
 * IMPORTANT: baseConfidence can be on 0-10 scale (SHIVA) or 0-100 scale (legacy)
 * We normalize to 0-100 scale for consistent tier calculation.
 *
 * Thresholds (on 0-100 scale with bonuses):
 * - Elite: 80+ (requires positive 7-day AND 4+ units)
 * - Legendary: 75-79 (high confidence + bonuses)
 * - Epic: 68-74 (strong picks)
 * - Rare: 60-67 (solid picks)
 * - Uncommon: 50-59 (average picks)
 * - Common: <50 (low confidence)
 */
export function calculateTierGrade(input: TierGradeInput): TierGradeResult {
  // Normalize baseConfidence to 0-100 scale if it's on 0-10 scale
  const normalizedBase = input.baseConfidence <= 10 ? input.baseConfidence * 10 : input.baseConfidence
  let tierScore = normalizedBase
  const bonuses = { units: 0, teamRecord: 0, hotStreak: 0 }

  // ===== UNITS BONUS (max +20 points) =====
  if (input.unitsRisked >= 6) {
    bonuses.units = 20
  } else if (input.unitsRisked >= 5) {
    bonuses.units = 16
  } else if (input.unitsRisked >= 4) {
    bonuses.units = 12
  } else if (input.unitsRisked >= 3) {
    bonuses.units = 8
  } else if (input.unitsRisked >= 2) {
    bonuses.units = 4
  }

  // ===== TEAM RECORD BONUS (max +10 points, min -5) =====
  if (input.teamRecord && (input.teamRecord.wins + input.teamRecord.losses) >= 3) {
    if (input.teamRecord.netUnits > 10) {
      bonuses.teamRecord = 10
    } else if (input.teamRecord.netUnits > 5) {
      bonuses.teamRecord = 8
    } else if (input.teamRecord.netUnits > 0) {
      bonuses.teamRecord = 5
    } else if (input.teamRecord.netUnits < 0) {
      bonuses.teamRecord = -5
    }
  }

  // ===== 7-DAY HOT STREAK BONUS (max +10 points, min -3) =====
  if (input.last7DaysRecord && (input.last7DaysRecord.wins + input.last7DaysRecord.losses) >= 3) {
    if (input.last7DaysRecord.netUnits > 5) {
      bonuses.hotStreak = 10
    } else if (input.last7DaysRecord.netUnits > 0) {
      bonuses.hotStreak = 5
    } else if (input.last7DaysRecord.netUnits < 0) {
      bonuses.hotStreak = -3
    }
  }

  // Calculate final score
  tierScore += bonuses.units + bonuses.teamRecord + bonuses.hotStreak

  // Elite requires: positive 7-day streak AND 4+ units
  const canBeElite = bonuses.hotStreak > 0 && input.unitsRisked >= 4

  // Determine tier
  let tier: RarityTier
  if (tierScore >= 80 && canBeElite) {
    tier = 'Elite'
  } else if (tierScore >= 75) {
    tier = 'Legendary'
  } else if (tierScore >= 68) {
    tier = 'Epic'
  } else if (tierScore >= 60) {
    tier = 'Rare'
  } else if (tierScore >= 50) {
    tier = 'Uncommon'
  } else {
    tier = 'Common'
  }

  return { tier, tierScore, bonuses }
}

/**
 * Simple fallback: get rarity tier from confidence only (for legacy picks)
 *
 * IMPORTANT: Confidence can be on 0-10 scale (SHIVA system) or 0-100 scale (legacy)
 * We detect which scale and normalize accordingly.
 *
 * 0-10 scale thresholds (SHIVA confidence):
 * - Elite: ≥8.5
 * - Legendary: ≥7.8
 * - Epic: ≥7.0
 * - Rare: ≥6.2
 * - Uncommon: ≥5.2
 * - Common: <5.2
 */
export function getRarityTierFromConfidence(confidence: number): RarityTier {
  // Normalize to 0-10 scale if value appears to be on 0-100 scale
  const normalizedConf = confidence > 10 ? confidence / 10 : confidence

  if (normalizedConf >= 8.5) return 'Elite'
  if (normalizedConf >= 7.8) return 'Legendary'
  if (normalizedConf >= 7.0) return 'Epic'
  if (normalizedConf >= 6.2) return 'Rare'
  if (normalizedConf >= 5.2) return 'Uncommon'
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
    case 'Elite':
      return {
        tier: 'Elite',
        borderColor: '#FF4500',
        bgGradient: 'from-red-950 via-orange-950/50 to-red-950',
        glowColor: 'rgba(255, 69, 0, 0.5)',
        textColor: 'text-orange-300',
        badgeBg: 'bg-gradient-to-r from-red-500 to-orange-500',
        icon: '🔥'
      }
    case 'Legendary':
      return {
        tier: 'Legendary',
        borderColor: '#FFD700',
        bgGradient: 'from-amber-950 via-yellow-950/50 to-amber-950',
        glowColor: 'rgba(255, 215, 0, 0.4)',
        textColor: 'text-amber-300',
        badgeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
        icon: '⭐'
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
        icon: '🔷'
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

