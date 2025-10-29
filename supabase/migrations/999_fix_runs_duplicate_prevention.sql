-- Fix runs table to prevent duplicate runs for the same game
-- This migration adds a unique constraint on (game_id, capper, bet_type) to prevent duplicates

-- Drop existing unique constraint if it exists (from migration 015)
DROP INDEX IF EXISTS uniq_runs_game_capper_active;

-- Step 1: Identify and log duplicate runs
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT game_id, capper, bet_type, COUNT(*) as cnt
    FROM runs
    WHERE game_id IS NOT NULL AND game_id != 'unknown'
    GROUP BY game_id, capper, bet_type
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Found % duplicate game/capper/bet_type combinations', duplicate_count;
END $$;

-- Step 2: Delete duplicate runs, keeping only the OLDEST one (first created)
-- This preserves the original run and removes subsequent duplicates
DELETE FROM runs
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY game_id, capper, bet_type
        ORDER BY created_at ASC, id ASC
      ) as rn
    FROM runs
    WHERE game_id IS NOT NULL AND game_id != 'unknown'
  ) ranked
  WHERE rn > 1
);

-- Step 3: Add unique constraint on (game_id, capper, bet_type) for all runs
-- This prevents multiple runs for the same game/capper/bet_type combination
CREATE UNIQUE INDEX IF NOT EXISTS uniq_runs_game_capper_bet_type
  ON runs (game_id, capper, bet_type)
  WHERE game_id IS NOT NULL AND game_id != 'unknown';

-- Add comment explaining the constraint
COMMENT ON INDEX uniq_runs_game_capper_bet_type IS 'Prevents duplicate runs for the same game/capper/bet_type combination';

