-- ============================================
-- Migration 068: Diversify Capper Factor Configurations
-- ============================================
-- GOALS:
-- 1. Fix invalid factor keys (shootingMomentum → shootingEfficiencyMomentum, etc.)
-- 2. Spread out factor usage - use underutilized factors (assistEfficiency, reboundingDiff, etc.)
-- 3. Ensure each capper has a unique factor profile for pick diversity
-- 4. Maintain archetype philosophy alignment
-- ============================================

-- ============================================
-- SHIVA: The Sharp Scholar - Balanced approach, uses ALL factor types
-- Philosophy: Trust the math. Every factor has value.
-- TOTALS: Balanced across core 6 factors
-- SPREAD: Balanced across different dimensions
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "totals-balanced",
    "enabled_factors": ["paceIndex", "offForm", "defErosion", "threeEnv", "whistleEnv", "restAdvantage"],
    "weights": {"paceIndex": 42, "offForm": 42, "defErosion": 42, "threeEnv": 42, "whistleEnv": 42, "restAdvantage": 40},
    "baseline_model": "pace-efficiency"
  },
  "SPREAD": {
    "archetype": "matchup-master",
    "enabled_factors": ["fourFactorsDiff", "homeAwaySplits", "netRatingDiff", "shootingEfficiencyMomentum", "momentumIndex"],
    "weights": {"fourFactorsDiff": 70, "homeAwaySplits": 50, "netRatingDiff": 50, "shootingEfficiencyMomentum": 40, "momentumIndex": 40},
    "baseline_model": "net-rating"
  }
}'::jsonb WHERE capper_id = 'shiva';

-- ============================================
-- IFRIT: Ice Veins - Clutch performance specialist
-- Philosophy: FT% and FG% win close games
-- TOTALS: Pace Prophet style but with shooting focus
-- SPREAD: Clutch + Scoring Margin dominant
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "pace-prophet",
    "enabled_factors": ["paceIndex", "offForm", "threeEnv", "defErosion", "whistleEnv"],
    "weights": {"paceIndex": 80, "offForm": 60, "threeEnv": 50, "defErosion": 40, "whistleEnv": 20},
    "baseline_model": "ppg-based"
  },
  "SPREAD": {
    "archetype": "ice-veins",
    "enabled_factors": ["clutchShooting", "scoringMargin", "netRatingDiff", "fourFactorsDiff", "turnoverDiff"],
    "weights": {"clutchShooting": 80, "scoringMargin": 55, "netRatingDiff": 50, "fourFactorsDiff": 40, "turnoverDiff": 25},
    "baseline_model": "scoring-margin"
  }
}'::jsonb WHERE capper_id = 'ifrit';

-- ============================================
-- NEXUS: Injury Hawk + Defense Specialist
-- Philosophy: Injuries create value, defense travels
-- TOTALS: Locksmith style (defense-focused UNDER specialist)
-- SPREAD: Injury-focused with defensive factors
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "the-locksmith",
    "enabled_factors": ["defStrength", "coldShooting", "injuryAvailability", "paceIndex", "restAdvantage"],
    "weights": {"defStrength": 80, "coldShooting": 70, "injuryAvailability": 50, "paceIndex": 30, "restAdvantage": 20},
    "baseline_model": "matchup-defensive"
  },
  "SPREAD": {
    "archetype": "injury-hawk",
    "enabled_factors": ["injuryAvailability", "fourFactorsDiff", "reboundingDiff", "netRatingDiff", "defensivePressure"],
    "weights": {"injuryAvailability": 80, "fourFactorsDiff": 60, "reboundingDiff": 50, "netRatingDiff": 35, "defensivePressure": 25},
    "baseline_model": "h2h-projection"
  }
}'::jsonb WHERE capper_id = 'nexus';

-- ============================================
-- SENTINEL: The Lockdown - Elite perimeter defense specialist
-- Philosophy: Defense travels, perimeter D wins in modern NBA
-- TOTALS: Fade Artist style (defensive erosion focus)
-- SPREAD: Perimeter defense + pressure dominant
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "the-fade",
    "enabled_factors": ["defErosion", "offForm", "injuryAvailability", "coldShooting", "paceIndex"],
    "weights": {"defErosion": 80, "offForm": 50, "injuryAvailability": 50, "coldShooting": 40, "paceIndex": 30},
    "baseline_model": "matchup-defensive"
  },
  "SPREAD": {
    "archetype": "lockdown",
    "enabled_factors": ["perimeterDefense", "defensivePressure", "fourFactorsDiff", "turnoverDiff", "netRatingDiff"],
    "weights": {"perimeterDefense": 80, "defensivePressure": 55, "fourFactorsDiff": 50, "turnoverDiff": 40, "netRatingDiff": 25},
    "baseline_model": "net-rating"
  }
}'::jsonb WHERE capper_id = 'sentinel';

-- ============================================
-- THIEF: Point Machine - Scoring margin specialist
-- Philosophy: Outscoring = covering. Simple math.
-- TOTALS: Efficiency Expert style
-- SPREAD: Scoring Margin + Clutch dominant
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "efficiency-expert",
    "enabled_factors": ["offForm", "defErosion", "injuryAvailability", "paceIndex", "threeEnv"],
    "weights": {"offForm": 70, "defErosion": 60, "injuryAvailability": 50, "paceIndex": 40, "threeEnv": 30},
    "baseline_model": "ppg-based"
  },
  "SPREAD": {
    "archetype": "point-machine",
    "enabled_factors": ["scoringMargin", "clutchShooting", "netRatingDiff", "fourFactorsDiff", "assistEfficiency"],
    "weights": {"scoringMargin": 85, "clutchShooting": 50, "netRatingDiff": 50, "fourFactorsDiff": 35, "assistEfficiency": 30},
    "baseline_model": "h2h-projection"
  }
}'::jsonb WHERE capper_id = 'thief';

-- ============================================
-- TITAN: The Closer - Net rating fundamentals
-- Philosophy: Games are won by the better team
-- TOTALS: Defense + Rest focused
-- SPREAD: Net Rating dominant with balanced support
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "tempo-tyrant",
    "enabled_factors": ["paceIndex", "defErosion", "offForm", "defStrength", "restAdvantage"],
    "weights": {"paceIndex": 70, "defErosion": 60, "offForm": 50, "defStrength": 40, "restAdvantage": 30},
    "baseline_model": "pace-efficiency"
  },
  "SPREAD": {
    "archetype": "closer",
    "enabled_factors": ["netRatingDiff", "shootingEfficiencyMomentum", "turnoverDiff", "reboundingDiff", "fourFactorsDiff"],
    "weights": {"netRatingDiff": 75, "shootingEfficiencyMomentum": 55, "turnoverDiff": 50, "reboundingDiff": 40, "fourFactorsDiff": 30},
    "baseline_model": "net-rating"
  }
}'::jsonb WHERE capper_id = 'titan';

-- ============================================
-- BLITZ: Form Rider - Momentum specialist
-- Philosophy: Hot teams stay hot, ride the wave
-- TOTALS: Hot Hand Hunter style
-- SPREAD: Momentum + Shooting momentum dominant
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "hot-hand-hunter",
    "enabled_factors": ["threeEnv", "offForm", "paceIndex", "whistleEnv", "coldShooting"],
    "weights": {"threeEnv": 80, "offForm": 55, "paceIndex": 50, "whistleEnv": 35, "coldShooting": 30},
    "baseline_model": "ppg-based"
  },
  "SPREAD": {
    "archetype": "hot-hand",
    "enabled_factors": ["shootingEfficiencyMomentum", "momentumIndex", "netRatingDiff", "reboundingDiff", "turnoverDiff"],
    "weights": {"shootingEfficiencyMomentum": 80, "momentumIndex": 60, "netRatingDiff": 50, "reboundingDiff": 35, "turnoverDiff": 25},
    "baseline_model": "scoring-margin"
  }
}'::jsonb WHERE capper_id = 'blitz';

-- ============================================
-- PICKSMITH: Ball Mover - Assist efficiency specialist
-- Philosophy: Unselfish teams with great chemistry cover
-- TOTALS: Injury Assassin style
-- SPREAD: Assist Efficiency dominant (UNIQUE - only capper using this as primary)
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "injury-assassin",
    "enabled_factors": ["injuryAvailability", "defErosion", "offForm", "paceIndex", "whistleEnv"],
    "weights": {"injuryAvailability": 80, "defErosion": 60, "offForm": 50, "paceIndex": 40, "whistleEnv": 20},
    "baseline_model": "pace-efficiency"
  },
  "SPREAD": {
    "archetype": "ball-mover",
    "enabled_factors": ["assistEfficiency", "turnoverDiff", "fourFactorsDiff", "netRatingDiff", "reboundingDiff"],
    "weights": {"assistEfficiency": 75, "turnoverDiff": 55, "fourFactorsDiff": 50, "netRatingDiff": 40, "reboundingDiff": 30},
    "baseline_model": "h2h-projection"
  }
}'::jsonb WHERE capper_id = 'picksmith';

-- ============================================
-- gr8nade: Board Bully - Rebounding specialist
-- Philosophy: Control the glass, control the game
-- TOTALS: Pace + Three Point focus
-- SPREAD: Rebounding dominant (UNIQUE - primary rebound focus)
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "pace-prophet",
    "enabled_factors": ["paceIndex", "threeEnv", "offForm", "defErosion", "whistleEnv"],
    "weights": {"paceIndex": 80, "threeEnv": 60, "offForm": 50, "defErosion": 40, "whistleEnv": 20},
    "baseline_model": "pace-efficiency"
  },
  "SPREAD": {
    "archetype": "board-bully",
    "enabled_factors": ["reboundingDiff", "turnoverDiff", "fourFactorsDiff", "netRatingDiff", "shootingEfficiencyMomentum"],
    "weights": {"reboundingDiff": 85, "turnoverDiff": 55, "fourFactorsDiff": 45, "netRatingDiff": 40, "shootingEfficiencyMomentum": 25},
    "baseline_model": "scoring-margin"
  }
}'::jsonb WHERE capper_id = 'gr8nade';

-- ============================================
-- sport727: The Grinder - Turnover discipline specialist
-- Philosophy: Ball security + efficient shooting = covering spreads
-- TOTALS: Whistle Hunter style (Free throw focus)
-- SPREAD: Turnover dominant with shooting support
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "free-throw-fiend",
    "enabled_factors": ["whistleEnv", "offForm", "defErosion", "paceIndex", "injuryAvailability"],
    "weights": {"whistleEnv": 90, "offForm": 60, "defErosion": 50, "paceIndex": 30, "injuryAvailability": 20},
    "baseline_model": "ppg-based"
  },
  "SPREAD": {
    "archetype": "the-grinder",
    "enabled_factors": ["turnoverDiff", "shootingEfficiencyMomentum", "netRatingDiff", "fourFactorsDiff", "homeAwaySplits"],
    "weights": {"turnoverDiff": 75, "shootingEfficiencyMomentum": 60, "netRatingDiff": 50, "fourFactorsDiff": 40, "homeAwaySplits": 25},
    "baseline_model": "h2h-projection"
  }
}'::jsonb WHERE capper_id = 'sport727';

-- ============================================
-- marshal-harris: The Disruptor - Chaos and pressure specialist
-- Philosophy: Force turnovers, control the game
-- TOTALS: Grinder style (slow/defensive)
-- SPREAD: Defensive Pressure + Turnover focus
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "the-grinder",
    "enabled_factors": ["paceIndex", "coldShooting", "defStrength", "restAdvantage", "injuryAvailability"],
    "weights": {"paceIndex": 70, "coldShooting": 60, "defStrength": 50, "restAdvantage": 40, "injuryAvailability": 30},
    "baseline_model": "matchup-defensive"
  },
  "SPREAD": {
    "archetype": "disruptor",
    "enabled_factors": ["turnoverDiff", "defensivePressure", "fourFactorsDiff", "netRatingDiff", "reboundingDiff"],
    "weights": {"turnoverDiff": 70, "defensivePressure": 55, "fourFactorsDiff": 50, "netRatingDiff": 40, "reboundingDiff": 35},
    "baseline_model": "net-rating"
  }
}'::jsonb WHERE capper_id = 'marshal-harris';

-- ============================================
-- monkey2: Cold Blooded - Fundamentals over narratives
-- Philosophy: Ignore the noise. Net rating + four factors = truth.
-- TOTALS: Locksmith style (defense focus)
-- SPREAD: Net Rating + Four Factors balanced
-- ============================================
UPDATE user_cappers SET factor_config = '{
  "TOTAL": {
    "archetype": "the-locksmith",
    "enabled_factors": ["defStrength", "coldShooting", "defErosion", "paceIndex", "injuryAvailability"],
    "weights": {"defStrength": 75, "coldShooting": 65, "defErosion": 50, "paceIndex": 35, "injuryAvailability": 25},
    "baseline_model": "matchup-defensive"
  },
  "SPREAD": {
    "archetype": "cold-blooded",
    "enabled_factors": ["netRatingDiff", "fourFactorsDiff", "injuryAvailability", "turnoverDiff", "reboundingDiff"],
    "weights": {"netRatingDiff": 80, "fourFactorsDiff": 70, "injuryAvailability": 45, "turnoverDiff": 30, "reboundingDiff": 25},
    "baseline_model": "scoring-margin"
  }
}'::jsonb WHERE capper_id = 'monkey2';

-- ============================================
-- Log migration
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 068: Diversified capper factor configurations';
  RAISE NOTICE 'Fixed invalid factor keys: shootingMomentum, paceMismatch, injuryAvailabilitySpread';
  RAISE NOTICE 'Added usage for underutilized factors: assistEfficiency, reboundingDiff, defensivePressure, perimeterDefense';
  RAISE NOTICE 'Each capper now has a unique factor profile for pick diversity';
END $$;

