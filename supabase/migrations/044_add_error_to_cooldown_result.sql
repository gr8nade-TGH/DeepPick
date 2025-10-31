-- Add 'ERROR' to the result column CHECK constraint in pick_generation_cooldowns table
-- This allows cooldowns to be created for pipeline failures (missing odds data, etc.)

-- Ensure reason column exists (for storing error messages)
ALTER TABLE pick_generation_cooldowns
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Drop the existing constraint
ALTER TABLE pick_generation_cooldowns
  DROP CONSTRAINT IF EXISTS pick_generation_cooldowns_result_check;

-- Add the new constraint with 'ERROR' included
ALTER TABLE pick_generation_cooldowns
  ADD CONSTRAINT pick_generation_cooldowns_result_check
  CHECK (result IN ('PASS', 'PICK_GENERATED', 'ERROR'));

COMMENT ON COLUMN pick_generation_cooldowns.result IS 'Result of pick generation attempt: PASS (low confidence), PICK_GENERATED (pick created), ERROR (pipeline failure)';
COMMENT ON COLUMN pick_generation_cooldowns.reason IS 'Reason for PASS or ERROR result (e.g., "Low confidence: 2.3" or "No valid total line data available")';

