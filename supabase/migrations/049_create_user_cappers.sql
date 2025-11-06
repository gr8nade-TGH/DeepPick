-- Migration 049: Create user_cappers table for user-created automated cappers
-- This enables users to create their own cappers with custom factor configurations

-- Create user_cappers table
CREATE TABLE IF NOT EXISTS user_cappers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  capper_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  color_theme TEXT DEFAULT 'blue',
  sport TEXT NOT NULL,
  bet_types TEXT[] NOT NULL,
  factor_config JSONB NOT NULL,
  execution_interval_minutes INTEGER NOT NULL DEFAULT 15,
  execution_priority INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  is_system_capper BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_capper_id CHECK (capper_id ~ '^[a-z0-9_-]+$'),
  CONSTRAINT valid_sport CHECK (sport IN ('NBA', 'NFL', 'MLB', 'NHL')),
  CONSTRAINT valid_bet_types CHECK (bet_types <@ ARRAY['TOTAL', 'SPREAD', 'MONEYLINE']::TEXT[]),
  CONSTRAINT valid_interval CHECK (execution_interval_minutes >= 5 AND execution_interval_minutes <= 1440),
  CONSTRAINT valid_priority CHECK (execution_priority >= 1 AND execution_priority <= 10)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_cappers_user_id ON user_cappers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cappers_capper_id ON user_cappers(capper_id);
CREATE INDEX IF NOT EXISTS idx_user_cappers_is_active ON user_cappers(is_active);
CREATE INDEX IF NOT EXISTS idx_user_cappers_sport ON user_cappers(sport);

-- Add comments
COMMENT ON TABLE user_cappers IS 'User-created automated cappers with custom factor configurations';
COMMENT ON COLUMN user_cappers.capper_id IS 'Unique identifier for the capper (lowercase, alphanumeric, hyphens, underscores)';
COMMENT ON COLUMN user_cappers.display_name IS 'Human-readable name shown in UI';
COMMENT ON COLUMN user_cappers.factor_config IS 'JSONB containing enabled factors and their weights';
COMMENT ON COLUMN user_cappers.is_system_capper IS 'True for built-in cappers (SHIVA, etc.), false for user-created';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_cappers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_cappers_updated_at
BEFORE UPDATE ON user_cappers
FOR EACH ROW
EXECUTE FUNCTION update_user_cappers_updated_at();

-- Create function to auto-create execution schedules when capper is created
CREATE OR REPLACE FUNCTION create_capper_execution_schedules()
RETURNS TRIGGER AS $$
DECLARE
  bet_type_item TEXT;
BEGIN
  -- For each bet type, create a schedule entry
  FOREACH bet_type_item IN ARRAY NEW.bet_types
  LOOP
    INSERT INTO capper_execution_schedules (
      capper_id,
      sport,
      bet_type,
      enabled,
      interval_minutes,
      priority,
      next_execution_at
    ) VALUES (
      NEW.capper_id,
      NEW.sport,
      bet_type_item,
      NEW.is_active,
      NEW.execution_interval_minutes,
      NEW.execution_priority,
      NOW() + (NEW.execution_interval_minutes || ' minutes')::INTERVAL
    )
    ON CONFLICT (capper_id, sport, bet_type) DO UPDATE
    SET
      enabled = NEW.is_active,
      interval_minutes = NEW.execution_interval_minutes,
      priority = NEW.execution_priority,
      updated_at = NOW();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_capper_schedules
AFTER INSERT OR UPDATE ON user_cappers
FOR EACH ROW
EXECUTE FUNCTION create_capper_execution_schedules();

-- Create function to delete execution schedules when capper is deleted
CREATE OR REPLACE FUNCTION delete_capper_execution_schedules()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM capper_execution_schedules
  WHERE capper_id = OLD.capper_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_capper_schedules
BEFORE DELETE ON user_cappers
FOR EACH ROW
EXECUTE FUNCTION delete_capper_execution_schedules();

-- Insert SHIVA as a system capper (for reference)
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
  'shiva',
  'SHIVA',
  'Advanced statistical analysis system for NBA totals and spreads',
  'blue',
  'NBA',
  ARRAY['TOTAL', 'SPREAD']::TEXT[],
  '{
    "TOTAL": {
      "enabled_factors": ["F1", "F2", "F3", "F4", "F5"],
      "weights": {
        "F1": 1.0,
        "F2": 1.0,
        "F3": 1.0,
        "F4": 1.0,
        "F5": 1.0
      }
    },
    "SPREAD": {
      "enabled_factors": ["S1", "S2", "S3", "S4", "S5"],
      "weights": {
        "S1": 1.0,
        "S2": 1.0,
        "S3": 1.0,
        "S4": 1.0,
        "S5": 1.0
      }
    }
  }'::JSONB,
  6,
  10,
  true,
  true
)
ON CONFLICT (capper_id) DO NOTHING;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 049 complete: Created user_cappers table with auto-schedule triggers';
END $$;

