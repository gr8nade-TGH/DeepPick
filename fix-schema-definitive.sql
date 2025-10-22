-- DEFINITIVE FIX: Drop and recreate capper_profiles with correct schema
-- This will fix the schema mismatch once and for all

-- First, check what currently exists
SELECT 'BEFORE DROP - Current columns:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'capper_profiles' 
ORDER BY ordinal_position;

-- Drop the table completely (this will remove all data)
DROP TABLE IF EXISTS capper_profiles CASCADE;

-- Create the correct schema that matches the existing API
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

-- Create indexes
CREATE INDEX ON capper_profiles (capper_id, sport, bet_type, is_active);
CREATE INDEX ON capper_profiles (capper_id, is_active);

-- Create update trigger
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

-- Disable RLS for development
ALTER TABLE capper_profiles DISABLE ROW LEVEL SECURITY;

-- Insert a test record to verify it works
INSERT INTO capper_profiles (
  id, capper_id, sport, bet_type, name, description, 
  factors, is_active, is_default
) VALUES (
  'shiva-nba-total-test',
  'SHIVA',
  'NBA', 
  'TOTAL',
  'SHIVA NBA TOTAL Test',
  'Test factor configuration for SHIVA',
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

-- Verify the new schema
SELECT 'AFTER CREATE - New columns:' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'capper_profiles' 
ORDER BY ordinal_position;

-- Test that we can query the new table
SELECT 'TEST QUERY - Can we read the data?' as status;
SELECT id, capper_id, sport, bet_type, name, is_active 
FROM capper_profiles 
WHERE capper_id = 'SHIVA';
