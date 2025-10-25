-- Migration 013: Bipolar Factor System with Full Transparency
-- This enables sophisticated factor analysis with -5 to +5 scoring per factor

-- ============================================================================
-- PICK FACTORS TABLE
-- ============================================================================
-- Stores detailed breakdown of each factor that contributed to a pick
CREATE TABLE IF NOT EXISTS pick_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  capper VARCHAR(50) NOT NULL,
  
  -- Factor identification
  factor_name VARCHAR(255) NOT NULL,
  factor_category VARCHAR(50) NOT NULL, -- 'vegas', 'form', 'matchup', 'context', 'ai_research'
  factor_weight DECIMAL(4,3) NOT NULL, -- Max possible contribution (e.g., 0.30 = 30%)
  
  -- Raw data (JSONB for flexibility)
  data_team_a JSONB, -- Your pick's team data
  data_team_b JSONB, -- Opponent's data
  data_context JSONB, -- Additional context (weather, injuries, etc.)
  
  -- Scoring (bipolar: -weight to +weight)
  raw_score DECIMAL(4,2) NOT NULL, -- -1.0 to +1.0 (before applying weight)
  weighted_score DECIMAL(4,2) NOT NULL, -- Actual contribution to confidence
  percentage INT, -- Contribution as percentage (for UI display)
  
  -- Transparency & reasoning
  reasoning TEXT NOT NULL,
  sources TEXT[], -- Where data came from
  
  -- StatMuse integration (if applicable)
  statmuse_query TEXT,
  statmuse_response TEXT,
  statmuse_failed BOOLEAN DEFAULT FALSE,
  
  -- Display
  display_order INT DEFAULT 0, -- Order to show factors in UI
  impact_type VARCHAR(20) NOT NULL, -- 'positive', 'negative', 'neutral'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast queries
  CONSTRAINT pick_factors_pick_id_fkey FOREIGN KEY (pick_id) REFERENCES picks(id) ON DELETE CASCADE
);

CREATE INDEX idx_pick_factors_pick_id ON pick_factors(pick_id);
CREATE INDEX idx_pick_factors_game_id ON pick_factors(game_id);
CREATE INDEX idx_pick_factors_capper ON pick_factors(capper);
CREATE INDEX idx_pick_factors_category ON pick_factors(factor_category);

COMMENT ON TABLE pick_factors IS 'Detailed factor breakdown with bipolar scoring (-5 to +5) showing exactly how confidence was calculated.';
COMMENT ON COLUMN pick_factors.raw_score IS 'Score before applying weight: -1.0 (strongly against) to +1.0 (strongly for)';
COMMENT ON COLUMN pick_factors.weighted_score IS 'Final contribution to confidence after applying factor weight';
COMMENT ON COLUMN pick_factors.data_team_a IS 'Raw data for the team being picked (JSON format for flexibility)';
COMMENT ON COLUMN pick_factors.data_team_b IS 'Raw data for the opponent team';

-- ============================================================================
-- UPDATE CAPPER_SETTINGS FOR SONAR-PRO
-- ============================================================================
-- Upgrade Shiva to use sonar-pro for deeper research
UPDATE capper_settings
SET 
  ai_model_run1 = 'sonar-pro',
  updated_at = NOW()
WHERE capper_name = 'shiva';

COMMENT ON UPDATE IS 'Upgraded Shiva to sonar-pro for deeper, more accurate research (cost: $0.003 vs $0.001)';

-- ============================================================================
-- BET SELECTION REASONING TABLE
-- ============================================================================
-- Stores why a specific bet type (spread/total/moneyline) was chosen
CREATE TABLE IF NOT EXISTS bet_selection_reasoning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL UNIQUE REFERENCES picks(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  
  -- Available bet options
  total_confidence DECIMAL(4,2),
  spread_confidence DECIMAL(4,2),
  moneyline_confidence DECIMAL(4,2),
  
  -- Selection reasoning
  selected_bet_type VARCHAR(20) NOT NULL, -- 'total', 'spread', 'moneyline'
  selection_reason TEXT NOT NULL, -- Why this bet was chosen
  
  -- Odds value consideration
  total_odds_value DECIMAL(4,2), -- How good are the total odds?
  spread_odds_value DECIMAL(4,2),
  moneyline_odds_value DECIMAL(4,2),
  
  -- Risk assessment
  risk_level VARCHAR(20), -- 'low', 'medium', 'high'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bet_selection_pick_id ON bet_selection_reasoning(pick_id);

COMMENT ON TABLE bet_selection_reasoning IS 'Explains why a specific bet type was chosen over alternatives, with confidence scores for each option.';

-- ============================================================================
-- SAMPLE DATA / TESTING
-- ============================================================================
-- This will help us test the new structure

-- Note: Actual data will be inserted by the algorithm during pick generation
-- The structure is ready for factors like:
--   - Vegas Edge Comparison (weight: 0.30, score: -3.0 to +3.0)
--   - Recent Form (weight: 0.15, score: -1.5 to +1.5)
--   - Head-to-Head History (weight: 0.10, score: -1.0 to +1.0)
--   - Offensive vs Defensive Matchup (weight: 0.15, score: -1.5 to +1.5)
--   - Injuries & Rest (weight: 0.10, score: -1.0 to +1.0)
--   - Home/Away Advantage (weight: 0.10, score: -1.0 to +1.0)
--   - Pace/Style Matchup (weight: 0.05, score: -0.5 to +0.5)
--   - Weather Impact (weight: 0.05, score: -0.5 to +0.5)

