-- ═══════════════════════════════════════════════════════════
-- DEEPPICK SETTINGS SYSTEM - FIXED VERSION
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor

-- ───────────────────────────────────────────────────────────
-- STEP 1: Check what sport_type enum values exist
-- ───────────────────────────────────────────────────────────
-- First, let's see what we have
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'sport_type'
ORDER BY e.enumsortorder;

-- ───────────────────────────────────────────────────────────
-- STEP 2: Create tables using TEXT instead of enum (safer)
-- ───────────────────────────────────────────────────────────

-- Drop existing table if it has issues
DROP TABLE IF EXISTS data_feed_settings CASCADE;

CREATE TABLE data_feed_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL UNIQUE CHECK (sport IN ('nfl', 'nba', 'mlb', 'nhl', 'soccer')),
  enabled BOOLEAN DEFAULT true,
  fetch_interval_minutes INTEGER DEFAULT 15,
  active_hours_start TIME DEFAULT '00:00:00',
  active_hours_end TIME DEFAULT '23:59:59',
  seasonal_start_month INTEGER,
  seasonal_end_month INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system',
  CONSTRAINT valid_interval CHECK (fetch_interval_minutes >= 5 AND fetch_interval_minutes <= 1440),
  CONSTRAINT valid_months CHECK (
    (seasonal_start_month IS NULL AND seasonal_end_month IS NULL) OR
    (seasonal_start_month BETWEEN 1 AND 12 AND seasonal_end_month BETWEEN 1 AND 12)
  )
);

-- Insert default settings
INSERT INTO data_feed_settings (sport, enabled, fetch_interval_minutes, seasonal_start_month, seasonal_end_month)
VALUES 
  ('nfl', true, 15, 9, 2),
  ('nba', true, 15, 10, 6),
  ('mlb', true, 15, 3, 10),
  ('nhl', true, 15, 10, 6);

-- ───────────────────────────────────────────────────────────
-- STEP 3: Cron Job Status Table
-- ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS cron_job_status CASCADE;

CREATE TABLE cron_job_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  last_run_timestamp TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
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
  ('deeppick_algorithm', 'vercel_cron', true);

-- ───────────────────────────────────────────────────────────
-- STEP 4: Manual Triggers Table
-- ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS manual_triggers CASCADE;

CREATE TABLE manual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  triggered_by TEXT DEFAULT 'dashboard_user',
  trigger_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  result_status TEXT,
  result_message TEXT,
  execution_time_ms INTEGER
);

-- ───────────────────────────────────────────────────────────
-- STEP 5: Enable RLS
-- ───────────────────────────────────────────────────────────
ALTER TABLE data_feed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_triggers ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────
-- STEP 6: Create Policies
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to data_feed_settings" ON data_feed_settings;
CREATE POLICY "Allow all access to data_feed_settings" ON data_feed_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to cron_job_status" ON cron_job_status;
CREATE POLICY "Allow all access to cron_job_status" ON cron_job_status FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to manual_triggers" ON manual_triggers;
CREATE POLICY "Allow all access to manual_triggers" ON manual_triggers FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────
-- STEP 7: Create Indexes
-- ───────────────────────────────────────────────────────────
CREATE INDEX idx_data_feed_settings_sport ON data_feed_settings(sport);
CREATE INDEX idx_data_feed_settings_enabled ON data_feed_settings(enabled);
CREATE INDEX idx_cron_job_status_name ON cron_job_status(job_name);
CREATE INDEX idx_cron_job_status_enabled ON cron_job_status(enabled);
CREATE INDEX idx_manual_triggers_type ON manual_triggers(trigger_type);
CREATE INDEX idx_manual_triggers_timestamp ON manual_triggers(trigger_timestamp DESC);

-- ═══════════════════════════════════════════════════════════
-- ✅ DONE! Verify the tables were created:
-- ═══════════════════════════════════════════════════════════
SELECT 'data_feed_settings' as table_name, COUNT(*) as row_count FROM data_feed_settings
UNION ALL
SELECT 'cron_job_status', COUNT(*) FROM cron_job_status
UNION ALL
SELECT 'manual_triggers', COUNT(*) FROM manual_triggers;

-- You should see:
-- data_feed_settings: 4 rows
-- cron_job_status: 8 rows
-- manual_triggers: 0 rows

