-- ============================================================================
-- CRITICAL FIX: Refresh Supabase Schema Cache & Verify Picks Table
-- ============================================================================
-- Run this in Supabase SQL Editor to fix the "run_id column not found" error
-- ============================================================================

-- 1. Check if run_id column exists in picks table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'picks'
ORDER BY ordinal_position;

-- 2. If run_id column is missing, add it
ALTER TABLE public.picks 
ADD COLUMN IF NOT EXISTS run_id UUID NULL REFERENCES runs(run_id) ON DELETE RESTRICT;

-- 3. Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_picks_run_id ON public.picks(run_id);

-- 4. Refresh Supabase schema cache by running NOTIFY
NOTIFY pgrst, 'reload schema';

-- 5. Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'picks'
  AND column_name = 'run_id';

-- ============================================================================
-- Expected Output:
-- - run_id column should exist with type 'uuid' and is_nullable = 'YES'
-- - Index idx_picks_run_id should exist
-- - Schema cache should be refreshed
-- ============================================================================

