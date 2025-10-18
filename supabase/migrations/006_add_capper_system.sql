-- Add capper system to picks table

-- Create capper enum
CREATE TYPE capper_type AS ENUM ('nexus', 'shiva', 'cerberus', 'ifrit', 'deeppick');

-- Add capper column to picks table
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS capper capper_type NOT NULL DEFAULT 'deeppick';

-- Create index for filtering by capper
CREATE INDEX IF NOT EXISTS idx_picks_capper ON picks(capper);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_picks_capper_status ON picks(capper, status);
CREATE INDEX IF NOT EXISTS idx_picks_capper_created ON picks(capper, created_at DESC);

-- Update existing picks to be from 'deeppick' (already default)
-- No action needed as default is set

COMMENT ON COLUMN picks.capper IS 'Which betting bot made this pick: nexus, shiva, cerberus, ifrit, or deeppick (ultimate)';

