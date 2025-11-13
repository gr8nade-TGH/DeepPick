-- Migration 051: Add pick_mode, auto_generate_hours_before, and excluded_teams to user_cappers
-- This enables users to choose between manual, auto, or hybrid pick generation modes

-- Add new columns to user_cappers table
ALTER TABLE user_cappers
  ADD COLUMN IF NOT EXISTS pick_mode TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS auto_generate_hours_before INTEGER,
  ADD COLUMN IF NOT EXISTS excluded_teams TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add constraint for pick_mode
ALTER TABLE user_cappers
  ADD CONSTRAINT valid_pick_mode CHECK (pick_mode IN ('manual', 'auto', 'hybrid'));

-- Add constraint for auto_generate_hours_before (only required for auto/hybrid modes)
ALTER TABLE user_cappers
  ADD CONSTRAINT valid_auto_hours CHECK (
    (pick_mode = 'manual' AND auto_generate_hours_before IS NULL) OR
    (pick_mode IN ('auto', 'hybrid') AND auto_generate_hours_before >= 1 AND auto_generate_hours_before <= 48)
  );

-- Add comments
COMMENT ON COLUMN user_cappers.pick_mode IS 'Pick generation mode: manual (user picks only), auto (AI picks only), hybrid (both)';
COMMENT ON COLUMN user_cappers.auto_generate_hours_before IS 'For auto/hybrid modes: generate picks X hours before game start';
COMMENT ON COLUMN user_cappers.excluded_teams IS 'For auto/hybrid modes: teams to exclude from auto-generation (user will pick manually)';

-- Update existing cappers to have pick_mode = 'auto' and default settings
UPDATE user_cappers
SET 
  pick_mode = 'auto',
  auto_generate_hours_before = 4,
  excluded_teams = ARRAY[]::TEXT[]
WHERE pick_mode IS NULL;

