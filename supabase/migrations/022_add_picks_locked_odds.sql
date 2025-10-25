-- Add locked_odds column to picks table for consistent grading
ALTER TABLE picks ADD COLUMN locked_odds JSONB;

-- Add comment
COMMENT ON COLUMN picks.locked_odds IS 'Locked odds snapshot at time of pick generation for consistent grading';
