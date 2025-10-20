-- Check if SHIVA v1 tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('runs', 'factors', 'odds_snapshots', 'insight_cards', 'idempotency_keys')
ORDER BY table_name;

-- If tables don't exist, run the migrations manually
-- This is a check script - the actual migrations are in supabase/migrations/
