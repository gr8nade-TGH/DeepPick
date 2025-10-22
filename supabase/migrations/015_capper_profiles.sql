-- Create capper_profiles table for storing factor configurations
CREATE TABLE IF NOT EXISTS capper_profiles (
  id TEXT PRIMARY KEY,
  capper_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique combination of capper_id, sport, bet_type for active profiles
  CONSTRAINT unique_active_profile UNIQUE (capper_id, sport, bet_type) 
    WHERE is_active = true
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_capper_profiles_lookup 
  ON capper_profiles (capper_id, sport, bet_type, is_active);

-- Create index for default profiles
CREATE INDEX IF NOT EXISTS idx_capper_profiles_default 
  ON capper_profiles (capper_id, sport, bet_type, is_default);

-- Add RLS policies
ALTER TABLE capper_profiles ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to capper profiles" ON capper_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert/update/delete for authenticated users (for now)
CREATE POLICY "Allow write access to capper profiles" ON capper_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_capper_profiles_updated_at 
  BEFORE UPDATE ON capper_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
