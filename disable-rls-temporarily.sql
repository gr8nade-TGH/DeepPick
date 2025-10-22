-- Temporarily disable RLS on capper_profiles for testing
-- This is for development only - re-enable in production

ALTER TABLE capper_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE shiva_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE shiva_run_steps DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('capper_profiles', 'event_log', 'shiva_runs', 'shiva_run_steps');
