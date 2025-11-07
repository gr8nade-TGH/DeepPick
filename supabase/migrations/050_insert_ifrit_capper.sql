-- Migration 050: Insert IFRIT capper into user_cappers table
-- IFRIT is an aggressive high-variance capper that emphasizes offensive efficiency and pace

-- Insert IFRIT as a system capper
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
  'ifrit',
  'IFRIT',
  'Aggressive high-variance capper emphasizing offensive efficiency and pace',
  'red',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["F1", "F2", "F3", "F4", "F5"],
      "weights": {
        "F1": 1.5,
        "F2": 0.8,
        "F3": 1.3,
        "F4": 1.2,
        "F5": 0.7
      }
    },
    "SPREAD": {
      "enabled_factors": ["S1", "S2", "S3", "S4", "S5"],
      "weights": {
        "S1": 1.4,
        "S2": 1.1,
        "S3": 0.9,
        "S4": 1.3,
        "S5": 1.2
      }
    }
  }'::JSONB,
  7,
  8,
  true,
  true
)
ON CONFLICT (capper_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  color_theme = EXCLUDED.color_theme,
  sport = EXCLUDED.sport,
  bet_types = EXCLUDED.bet_types,
  factor_config = EXCLUDED.factor_config,
  execution_interval_minutes = EXCLUDED.execution_interval_minutes,
  execution_priority = EXCLUDED.execution_priority,
  is_active = EXCLUDED.is_active,
  is_system_capper = EXCLUDED.is_system_capper,
  updated_at = NOW();

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 050 complete: Inserted IFRIT capper with custom factor weights';
END $$;

