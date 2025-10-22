-- Fix capper_profiles schema to match existing API expectations
-- Drop and recreate with correct column names

DROP TABLE IF EXISTS capper_profiles CASCADE;

-- Create capper_profiles with column names that match existing API
CREATE TABLE capper_profiles (
  id TEXT PRIMARY KEY,
  capper_id TEXT NOT NULL,               -- matches existing API
  sport TEXT NOT NULL,
  bet_type TEXT NOT NULL,                -- matches existing API
  name TEXT,
  description TEXT,
  factors JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,  -- matches existing API
  is_default BOOLEAN NOT NULL DEFAULT false, -- matches existing API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX ON capper_profiles (capper_id, sport, bet_type, is_active);
CREATE INDEX ON capper_profiles (capper_id, is_active);

-- Update trigger
CREATE OR REPLACE FUNCTION set_updated_at() 
RETURNS TRIGGER AS $$
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

CREATE TRIGGER capper_profiles_updated
  BEFORE UPDATE ON capper_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Disable RLS for now (development only)
ALTER TABLE capper_profiles DISABLE ROW LEVEL SECURITY;

-- Insert a default profile to test
INSERT INTO capper_profiles (
  id, capper_id, sport, bet_type, name, description, 
  factors, is_active, is_default
) VALUES (
  'shiva-nba-total-default',
  'SHIVA',
  'NBA', 
  'TOTAL',
  'SHIVA NBA TOTAL Default',
  'Default factor configuration for SHIVA',
  '[
    {
      "key": "paceIndex",
      "name": "Matchup Pace Index",
      "description": "Expected game pace vs league average",
      "enabled": true,
      "weight": 20,
      "dataSource": "nba-stats-api",
      "maxPoints": 2,
      "sport": "NBA",
      "betType": "TOTAL",
      "scope": "matchup",
      "icon": "⏱️",
      "shortName": "Pace"
    }
  ]'::jsonb,
  true,
  true
);
