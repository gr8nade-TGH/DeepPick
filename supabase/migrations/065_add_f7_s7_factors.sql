-- =====================================================
-- ADD F7 (Rest Advantage) AND S7 (Momentum Index) FACTORS
-- =====================================================
-- This migration adds two new factors to the system:
--
-- F7: restAdvantage (TOTALS)
--   - Analyzes rest differential between teams
--   - Back-to-backs cause fatigue and lower scoring
--   - Data: restDays, isBackToBack from MySportsFeeds
--
-- S7: momentumIndex (SPREAD)
--   - Analyzes team momentum based on streak and last 10 record
--   - Hot teams tend to cover spreads
--   - Data: winStreak, last10Record from MySportsFeeds
--
-- STRATEGY: Add new factors to cappers that would benefit from them:
--   - restAdvantage: NEXUS (Rest Detective archetype) gets highest weight
--   - momentumIndex: IFRIT, BLITZ (Form Rider archetype) get highest weight

-- ============================================
-- SHIVA: Add restAdvantage (15%) to TOTALS, momentumIndex (15%) to SPREAD
-- Philosophy: Balanced approach - include new factors at moderate weight
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "sharp-scholar",
    "enabled_factors": ["paceIndex", "offForm", "defErosion", "threeEnv", "whistleEnv", "restAdvantage"],
    "weights": {"paceIndex": 18, "offForm": 18, "defErosion": 18, "threeEnv": 18, "whistleEnv": 13, "restAdvantage": 15}
  },
  "SPREAD": {
    "archetype": "matchup-master",
    "enabled_factors": ["fourFactorsDiff", "homeAwaySplits", "netRatingDiff", "shootingEfficiencyMomentum", "momentumIndex"],
    "weights": {"fourFactorsDiff": 35, "homeAwaySplits": 20, "netRatingDiff": 15, "shootingEfficiencyMomentum": 15, "momentumIndex": 15}
  }
}'::jsonb WHERE capper_id = 'shiva';

-- ============================================
-- IFRIT: Add momentumIndex (25%) to SPREAD - momentum-focused
-- Philosophy: Tempo and momentum - ride the fast teams and hot streaks
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "pace-prophet",
    "enabled_factors": ["paceIndex", "offForm", "threeEnv"],
    "weights": {"paceIndex": 50, "offForm": 30, "threeEnv": 20}
  },
  "SPREAD": {
    "archetype": "form-rider",
    "enabled_factors": ["shootingEfficiencyMomentum", "momentumIndex", "homeAwaySplits", "netRatingDiff"],
    "weights": {"shootingEfficiencyMomentum": 40, "momentumIndex": 25, "homeAwaySplits": 20, "netRatingDiff": 15}
  }
}'::jsonb WHERE capper_id = 'ifrit';

-- ============================================
-- BLITZ: Add momentumIndex (20%) to SPREAD - momentum-focused
-- Philosophy: Chase the heat - shooting streaks and momentum
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "hot-hand-hunter",
    "enabled_factors": ["threeEnv", "offForm", "paceIndex", "whistleEnv"],
    "weights": {"threeEnv": 40, "offForm": 25, "paceIndex": 20, "whistleEnv": 15}
  },
  "SPREAD": {
    "archetype": "form-rider",
    "enabled_factors": ["shootingEfficiencyMomentum", "momentumIndex", "turnoverDiff", "homeAwaySplits"],
    "weights": {"shootingEfficiencyMomentum": 35, "momentumIndex": 25, "turnoverDiff": 20, "homeAwaySplits": 20}
  }
}'::jsonb WHERE capper_id = 'blitz';

-- ============================================
-- NEXUS: Add restAdvantage (30%) to TOTALS - fatigue-focused
-- Philosophy: Injuries and fatigue create value - beat the slow-moving lines
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "rest-detective",
    "enabled_factors": ["defErosion", "restAdvantage", "injuryAvailability", "offForm"],
    "weights": {"defErosion": 30, "restAdvantage": 30, "injuryAvailability": 25, "offForm": 15}
  },
  "SPREAD": {
    "archetype": "injury-hawk",
    "enabled_factors": ["injuryAvailability", "fourFactorsDiff", "homeAwaySplits", "netRatingDiff"],
    "weights": {"injuryAvailability": 40, "fourFactorsDiff": 25, "homeAwaySplits": 20, "netRatingDiff": 15}
  }
}'::jsonb WHERE capper_id = 'nexus';

-- ============================================
-- SENTINEL: Add restAdvantage (15%) to TOTALS
-- Philosophy: Quality metrics and home court - fundamentals matter
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "restAdvantage", "paceIndex"],
    "weights": {"offForm": 35, "defErosion": 25, "restAdvantage": 20, "paceIndex": 20}
  },
  "SPREAD": {
    "archetype": "home-court-hero",
    "enabled_factors": ["homeAwaySplits", "fourFactorsDiff", "netRatingDiff", "turnoverDiff"],
    "weights": {"homeAwaySplits": 40, "fourFactorsDiff": 25, "netRatingDiff": 20, "turnoverDiff": 15}
  }
}'::jsonb WHERE capper_id = 'sentinel';

-- ============================================
-- THIEF: Add momentumIndex (20%) to SPREAD
-- Philosophy: Shooting touch and clutch performance - steal wins
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "hot-hand-hunter",
    "enabled_factors": ["threeEnv", "offForm", "paceIndex", "defErosion"],
    "weights": {"threeEnv": 35, "offForm": 30, "paceIndex": 20, "defErosion": 15}
  },
  "SPREAD": {
    "archetype": "closer",
    "enabled_factors": ["netRatingDiff", "momentumIndex", "shootingEfficiencyMomentum", "turnoverDiff"],
    "weights": {"netRatingDiff": 35, "momentumIndex": 25, "shootingEfficiencyMomentum": 25, "turnoverDiff": 15}
  }
}'::jsonb WHERE capper_id = 'thief';

-- ============================================
-- TITAN: Add restAdvantage (15%) to TOTALS, momentumIndex (15%) to SPREAD
-- Philosophy: Pure fundamentals - ratings and matchups win
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "restAdvantage", "paceIndex"],
    "weights": {"offForm": 35, "defErosion": 25, "restAdvantage": 20, "paceIndex": 20}
  },
  "SPREAD": {
    "archetype": "matchup-master",
    "enabled_factors": ["fourFactorsDiff", "netRatingDiff", "momentumIndex", "turnoverDiff"],
    "weights": {"fourFactorsDiff": 30, "netRatingDiff": 25, "momentumIndex": 25, "turnoverDiff": 20}
  }
}'::jsonb WHERE capper_id = 'titan';

-- PICKSMITH remains unchanged (consensus capper, no factors)

-- Verification query (run this after to confirm)
-- SELECT capper_id, display_name, factor_config FROM user_cappers WHERE is_system_capper = true ORDER BY capper_id;

