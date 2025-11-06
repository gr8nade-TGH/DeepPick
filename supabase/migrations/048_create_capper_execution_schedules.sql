-- Migration: Create capper_execution_schedules table
-- Purpose: Centralized scheduling for all capper pick generation
-- Replaces individual cron jobs with database-driven orchestration

CREATE TABLE IF NOT EXISTS capper_execution_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Capper identification
  capper_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  
  -- Scheduling configuration
  enabled BOOLEAN DEFAULT true,
  interval_minutes INTEGER NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher priority executes first when multiple are due
  
  -- Execution tracking
  last_execution_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  last_execution_status TEXT, -- 'success', 'failure', 'skipped'
  last_execution_error TEXT,
  
  -- Statistics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique schedule per capper/sport/bet_type combination
  CONSTRAINT unique_capper_schedule UNIQUE (capper_id, sport, bet_type)
);

-- Index for finding due schedules efficiently
CREATE INDEX idx_capper_schedules_next_execution 
ON capper_execution_schedules (next_execution_at) 
WHERE enabled = true;

-- Index for capper lookup
CREATE INDEX idx_capper_schedules_capper_id 
ON capper_execution_schedules (capper_id);

-- Function to update next_execution_at based on interval
CREATE OR REPLACE FUNCTION update_next_execution_time()
RETURNS TRIGGER AS $$
BEGIN
  -- If last_execution_at is updated, calculate next_execution_at
  IF NEW.last_execution_at IS DISTINCT FROM OLD.last_execution_at THEN
    NEW.next_execution_at := NEW.last_execution_at + (NEW.interval_minutes || ' minutes')::INTERVAL;
  END IF;
  
  -- Always update updated_at
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update next_execution_at
CREATE TRIGGER trigger_update_next_execution
BEFORE UPDATE ON capper_execution_schedules
FOR EACH ROW
EXECUTE FUNCTION update_next_execution_time();

-- Insert initial schedules for SHIVA
-- These replace the current cron jobs in vercel.json

-- SHIVA TOTAL picks (currently runs every 6 minutes)
INSERT INTO capper_execution_schedules (
  capper_id,
  sport,
  bet_type,
  enabled,
  interval_minutes,
  priority,
  next_execution_at
) VALUES (
  'SHIVA',
  'NBA',
  'TOTAL',
  true,
  6,
  10, -- High priority
  NOW() -- Start immediately
) ON CONFLICT (capper_id, sport, bet_type) DO NOTHING;

-- SHIVA SPREAD picks (currently runs every 8 minutes)
INSERT INTO capper_execution_schedules (
  capper_id,
  sport,
  bet_type,
  enabled,
  interval_minutes,
  priority,
  10, -- High priority
  NOW() -- Start immediately
) VALUES (
  'SHIVA',
  'NBA',
  'SPREAD',
  true,
  8,
  10,
  NOW()
) ON CONFLICT (capper_id, sport, bet_type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE capper_execution_schedules IS 
'Centralized scheduling table for capper pick generation. Replaces individual cron jobs with database-driven orchestration.';

COMMENT ON COLUMN capper_execution_schedules.priority IS 
'Higher priority executes first when multiple schedules are due. Range: 0-100. Default: 0.';

COMMENT ON COLUMN capper_execution_schedules.interval_minutes IS 
'How often to execute this capper (in minutes). Example: 6 = every 6 minutes.';

COMMENT ON COLUMN capper_execution_schedules.next_execution_at IS 
'Timestamp when this schedule is next due to execute. Auto-calculated by trigger.';

