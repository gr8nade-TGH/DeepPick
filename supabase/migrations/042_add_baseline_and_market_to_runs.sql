-- Add baseline_avg and market_total columns to runs table
-- These columns store the matchup baseline (team1_PPG + team2_PPG) and market total line

ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS baseline_avg NUMERIC,
ADD COLUMN IF NOT EXISTS market_total NUMERIC;

-- Add index for filtering/sorting by these values
CREATE INDEX IF NOT EXISTS idx_runs_baseline_avg ON public.runs(baseline_avg);
CREATE INDEX IF NOT EXISTS idx_runs_market_total ON public.runs(market_total);

-- Add comment for documentation
COMMENT ON COLUMN public.runs.baseline_avg IS 'Matchup baseline = away team PPG + home team PPG (avg of last 5 games)';
COMMENT ON COLUMN public.runs.market_total IS 'Market total line averaged from sportsbooks (DraftKings, FanDuel, etc.)';

