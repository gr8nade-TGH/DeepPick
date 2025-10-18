-- API Monitoring and Data Logging System
-- Tracks all external API calls, usage, and data quality

-- Table: api_calls
-- Logs every call to external APIs (The Odds API, future APIs)
CREATE TABLE IF NOT EXISTS api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- API Info
  api_provider TEXT NOT NULL, -- 'the_odds_api', 'weather_api', etc.
  endpoint TEXT NOT NULL, -- '/v4/sports/americanfootball_nfl/odds'
  method TEXT NOT NULL DEFAULT 'GET',
  
  -- Request Details
  request_params JSONB, -- Query parameters, filters
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Response Details
  response_status INTEGER, -- 200, 404, 429, etc.
  response_time_ms INTEGER, -- How long the call took
  response_size_bytes INTEGER, -- Size of response
  
  -- Data Received
  events_received INTEGER DEFAULT 0, -- Number of games/events in response
  bookmakers_received TEXT[], -- List of bookmakers in response
  sports_received TEXT[], -- List of sports in response
  data_snapshot JSONB, -- Sample of data (first event)
  
  -- Usage Tracking
  api_calls_remaining INTEGER, -- From response headers
  api_calls_used INTEGER, -- From response headers
  
  -- Status
  success BOOLEAN NOT NULL,
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  triggered_by TEXT, -- 'cron', 'manual', 'user_action'
  triggered_by_user_id UUID, -- If user-initiated
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: data_ingestion_logs
-- Tracks what data was actually stored from each API call
CREATE TABLE IF NOT EXISTS data_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_call_id UUID REFERENCES api_calls(id) ON DELETE SET NULL,
  
  -- Ingestion Details
  games_added INTEGER DEFAULT 0,
  games_updated INTEGER DEFAULT 0,
  games_skipped INTEGER DEFAULT 0,
  odds_history_records_created INTEGER DEFAULT 0,
  
  -- Data Quality
  games_missing_odds INTEGER DEFAULT 0,
  games_missing_teams INTEGER DEFAULT 0,
  incomplete_records INTEGER DEFAULT 0,
  
  -- Sport Breakdown
  sport_breakdown JSONB, -- { "nfl": 15, "nba": 20, "mlb": 10 }
  bookmaker_breakdown JSONB, -- { "draftkings": 45, "fanduel": 45 }
  
  -- Timing
  processing_time_ms INTEGER,
  
  -- Status
  success BOOLEAN NOT NULL,
  error_message TEXT,
  warnings TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: api_quota_tracking
-- Daily/monthly usage tracking
CREATE TABLE IF NOT EXISTS api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider TEXT NOT NULL,
  
  -- Time Period
  period_type TEXT NOT NULL, -- 'daily', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Usage Stats
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  total_events_received INTEGER DEFAULT 0,
  
  -- Quota Limits
  quota_limit INTEGER, -- e.g., 500 calls/month for Pro+
  quota_remaining INTEGER,
  quota_used_percentage DECIMAL(5,2),
  
  -- Cost Tracking (if applicable)
  estimated_cost DECIMAL(10,2),
  
  -- Metadata
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(api_provider, period_type, period_start)
);

-- Table: data_quality_metrics
-- Track data quality over time
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time Period
  date DATE NOT NULL,
  hour INTEGER, -- 0-23, NULL for daily aggregate
  
  -- Completeness Metrics
  total_games_tracked INTEGER DEFAULT 0,
  games_with_complete_odds INTEGER DEFAULT 0,
  games_with_all_bookmakers INTEGER DEFAULT 0,
  average_bookmakers_per_game DECIMAL(5,2),
  
  -- Freshness Metrics
  average_odds_age_minutes DECIMAL(10,2),
  oldest_odds_age_minutes INTEGER,
  
  -- Coverage Metrics
  sports_covered TEXT[],
  bookmakers_active TEXT[],
  
  -- Reliability Metrics
  api_success_rate DECIMAL(5,2),
  average_response_time_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(date, hour)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_calls_provider ON api_calls(api_provider);
CREATE INDEX IF NOT EXISTS idx_api_calls_success ON api_calls(success);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_api_call ON data_ingestion_logs(api_call_id);
CREATE INDEX IF NOT EXISTS idx_quota_tracking_provider_period ON api_quota_tracking(api_provider, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_date ON data_quality_metrics(date DESC);

-- RLS Policies
ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_quota_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to api_calls"
  ON api_calls FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to api_calls"
  ON api_calls FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Allow public read access to data_ingestion_logs"
  ON data_ingestion_logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to data_ingestion_logs"
  ON data_ingestion_logs FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Allow public read access to api_quota_tracking"
  ON api_quota_tracking FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to api_quota_tracking"
  ON api_quota_tracking FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Allow public read access to data_quality_metrics"
  ON data_quality_metrics FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to data_quality_metrics"
  ON data_quality_metrics FOR ALL
  TO service_role
  USING (true);

-- Function to update quota tracking
CREATE OR REPLACE FUNCTION update_api_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily quota
  INSERT INTO api_quota_tracking (
    api_provider,
    period_type,
    period_start,
    period_end,
    total_calls,
    successful_calls,
    failed_calls,
    total_events_received,
    quota_remaining,
    last_updated
  )
  VALUES (
    NEW.api_provider,
    'daily',
    CURRENT_DATE,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.success THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    COALESCE(NEW.events_received, 0),
    NEW.api_calls_remaining,
    NOW()
  )
  ON CONFLICT (api_provider, period_type, period_start)
  DO UPDATE SET
    total_calls = api_quota_tracking.total_calls + 1,
    successful_calls = api_quota_tracking.successful_calls + CASE WHEN NEW.success THEN 1 ELSE 0 END,
    failed_calls = api_quota_tracking.failed_calls + CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    total_events_received = api_quota_tracking.total_events_received + COALESCE(NEW.events_received, 0),
    quota_remaining = COALESCE(NEW.api_calls_remaining, api_quota_tracking.quota_remaining),
    last_updated = NOW();
  
  -- Update monthly quota
  INSERT INTO api_quota_tracking (
    api_provider,
    period_type,
    period_start,
    period_end,
    total_calls,
    successful_calls,
    failed_calls,
    total_events_received,
    quota_remaining,
    last_updated
  )
  VALUES (
    NEW.api_provider,
    'monthly',
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
    1,
    CASE WHEN NEW.success THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    COALESCE(NEW.events_received, 0),
    NEW.api_calls_remaining,
    NOW()
  )
  ON CONFLICT (api_provider, period_type, period_start)
  DO UPDATE SET
    total_calls = api_quota_tracking.total_calls + 1,
    successful_calls = api_quota_tracking.successful_calls + CASE WHEN NEW.success THEN 1 ELSE 0 END,
    failed_calls = api_quota_tracking.failed_calls + CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    total_events_received = api_quota_tracking.total_events_received + COALESCE(NEW.events_received, 0),
    quota_remaining = COALESCE(NEW.api_calls_remaining, api_quota_tracking.quota_remaining),
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update quota
CREATE TRIGGER trigger_update_api_quota
  AFTER INSERT ON api_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_api_quota();

