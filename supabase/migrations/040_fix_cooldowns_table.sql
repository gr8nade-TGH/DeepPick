-- Fix cooldowns table to accept TEXT run_id
ALTER TABLE pick_generation_cooldowns 
  DROP CONSTRAINT IF EXISTS pick_generation_cooldowns_run_id_fkey;

-- Change run_id column to TEXT 
ALTER TABLE pick_generation_cooldowns
  ALTER COLUMN run_id TYPE TEXT;

COMMENT ON COLUMN pick_generation_cooldowns.run_id IS 'Run ID as TEXT (e.g., shiva_1234567890_abc)';

