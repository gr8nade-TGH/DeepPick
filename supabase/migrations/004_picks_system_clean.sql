-- Drop existing objects if they exist (clean slate)
DROP TRIGGER IF EXISTS trigger_grade_picks ON games;
DROP FUNCTION IF EXISTS grade_picks_for_game();
DROP TABLE IF EXISTS picks CASCADE;

-- Create picks table for storing predictions
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  
  -- Pick details
  pick_type TEXT NOT NULL, -- 'moneyline', 'spread', 'total_over', 'total_under'
  selection TEXT NOT NULL, -- Team name or 'over'/'under'
  odds INTEGER NOT NULL, -- American odds (e.g., +567, -140)
  units DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  
  -- Game snapshot at time of pick
  game_snapshot JSONB NOT NULL, -- Store game details when pick was made
  
  -- Result tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'won', 'lost', 'push', 'cancelled'
  result JSONB, -- Stores grading details
  net_units DECIMAL(10, 2), -- Profit/loss in units
  
  -- Pick metadata
  is_system_pick BOOLEAN NOT NULL DEFAULT true, -- True if from algorithm, false if manual
  confidence DECIMAL(5, 2), -- 0-100 confidence score from algorithm
  reasoning TEXT, -- Why this pick was made
  algorithm_version TEXT, -- Which algorithm version made this pick
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_picks_game_id ON picks(game_id);
CREATE INDEX idx_picks_status ON picks(status);
CREATE INDEX idx_picks_is_system ON picks(is_system_pick);
CREATE INDEX idx_picks_created_at ON picks(created_at DESC);

-- Add RLS policies
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to picks"
  ON picks FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to picks"
  ON picks FOR ALL
  TO service_role
  USING (true);

-- Function to auto-grade picks when game gets a final score
CREATE OR REPLACE FUNCTION grade_picks_for_game()
RETURNS TRIGGER AS $$
DECLARE
  pick_record RECORD;
  pick_won BOOLEAN;
  payout DECIMAL(10, 2);
BEGIN
  -- Only grade when status changes to 'final' and we have a score
  IF NEW.status = 'final' AND NEW.final_score IS NOT NULL THEN
    
    -- Loop through all pending picks for this game
    FOR pick_record IN 
      SELECT * FROM picks 
      WHERE game_id = NEW.id 
      AND status = 'pending'
    LOOP
      pick_won := false;
      payout := 0;
      
      -- Grade based on pick type
      CASE pick_record.pick_type
        WHEN 'moneyline' THEN
          -- Check if selected team won
          IF pick_record.selection = NEW.home_team->>'name' AND NEW.final_score->>'winner' = 'home' THEN
            pick_won := true;
          ELSIF pick_record.selection = NEW.away_team->>'name' AND NEW.final_score->>'winner' = 'away' THEN
            pick_won := true;
          ELSIF NEW.final_score->>'winner' = 'tie' THEN
            -- Push on tie
            UPDATE picks 
            SET status = 'push',
                net_units = 0,
                graded_at = NOW(),
                result = jsonb_build_object(
                  'outcome', 'push',
                  'reason', 'Game ended in a tie'
                )
            WHERE id = pick_record.id;
            CONTINUE;
          END IF;
        
        -- Add more pick types here (spread, totals, etc.)
        ELSE
          -- Unknown pick type, skip
          CONTINUE;
      END CASE;
      
      -- Calculate payout
      IF pick_won THEN
        IF pick_record.odds > 0 THEN
          -- Positive odds: profit = (odds / 100) * units
          payout := (pick_record.odds::DECIMAL / 100.0) * pick_record.units;
        ELSE
          -- Negative odds: profit = (100 / abs(odds)) * units
          payout := (100.0 / ABS(pick_record.odds)::DECIMAL) * pick_record.units;
        END IF;
        
        UPDATE picks 
        SET status = 'won',
            net_units = payout,
            graded_at = NOW(),
            result = jsonb_build_object(
              'outcome', 'won',
              'payout', payout,
              'final_score', NEW.final_score
            )
        WHERE id = pick_record.id;
      ELSE
        UPDATE picks 
        SET status = 'lost',
            net_units = -pick_record.units,
            graded_at = NOW(),
            result = jsonb_build_object(
              'outcome', 'lost',
              'payout', -pick_record.units,
              'final_score', NEW.final_score
            )
        WHERE id = pick_record.id;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-grade picks
CREATE TRIGGER trigger_grade_picks
  AFTER UPDATE OF status, final_score ON games
  FOR EACH ROW
  EXECUTE FUNCTION grade_picks_for_game();

