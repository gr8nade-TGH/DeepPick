-- Fix record_pick_generation_result to accept TEXT run_id instead of UUID
CREATE OR REPLACE FUNCTION record_pick_generation_result(
  p_run_id TEXT,
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
  
  -- Insert or update cooldown record (no longer updating shiva_runs since we're using runs table)
  INSERT INTO pick_generation_cooldowns (
    game_id, capper, bet_type, run_id, result, 
    units, confidence_score, cooldown_until
  ) VALUES (
    p_game_id, p_capper, p_bet_type, p_run_id::TEXT, p_result,
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
    
  -- Log success
  RAISE NOTICE 'Recorded pick generation result for game %, capper %, bet_type %, result %', p_game_id, p_capper, p_bet_type, p_result;
END;
$$ LANGUAGE plpgsql;

