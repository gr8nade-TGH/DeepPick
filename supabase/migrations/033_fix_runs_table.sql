-- Check if runs table exists, if not create it
CREATE TABLE IF NOT EXISTS public.runs (
  id TEXT PRIMARY KEY,
  run_id TEXT UNIQUE NOT NULL,
  game_id TEXT,
  state TEXT,
  current_step INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_runs_run_id ON public.runs(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_game_id ON public.runs(game_id);
CREATE INDEX IF NOT EXISTS idx_runs_state ON public.runs(state);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON public.runs(started_at);

-- Enable RLS
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on runs" ON public.runs
  FOR ALL USING (true);

