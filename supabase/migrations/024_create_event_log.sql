-- Create event_log table for unified telemetry
CREATE TABLE IF NOT EXISTS event_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  source TEXT NOT NULL CHECK (source IN ('api', 'pipeline', 'db', 'external')),
  route TEXT,
  request_id TEXT,
  run_id TEXT,
  step TEXT,
  capper TEXT,
  status TEXT CHECK (status IN ('STARTED', 'SUCCESS', 'FAILED')),
  code TEXT,
  http_status INT,
  duration_ms INT,
  details JSONB
);

-- Indexes for efficient querying
CREATE INDEX ON event_log (ts DESC);
CREATE INDEX ON event_log (route, ts DESC);
CREATE INDEX ON event_log (run_id);
CREATE INDEX ON event_log (status);
CREATE INDEX ON event_log (capper, step, ts DESC);
CREATE INDEX ON event_log (level, ts DESC);

-- RLS policies
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to event log" ON event_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert for authenticated users
CREATE POLICY "Allow insert to event log" ON event_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
