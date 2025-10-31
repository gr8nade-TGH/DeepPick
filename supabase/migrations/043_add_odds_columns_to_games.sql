-- Add missing odds columns to games table
-- These columns are used by SHIVA v1 for quick access to current lines

-- Add total_line column
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS total_line DECIMAL(5, 2);

-- Add spread_line column  
ALTER TABLE games
ADD COLUMN IF NOT EXISTS spread_line DECIMAL(5, 2);

-- Add moneyline columns
ALTER TABLE games
ADD COLUMN IF NOT EXISTS home_ml INTEGER;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS away_ml INTEGER;

-- Add comments
COMMENT ON COLUMN games.total_line IS 'Current total line (over/under) for the game';
COMMENT ON COLUMN games.spread_line IS 'Current spread line for the game (absolute value)';
COMMENT ON COLUMN games.home_ml IS 'Current moneyline odds for home team (American format)';
COMMENT ON COLUMN games.away_ml IS 'Current moneyline odds for away team (American format)';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_games_total_line ON games(total_line) WHERE total_line IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_spread_line ON games(spread_line) WHERE spread_line IS NOT NULL;

-- Migrate existing data from odds JSONB column if it exists
UPDATE games
SET 
  total_line = COALESCE(
    (odds->>'total_line')::DECIMAL(5,2),
    (odds->'total'->>'line')::DECIMAL(5,2)
  ),
  spread_line = COALESCE(
    (odds->>'spread_line')::DECIMAL(5,2),
    (odds->'spread'->>'line')::DECIMAL(5,2),
    ABS((odds->'spread'->>'line')::DECIMAL(5,2))
  ),
  home_ml = COALESCE(
    (odds->>'home_ml')::INTEGER,
    (odds->'moneyline'->>'home')::INTEGER
  ),
  away_ml = COALESCE(
    (odds->>'away_ml')::INTEGER,
    (odds->'moneyline'->>'away')::INTEGER
  )
WHERE odds IS NOT NULL
  AND (total_line IS NULL OR spread_line IS NULL OR home_ml IS NULL OR away_ml IS NULL);

