-- Create odds_snapshots table for SHIVA v1
CREATE TABLE IF NOT EXISTS public.odds_snapshots (
    snapshot_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    start_time_utc TIMESTAMPTZ NOT NULL,
    captured_at_utc TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    books_considered INTEGER DEFAULT 0,
    moneyline JSONB,
    spread JSONB,
    total JSONB,
    raw_payload JSONB,
    payload_json JSONB NOT NULL, -- Main payload from API
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_run_id ON public.odds_snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_game_id ON public.odds_snapshots(game_id);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_captured_at ON public.odds_snapshots(captured_at_utc);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_sport ON public.odds_snapshots(sport);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_is_active ON public.odds_snapshots(is_active);

-- Add RLS (Row Level Security) if needed
ALTER TABLE public.odds_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on odds_snapshots" ON public.odds_snapshots
    FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE public.odds_snapshots IS 'Snapshots of odds data captured at specific points in time for SHIVA v1 pick generation';
COMMENT ON COLUMN public.odds_snapshots.run_id IS 'Reference to the SHIVA run this snapshot belongs to';
COMMENT ON COLUMN public.odds_snapshots.game_id IS 'Reference to the game this snapshot belongs to';
COMMENT ON COLUMN public.odds_snapshots.payload_json IS 'Main payload data from the API request';
COMMENT ON COLUMN public.odds_snapshots.is_active IS 'Whether this snapshot is currently active for the run';
COMMENT ON COLUMN public.odds_snapshots.raw_payload IS 'Complete raw odds data from all sportsbooks';
COMMENT ON COLUMN public.odds_snapshots.moneyline IS 'Processed moneyline odds data';
COMMENT ON COLUMN public.odds_snapshots.spread IS 'Processed spread odds data';
COMMENT ON COLUMN public.odds_snapshots.total IS 'Processed total/over-under odds data';
