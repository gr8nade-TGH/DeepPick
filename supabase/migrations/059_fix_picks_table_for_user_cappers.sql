-- Fix picks table to support user cappers
-- Change capper column from ENUM to TEXT to allow any capper_id

-- Step 1: Alter the column type from ENUM to TEXT
ALTER TABLE picks ALTER COLUMN capper TYPE TEXT USING capper::TEXT;

-- Step 2: Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_picks_capper ON picks(capper);

