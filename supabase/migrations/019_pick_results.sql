-- Pick Results Table for Grading System
-- Stores grading outcomes, units delta, and learning notes

CREATE TABLE IF NOT EXISTS pick_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'push')),
  units_delta NUMERIC NOT NULL,
  final_score JSONB NOT NULL, -- { "home": 118, "away": 110 }
  explanation TEXT,
  factors_review JSONB, -- Suggested weight changes per factor
  result_insight_json JSONB, -- For Insight Card RESULTS section
  grading_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One result per pick
  CONSTRAINT pick_results_pick_unique UNIQUE (pick_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pick_results_pick 
  ON pick_results(pick_id);

CREATE INDEX IF NOT EXISTS idx_pick_results_result 
  ON pick_results(result);

CREATE INDEX IF NOT EXISTS idx_pick_results_created 
  ON pick_results(created_at DESC);

-- Comments
COMMENT ON TABLE pick_results IS 'Stores pick grading results and learning notes';
COMMENT ON COLUMN pick_results.result IS 'Outcome: win, loss, or push';
COMMENT ON COLUMN pick_results.units_delta IS 'Net units won (+) or lost (-)';
COMMENT ON COLUMN pick_results.factors_review IS 'Suggested factor weight adjustments for learning';

