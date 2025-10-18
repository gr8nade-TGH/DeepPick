-- ═══════════════════════════════════════════════════════════
-- CRITICAL DATA INTEGRITY FIXES
-- ═══════════════════════════════════════════════════════════
-- These changes fix timezone handling, game matching, and status tracking

-- ───────────────────────────────────────────────────────────
-- 1. ADD API EVENT ID (Prevents Duplicate Games)
-- ───────────────────────────────────────────────────────────
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS api_event_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_games_api_event_id ON games(api_event_id);

COMMENT ON COLUMN games.api_event_id IS 'Unique event ID from The Odds API - used for reliable game matching';

-- ───────────────────────────────────────────────────────────
-- 2. ADD TIMEZONE SUPPORT
-- ───────────────────────────────────────────────────────────
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

COMMENT ON COLUMN games.timezone IS 'Timezone for game start time (default: EST)';

-- ───────────────────────────────────────────────────────────
-- 3. ADD FULL TIMESTAMP (Better than separate date/time)
-- ───────────────────────────────────────────────────────────
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS game_start_timestamp TIMESTAMP WITH TIME ZONE;

-- Populate from existing game_date and game_time
UPDATE games 
SET game_start_timestamp = (game_date || ' ' || game_time)::TIMESTAMP WITH TIME ZONE
WHERE game_start_timestamp IS NULL AND game_date IS NOT NULL AND game_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_start_timestamp ON games(game_start_timestamp);

COMMENT ON COLUMN games.game_start_timestamp IS 'Full timestamp with timezone for accurate game start time';

-- ───────────────────────────────────────────────────────────
-- 4. ADD STATUS TRANSITION TRACKING
-- ───────────────────────────────────────────────────────────
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS status_last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN games.status_last_updated IS 'When the game status was last changed';

-- ───────────────────────────────────────────────────────────
-- 5. ADD DATA QUALITY FLAGS
-- ───────────────────────────────────────────────────────────
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS data_quality_warnings TEXT[];

COMMENT ON COLUMN games.data_quality_warnings IS 'Array of warnings like "low_bookmaker_count", "extreme_odds"';

-- ───────────────────────────────────────────────────────────
-- 6. IMPROVE ODDS HISTORY TRACKING
-- ───────────────────────────────────────────────────────────
ALTER TABLE odds_history 
  ADD COLUMN IF NOT EXISTS bookmaker_count INTEGER;

COMMENT ON COLUMN odds_history.bookmaker_count IS 'Number of bookmakers that provided odds for this snapshot';

-- ───────────────────────────────────────────────────────────
-- 7. ADD PICK GRADING METADATA
-- ───────────────────────────────────────────────────────────
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS grading_details JSONB;

COMMENT ON COLUMN picks.graded_at IS 'When the pick was graded (won/lost/push determined)';
COMMENT ON COLUMN picks.grading_details IS 'Details about how pick was graded (final score, margin, etc)';

-- ───────────────────────────────────────────────────────────
-- 8. CREATE GAME STATUS HISTORY TABLE
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT DEFAULT 'system',
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_game_status_history_game_id ON game_status_history(game_id);
CREATE INDEX IF NOT EXISTS idx_game_status_history_changed_at ON game_status_history(changed_at DESC);

COMMENT ON TABLE game_status_history IS 'Tracks all status changes for games (scheduled → live → final)';

-- Enable RLS
ALTER TABLE game_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to game_status_history" ON game_status_history FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────
-- 9. CREATE FUNCTION TO UPDATE GAME STATUS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_game_status(
  p_game_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_old_status FROM games WHERE id = p_game_id;
  
  -- Only update if status changed
  IF v_old_status IS DISTINCT FROM p_new_status THEN
    -- Update game
    UPDATE games 
    SET 
      status = p_new_status,
      status_last_updated = NOW(),
      updated_at = NOW()
    WHERE id = p_game_id;
    
    -- Log status change
    INSERT INTO game_status_history (game_id, old_status, new_status, reason)
    VALUES (p_game_id, v_old_status, p_new_status, p_reason);
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_game_status IS 'Updates game status and logs the change to history';

-- ───────────────────────────────────────────────────────────
-- 10. CREATE VIEW FOR GAMES WITH COMPUTED STATUS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW games_with_computed_status AS
SELECT 
  g.*,
  CASE 
    WHEN g.game_start_timestamp IS NULL THEN g.status
    WHEN NOW() < g.game_start_timestamp THEN 'scheduled'
    WHEN NOW() >= g.game_start_timestamp AND NOW() < (g.game_start_timestamp + INTERVAL '4 hours') THEN 'live'
    WHEN g.home_score IS NOT NULL AND g.away_score IS NOT NULL THEN 'final'
    ELSE g.status
  END AS computed_status,
  EXTRACT(EPOCH FROM (g.game_start_timestamp - NOW())) / 60 AS minutes_until_start,
  EXTRACT(EPOCH FROM (NOW() - g.game_start_timestamp)) / 60 AS minutes_since_start
FROM games g;

COMMENT ON VIEW games_with_computed_status IS 'Games with auto-computed status based on timestamps';

-- ═══════════════════════════════════════════════════════════
-- ✅ MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════
-- Next steps:
-- 1. Update simple-ingest to store api_event_id
-- 2. Update simple-ingest to convert UTC times to EST
-- 3. Update capper algorithms to check game_start_timestamp
-- 4. Update score fetch to use computed_status
-- ═══════════════════════════════════════════════════════════

