-- Create system_locks table for distributed locking
-- This prevents concurrent cron jobs or API calls from running simultaneously

CREATE TABLE IF NOT EXISTS system_locks (
  lock_key TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_system_locks_expires_at ON system_locks(expires_at);

-- Enable RLS (but allow all operations for now - this is a system table)
ALTER TABLE system_locks ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (system table)
CREATE POLICY "Allow all operations on system_locks" ON system_locks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE system_locks IS 'Distributed locking mechanism to prevent concurrent execution of cron jobs and critical operations';

