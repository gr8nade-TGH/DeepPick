-- ═══════════════════════════════════════════════════════════
-- ENHANCED GAME DEDUPLICATION LOGIC
-- ═══════════════════════════════════════════════════════════
-- Prevents duplicate games using team matchup + date + status logic

-- ───────────────────────────────────────────────────────────
-- 1. ADD COMPOSITE UNIQUE CONSTRAINT FOR GAME DEDUPLICATION
-- ───────────────────────────────────────────────────────────

-- Add unique constraint on team matchup + date combination
-- This prevents duplicate games for the same teams on the same date
ALTER TABLE games 
  ADD CONSTRAINT IF NOT EXISTS games_unique_matchup_date 
  UNIQUE (
    (home_team->>'name'), 
    (away_team->>'name'), 
    game_date, 
    sport
  );

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_games_matchup_date 
ON games (
  (home_team->>'name'), 
  (away_team->>'name'), 
  game_date, 
  sport
);

COMMENT ON CONSTRAINT games_unique_matchup_date ON games IS 'Prevents duplicate games for same team matchup on same date';

-- ───────────────────────────────────────────────────────────
-- 2. CREATE FUNCTION FOR SMART GAME UPSERT
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_game_smart(
  p_sport TEXT,
  p_league TEXT,
  p_home_team JSONB,
  p_away_team JSONB,
  p_game_date DATE,
  p_game_time TIME,
  p_game_start_timestamp TIMESTAMP WITH TIME ZONE,
  p_status TEXT,
  p_odds JSONB,
  p_api_event_id TEXT DEFAULT NULL,
  p_venue TEXT DEFAULT NULL,
  p_weather JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_game_id UUID;
  v_existing_game RECORD;
  v_home_name TEXT;
  v_away_name TEXT;
  v_should_update BOOLEAN := FALSE;
BEGIN
  -- Extract team names for matching
  v_home_name := p_home_team->>'name';
  v_away_name := p_away_team->>'name';
  
  -- First, try to find by API event ID (most reliable)
  IF p_api_event_id IS NOT NULL THEN
    SELECT id, status INTO v_existing_game
    FROM games 
    WHERE api_event_id = p_api_event_id;
    
    IF FOUND THEN
      v_game_id := v_existing_game.id;
      -- Only update if game is still scheduled (not live/final)
      IF v_existing_game.status IN ('scheduled', 'postponed', 'cancelled') THEN
        v_should_update := TRUE;
      END IF;
    END IF;
  END IF;
  
  -- If not found by API event ID, try team matchup + date
  IF v_game_id IS NULL THEN
    SELECT id, status INTO v_existing_game
    FROM games 
    WHERE 
      (home_team->>'name') = v_home_name 
      AND (away_team->>'name') = v_away_name 
      AND game_date = p_game_date 
      AND sport = p_sport;
    
    IF FOUND THEN
      v_game_id := v_existing_game.id;
      -- Only update if game is still scheduled (not live/final)
      IF v_existing_game.status IN ('scheduled', 'postponed', 'cancelled') THEN
        v_should_update := TRUE;
      END IF;
    END IF;
  END IF;
  
  -- Update existing game if allowed
  IF v_should_update THEN
    UPDATE games SET
      odds = p_odds,
      status = p_status,
      game_start_timestamp = p_game_start_timestamp,
      api_event_id = COALESCE(p_api_event_id, api_event_id),
      venue = COALESCE(p_venue, venue),
      weather = COALESCE(p_weather, weather),
      updated_at = NOW()
    WHERE id = v_game_id;
    
    RAISE NOTICE 'Updated existing game % for % @ % on %', v_game_id, v_away_name, v_home_name, p_game_date;
  END IF;
  
  -- Insert new game if not found
  IF v_game_id IS NULL THEN
    v_game_id := gen_random_uuid();
    
    INSERT INTO games (
      id, sport, league, home_team, away_team, 
      game_date, game_time, game_start_timestamp,
      status, odds, api_event_id, venue, weather,
      created_at, updated_at
    ) VALUES (
      v_game_id, p_sport, p_league, p_home_team, p_away_team,
      p_game_date, p_game_time, p_game_start_timestamp,
      p_status, p_odds, p_api_event_id, p_venue, p_weather,
      NOW(), NOW()
    );
    
    RAISE NOTICE 'Created new game % for % @ % on %', v_game_id, v_away_name, v_home_name, p_game_date;
  END IF;
  
  RETURN v_game_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_game_smart IS 'Smart game upsert that prevents duplicates using team matchup + date + status logic';

-- ───────────────────────────────────────────────────────────
-- 3. CREATE FUNCTION TO CLEAN UP DUPLICATE GAMES
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_duplicate_games() RETURNS TABLE(
  duplicate_count INTEGER,
  kept_games INTEGER,
  removed_games INTEGER
) AS $$
DECLARE
  v_duplicate_count INTEGER := 0;
  v_kept_games INTEGER := 0;
  v_removed_games INTEGER := 0;
  v_game RECORD;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT 
      (home_team->>'name') as home_name,
      (away_team->>'name') as away_name,
      game_date,
      sport,
      COUNT(*) as game_count
    FROM games 
    GROUP BY (home_team->>'name'), (away_team->>'name'), game_date, sport
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Remove duplicates, keeping the earliest created game
  FOR v_game IN 
    SELECT 
      g.id,
      g.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY (home_team->>'name'), (away_team->>'name'), game_date, sport 
        ORDER BY created_at ASC
      ) as rn
    FROM games g
    WHERE EXISTS (
      SELECT 1 
      FROM games g2 
      WHERE 
        (g2.home_team->>'name') = (g.home_team->>'name')
        AND (g2.away_team->>'name') = (g.away_team->>'name')
        AND g2.game_date = g.game_date
        AND g2.sport = g.sport
        AND g2.id != g.id
    )
  LOOP
    IF v_game.rn = 1 THEN
      v_kept_games := v_kept_games + 1;
    ELSE
      -- Delete duplicate game (cascade will handle related records)
      DELETE FROM games WHERE id = v_game.id;
      v_removed_games := v_removed_games + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_duplicate_count, v_kept_games, v_removed_games;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_duplicate_games IS 'Removes duplicate games, keeping the earliest created game for each matchup';

-- ───────────────────────────────────────────────────────────
-- 4. CREATE VIEW FOR GAME DEDUPLICATION MONITORING
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW game_deduplication_status AS
SELECT 
  (home_team->>'name') as home_team,
  (away_team->>'name') as away_team,
  game_date,
  sport,
  COUNT(*) as game_count,
  MIN(created_at) as earliest_game,
  MAX(created_at) as latest_game,
  STRING_AGG(DISTINCT status, ', ') as statuses,
  STRING_AGG(DISTINCT api_event_id, ', ') as api_event_ids
FROM games 
GROUP BY (home_team->>'name'), (away_team->>'name'), game_date, sport
ORDER BY game_count DESC, game_date DESC;

COMMENT ON VIEW game_deduplication_status IS 'Shows potential duplicate games for monitoring';

-- ═══════════════════════════════════════════════════════════
-- ✅ ENHANCED DEDUPLICATION COMPLETE
-- ═══════════════════════════════════════════════════════════
-- Next steps:
-- 1. Update simple-ingest to use upsert_game_smart function
-- 2. Run cleanup_duplicate_games() to remove existing duplicates
-- 3. Monitor game_deduplication_status view
-- ═══════════════════════════════════════════════════════════
