-- ============================================================================
-- DEEPPICK - COMPLETE DATABASE SETUP
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- Click "Run" to execute
-- ============================================================================

-- ============================================================================
-- PART 1: API MONITORING TABLES (Migration 008)
-- ============================================================================

-- Table: api_calls
CREATE TABLE IF NOT EXISTS api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  request_params JSONB,
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_status INTEGER,
  response_time_ms INTEGER,
  response_size_bytes INTEGER,
  events_received INTEGER DEFAULT 0,
  bookmakers_received TEXT[],
  sports_received TEXT[],
  data_snapshot JSONB,
  api_calls_remaining INTEGER,
  api_calls_used INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  error_details JSONB,
  triggered_by TEXT,
  triggered_by_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: data_ingestion_logs
CREATE TABLE IF NOT EXISTS data_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_call_id UUID REFERENCES api_calls(id) ON DELETE SET NULL,
  games_added INTEGER DEFAULT 0,
  games_updated INTEGER DEFAULT 0,
  games_skipped INTEGER DEFAULT 0,
  odds_history_records_created INTEGER DEFAULT 0,
  games_missing_odds INTEGER DEFAULT 0,
  games_missing_teams INTEGER DEFAULT 0,
  incomplete_records INTEGER DEFAULT 0,
  sport_breakdown JSONB,
  bookmaker_breakdown JSONB,
  processing_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  warnings TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: api_quota_tracking
CREATE TABLE IF NOT EXISTS api_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  total_events_received INTEGER DEFAULT 0,
  quota_limit INTEGER,
  quota_remaining INTEGER,
  quota_used_percentage DECIMAL(5,2),
  estimated_cost DECIMAL(10,2),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(api_provider, period_type, period_start)
);

-- Table: data_quality_metrics
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  hour INTEGER,
  total_games_tracked INTEGER DEFAULT 0,
  games_with_complete_odds INTEGER DEFAULT 0,
  games_with_all_bookmakers INTEGER DEFAULT 0,
  average_bookmakers_per_game DECIMAL(5,2),
  average_odds_age_minutes DECIMAL(10,2),
  oldest_odds_age_minutes INTEGER,
  sports_covered TEXT[],
  bookmakers_active TEXT[],
  api_success_rate DECIMAL(5,2),
  average_response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, hour)
);

-- Indexes for Part 1
CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_calls_provider ON api_calls(api_provider);
CREATE INDEX IF NOT EXISTS idx_api_calls_success ON api_calls(success);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_api_call ON data_ingestion_logs(api_call_id);
CREATE INDEX IF NOT EXISTS idx_quota_tracking_provider_period ON api_quota_tracking(api_provider, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_date ON data_quality_metrics(date DESC);

-- RLS for Part 1
ALTER TABLE api_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_quota_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to api_calls" ON api_calls;
CREATE POLICY "Allow public read access to api_calls"
  ON api_calls FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to api_calls" ON api_calls;
CREATE POLICY "Allow service role full access to api_calls"
  ON api_calls FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow public read access to data_ingestion_logs" ON data_ingestion_logs;
CREATE POLICY "Allow public read access to data_ingestion_logs"
  ON data_ingestion_logs FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to data_ingestion_logs" ON data_ingestion_logs;
CREATE POLICY "Allow service role full access to data_ingestion_logs"
  ON data_ingestion_logs FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow public read access to api_quota_tracking" ON api_quota_tracking;
CREATE POLICY "Allow public read access to api_quota_tracking"
  ON api_quota_tracking FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to api_quota_tracking" ON api_quota_tracking;
CREATE POLICY "Allow service role full access to api_quota_tracking"
  ON api_quota_tracking FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow public read access to data_quality_metrics" ON data_quality_metrics;
CREATE POLICY "Allow public read access to data_quality_metrics"
  ON data_quality_metrics FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to data_quality_metrics" ON data_quality_metrics;
CREATE POLICY "Allow service role full access to data_quality_metrics"
  ON data_quality_metrics FOR ALL TO service_role USING (true);

-- Function to update quota tracking
CREATE OR REPLACE FUNCTION update_api_quota()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_quota_tracking (
    api_provider, period_type, period_start, period_end,
    total_calls, successful_calls, failed_calls, total_events_received,
    quota_remaining, last_updated
  ) VALUES (
    NEW.api_provider, 'daily', CURRENT_DATE, CURRENT_DATE,
    1,
    CASE WHEN NEW.success THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    COALESCE(NEW.events_received, 0),
    NEW.api_calls_remaining, NOW()
  )
  ON CONFLICT (api_provider, period_type, period_start)
  DO UPDATE SET
    total_calls = api_quota_tracking.total_calls + 1,
    successful_calls = api_quota_tracking.successful_calls + CASE WHEN NEW.success THEN 1 ELSE 0 END,
    failed_calls = api_quota_tracking.failed_calls + CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    total_events_received = api_quota_tracking.total_events_received + COALESCE(NEW.events_received, 0),
    quota_remaining = COALESCE(NEW.api_calls_remaining, api_quota_tracking.quota_remaining),
    last_updated = NOW();
  
  INSERT INTO api_quota_tracking (
    api_provider, period_type, period_start, period_end,
    total_calls, successful_calls, failed_calls, total_events_received,
    quota_remaining, last_updated
  ) VALUES (
    NEW.api_provider, 'monthly',
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
    1,
    CASE WHEN NEW.success THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    COALESCE(NEW.events_received, 0),
    NEW.api_calls_remaining, NOW()
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

DROP TRIGGER IF EXISTS trigger_update_api_quota ON api_calls;
CREATE TRIGGER trigger_update_api_quota
  AFTER INSERT ON api_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_api_quota();

-- ============================================================================
-- PART 2: DATA FEED SETTINGS & CONTROL (Migration 009)
-- ============================================================================

-- Table: data_feed_settings
CREATE TABLE IF NOT EXISTS data_feed_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  api_provider TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  paused_until TIMESTAMPTZ,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 15,
  priority INTEGER NOT NULL DEFAULT 5,
  active_hours_start INTEGER,
  active_hours_end INTEGER,
  active_days TEXT[],
  season_start_month INTEGER,
  season_end_month INTEGER,
  max_calls_per_day INTEGER,
  max_calls_per_month INTEGER,
  current_daily_calls INTEGER DEFAULT 0,
  current_monthly_calls INTEGER DEFAULT 0,
  increase_frequency_before_games_hours INTEGER,
  reduced_frequency_after_hours INTEGER,
  api_endpoint TEXT,
  api_params JSONB,
  bookmakers TEXT[],
  markets TEXT[],
  last_successful_call TIMESTAMPTZ,
  last_failed_call TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: cron_job_status
CREATE TABLE IF NOT EXISTS cron_job_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_path TEXT NOT NULL,
  schedule TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_execution TIMESTAMPTZ,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  average_duration_ms INTEGER,
  expected_interval_minutes INTEGER NOT NULL,
  is_healthy BOOLEAN DEFAULT true,
  last_health_check TIMESTAMPTZ,
  alert_on_failure BOOLEAN DEFAULT true,
  alert_email TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: manual_triggers
CREATE TABLE IF NOT EXISTS manual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  source_name TEXT,
  triggered_by TEXT NOT NULL,
  success BOOLEAN,
  duration_ms INTEGER,
  result_message TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO data_feed_settings (source_name, source_type, api_provider, enabled, refresh_interval_minutes, priority, season_start_month, season_end_month, api_endpoint, bookmakers, markets, notes) VALUES
  ('odds_nfl', 'odds', 'the_odds_api', true, 30, 10, 9, 2, '/v4/sports/americanfootball_nfl/odds', ARRAY['draftkings', 'fanduel', 'williamhill_us', 'betmgm'], ARRAY['h2h', 'spreads', 'totals'], 'NFL season: September-February'),
  ('odds_nba', 'odds', 'the_odds_api', true, 30, 8, 10, 6, '/v4/sports/basketball_nba/odds', ARRAY['draftkings', 'fanduel', 'williamhill_us', 'betmgm'], ARRAY['h2h', 'spreads', 'totals'], 'NBA season: October-June'),
  ('odds_mlb', 'odds', 'the_odds_api', true, 30, 7, 4, 10, '/v4/sports/baseball_mlb/odds', ARRAY['draftkings', 'fanduel', 'williamhill_us', 'betmgm'], ARRAY['h2h', 'spreads', 'totals'], 'MLB season: April-October'),
  ('scores', 'scores', 'the_odds_api', true, 15, 9, NULL, NULL, '/v4/sports/{sport}/scores', NULL, NULL, 'Fetch scores for all active sports')
ON CONFLICT (source_name) DO NOTHING;

INSERT INTO cron_job_status (job_name, job_path, schedule, expected_interval_minutes, notes) VALUES
  ('auto-refresh-odds', '/api/auto-refresh-odds', '*/15 * * * *', 15, 'Fetches scores, archives games, ingests fresh odds'),
  ('auto-run-cappers', '/api/auto-run-cappers', '*/20 * * * *', 20, 'Runs all capper algorithms to generate picks')
ON CONFLICT (job_name) DO NOTHING;

-- Indexes for Part 2
CREATE INDEX IF NOT EXISTS idx_data_feed_settings_enabled ON data_feed_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_data_feed_settings_source_type ON data_feed_settings(source_type);
CREATE INDEX IF NOT EXISTS idx_cron_job_status_enabled ON cron_job_status(enabled);
CREATE INDEX IF NOT EXISTS idx_cron_job_status_health ON cron_job_status(is_healthy);
CREATE INDEX IF NOT EXISTS idx_manual_triggers_created ON manual_triggers(created_at DESC);

-- RLS for Part 2
ALTER TABLE data_feed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to data_feed_settings" ON data_feed_settings;
CREATE POLICY "Allow public read access to data_feed_settings"
  ON data_feed_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to data_feed_settings" ON data_feed_settings;
CREATE POLICY "Allow service role full access to data_feed_settings"
  ON data_feed_settings FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow public read access to cron_job_status" ON cron_job_status;
CREATE POLICY "Allow public read access to cron_job_status"
  ON cron_job_status FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to cron_job_status" ON cron_job_status;
CREATE POLICY "Allow service role full access to cron_job_status"
  ON cron_job_status FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow public read access to manual_triggers" ON manual_triggers;
CREATE POLICY "Allow public read access to manual_triggers"
  ON manual_triggers FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow service role full access to manual_triggers" ON manual_triggers;
CREATE POLICY "Allow service role full access to manual_triggers"
  ON manual_triggers FOR ALL TO service_role USING (true);

-- Helper Functions
CREATE OR REPLACE FUNCTION check_cron_health()
RETURNS void AS $$
DECLARE
  job RECORD;
  minutes_since_last_run INTEGER;
BEGIN
  FOR job IN SELECT * FROM cron_job_status WHERE enabled = true LOOP
    IF job.last_execution IS NOT NULL THEN
      minutes_since_last_run := EXTRACT(EPOCH FROM (NOW() - job.last_execution)) / 60;
      IF minutes_since_last_run > (job.expected_interval_minutes * 2) THEN
        UPDATE cron_job_status SET is_healthy = false, last_health_check = NOW() WHERE id = job.id;
      ELSE
        UPDATE cron_job_status SET is_healthy = true, last_health_check = NOW() WHERE id = job.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_cron_execution(
  p_job_name TEXT,
  p_success BOOLEAN,
  p_duration_ms INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE cron_job_status
  SET 
    last_execution = NOW(),
    last_success = CASE WHEN p_success THEN NOW() ELSE last_success END,
    last_failure = CASE WHEN NOT p_success THEN NOW() ELSE last_failure END,
    total_executions = total_executions + 1,
    successful_executions = successful_executions + CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_executions = failed_executions + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    average_duration_ms = COALESCE(
      (average_duration_ms * (total_executions - 1) + p_duration_ms) / total_executions,
      p_duration_ms
    ),
    updated_at = NOW()
  WHERE job_name = p_job_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION should_data_source_run(p_source_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  setting RECORD;
  current_hour INTEGER;
  current_day TEXT;
  current_month INTEGER;
BEGIN
  SELECT * INTO setting FROM data_feed_settings WHERE source_name = p_source_name;
  
  IF NOT FOUND OR NOT setting.enabled THEN RETURN false; END IF;
  IF setting.paused_until IS NOT NULL AND NOW() < setting.paused_until THEN RETURN false; END IF;
  IF setting.max_calls_per_day IS NOT NULL AND setting.current_daily_calls >= setting.max_calls_per_day THEN RETURN false; END IF;
  IF setting.max_calls_per_month IS NOT NULL AND setting.current_monthly_calls >= setting.max_calls_per_month THEN RETURN false; END IF;
  
  current_hour := EXTRACT(HOUR FROM NOW());
  IF setting.active_hours_start IS NOT NULL AND setting.active_hours_end IS NOT NULL THEN
    IF current_hour < setting.active_hours_start OR current_hour > setting.active_hours_end THEN RETURN false; END IF;
  END IF;
  
  current_day := LOWER(TO_CHAR(NOW(), 'Day'));
  IF setting.active_days IS NOT NULL AND NOT (current_day = ANY(setting.active_days)) THEN RETURN false; END IF;
  
  current_month := EXTRACT(MONTH FROM NOW());
  IF setting.season_start_month IS NOT NULL AND setting.season_end_month IS NOT NULL THEN
    IF setting.season_start_month > setting.season_end_month THEN
      IF current_month < setting.season_start_month AND current_month > setting.season_end_month THEN RETURN false; END IF;
    ELSE
      IF current_month < setting.season_start_month OR current_month > setting.season_end_month THEN RETURN false; END IF;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- You should see: "Success. No rows returned"
-- Check the tables exist: SELECT * FROM data_feed_settings;
-- ============================================================================

