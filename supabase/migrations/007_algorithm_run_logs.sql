-- Algorithm Run Logs
-- Tracks every time a capper algorithm runs (every 20 minutes)

CREATE TABLE algorithm_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run metadata
  capper TEXT NOT NULL, -- 'ifrit', 'nexus', 'shiva', 'cerberus', 'deeppick'
  trigger_type TEXT NOT NULL, -- 'manual', 'cron', 'api'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Run results
  status TEXT NOT NULL, -- 'running', 'success', 'error', 'no_games', 'no_picks'
  games_analyzed INTEGER DEFAULT 0,
  picks_generated INTEGER DEFAULT 0,
  picks_skipped INTEGER DEFAULT 0, -- Due to duplicates
  
  -- Details
  error_message TEXT,
  error_stack TEXT,
  
  -- Summary data
  summary JSONB, -- Stores detailed breakdown
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_algorithm_runs_capper ON algorithm_runs(capper);
CREATE INDEX idx_algorithm_runs_started_at ON algorithm_runs(started_at DESC);
CREATE INDEX idx_algorithm_runs_status ON algorithm_runs(status);
CREATE INDEX idx_algorithm_runs_capper_started ON algorithm_runs(capper, started_at DESC);

-- Add RLS policies
ALTER TABLE algorithm_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to algorithm_runs"
  ON algorithm_runs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to algorithm_runs"
  ON algorithm_runs FOR ALL
  TO service_role
  USING (true);

-- Create a view for recent runs
CREATE OR REPLACE VIEW recent_algorithm_runs AS
SELECT 
  id,
  capper,
  trigger_type,
  started_at,
  completed_at,
  duration_ms,
  status,
  games_analyzed,
  picks_generated,
  picks_skipped,
  error_message,
  summary
FROM algorithm_runs
ORDER BY started_at DESC
LIMIT 100;

-- Grant access to view
GRANT SELECT ON recent_algorithm_runs TO public;

