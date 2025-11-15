-- Migration 061: Add 5 Preset System Cappers
-- Adds SENTINEL, NEXUS, BLITZ, TITAN, THIEF as system cappers
-- Each has unique factor configurations matching the preset strategies
-- Execution schedules are staggered to avoid conflicts with SHIVA and IFRIT

-- Insert SENTINEL (The Conservative)
INSERT INTO user_cappers (
  user_id,
  capper_id,
  display_name,
  description,
  color_theme,
  sport,
  bet_types,
  factor_config,
  execution_interval_minutes,
  execution_priority,
  is_active,
  is_system_capper
) VALUES (
  NULL,
  'sentinel',
  'SENTINEL',
  'Defense wins championships. Low-risk, high-confidence plays focusing on proven, stable factors.',
  'blue',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["netRating", "restDays", "injuryImpact", "homeAwayDiff", "paceIndex"],
      "weights": {
        "netRating": 70,
        "restDays": 60,
        "injuryImpact": 60,
        "homeAwayDiff": 40,
        "paceIndex": 20
      }
    },
    "SPREAD": {
      "enabled_factors": ["offDefBalance", "homeCourtEdge", "injuryImpact", "clutchPerformance", "recentForm"],
      "weights": {
        "offDefBalance": 70,
        "homeCourtEdge": 60,
        "injuryImpact": 50,
        "clutchPerformance": 40,
        "recentForm": 30
      }
    }
  }'::JSONB,
  10,
  7,
  true,
  true
) ON CONFLICT (capper_id) DO NOTHING;

-- Insert NEXUS (The Balanced Sharp)
INSERT INTO user_cappers (
  user_id,
  capper_id,
  display_name,
  description,
  color_theme,
  sport,
  bet_types,
  factor_config,
  execution_interval_minutes,
  execution_priority,
  is_active,
  is_system_capper
) VALUES (
  NULL,
  'nexus',
  'NEXUS',
  'Data-driven precision. Well-rounded approach with even distribution across all factors.',
  'slate',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["paceIndex", "netRating", "shooting", "restDays", "injuryImpact"],
      "weights": {
        "paceIndex": 45,
        "netRating": 50,
        "shooting": 50,
        "restDays": 50,
        "injuryImpact": 55
      }
    },
    "SPREAD": {
      "enabled_factors": ["recentForm", "paceMismatch", "offDefBalance", "homeCourtEdge", "injuryImpact"],
      "weights": {
        "recentForm": 50,
        "paceMismatch": 50,
        "offDefBalance": 50,
        "homeCourtEdge": 50,
        "injuryImpact": 50
      }
    }
  }'::JSONB,
  12,
  6,
  true,
  true
) ON CONFLICT (capper_id) DO NOTHING;

-- Insert BLITZ (The Pace Demon)
INSERT INTO user_cappers (
  user_id,
  capper_id,
  display_name,
  description,
  color_theme,
  sport,
  bet_types,
  factor_config,
  execution_interval_minutes,
  execution_priority,
  is_active,
  is_system_capper
) VALUES (
  NULL,
  'blitz',
  'BLITZ',
  'Speed kills. High-scoring, fast-paced games. Overs specialist emphasizing pace and offensive firepower.',
  'orange',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["paceIndex", "shooting", "netRating", "homeAwayDiff"],
      "weights": {
        "paceIndex": 100,
        "shooting": 70,
        "netRating": 50,
        "homeAwayDiff": 30
      }
    },
    "SPREAD": {
      "enabled_factors": ["paceMismatch", "offDefBalance", "recentForm", "homeCourtEdge", "clutchPerformance"],
      "weights": {
        "paceMismatch": 80,
        "offDefBalance": 60,
        "recentForm": 50,
        "homeCourtEdge": 30,
        "clutchPerformance": 30
      }
    }
  }'::JSONB,
  15,
  5,
  true,
  true
) ON CONFLICT (capper_id) DO NOTHING;

-- Insert TITAN (The Grind-It-Out)
INSERT INTO user_cappers (
  user_id,
  capper_id,
  display_name,
  description,
  color_theme,
  sport,
  bet_types,
  factor_config,
  execution_interval_minutes,
  execution_priority,
  is_active,
  is_system_capper
) VALUES (
  NULL,
  'titan',
  'TITAN',
  'Grind it out. Emphasizes defensive efficiency, slow pace, and home court advantage.',
  'emerald',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["netRating", "restDays", "homeAwayDiff", "injuryImpact", "paceIndex"],
      "weights": {
        "netRating": 80,
        "restDays": 70,
        "homeAwayDiff": 50,
        "injuryImpact": 35,
        "paceIndex": 15
      }
    },
    "SPREAD": {
      "enabled_factors": ["offDefBalance", "homeCourtEdge", "clutchPerformance", "recentForm", "injuryImpact"],
      "weights": {
        "offDefBalance": 80,
        "homeCourtEdge": 70,
        "clutchPerformance": 40,
        "recentForm": 30,
        "injuryImpact": 30
      }
    }
  }'::JSONB,
  18,
  4,
  true,
  true
) ON CONFLICT (capper_id) DO NOTHING;

-- Insert THIEF (The Contrarian)
INSERT INTO user_cappers (
  user_id,
  capper_id,
  display_name,
  description,
  color_theme,
  sport,
  bet_types,
  factor_config,
  execution_interval_minutes,
  execution_priority,
  is_active,
  is_system_capper
) VALUES (
  NULL,
  'thief',
  'THIEF',
  'Steal value. Fade the public, find value in overreactions. Emphasizes underlying metrics the public overlooks.',
  'purple',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["paceIndex", "netRating", "shooting", "homeAwayDiff", "restDays", "injuryImpact"],
      "weights": {
        "paceIndex": 50,
        "netRating": 80,
        "shooting": 60,
        "homeAwayDiff": 20,
        "restDays": 20,
        "injuryImpact": 20
      }
    },
    "SPREAD": {
      "enabled_factors": ["recentForm", "paceMismatch", "offDefBalance", "homeCourtEdge", "clutchPerformance", "injuryImpact"],
      "weights": {
        "recentForm": 10,
        "paceMismatch": 50,
        "offDefBalance": 80,
        "homeCourtEdge": 10,
        "clutchPerformance": 80,
        "injuryImpact": 20
      }
    }
  }'::JSONB,
  20,
  3,
  true,
  true
) ON CONFLICT (capper_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN user_cappers.is_system_capper IS 
'Indicates if this is an official system capper (SHIVA, IFRIT, SENTINEL, NEXUS, BLITZ, TITAN, THIEF) vs user-created capper';

-- Note: Execution schedules will be auto-created by the trigger 'trigger_create_capper_execution_schedules'
-- which fires on INSERT to user_cappers and creates entries in capper_execution_schedules

