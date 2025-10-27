-- Add missing columns to runs table
ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS bet_type TEXT;

ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS units NUMERIC;

ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS confidence NUMERIC;

ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS pick_type TEXT;

ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS selection TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_bet_type ON public.runs(bet_type);
CREATE INDEX IF NOT EXISTS idx_runs_pick_type ON public.runs(pick_type);
CREATE INDEX IF NOT EXISTS idx_runs_units ON public.runs(units);

