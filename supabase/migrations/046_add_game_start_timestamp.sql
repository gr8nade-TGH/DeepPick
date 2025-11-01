-- ═══════════════════════════════════════════════════════════
-- ADD GAME_START_TIMESTAMP TO GAMES TABLE
-- ═══════════════════════════════════════════════════════════
-- This fixes the critical timezone bug where game times were being
-- stored as separate DATE and TIME fields, losing timezone information.
-- 
-- The game_start_timestamp field stores the complete ISO-8601 timestamp
-- in UTC, which is what MySportsFeeds provides.

-- ───────────────────────────────────────────────────────────
-- 1. ADD GAME_START_TIMESTAMP COLUMN
-- ───────────────────────────────────────────────────────────

ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS game_start_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN games.game_start_timestamp IS 'Complete game start time in UTC (ISO-8601). This is the authoritative source for game timing.';

-- ───────────────────────────────────────────────────────────
-- 2. BACKFILL EXISTING GAMES
-- ───────────────────────────────────────────────────────────
-- Combine game_date and game_time to create game_start_timestamp
-- Assumes game_time is in UTC (which it should be from MySportsFeeds)

UPDATE games
SET game_start_timestamp = (game_date::TEXT || 'T' || game_time::TEXT || 'Z')::TIMESTAMPTZ
WHERE game_start_timestamp IS NULL
  AND game_date IS NOT NULL
  AND game_time IS NOT NULL;

-- ───────────────────────────────────────────────────────────
-- 3. CREATE INDEX FOR PERFORMANCE
-- ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_games_start_timestamp 
  ON games(game_start_timestamp);

-- ───────────────────────────────────────────────────────────
-- 4. UPDATE get_available_games_for_pick_generation FUNCTION
-- ───────────────────────────────────────────────────────────
-- Use game_start_timestamp instead of game_time for eligibility checks

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
    COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) as game_time,
    (g.odds->>'total_line')::DECIMAL(5,2) as total_line,
    (g.odds->>'spread_line')::DECIMAL(5,2) as spread_line
  FROM games g
  WHERE g.status IN ('scheduled', 'pre-game')
    AND COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) > NOW() + INTERVAL '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM picks p
      WHERE p.game_id = g.id
        AND p.capper = p_capper
        AND p.pick_type = p_bet_type
        AND p.status IN ('pending', 'won', 'lost', 'push')
    )
    AND NOT EXISTS (
      SELECT 1 FROM pick_generation_cooldowns c
      WHERE c.game_id = g.id
        AND c.capper = p_capper
        AND c.bet_type = p_bet_type
        AND c.cooldown_until > NOW()
    )
  ORDER BY COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_games_for_pick_generation IS 'Returns games eligible for pick generation, using game_start_timestamp for accurate timing';

