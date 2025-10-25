-- Add locked_odds column to runs table for pick grading
ALTER TABLE runs ADD COLUMN locked_odds JSONB;

-- Add comment
COMMENT ON COLUMN runs.locked_odds IS 'Locked odds snapshot at time of pick generation for consistent grading';
