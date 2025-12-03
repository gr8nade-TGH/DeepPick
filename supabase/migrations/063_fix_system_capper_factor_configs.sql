-- =====================================================
-- FIX SYSTEM CAPPER FACTOR CONFIGS
-- =====================================================
-- Issue: factor_config in user_cappers uses legacy keys that don't exist
-- in factor-registry.ts, causing factors to be silently skipped.
--
-- VALID TOTALS FACTORS (from factor-registry.ts):
--   paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability
--
-- VALID SPREAD FACTORS (from factor-registry.ts):
--   netRatingDiff, turnoverDiff, shootingEfficiencyMomentum, homeAwaySplits, fourFactorsDiff, injuryAvailability
--
-- ARCHETYPE MAPPING (from create/page.tsx):
-- Each system capper gets ONE TOTALS archetype + ONE SPREAD archetype
--
-- TOTALS ARCHETYPES:
--   1. Pace Prophet     - paceIndex dominant (tempo-focused)
--   2. Efficiency Expert - offForm dominant (rating-focused)
--   3. Hot Hand Hunter   - threeEnv dominant (shooting streaks)
--   4. Rest Detective    - defErosion/injuryAvailability (fatigue/injuries)
--   5. Sharp Scholar     - Balanced all factors
--
-- SPREAD ARCHETYPES:
--   1. Form Rider       - shootingEfficiencyMomentum dominant (momentum)
--   2. Matchup Master   - fourFactorsDiff dominant (matchup analysis)
--   3. Home Court Hero  - homeAwaySplits dominant (home advantage)
--   4. The Closer       - netRatingDiff dominant (who closes games)
--   5. Injury Hawk      - injuryAvailability dominant (injury value)

-- ============================================
-- SHIVA: Sharp Scholar (TOTALS) + Matchup Master (SPREAD)
-- Philosophy: Balanced, trusts the math, looks at full picture
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "sharp-scholar",
    "enabled_factors": ["paceIndex", "offForm", "defErosion", "threeEnv", "whistleEnv"],
    "weights": {"paceIndex": 20, "offForm": 20, "defErosion": 20, "threeEnv": 20, "whistleEnv": 20}
  },
  "SPREAD": {
    "archetype": "matchup-master",
    "enabled_factors": ["fourFactorsDiff", "homeAwaySplits", "netRatingDiff", "shootingEfficiencyMomentum"],
    "weights": {"fourFactorsDiff": 40, "homeAwaySplits": 25, "netRatingDiff": 20, "shootingEfficiencyMomentum": 15}
  }
}'::jsonb WHERE capper_id = 'shiva';

-- ============================================
-- IFRIT: Pace Prophet (TOTALS) + Form Rider (SPREAD)
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
    "enabled_factors": ["shootingEfficiencyMomentum", "homeAwaySplits", "netRatingDiff"],
    "weights": {"shootingEfficiencyMomentum": 50, "homeAwaySplits": 30, "netRatingDiff": 20}
  }
}'::jsonb WHERE capper_id = 'ifrit';

-- ============================================
-- BLITZ: Hot Hand Hunter (TOTALS) + Form Rider (SPREAD)
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
    "enabled_factors": ["shootingEfficiencyMomentum", "turnoverDiff", "homeAwaySplits", "netRatingDiff"],
    "weights": {"shootingEfficiencyMomentum": 40, "turnoverDiff": 25, "homeAwaySplits": 20, "netRatingDiff": 15}
  }
}'::jsonb WHERE capper_id = 'blitz';

-- ============================================
-- NEXUS: Rest Detective (TOTALS) + Injury Hawk (SPREAD)
-- Philosophy: Injuries and fatigue create value - beat the slow-moving lines
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "rest-detective",
    "enabled_factors": ["defErosion", "injuryAvailability", "offForm", "paceIndex"],
    "weights": {"defErosion": 35, "injuryAvailability": 30, "offForm": 20, "paceIndex": 15}
  },
  "SPREAD": {
    "archetype": "injury-hawk",
    "enabled_factors": ["injuryAvailability", "fourFactorsDiff", "homeAwaySplits", "netRatingDiff"],
    "weights": {"injuryAvailability": 40, "fourFactorsDiff": 25, "homeAwaySplits": 20, "netRatingDiff": 15}
  }
}'::jsonb WHERE capper_id = 'nexus';

-- ============================================
-- SENTINEL: Efficiency Expert (TOTALS) + Home Court Hero (SPREAD)
-- Philosophy: Quality metrics and home court - fundamentals matter
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "injuryAvailability", "paceIndex"],
    "weights": {"offForm": 35, "defErosion": 30, "injuryAvailability": 20, "paceIndex": 15}
  },
  "SPREAD": {
    "archetype": "home-court-hero",
    "enabled_factors": ["homeAwaySplits", "fourFactorsDiff", "netRatingDiff", "turnoverDiff"],
    "weights": {"homeAwaySplits": 40, "fourFactorsDiff": 25, "netRatingDiff": 20, "turnoverDiff": 15}
  }
}'::jsonb WHERE capper_id = 'sentinel';

-- ============================================
-- THIEF: Hot Hand Hunter (TOTALS) + The Closer (SPREAD)
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
    "enabled_factors": ["netRatingDiff", "shootingEfficiencyMomentum", "turnoverDiff", "homeAwaySplits"],
    "weights": {"netRatingDiff": 40, "shootingEfficiencyMomentum": 25, "turnoverDiff": 20, "homeAwaySplits": 15}
  }
}'::jsonb WHERE capper_id = 'thief';

-- ============================================
-- TITAN: Efficiency Expert (TOTALS) + Matchup Master (SPREAD)
-- Philosophy: Pure fundamentals - ratings and matchups win
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "paceIndex", "whistleEnv"],
    "weights": {"offForm": 40, "defErosion": 30, "paceIndex": 20, "whistleEnv": 10}
  },
  "SPREAD": {
    "archetype": "matchup-master",
    "enabled_factors": ["fourFactorsDiff", "netRatingDiff", "turnoverDiff", "injuryAvailability"],
    "weights": {"fourFactorsDiff": 35, "netRatingDiff": 30, "turnoverDiff": 20, "injuryAvailability": 15}
  }
}'::jsonb WHERE capper_id = 'titan';

-- ============================================
-- PICKSMITH: Meta-capper (consensus, no factors)
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "type": "consensus",
  "minCappers": 2,
  "weightByRecord": true
}'::jsonb WHERE capper_id = 'picksmith';

-- Verification query (run this after to confirm)
-- SELECT capper_id, display_name, factor_config FROM user_cappers WHERE is_system_capper = true ORDER BY capper_id;

