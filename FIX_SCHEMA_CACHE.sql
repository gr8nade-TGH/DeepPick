-- ============================================================================
-- CRITICAL FIX: Refresh Supabase Schema Cache & Verify Picks Table
-- ============================================================================
-- Run this in Supabase SQL Editor to fix the "run_id column not found" error
-- ============================================================================

-- STEP 1: Check current data types for run_id in both tables
SELECT
  'runs' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'runs'
  AND column_name = 'run_id'
UNION ALL
SELECT
  'picks' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'picks'
  AND column_name = 'run_id';

-- STEP 2: Check all columns in picks table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'picks'
ORDER BY ordinal_position;

-- STEP 3: Drop existing run_id column from picks if it exists (to recreate with correct type)
ALTER TABLE public.picks DROP COLUMN IF EXISTS run_id CASCADE;

-- STEP 4: Add run_id column with matching type from runs table
-- This will use the SAME type as runs.run_id (either TEXT or UUID)
DO $$
DECLARE
  runs_run_id_type TEXT;
BEGIN
  -- Get the data type of runs.run_id
  SELECT data_type INTO runs_run_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'runs'
    AND column_name = 'run_id';

  -- Add run_id column to picks with matching type
  IF runs_run_id_type = 'text' THEN
    ALTER TABLE public.picks ADD COLUMN run_id TEXT NULL;
  ELSIF runs_run_id_type = 'uuid' THEN
    ALTER TABLE public.picks ADD COLUMN run_id UUID NULL;
  ELSE
    RAISE EXCEPTION 'Unexpected data type for runs.run_id: %', runs_run_id_type;
  END IF;

  RAISE NOTICE 'Added run_id column to picks with type: %', runs_run_id_type;
END $$;

-- STEP 5: Add foreign key constraint
ALTER TABLE public.picks
ADD CONSTRAINT picks_run_id_fkey
FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE RESTRICT;

-- STEP 6: Create index
CREATE INDEX IF NOT EXISTS idx_picks_run_id ON public.picks(run_id);

-- STEP 7: Refresh Supabase schema cache
NOTIFY pgrst, 'reload schema';

-- STEP 8: Verify the column was added with correct type
SELECT
  'picks' as table_name,
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
-- - run_id column should exist with matching type from runs table
-- - Foreign key constraint should be created successfully
-- - Index idx_picks_run_id should exist
-- - Schema cache should be refreshed
-- ============================================================================

