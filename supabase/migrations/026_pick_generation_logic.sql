-- Enhanced pick generation logic for automated systems
-- This migration adds logic to prevent duplicate picks and manage PASS scenarios

-- Add capper column to shiva_runs table
ALTER TABLE shiva_runs 
  ADD COLUMN IF NOT EXISTS capper capper_type DEFAULT 'shiva';

-- Add pick generation result tracking
ALTER TABLE shiva_runs 
  ADD COLUMN IF NOT EXISTS pick_result TEXT CHECK (pick_result IN ('PICK_GENERATED', 'PASS', 'ERROR')),
  ADD COLUMN IF NOT EXISTS units_generated DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS pick_id UUID REFERENCES picks(id);

-- Create table to track PASS scenarios with cooldown logic
CREATE TABLE IF NOT EXISTS pick_generation_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  capper capper_type NOT NULL,
  bet_type TEXT NOT NULL, -- 'TOTAL', 'SPREAD', 'MONEYLINE'
  run_id UUID REFERENCES shiva_runs(run_id),
  result TEXT NOT NULL CHECK (result IN ('PASS', 'PICK_GENERATED')),
  units DECIMAL(10, 2) DEFAULT 0,
  confidence_score DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ NOT NULL,
  
  -- Ensure one record per game/capper/bet_type combination
  UNIQUE(game_id, capper, bet_type)
);

-- Create indexes for efficient querying
CREATE INDEX ON pick_generation_cooldowns (game_id, capper, bet_type);
CREATE INDEX ON pick_generation_cooldowns (cooldown_until);
CREATE INDEX ON pick_generation_cooldowns (created_at DESC);
CREATE INDEX ON shiva_runs (capper, game_id, created_at DESC);

-- Function to check if a game can be processed for pick generation
CREATE OR REPLACE FUNCTION can_generate_pick(
  p_game_id TEXT,
  p_capper capper_type,
  p_bet_type TEXT,
  p_cooldown_hours INTEGER DEFAULT 2
) RETURNS BOOLEAN AS $$
DECLARE
  existing_pick_count INTEGER;
  cooldown_record RECORD;
BEGIN
  -- Check if a pick already exists for this game/capper/bet_type
  SELECT COUNT(*) INTO existing_pick_count
  FROM picks 
  WHERE game_id = p_game_id::UUID 
    AND capper = p_capper 
    AND pick_type = p_bet_type
    AND status IN ('pending', 'won', 'lost', 'push');
  
  IF existing_pick_count > 0 THEN
    RETURN FALSE; -- Pick already exists
  END IF;
  
  -- Check cooldown period
  SELECT * INTO cooldown_record
  FROM pick_generation_cooldowns
  WHERE game_id = p_game_id 
    AND capper = p_capper 
    AND bet_type = p_bet_type
    AND cooldown_until > NOW();
  
  IF cooldown_record IS NOT NULL THEN
    RETURN FALSE; -- Still in cooldown period
  END IF;
  
  RETURN TRUE; -- Can generate pick
END;
$$ LANGUAGE plpgsql;

-- Function to record pick generation result
CREATE OR REPLACE FUNCTION record_pick_generation_result(
  p_run_id UUID,
  p_game_id TEXT,
  p_capper capper_type,
  p_bet_type TEXT,
  p_result TEXT,
  p_units DECIMAL(10, 2) DEFAULT 0,
  p_confidence DECIMAL(5, 2) DEFAULT NULL,
  p_pick_id UUID DEFAULT NULL,
  p_cooldown_hours INTEGER DEFAULT 2
) RETURNS VOID AS $$
DECLARE
  cooldown_until TIMESTAMPTZ;
BEGIN
  -- Calculate cooldown period
  cooldown_until := NOW() + (p_cooldown_hours || ' hours')::INTERVAL;
  
  -- Update shiva_runs with result
  UPDATE shiva_runs 
  SET pick_result = p_result,
      units_generated = p_units,
      confidence_score = p_confidence,
      pick_id = p_pick_id,
      completed_at = NOW(),
      status = CASE 
        WHEN p_result = 'ERROR' THEN 'FAILED'
        ELSE 'SUCCESS'
      END
  WHERE run_id = p_run_id;
  
  -- Insert or update cooldown record
  INSERT INTO pick_generation_cooldowns (
    game_id, capper, bet_type, run_id, result, 
    units, confidence_score, cooldown_until
  ) VALUES (
    p_game_id, p_capper, p_bet_type, p_run_id, p_result,
    p_units, p_confidence, cooldown_until
  )
  ON CONFLICT (game_id, capper, bet_type) 
  DO UPDATE SET
    run_id = EXCLUDED.run_id,
    result = EXCLUDED.result,
    units = EXCLUDED.units,
    confidence_score = EXCLUDED.confidence_score,
    created_at = NOW(),
    cooldown_until = EXCLUDED.cooldown_until;
END;
$$ LANGUAGE plpgsql;

-- Function to get available games for pick generation
CREATE OR REPLACE FUNCTION get_available_games_for_pick_generation(
  p_capper capper_type,
  p_bet_type TEXT DEFAULT 'TOTAL',
  p_cooldown_hours INTEGER DEFAULT 2,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  game_id TEXT,
  home_team TEXT,
  away_team TEXT,
  game_time TIMESTAMPTZ,
  total_line DECIMAL(5,2),
  spread_line DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id::TEXT as game_id,
    g.home_team->>'name' as home_team,
    g.away_team->>'name' as away_team,
    g.start_time as game_time,
    g.odds->>'total_line'::DECIMAL(5,2) as total_line,
    g.odds->>'spread_line'::DECIMAL(5,2) as spread_line
  FROM games g
  WHERE g.status IN ('scheduled', 'pre-game')
    AND g.start_time > NOW() + INTERVAL '1 hour' -- At least 1 hour before game
    AND g.start_time < NOW() + INTERVAL '24 hours' -- Within next 24 hours
    AND can_generate_pick(g.id::TEXT, p_capper, p_bet_type, p_cooldown_hours)
  ORDER BY g.start_time ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for new table
ALTER TABLE pick_generation_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to pick generation cooldowns" ON pick_generation_cooldowns
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert to pick generation cooldowns" ON pick_generation_cooldowns
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE pick_generation_cooldowns IS 'Tracks pick generation attempts and cooldown periods to prevent duplicate picks and excessive API calls';
COMMENT ON FUNCTION can_generate_pick IS 'Checks if a game can be processed for pick generation based on existing picks and cooldown periods';
COMMENT ON FUNCTION record_pick_generation_result IS 'Records the result of a pick generation run and sets appropriate cooldown periods';
COMMENT ON FUNCTION get_available_games_for_pick_generation IS 'Returns games available for pick generation, respecting cooldown periods and existing picks';
