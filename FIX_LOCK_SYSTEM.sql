-- ============================================================================
-- FIX LOCK SYSTEM - Run this in Supabase SQL Editor
-- ============================================================================
-- This will create the system_locks table and atomic lock function
-- to prevent concurrent cron executions
-- ============================================================================

-- 1. Create system_locks table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_locks (
  lock_key TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_locks_expires_at ON system_locks(expires_at);

-- 3. Drop existing function if it exists (to ensure clean recreation)
DROP FUNCTION IF EXISTS acquire_shiva_lock(TEXT, TEXT, INTEGER);

-- 4. Create atomic lock acquisition function
CREATE OR REPLACE FUNCTION acquire_shiva_lock(
  p_lock_key TEXT,
  p_locked_by TEXT,
  p_timeout_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_lock RECORD;
  v_lock_acquired BOOLEAN := FALSE;
BEGIN
  -- Try to acquire lock atomically using FOR UPDATE NOWAIT
  BEGIN
    SELECT * INTO v_existing_lock
    FROM system_locks
    WHERE lock_key = p_lock_key
    FOR UPDATE NOWAIT;
    
    -- If we got here, we have the lock
    IF v_existing_lock IS NULL THEN
      -- No existing lock, create one
      INSERT INTO system_locks (lock_key, locked_at, locked_by, expires_at)
      VALUES (p_lock_key, NOW(), p_locked_by, NOW() + (p_timeout_seconds || ' seconds')::INTERVAL);
      v_lock_acquired := TRUE;
    ELSE
      -- Lock exists, check if expired
      IF v_existing_lock.expires_at < NOW() THEN
        -- Lock expired, update it
        UPDATE system_locks
        SET locked_at = NOW(), 
            locked_by = p_locked_by, 
            expires_at = NOW() + (p_timeout_seconds || ' seconds')::INTERVAL
        WHERE lock_key = p_lock_key;
        v_lock_acquired := TRUE;
      ELSE
        -- Lock is still active
        v_lock_acquired := FALSE;
      END IF;
    END IF;
    
    RETURN v_lock_acquired;
    
  EXCEPTION
    WHEN lock_not_available THEN
      -- Another transaction has the lock
      RETURN FALSE;
  END;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION acquire_shiva_lock(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_shiva_lock(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION acquire_shiva_lock(TEXT, TEXT, INTEGER) TO service_role;

-- 6. Verify the function was created
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  'Function created successfully!' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'acquire_shiva_lock';

-- 7. Verify the table was created
SELECT 
  table_name,
  'Table created successfully!' AS status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'system_locks';

