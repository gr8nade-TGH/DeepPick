-- Create MySportsFeeds cache table
-- This table stores team stats to persist across serverless function cold starts
-- Prevents rate limiting by caching data for 4 hours

CREATE TABLE IF NOT EXISTS mysportsfeeds_cache (
  cache_key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index on expires_at for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_mysportsfeeds_cache_expires_at 
  ON mysportsfeeds_cache(expires_at);

-- Comment on table
COMMENT ON TABLE mysportsfeeds_cache IS 'Cache for MySportsFeeds team stats to persist across serverless cold starts and prevent rate limiting';

-- Comment on columns
COMMENT ON COLUMN mysportsfeeds_cache.cache_key IS 'Format: {teamAbbrev}:{n} (e.g., BOS:10)';
COMMENT ON COLUMN mysportsfeeds_cache.data IS 'TeamFormData object with pace, ortg, drtg, etc.';
COMMENT ON COLUMN mysportsfeeds_cache.created_at IS 'When the cache entry was created';
COMMENT ON COLUMN mysportsfeeds_cache.expires_at IS 'When the cache entry expires (4 hours from created_at)';

