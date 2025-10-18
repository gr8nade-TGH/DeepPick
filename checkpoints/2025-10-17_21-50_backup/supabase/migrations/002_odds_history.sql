-- Create odds_history table to track odds changes over time
CREATE TABLE IF NOT EXISTS odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  odds JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries by game_id and time
CREATE INDEX IF NOT EXISTS idx_odds_history_game_id ON odds_history(game_id);
CREATE INDEX IF NOT EXISTS idx_odds_history_captured_at ON odds_history(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_odds_history_game_time ON odds_history(game_id, captured_at DESC);

-- Add RLS policies
ALTER TABLE odds_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to odds_history"
  ON odds_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to odds_history"
  ON odds_history FOR ALL
  TO service_role
  USING (true);

