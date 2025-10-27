-- Add total_line column to pick_generation_cooldowns table to track line changes
ALTER TABLE pick_generation_cooldowns 
ADD COLUMN IF NOT EXISTS total_line DECIMAL(5, 2);

COMMENT ON COLUMN pick_generation_cooldowns.total_line IS 'The total line at the time of the PASS. Used to allow retries if the line changes.';

