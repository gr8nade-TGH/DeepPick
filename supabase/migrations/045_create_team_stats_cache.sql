-- Create team_stats_cache table to persist MySportsFeeds team stats across serverless cold starts
-- This solves the rate limiting issue by caching team stats in the database instead of in-memory

CREATE TABLE IF NOT EXISTS team_stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team VARCHAR(10) NOT NULL,
  season VARCHAR(20) NOT NULL,
  limit_games INTEGER NOT NULL DEFAULT 10,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on team + season + limit to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_stats_cache_unique 
  ON team_stats_cache(team, season, limit_games);

-- Create index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_team_stats_cache_expires 
  ON team_stats_cache(expires_at);

-- Add RLS policies
ALTER TABLE team_stats_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role can manage team_stats_cache"
  ON team_stats_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read team_stats_cache"
  ON team_stats_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_team_stats_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM team_stats_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_team_stats_cache() TO service_role;

COMMENT ON TABLE team_stats_cache IS 'Caches MySportsFeeds team statistics to reduce API calls and avoid rate limiting';
COMMENT ON COLUMN team_stats_cache.team IS 'Team abbreviation (e.g., BOS, LAL)';
COMMENT ON COLUMN team_stats_cache.season IS 'NBA season (e.g., 2024-2025-regular or current)';
COMMENT ON COLUMN team_stats_cache.limit_games IS 'Number of games fetched (default: 10)';
COMMENT ON COLUMN team_stats_cache.data IS 'Cached team statistics data from MySportsFeeds API';
COMMENT ON COLUMN team_stats_cache.cached_at IS 'When the data was cached';
COMMENT ON COLUMN team_stats_cache.expires_at IS 'When the cache entry expires (typically cached_at + 60 minutes)';

