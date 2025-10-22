-- Fix capper_profiles schema with proper constraints and validation
-- Drop existing table and recreate with proper structure
DROP TABLE IF EXISTS capper_profiles CASCADE;

-- Create capper_profiles with proper constraints
CREATE TABLE capper_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capper_code TEXT NOT NULL,               -- 'SHIVA'
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  label TEXT,
  config JSONB NOT NULL,                   -- validated in app (zod) & checks below
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX ON capper_profiles (capper_code, is_active);
CREATE INDEX ON capper_profiles (capper_code, version);

-- Constraint: ensure weights roughly sum to 1.0 (±0.05 tolerance)
ALTER TABLE capper_profiles
  ADD CONSTRAINT shiva_weights_reasonable
  CHECK ((config->>'weights_sum')::numeric BETWEEN 0.95 AND 1.05);

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

-- RLS policies
ALTER TABLE capper_profiles ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to capper profiles" ON capper_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow write access for authenticated users (for now)
CREATE POLICY "Allow write access to capper profiles" ON capper_profiles
  FOR ALL USING (auth.role() = 'authenticated');
