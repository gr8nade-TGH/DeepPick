-- ============================================
-- Migration: Add New SPREAD Archetypes with S10-S12 Factors
-- Date: 2025-12-03
-- Purpose: Update select cappers to use new archetypes that utilize
--          clutchShooting (S10), scoringMargin (S11), perimeterDefense (S12)
-- ============================================

-- ============================================
-- IFRIT: Ice Veins (SPREAD) - Clutch shooting focused
-- Philosophy: FT% and FG% win close games
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "pace-prophet",
    "enabled_factors": ["paceIndex", "offForm", "threeEnv", "defErosion", "whistleEnv"],
    "weights": {"paceIndex": 80, "offForm": 60, "threeEnv": 50, "defErosion": 40, "whistleEnv": 20}
  },
  "SPREAD": {
    "archetype": "ice-veins",
    "enabled_factors": ["clutchShooting", "scoringMargin", "netRatingDiff", "fourFactorsDiff", "turnoverDiff"],
    "weights": {"clutchShooting": 80, "scoringMargin": 55, "netRatingDiff": 50, "fourFactorsDiff": 40, "turnoverDiff": 25}
  }
}'::jsonb WHERE capper_id = 'ifrit';

-- ============================================
-- SENTINEL: Lockdown (SPREAD) - Defense specialist
-- Philosophy: Perimeter defense + pressure = covers
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "rest-detective",
    "enabled_factors": ["defErosion", "injuryAvailability", "paceIndex", "offForm", "whistleEnv"],
    "weights": {"defErosion": 80, "injuryAvailability": 60, "paceIndex": 50, "offForm": 40, "whistleEnv": 20}
  },
  "SPREAD": {
    "archetype": "lockdown",
    "enabled_factors": ["perimeterDefense", "defensivePressure", "fourFactorsDiff", "turnoverDiff", "netRatingDiff"],
    "weights": {"perimeterDefense": 80, "defensivePressure": 55, "fourFactorsDiff": 50, "turnoverDiff": 40, "netRatingDiff": 25}
  }
}'::jsonb WHERE capper_id = 'sentinel';

-- ============================================
-- THIEF: Point Machine (SPREAD) - Scoring margin focused
-- Philosophy: Outscoring = covering. Simple math.
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "paceIndex", "threeEnv", "whistleEnv"],
    "weights": {"offForm": 80, "defErosion": 60, "paceIndex": 50, "threeEnv": 40, "whistleEnv": 20}
  },
  "SPREAD": {
    "archetype": "point-machine",
    "enabled_factors": ["scoringMargin", "clutchShooting", "netRatingDiff", "fourFactorsDiff", "turnoverDiff"],
    "weights": {"scoringMargin": 85, "clutchShooting": 55, "netRatingDiff": 50, "fourFactorsDiff": 35, "turnoverDiff": 25}
  }
}'::jsonb WHERE capper_id = 'thief';

-- ============================================
-- Log migration
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 067: Updated IFRIT, SENTINEL, THIEF with new archetypes (ice-veins, lockdown, point-machine)';
  RAISE NOTICE 'New factors in use: clutchShooting (S10), scoringMargin (S11), perimeterDefense (S12)';
END $$;

