-- Migration: Add excluded_teams support for user cappers
-- This allows cappers to exclude specific teams from auto-generation

-- Step 1: Add excluded_teams column to user_cappers table
ALTER TABLE user_cappers
ADD COLUMN IF NOT EXISTS excluded_teams JSONB DEFAULT '[]'::JSONB;

-- Add comment
COMMENT ON COLUMN user_cappers.excluded_teams IS 'Array of team abbreviations to exclude from auto-generation (e.g., ["LAL", "BOS"])';

-- Step 2: Update get_available_games_for_pick_generation to support excluded teams
-- This function is called by the orchestrator to find games for pick generation
CREATE OR REPLACE FUNCTION get_available_games_for_pick_generation(
  p_capper capper_type,
  p_bet_type TEXT DEFAULT 'TOTAL',
  p_cooldown_hours INTEGER DEFAULT 2,
  p_limit INTEGER DEFAULT 10,
  p_excluded_teams JSONB DEFAULT '[]'::JSONB  -- NEW: excluded teams array
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
    g.home_team->>'abbreviation' as home_team,
    g.away_team->>'abbreviation' as away_team,
    COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) as game_time,
    (g.odds->>'total_line')::DECIMAL(5,2) as total_line,
    (g.odds->>'spread_line')::DECIMAL(5,2) as spread_line
  FROM games g
  WHERE g.status IN ('scheduled', 'pre-game')
    AND COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) > NOW() + INTERVAL '1 hour'
    AND COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) < NOW() + INTERVAL '24 hours'
    AND can_generate_pick(g.id::TEXT, p_capper, p_bet_type, p_cooldown_hours)
    -- NEW: Filter out games where either team is in excluded_teams array
    AND NOT (
      (g.home_team->>'abbreviation')::TEXT = ANY(
        SELECT jsonb_array_elements_text(p_excluded_teams)
      )
      OR
      (g.away_team->>'abbreviation')::TEXT = ANY(
        SELECT jsonb_array_elements_text(p_excluded_teams)
      )
    )
  ORDER BY COALESCE(g.game_start_timestamp, (g.game_date::TEXT || 'T' || g.game_time::TEXT || 'Z')::TIMESTAMPTZ) ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_available_games_for_pick_generation IS 'Returns games available for pick generation, respecting cooldown periods, existing picks, and excluded teams';

-- Step 3: Create helper function to get excluded teams for a capper
CREATE OR REPLACE FUNCTION get_capper_excluded_teams(p_capper_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_excluded_teams JSONB;
BEGIN
  -- Get excluded teams from user_cappers table
  SELECT excluded_teams INTO v_excluded_teams
  FROM user_cappers
  WHERE capper_id = p_capper_id;
  
  -- Return empty array if not found
  RETURN COALESCE(v_excluded_teams, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_capper_excluded_teams IS 'Returns the excluded teams array for a given capper ID';

