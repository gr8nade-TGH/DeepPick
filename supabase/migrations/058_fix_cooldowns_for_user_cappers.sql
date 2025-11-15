-- Fix pick_generation_cooldowns table to support user cappers
-- Change capper column from ENUM to TEXT to allow any capper_id

-- Step 1: Drop dependent view
DROP VIEW IF EXISTS pick_generation_status CASCADE;

-- Step 2: Drop the existing column
ALTER TABLE pick_generation_cooldowns DROP COLUMN IF EXISTS capper CASCADE;

-- Step 3: Add the column back as TEXT
ALTER TABLE pick_generation_cooldowns ADD COLUMN capper TEXT NOT NULL;

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_cooldowns_capper ON pick_generation_cooldowns(capper);

-- Step 5: Update the check constraint to use the new TEXT column
-- First drop the old constraint if it exists
ALTER TABLE pick_generation_cooldowns DROP CONSTRAINT IF EXISTS pick_generation_cooldowns_check;

-- Add new constraint that checks game_id, capper, and bet_type combination
ALTER TABLE pick_generation_cooldowns
  ADD CONSTRAINT pick_generation_cooldowns_unique
  UNIQUE (game_id, capper, bet_type);

-- Step 6: Recreate the view if it existed (optional - can be done later if needed)

