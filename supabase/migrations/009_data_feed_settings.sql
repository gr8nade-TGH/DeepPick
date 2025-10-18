-- Data Feed Settings and Control System
-- Allows dynamic configuration of API calls, cron jobs, and data sources

-- Table: data_feed_settings
-- Stores configuration for each data source
CREATE TABLE IF NOT EXISTS data_feed_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Data Source Info
  source_name TEXT NOT NULL UNIQUE, -- 'odds_nfl', 'odds_nba', 'odds_mlb', 'scores', 'weather'
  source_type TEXT NOT NULL, -- 'odds', 'scores', 'weather', 'stats'
  api_provider TEXT NOT NULL, -- 'the_odds_api', 'weather_api', etc.
  
  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,
  paused_until TIMESTAMPTZ, -- Temporarily pause until this time
  
  -- Frequency Settings
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 15,
  priority INTEGER NOT NULL DEFAULT 5, -- 1-10, higher = more important
  
  -- Time-Based Rules
  active_hours_start INTEGER, -- 0-23, NULL = always active
  active_hours_end INTEGER, -- 0-23
  active_days TEXT[], -- ['monday', 'tuesday', ...], NULL = all days
  
  -- Season-Based Rules
  season_start_month INTEGER, -- 1-12, NULL = year-round
  season_end_month INTEGER, -- 1-12
  
  -- Rate Limiting
  max_calls_per_day INTEGER,
  max_calls_per_month INTEGER,
  current_daily_calls INTEGER DEFAULT 0,
  current_monthly_calls INTEGER DEFAULT 0,
  
  -- Smart Scheduling
  increase_frequency_before_games_hours INTEGER, -- Fetch more often X hours before games
  reduced_frequency_after_hours INTEGER, -- Reduce frequency if no games in X hours
  
  -- API Configuration
  api_endpoint TEXT,
  api_params JSONB, -- Query parameters
  bookmakers TEXT[], -- For odds feeds
  markets TEXT[], -- For odds feeds: ['h2h', 'spreads', 'totals']
  
  -- Metadata
  last_successful_call TIMESTAMPTZ,
  last_failed_call TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: cron_job_status
-- Tracks Vercel cron jobs and their execution
CREATE TABLE IF NOT EXISTS cron_job_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job Info
  job_name TEXT NOT NULL UNIQUE, -- 'auto-refresh-odds', 'auto-run-cappers'
  job_path TEXT NOT NULL, -- '/api/auto-refresh-odds'
  schedule TEXT NOT NULL, -- '*/15 * * * *'
  
  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_execution TIMESTAMPTZ,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ,
  
  -- Execution Stats
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  average_duration_ms INTEGER,
  
  -- Health Monitoring
  expected_interval_minutes INTEGER NOT NULL, -- How often it should run
  is_healthy BOOLEAN DEFAULT true, -- False if hasn't run in 2x expected interval
  last_health_check TIMESTAMPTZ,
  
  -- Alerts
  alert_on_failure BOOLEAN DEFAULT true,
  alert_email TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: manual_triggers
-- Log manual triggers from the control panel
CREATE TABLE IF NOT EXISTS manual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  trigger_type TEXT NOT NULL, -- 'refresh_odds', 'run_capper', 'fetch_scores'
  source_name TEXT, -- Which data source was triggered
  triggered_by TEXT NOT NULL, -- 'user', 'system', 'alert'
  
  -- Result
  success BOOLEAN,
  duration_ms INTEGER,
  result_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings for each sport
INSERT INTO data_feed_settings (source_name, source_type, api_provider, enabled, refresh_interval_minutes, priority, season_start_month, season_end_month, api_endpoint, bookmakers, markets, notes) VALUES
  ('odds_nfl', 'odds', 'the_odds_api', true, 30, 10, 9, 2, '/v4/sports/americanfootball_nfl/odds', ARRAY['draftkings', 'fanduel', 'williamhill_us', 'betmgm'], ARRAY['h2h', 'spreads', 'totals'], 'NFL season: September-February'),
  ('odds_nba', 'odds', 'the_odds_api', true, 30, 8, 10, 6, '/v4/sports/basketball_nba/odds', ARRAY['draftkings', 'fanduel', 'williamhill_us', 'betmgm'], ARRAY['h2h', 'spreads', 'totals'], 'NBA season: October-June'),
  ('odds_mlb', 'odds', 'the_odds_api', true, 30, 7, 4, 10, '/v4/sports/baseball_mlb/odds', ARRAY['draftkings', 'fanduel', 'williamhill_us', 'betmgm'], ARRAY['h2h', 'spreads', 'totals'], 'MLB season: April-October'),
  ('scores', 'scores', 'the_odds_api', true, 15, 9, NULL, NULL, '/v4/sports/{sport}/scores', NULL, NULL, 'Fetch scores for all active sports')
ON CONFLICT (source_name) DO NOTHING;

-- Insert default cron job statuses
INSERT INTO cron_job_status (job_name, job_path, schedule, expected_interval_minutes, notes) VALUES
  ('auto-refresh-odds', '/api/auto-refresh-odds', '*/15 * * * *', 15, 'Fetches scores, archives games, ingests fresh odds'),
  ('auto-run-cappers', '/api/auto-run-cappers', '*/20 * * * *', 20, 'Runs all capper algorithms to generate picks')
ON CONFLICT (job_name) DO NOTHING;

-- Function to check cron job health
CREATE OR REPLACE FUNCTION check_cron_health()
RETURNS void AS $$
DECLARE
  job RECORD;
  minutes_since_last_run INTEGER;
BEGIN
  FOR job IN SELECT * FROM cron_job_status WHERE enabled = true LOOP
    IF job.last_execution IS NOT NULL THEN
      minutes_since_last_run := EXTRACT(EPOCH FROM (NOW() - job.last_execution)) / 60;
      
      -- Mark unhealthy if hasn't run in 2x expected interval
      IF minutes_since_last_run > (job.expected_interval_minutes * 2) THEN
        UPDATE cron_job_status
        SET is_healthy = false,
            last_health_check = NOW()
        WHERE id = job.id;
      ELSE
        UPDATE cron_job_status
        SET is_healthy = true,
            last_health_check = NOW()
        WHERE id = job.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update cron job execution stats
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

-- Function to reset daily call counters (run at midnight)
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE data_feed_settings
  SET current_daily_calls = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly call counters (run on 1st of month)
CREATE OR REPLACE FUNCTION reset_monthly_counters()
RETURNS void AS $$
BEGIN
  UPDATE data_feed_settings
  SET current_monthly_calls = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a data source should run now
CREATE OR REPLACE FUNCTION should_data_source_run(p_source_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  setting RECORD;
  current_hour INTEGER;
  current_day TEXT;
  current_month INTEGER;
BEGIN
  SELECT * INTO setting FROM data_feed_settings WHERE source_name = p_source_name;
  
  IF NOT FOUND OR NOT setting.enabled THEN
    RETURN false;
  END IF;
  
  -- Check if paused
  IF setting.paused_until IS NOT NULL AND NOW() < setting.paused_until THEN
    RETURN false;
  END IF;
  
  -- Check daily limit
  IF setting.max_calls_per_day IS NOT NULL AND setting.current_daily_calls >= setting.max_calls_per_day THEN
    RETURN false;
  END IF;
  
  -- Check monthly limit
  IF setting.max_calls_per_month IS NOT NULL AND setting.current_monthly_calls >= setting.max_calls_per_month THEN
    RETURN false;
  END IF;
  
  -- Check active hours
  current_hour := EXTRACT(HOUR FROM NOW());
  IF setting.active_hours_start IS NOT NULL AND setting.active_hours_end IS NOT NULL THEN
    IF current_hour < setting.active_hours_start OR current_hour > setting.active_hours_end THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check active days
  current_day := LOWER(TO_CHAR(NOW(), 'Day'));
  IF setting.active_days IS NOT NULL AND NOT (current_day = ANY(setting.active_days)) THEN
    RETURN false;
  END IF;
  
  -- Check season
  current_month := EXTRACT(MONTH FROM NOW());
  IF setting.season_start_month IS NOT NULL AND setting.season_end_month IS NOT NULL THEN
    -- Handle seasons that span year boundary (e.g., NFL: Sept-Feb)
    IF setting.season_start_month > setting.season_end_month THEN
      IF current_month < setting.season_start_month AND current_month > setting.season_end_month THEN
        RETURN false;
      END IF;
    ELSE
      IF current_month < setting.season_start_month OR current_month > setting.season_end_month THEN
        RETURN false;
      END IF;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_feed_settings_enabled ON data_feed_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_data_feed_settings_source_type ON data_feed_settings(source_type);
CREATE INDEX IF NOT EXISTS idx_cron_job_status_enabled ON cron_job_status(enabled);
CREATE INDEX IF NOT EXISTS idx_cron_job_status_health ON cron_job_status(is_healthy);
CREATE INDEX IF NOT EXISTS idx_manual_triggers_created ON manual_triggers(created_at DESC);

-- RLS Policies
ALTER TABLE data_feed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to data_feed_settings"
  ON data_feed_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to data_feed_settings"
  ON data_feed_settings FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Allow public read access to cron_job_status"
  ON cron_job_status FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to cron_job_status"
  ON cron_job_status FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Allow public read access to manual_triggers"
  ON manual_triggers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow service role full access to manual_triggers"
  ON manual_triggers FOR ALL
  TO service_role
  USING (true);

