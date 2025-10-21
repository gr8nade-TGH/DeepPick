-- Phase 4: Confidence, Edge, and Calibration
-- Add edge fields to pick_results and create calibration_runs table

-- Add edge fields to pick_results table
ALTER TABLE pick_results 
ADD COLUMN IF NOT EXISTS edge_raw DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS edge_pct DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS conf_score DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'legacy_v1';

-- Create calibration_runs table
CREATE TABLE IF NOT EXISTS calibration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_version VARCHAR(50) NOT NULL,
  scaling_constant DECIMAL(10,4) NOT NULL,
  sample_size INTEGER NOT NULL,
  hit_rate_by_bin JSONB NOT NULL,
  r_squared DECIMAL(10,4),
  notes TEXT
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_calibration_runs_model_version 
ON calibration_runs(model_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pick_results_model_version 
ON pick_results(model_version, created_at DESC);

-- Add RLS policies
ALTER TABLE calibration_runs ENABLE ROW LEVEL SECURITY;

-- Allow read access to calibration runs
CREATE POLICY "Allow read access to calibration_runs" 
ON calibration_runs FOR SELECT 
USING (true);

-- Allow insert access to calibration runs (for API)
CREATE POLICY "Allow insert access to calibration_runs" 
ON calibration_runs FOR INSERT 
WITH CHECK (true);

-- Update pick_results policies to include new fields
CREATE POLICY "Allow read access to pick_results" 
ON pick_results FOR SELECT 
USING (true);

CREATE POLICY "Allow insert access to pick_results" 
ON pick_results FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update access to pick_results" 
ON pick_results FOR UPDATE 
USING (true);
