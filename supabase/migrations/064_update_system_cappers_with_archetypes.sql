-- ============================================
-- Update System Cappers with Proper Archetype Configurations
-- All weights MUST sum to 250% per bet type
-- ============================================
-- TOTALS factors: paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability
-- SPREAD factors: netRatingDiff, turnoverDiff, shootingEfficiencyMomentum, homeAwaySplits, fourFactorsDiff, injuryAvailability
-- ============================================

-- ============================================
-- SHIVA: Sharp Scholar (TOTALS) + Cold Blooded (SPREAD)
-- Philosophy: The original - balanced, mathematical, fundamentals-focused
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "sharp-scholar",
    "enabled_factors": ["paceIndex", "offForm", "defErosion", "threeEnv", "whistleEnv"],
    "weights": {"paceIndex": 50, "offForm": 50, "defErosion": 50, "threeEnv": 50, "whistleEnv": 50}
  },
  "SPREAD": {
    "archetype": "cold-blooded",
    "enabled_factors": ["netRatingDiff", "fourFactorsDiff", "injuryAvailability", "turnoverDiff", "homeAwaySplits"],
    "weights": {"netRatingDiff": 80, "fourFactorsDiff": 70, "injuryAvailability": 50, "turnoverDiff": 30, "homeAwaySplits": 20}
  }
}'::jsonb WHERE capper_id = 'shiva';

-- ============================================
-- IFRIT: Pace Prophet (TOTALS) + Hot Hand (SPREAD)
-- Philosophy: Aggressive, high-tempo, momentum-chasing
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "pace-prophet",
    "enabled_factors": ["paceIndex", "offForm", "threeEnv", "defErosion", "whistleEnv"],
    "weights": {"paceIndex": 80, "offForm": 60, "threeEnv": 50, "defErosion": 40, "whistleEnv": 20}
  },
  "SPREAD": {
    "archetype": "hot-hand",
    "enabled_factors": ["shootingEfficiencyMomentum", "netRatingDiff", "homeAwaySplits", "fourFactorsDiff", "turnoverDiff"],
    "weights": {"shootingEfficiencyMomentum": 80, "netRatingDiff": 60, "homeAwaySplits": 50, "fourFactorsDiff": 40, "turnoverDiff": 20}
  }
}'::jsonb WHERE capper_id = 'ifrit';

-- ============================================
-- SENTINEL: Fade Artist (TOTALS) + Injury Hawk (SPREAD)
-- Philosophy: Conservative, defensive, injury-aware
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "fade-artist",
    "enabled_factors": ["defErosion", "offForm", "injuryAvailability", "whistleEnv", "paceIndex"],
    "weights": {"defErosion": 80, "offForm": 60, "injuryAvailability": 50, "whistleEnv": 40, "paceIndex": 20}
  },
  "SPREAD": {
    "archetype": "injury-hawk",
    "enabled_factors": ["injuryAvailability", "fourFactorsDiff", "homeAwaySplits", "netRatingDiff", "turnoverDiff"],
    "weights": {"injuryAvailability": 80, "fourFactorsDiff": 60, "homeAwaySplits": 50, "netRatingDiff": 40, "turnoverDiff": 20}
  }
}'::jsonb WHERE capper_id = 'sentinel';

-- ============================================
-- NEXUS: Sharp Scholar (TOTALS) + Matchup Master (SPREAD)
-- Philosophy: Data-driven, balanced, matchup-focused
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "sharp-scholar",
    "enabled_factors": ["paceIndex", "offForm", "defErosion", "threeEnv", "whistleEnv"],
    "weights": {"paceIndex": 50, "offForm": 50, "defErosion": 50, "threeEnv": 50, "whistleEnv": 50}
  },
  "SPREAD": {
    "archetype": "matchup-master",
    "enabled_factors": ["fourFactorsDiff", "homeAwaySplits", "netRatingDiff", "shootingEfficiencyMomentum", "injuryAvailability"],
    "weights": {"fourFactorsDiff": 70, "homeAwaySplits": 60, "netRatingDiff": 50, "shootingEfficiencyMomentum": 40, "injuryAvailability": 30}
  }
}'::jsonb WHERE capper_id = 'nexus';

-- ============================================
-- BLITZ: Hot Hand Hunter (TOTALS) + Hot Hand (SPREAD)
-- Philosophy: Chase the heat, shooting streaks, momentum
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "hot-hand-hunter",
    "enabled_factors": ["threeEnv", "offForm", "paceIndex", "whistleEnv", "defErosion"],
    "weights": {"threeEnv": 80, "offForm": 60, "paceIndex": 50, "whistleEnv": 40, "defErosion": 20}
  },
  "SPREAD": {
    "archetype": "hot-hand",
    "enabled_factors": ["shootingEfficiencyMomentum", "netRatingDiff", "homeAwaySplits", "fourFactorsDiff", "turnoverDiff"],
    "weights": {"shootingEfficiencyMomentum": 80, "netRatingDiff": 60, "homeAwaySplits": 50, "fourFactorsDiff": 40, "turnoverDiff": 20}
  }
}'::jsonb WHERE capper_id = 'blitz';

-- ============================================
-- TITAN: Tempo Tyrant (TOTALS) + Grinder (SPREAD)
-- Philosophy: Grind it out, slow pace, ball control, unders
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "tempo-tyrant",
    "enabled_factors": ["paceIndex", "defErosion", "offForm", "threeEnv", "whistleEnv"],
    "weights": {"paceIndex": 90, "defErosion": 70, "offForm": 50, "threeEnv": 25, "whistleEnv": 15}
  },
  "SPREAD": {
    "archetype": "grinder",
    "enabled_factors": ["turnoverDiff", "shootingEfficiencyMomentum", "netRatingDiff", "fourFactorsDiff", "homeAwaySplits"],
    "weights": {"turnoverDiff": 75, "shootingEfficiencyMomentum": 60, "netRatingDiff": 50, "fourFactorsDiff": 40, "homeAwaySplits": 25}
  }
}'::jsonb WHERE capper_id = 'titan';

-- ============================================
-- THIEF: Whistle Hunter (TOTALS) + Road Warrior (SPREAD)
-- Philosophy: Contrarian, find hidden value, refs + road dogs
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "whistle-hunter",
    "enabled_factors": ["whistleEnv", "offForm", "defErosion", "paceIndex", "injuryAvailability"],
    "weights": {"whistleEnv": 90, "offForm": 60, "defErosion": 50, "paceIndex": 30, "injuryAvailability": 20}
  },
  "SPREAD": {
    "archetype": "road-warrior",
    "enabled_factors": ["homeAwaySplits", "turnoverDiff", "fourFactorsDiff", "netRatingDiff", "shootingEfficiencyMomentum"],
    "weights": {"homeAwaySplits": 85, "turnoverDiff": 55, "fourFactorsDiff": 50, "netRatingDiff": 40, "shootingEfficiencyMomentum": 20}
  }
}'::jsonb WHERE capper_id = 'thief';

-- ============================================
-- CERBERUS (if exists): Disruptor (TOTALS/efficiency) + Disruptor (SPREAD)
-- Philosophy: Chaos, turnovers, force mistakes
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "injuryAvailability", "paceIndex", "threeEnv"],
    "weights": {"offForm": 70, "defErosion": 60, "injuryAvailability": 50, "paceIndex": 40, "threeEnv": 30}
  },
  "SPREAD": {
    "archetype": "disruptor",
    "enabled_factors": ["turnoverDiff", "fourFactorsDiff", "netRatingDiff", "shootingEfficiencyMomentum", "homeAwaySplits"],
    "weights": {"turnoverDiff": 90, "fourFactorsDiff": 60, "netRatingDiff": 50, "shootingEfficiencyMomentum": 30, "homeAwaySplits": 20}
  }
}'::jsonb WHERE capper_id = 'cerberus';

-- ============================================
-- PICKSMITH (if exists): Injury Assassin (TOTALS) + Closer (SPREAD)
-- Philosophy: Injury exploitation + net rating fundamentals
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "injury-assassin",
    "enabled_factors": ["injuryAvailability", "defErosion", "offForm", "paceIndex", "whistleEnv"],
    "weights": {"injuryAvailability": 80, "defErosion": 60, "offForm": 50, "paceIndex": 40, "whistleEnv": 20}
  },
  "SPREAD": {
    "archetype": "closer",
    "enabled_factors": ["netRatingDiff", "shootingEfficiencyMomentum", "turnoverDiff", "homeAwaySplits", "fourFactorsDiff"],
    "weights": {"netRatingDiff": 75, "shootingEfficiencyMomentum": 55, "turnoverDiff": 50, "homeAwaySplits": 40, "fourFactorsDiff": 30}
  }
}'::jsonb WHERE capper_id = 'picksmith';

-- Add a comment documenting the archetype assignments
COMMENT ON TABLE user_cappers IS 'System cappers with archetype-based factor configurations (all weights sum to 250% per bet type)';

