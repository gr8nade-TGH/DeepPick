-- Add factor data columns to runs table
ALTER TABLE public.runs 
  ADD COLUMN IF NOT EXISTS factor_contributions JSONB,
  ADD COLUMN IF NOT EXISTS factor_adjustments JSONB,
  ADD COLUMN IF NOT EXISTS predicted_total NUMERIC(10, 2);

-- Add index for JSONB column
CREATE INDEX IF NOT EXISTS idx_runs_predicted_total ON public.runs(predicted_total);

COMMENT ON COLUMN public.runs.factor_contributions IS 'Confidence contribution from each factor';
COMMENT ON COLUMN public.runs.factor_adjustments IS 'Point adjustments to predicted total from each factor';
COMMENT ON COLUMN public.runs.predicted_total IS 'Predicted total score for totals bets';

