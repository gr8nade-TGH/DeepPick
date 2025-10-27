-- Add capper column to runs table
ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS capper TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_runs_capper ON public.runs(capper);

