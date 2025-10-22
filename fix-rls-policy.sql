-- Fix RLS policy for capper_profiles table
-- The current policy is too restrictive

-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to capper profiles" ON capper_profiles;
DROP POLICY IF EXISTS "Allow write access to capper profiles" ON capper_profiles;

-- Create more permissive policies for development
-- Allow all authenticated users to read
CREATE POLICY "Allow read access to capper profiles" ON capper_profiles
  FOR SELECT USING (true);

-- Allow all authenticated users to insert/update
CREATE POLICY "Allow write access to capper profiles" ON capper_profiles
  FOR ALL USING (true);

-- Also fix event_log policies
DROP POLICY IF EXISTS "Allow read access to event log" ON event_log;
DROP POLICY IF EXISTS "Allow insert to event log" ON event_log;

CREATE POLICY "Allow read access to event log" ON event_log
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to event log" ON event_log
  FOR INSERT WITH CHECK (true);

-- Fix shiva_runs policies
DROP POLICY IF EXISTS "Allow read access to shiva runs" ON shiva_runs;
DROP POLICY IF EXISTS "Allow insert to shiva runs" ON shiva_runs;

CREATE POLICY "Allow read access to shiva runs" ON shiva_runs
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to shiva runs" ON shiva_runs
  FOR INSERT WITH CHECK (true);

-- Fix shiva_run_steps policies
DROP POLICY IF EXISTS "Allow read access to shiva run steps" ON shiva_run_steps;
DROP POLICY IF EXISTS "Allow insert to shiva run steps" ON shiva_run_steps;

CREATE POLICY "Allow read access to shiva run steps" ON shiva_run_steps
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to shiva run steps" ON shiva_run_steps
  FOR INSERT WITH CHECK (true);
