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
 * Thresholds (adjusted for better distribution):
 * - Elite: 80+ (requires positive 7-day AND 4+ units)
 * - Legendary: 75-79 (high confidence + bonuses)
 * - Epic: 68-74 (strong picks)
 * - Rare: 60-67 (solid picks)
 * - Uncommon: 50-59 (average picks)
 * - Common: <50 (low confidence)
 */
export function calculateTierGrade(input: TierGradeInput): TierGradeResult {
  let tierScore = input.baseConfidence
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
 * Simple fallback: get rarity from confidence only (for legacy picks)
 */
export function getRarityFromConfidence(confidence: number): RarityTier {
  if (confidence >= 85) return 'Elite'
  if (confidence >= 78) return 'Legendary'
  if (confidence >= 70) return 'Epic'
  if (confidence >= 62) return 'Rare'
  if (confidence >= 52) return 'Uncommon'
  return 'Common'
}

