-- ============================================================================
-- VERIFY DATABASE SETUP FOR SHIVA AUTO-PICKS
-- ============================================================================
-- Run this in Supabase SQL Editor to verify all required tables and functions exist
-- ============================================================================

-- 1. Check if system_locks table exists
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'system_locks';

-- 2. Check if acquire_shiva_lock function exists
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE 
    WHEN p.proname IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'acquire_shiva_lock';

-- 3. Check if pick_generation_cooldowns table exists
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'pick_generation_cooldowns';

-- 4. Check if runs table exists
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'runs';

-- 5. Check if games table exists
SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'games';

-- 6. Count active NBA games
SELECT 
  COUNT(*) AS active_nba_games,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAS GAMES'
    ELSE '⚠️ NO GAMES'
  END AS status
FROM games
WHERE sport = 'NBA'
  AND status IN ('scheduled', 'pre-game', 'in-progress');

-- 7. Count recent SHIVA runs (last 24 hours)
SELECT 
  COUNT(*) AS runs_last_24h,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAS RUNS'
    ELSE '⚠️ NO RUNS'
  END AS status
FROM runs
WHERE capper = 'shiva'
  AND created_at > NOW() - INTERVAL '24 hours';

-- 8. Count active cooldowns
SELECT 
  COUNT(*) AS active_cooldowns,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ HAS ACTIVE COOLDOWNS'
    ELSE '✅ NO COOLDOWNS'
  END AS status
FROM pick_generation_cooldowns
WHERE capper = 'shiva'
  AND cooldown_until > NOW();

-- 9. Check for stale locks
SELECT 
  lock_key,
  locked_by,
  locked_at,
  expires_at,
  EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60 AS age_minutes,
  CASE 
    WHEN expires_at < NOW() THEN '⚠️ EXPIRED'
    ELSE '🔒 ACTIVE'
  END AS status
FROM system_locks
WHERE lock_key = 'shiva_auto_picks_lock';

-- 10. Show latest run details
SELECT 
  run_id,
  game_id,
  state,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS age_minutes
FROM runs
WHERE capper = 'shiva'
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- IF ANY TABLES/FUNCTIONS ARE MISSING, RUN THE FOLLOWING:
-- ============================================================================

-- Create system_locks table (if missing)
-- CREATE TABLE IF NOT EXISTS system_locks (
--   lock_key TEXT PRIMARY KEY,
--   locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   locked_by TEXT NOT NULL,
--   expires_at TIMESTAMPTZ NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Create acquire_shiva_lock function (if missing)
-- See FIX_LOCK_SYSTEM.sql for the full function definition

-- ============================================================================
-- TO CLEAR A STALE LOCK (if needed):
-- ============================================================================
-- DELETE FROM system_locks WHERE lock_key = 'shiva_auto_picks_lock';

-- ============================================================================
-- TO CLEAR ALL COOLDOWNS (for testing):
-- ============================================================================
-- DELETE FROM pick_generation_cooldowns WHERE capper = 'shiva';

