-- Fix capper_profiles table - handle existing policies
-- Drop existing policies first
DROP POLICY IF EXISTS "Allow read access to capper profiles" ON capper_profiles;
DROP POLICY IF EXISTS "Allow write access to capper profiles" ON capper_profiles;

-- Recreate policies
CREATE POLICY "Allow read access to capper profiles" ON capper_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow write access to capper profiles" ON capper_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- Verify table exists and is accessible
SELECT COUNT(*) as table_exists FROM capper_profiles;
