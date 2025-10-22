-- Create SHIVA runs table for pipeline tracking
CREATE TABLE IF NOT EXISTS shiva_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('cron', 'manual', 'api')),
  request_id TEXT,
  game_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  error_code TEXT,
  error_message TEXT
);

-- Create SHIVA run steps table for detailed step tracking
CREATE TABLE IF NOT EXISTS shiva_run_steps (
  step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES shiva_runs(run_id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('STARTED', 'SUCCESS', 'FAILED')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_ms INT,
  details JSONB
);

-- Indexes for efficient querying
CREATE INDEX ON shiva_runs (started_at DESC);
CREATE INDEX ON shiva_runs (status, started_at DESC);
CREATE INDEX ON shiva_runs (game_id);
CREATE INDEX ON shiva_run_steps (run_id, started_at);

-- RLS policies
ALTER TABLE shiva_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shiva_run_steps ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to shiva runs" ON shiva_runs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access to shiva run steps" ON shiva_run_steps
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert for authenticated users
CREATE POLICY "Allow insert to shiva runs" ON shiva_runs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow insert to shiva run steps" ON shiva_run_steps
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
