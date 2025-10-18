-- ═══════════════════════════════════════════════════════════
-- DEEPPICK DATA FEED SETTINGS & MONITORING SYSTEM
-- ═══════════════════════════════════════════════════════════
-- Run this SQL in Supabase SQL Editor to create settings tables
-- This enables the Settings tab on the Monitoring page

-- ───────────────────────────────────────────────────────────
-- 1. DATA FEED SETTINGS TABLE
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_feed_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport sport_type NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  fetch_interval_minutes INTEGER DEFAULT 15,
  active_hours_start TIME DEFAULT '00:00:00',
  active_hours_end TIME DEFAULT '23:59:59',
  seasonal_start_month INTEGER, -- 1-12, NULL means always active
  seasonal_end_month INTEGER,   -- 1-12, NULL means always active
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system',
  CONSTRAINT valid_interval CHECK (fetch_interval_minutes >= 5 AND fetch_interval_minutes <= 1440),
  CONSTRAINT valid_months CHECK (
    (seasonal_start_month IS NULL AND seasonal_end_month IS NULL) OR
    (seasonal_start_month BETWEEN 1 AND 12 AND seasonal_end_month BETWEEN 1 AND 12)
  )
);

-- Insert default settings for each sport
INSERT INTO data_feed_settings (sport, enabled, fetch_interval_minutes, seasonal_start_month, seasonal_end_month)
VALUES 
  ('nfl', true, 15, 9, 2),    -- September to February
  ('nba', true, 15, 10, 6),   -- October to June
  ('mlb', true, 15, 3, 10),   -- March to October
  ('nhl', true, 15, 10, 6)    -- October to June
ON CONFLICT (sport) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 2. CRON JOB STATUS TABLE
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_job_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL, -- 'vercel_cron', 'manual_trigger', etc.
  last_run_timestamp TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT, -- 'success', 'failed', 'running'
  last_run_duration_ms INTEGER,
  next_scheduled_run TIMESTAMP WITH TIME ZONE,
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default cron jobs
INSERT INTO cron_job_status (job_name, job_type, enabled)
VALUES 
  ('odds_ingestion', 'vercel_cron', true),
  ('score_fetching', 'vercel_cron', true),
  ('archive_games', 'vercel_cron', true),
  ('nexus_algorithm', 'vercel_cron', true),
  ('shiva_algorithm', 'vercel_cron', true),
  ('cerberus_algorithm', 'vercel_cron', true),
  ('ifrit_algorithm', 'vercel_cron', true),
  ('deeppick_algorithm', 'vercel_cron', true)
ON CONFLICT (job_name) DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- 3. MANUAL TRIGGER LOG TABLE
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL, -- 'odds_ingestion', 'algorithm_run', etc.
  triggered_by TEXT DEFAULT 'dashboard_user',
  trigger_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  result_status TEXT, -- 'success', 'failed', 'pending'
  result_message TEXT,
  execution_time_ms INTEGER
);

-- ───────────────────────────────────────────────────────────
-- 4. ENABLE ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────
ALTER TABLE data_feed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_triggers ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────
-- 5. CREATE POLICIES (Allow all for now)
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to data_feed_settings" ON data_feed_settings;
CREATE POLICY "Allow all access to data_feed_settings" ON data_feed_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to cron_job_status" ON cron_job_status;
CREATE POLICY "Allow all access to cron_job_status" ON cron_job_status FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to manual_triggers" ON manual_triggers;
CREATE POLICY "Allow all access to manual_triggers" ON manual_triggers FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_data_feed_settings_sport ON data_feed_settings(sport);
CREATE INDEX IF NOT EXISTS idx_data_feed_settings_enabled ON data_feed_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_cron_job_status_name ON cron_job_status(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_status_enabled ON cron_job_status(enabled);
CREATE INDEX IF NOT EXISTS idx_manual_triggers_type ON manual_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_manual_triggers_timestamp ON manual_triggers(trigger_timestamp DESC);

-- ═══════════════════════════════════════════════════════════
-- ✅ SETUP COMPLETE!
-- ═══════════════════════════════════════════════════════════
-- After running this SQL:
-- 1. Deploy your code to Vercel (git push)
-- 2. Go to Monitoring page > Settings tab
-- 3. You can now control data fetch intervals per sport!
-- 4. Generate a Debug Report to see settings validation
-- ═══════════════════════════════════════════════════════════
