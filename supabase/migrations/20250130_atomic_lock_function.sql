-- Create atomic lock acquisition function
-- This prevents race conditions where multiple cron instances try to acquire the lock simultaneously

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
  -- Try to get existing lock
  SELECT * INTO v_existing_lock
  FROM system_locks
  WHERE lock_key = p_lock_key
  FOR UPDATE NOWAIT; -- This will fail immediately if another transaction has the lock
  
  -- If we got here, we have the lock (or it doesn't exist)
  IF v_existing_lock IS NULL THEN
    -- No existing lock, create it
    INSERT INTO system_locks (lock_key, locked_at, locked_by, expires_at)
    VALUES (
      p_lock_key,
      NOW(),
      p_locked_by,
      NOW() + (p_timeout_seconds || ' seconds')::INTERVAL
    );
    v_lock_acquired := TRUE;
  ELSE
    -- Check if existing lock is expired
    IF v_existing_lock.expires_at < NOW() THEN
      -- Lock is expired, update it
      UPDATE system_locks
      SET locked_at = NOW(),
          locked_by = p_locked_by,
          expires_at = NOW() + (p_timeout_seconds || ' seconds')::INTERVAL,
          updated_at = NOW()
      WHERE lock_key = p_lock_key;
      v_lock_acquired := TRUE;
    ELSE
      -- Lock is still valid, cannot acquire
      v_lock_acquired := FALSE;
    END IF;
  END IF;
  
  RETURN v_lock_acquired;
  
EXCEPTION
  WHEN lock_not_available THEN
    -- Another transaction has the lock
    RETURN FALSE;
  WHEN OTHERS THEN
    -- Any other error
    RAISE NOTICE 'Error acquiring lock: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION acquire_shiva_lock(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_shiva_lock(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION acquire_shiva_lock(TEXT, TEXT, INTEGER) TO service_role;

