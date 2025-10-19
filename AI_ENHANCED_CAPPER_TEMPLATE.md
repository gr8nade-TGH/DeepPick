### ai_research_runs table (NEW)
```sql
CREATE TABLE ai_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  capper TEXT, -- 'shiva', 'ifrit', etc.
  run_number INTEGER, -- 1, 2, or 3
  run_type TEXT, -- 'analytical', 'strategic', 'realtime_validation'
  factors JSONB, -- 2 factors per run
  validation_result JSONB, -- Only for run 3
  odds_at_run JSONB, -- Snapshot of odds when run executed
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(game_id, capper, run_number)
);

CREATE INDEX idx_ai_runs_game ON ai_research_runs(game_id);
CREATE INDEX idx_ai_runs_capper ON ai_research_runs(capper);
```
