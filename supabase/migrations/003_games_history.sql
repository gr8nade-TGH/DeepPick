-- Create games_history table to store archived completed games
CREATE TABLE IF NOT EXISTS games_history (
  id UUID PRIMARY KEY,
  sport sport_type NOT NULL,
  league TEXT,
  home_team JSONB NOT NULL,
  away_team JSONB NOT NULL,
  game_date DATE NOT NULL,
  game_time TIME,
  status TEXT NOT NULL,
  final_score JSONB,
  venue TEXT,
  odds JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_games_history_sport ON games_history(sport);
CREATE INDEX IF NOT EXISTS idx_games_history_date ON games_history(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_history_archived ON games_history(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_history_status ON games_history(status);

-- Add RLS policies
ALTER TABLE games_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to games_history"
  ON games_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to games_history"
  ON games_history FOR ALL
  TO service_role
  USING (true);

-- Add final_score column to games table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'final_score'
  ) THEN
    ALTER TABLE games ADD COLUMN final_score JSONB;
  END IF;
END $$;

-- Add completed_at column to games table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE games ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

