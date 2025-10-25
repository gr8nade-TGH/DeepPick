-- Capper Settings Table for DB-Driven Profiles
-- Stores active profile JSON by capper/sport

CREATE TABLE IF NOT EXISTS capper_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capper TEXT NOT NULL,
  sport TEXT NOT NULL,
  version TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  profile_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  
  -- Ensure only one active profile per (capper, sport)
  CONSTRAINT capper_settings_active_unique 
    UNIQUE (capper, sport, is_active) 
    WHERE is_active = true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_capper_settings_active 
  ON capper_settings(capper, sport, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_capper_settings_created 
  ON capper_settings(created_at DESC);

-- Comments
COMMENT ON TABLE capper_settings IS 'Stores capper profile configurations per sport';
COMMENT ON COLUMN capper_settings.profile_json IS 'JSON schema matching CapperProfile interface';
COMMENT ON COLUMN capper_settings.is_active IS 'Only one active profile per (capper, sport)';

