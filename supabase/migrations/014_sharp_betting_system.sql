-- Migration 014: Sharp Betting System
-- Converts from abstract confidence scoring to professional sharp betting approach
-- Based on market-deviation, effect sizes, and expected value

-- ============================================================================
-- UPDATE PICK_FACTORS TABLE FOR SHARP BETTING
-- ============================================================================

-- Add new columns for sharp betting approach
ALTER TABLE pick_factors 
  ADD COLUMN IF NOT EXISTS effect_size DECIMAL(6,3),  -- Points or log-odds deviation from market
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20),  -- 'points' or 'log_odds'
  ADD COLUMN IF NOT EXISTS sample_size INT,  -- Number of data points used
  ADD COLUMN IF NOT EXISTS recency DECIMAL(3,2),  -- 0-1, how fresh the data is
  ADD COLUMN IF NOT EXISTS data_quality DECIMAL(3,2),  -- 0-1, confidence in data source
  ADD COLUMN IF NOT EXISTS reliability DECIMAL(3,2),  -- Calculated: sqrt(n_eff / (n_eff + k))
  ADD COLUMN IF NOT EXISTS learned_weight DECIMAL(4,2) DEFAULT 1.0,  -- From backtesting/ridge regression
  ADD COLUMN IF NOT EXISTS soft_cap DECIMAL(4,2),  -- Max absolute effect allowed
  ADD COLUMN IF NOT EXISTS contribution DECIMAL(6,3),  -- Final: clip(weight * effect, ±cap) * reliability
  ADD COLUMN IF NOT EXISTS market_baseline DECIMAL(8,2),  -- The market line this factor compares against
  ADD COLUMN IF NOT EXISTS residualized BOOLEAN DEFAULT FALSE;  -- Whether feature was residualized

COMMENT ON COLUMN pick_factors.effect_size IS 'Quantified deviation from market in points (spread/total) or log-odds (ML)';
COMMENT ON COLUMN pick_factors.unit IS 'Measurement unit: points for spread/total, log_odds for moneyline';
COMMENT ON COLUMN pick_factors.reliability IS 'Calculated reliability: sqrt(sample_size / (sample_size + shrinkage_k)) * recency * data_quality';
COMMENT ON COLUMN pick_factors.contribution IS 'Final contribution to prediction: clip(learned_weight * effect_size, ±soft_cap) * reliability';
COMMENT ON COLUMN pick_factors.residualized IS 'Whether this feature was residualized against the market to avoid double-counting';

-- ============================================================================
-- PREDICTION HEADS TABLE
-- ============================================================================
-- Three separate prediction heads: spread, total, moneyline
-- Each converts factor contributions → probability → expected value

CREATE TABLE IF NOT EXISTS prediction_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES picks(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  capper VARCHAR(50) NOT NULL,
  
  -- Bet type
  bet_type VARCHAR(20) NOT NULL,  -- 'spread', 'total', 'moneyline'
  
  -- Market baseline
  market_line DECIMAL(8,2),  -- Current market number (spread, total, or log-odds)
  market_odds INT,  -- American odds at the market line
  market_implied_prob DECIMAL(5,4),  -- Implied probability from market odds (vig-removed)
  
  -- Prediction
  predicted_deviation DECIMAL(6,3),  -- Sum of factor contributions
  true_line DECIMAL(8,2),  -- market_line + predicted_deviation
  
  -- Probability calculations
  cover_probability DECIMAL(5,4),  -- For spread/total: Φ(Δ / σ)
  win_probability DECIMAL(5,4),  -- For moneyline or derived from spread
  league_sigma DECIMAL(5,2),  -- League-specific stddev used (margins or totals)
  
  -- Expected value calculation
  offered_odds INT,  -- Actual odds available to bet
  offered_implied_prob DECIMAL(5,4),  -- Implied probability from offered odds
  decimal_payout DECIMAL(6,3),  -- Decimal payout multiplier
  expected_value DECIMAL(7,4),  -- EV = p * payout - (1-p) * stake
  ev_percentage DECIMAL(6,3),  -- EV as percentage for easier reading
  
  -- Gating & thresholds
  meets_deviation_threshold BOOLEAN,  -- e.g., |Δ| ≥ 0.75 for NBA spread
  meets_ev_threshold BOOLEAN,  -- e.g., EV ≥ +1.5% for spread
  meets_odds_threshold BOOLEAN,  -- e.g., avoid laying worse than -250
  overall_threshold_met BOOLEAN,  -- All gates passed
  threshold_reason TEXT,  -- Explanation of why passed/failed
  
  -- Ranking
  rank INT,  -- 1 = best EV among the three heads
  is_selected BOOLEAN DEFAULT FALSE,  -- Was this head chosen for the actual pick?
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prediction_heads_pick_id ON prediction_heads(pick_id);
CREATE INDEX idx_prediction_heads_game_id ON prediction_heads(game_id);
CREATE INDEX idx_prediction_heads_capper ON prediction_heads(capper);
CREATE INDEX idx_prediction_heads_bet_type ON prediction_heads(bet_type);

COMMENT ON TABLE prediction_heads IS 'Three prediction paths (spread/total/ML) each converting factor effects → probability → EV for sharp bet selection';
COMMENT ON COLUMN prediction_heads.predicted_deviation IS 'Sum of all factor contributions for this bet type, in appropriate units';
COMMENT ON COLUMN prediction_heads.expected_value IS 'EV = win_probability * decimal_payout - (1 - win_probability) [in units, not percentage]';
COMMENT ON COLUMN prediction_heads.ev_percentage IS 'Expected value as percentage for easier interpretation (EV * 100)';

-- ============================================================================
-- MARKET DEVIATIONS LOG TABLE
-- ============================================================================
-- Track how factors deviate from market over time for learning

CREATE TABLE IF NOT EXISTS market_deviations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  capper VARCHAR(50) NOT NULL,
  factor_name VARCHAR(255) NOT NULL,
  
  -- Market context
  bet_type VARCHAR(20) NOT NULL,
  market_line_at_prediction DECIMAL(8,2),
  market_line_at_game_time DECIMAL(8,2),
  actual_result DECIMAL(8,2),  -- Actual game result (spread covered, total, ML result)
  
  -- Factor prediction
  predicted_effect DECIMAL(6,3),
  actual_effect DECIMAL(6,3),  -- How much the factor actually mattered
  prediction_error DECIMAL(6,3),  -- actual - predicted
  
  -- Model performance
  contributed_to_correct_pick BOOLEAN,
  factor_reliability_score DECIMAL(3,2),
  
  -- Learning
  suggested_weight_adjustment DECIMAL(5,3),  -- For updating learned_weight
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_deviations_game_id ON market_deviations_log(game_id);
CREATE INDEX idx_market_deviations_capper ON market_deviations_log(capper);
CREATE INDEX idx_market_deviations_factor ON market_deviations_log(factor_name);

COMMENT ON TABLE market_deviations_log IS 'Historical log of factor predictions vs actual results for model learning and weight tuning';

-- ============================================================================
-- LEAGUE PARAMETERS TABLE
-- ============================================================================
-- Store league-specific parameters (sigma, thresholds, shrinkage factors)

CREATE TABLE IF NOT EXISTS league_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  league VARCHAR(50) NOT NULL,
  
  -- Standard deviations (for probability calculations)
  spread_sigma DECIMAL(5,2),  -- Stddev of point margins
  total_sigma DECIMAL(5,2),  -- Stddev of total points
  
  -- Thresholds for gating picks
  min_spread_deviation DECIMAL(4,2),  -- e.g., 0.75 for NBA
  min_total_deviation DECIMAL(4,2),  -- e.g., 2.0 for NBA
  min_ev_spread DECIMAL(5,4),  -- e.g., 0.015 (1.5%)
  min_ev_total DECIMAL(5,4),
  min_ev_moneyline_dog DECIMAL(5,4),
  min_ev_moneyline_fav DECIMAL(5,4),
  max_moneyline_lay INT,  -- e.g., -250
  
  -- Shrinkage parameters (k values for reliability calculation)
  shrinkage_k_recent_form INT DEFAULT 30,
  shrinkage_k_injuries INT DEFAULT 10,
  shrinkage_k_weather INT DEFAULT 20,
  shrinkage_k_matchup INT DEFAULT 40,
  shrinkage_k_ai_research INT DEFAULT 50,  -- Higher k = more shrinkage for narrative factors
  
  -- Metadata
  last_calibrated TIMESTAMPTZ,
  games_used_for_calibration INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sport, league)
);

-- Insert default parameters for NBA
INSERT INTO league_parameters (sport, league, spread_sigma, total_sigma, min_spread_deviation, min_total_deviation, min_ev_spread, min_ev_total, min_ev_moneyline_dog, min_ev_moneyline_fav, max_moneyline_lay)
VALUES 
  ('basketball', 'NBA', 12.5, 14.0, 0.75, 2.0, 0.015, 0.015, 0.025, 0.035, -250),
  ('basketball', 'NCAAB', 13.5, 15.0, 0.70, 2.0, 0.015, 0.015, 0.025, 0.035, -220)
ON CONFLICT (sport, league) DO UPDATE SET
  updated_at = NOW();

-- Insert default parameters for NFL
INSERT INTO league_parameters (sport, league, spread_sigma, total_sigma, min_spread_deviation, min_total_deviation, min_ev_spread, min_ev_total, min_ev_moneyline_dog, min_ev_moneyline_fav, max_moneyline_lay)
VALUES 
  ('american_football', 'NFL', 13.8, 13.5, 0.70, 1.5, 0.015, 0.015, 0.025, 0.035, -250),
  ('american_football', 'NCAAF', 14.5, 14.0, 0.70, 1.5, 0.015, 0.015, 0.025, 0.035, -220)
ON CONFLICT (sport, league) DO UPDATE SET
  updated_at = NOW();

COMMENT ON TABLE league_parameters IS 'League-specific parameters for sharp betting: sigma values, thresholds, and shrinkage factors';

-- ============================================================================
-- UPDATE CAPPER_SETTINGS FOR MINIMUM FACTORS
-- ============================================================================

ALTER TABLE capper_settings
  ADD COLUMN IF NOT EXISTS min_factors_required INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_ai_retries INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS retry_delay_seconds INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS enable_deep_search BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS enable_residualization BOOLEAN DEFAULT TRUE;

-- Update Shiva settings for sharp betting
UPDATE capper_settings
SET 
  min_factors_required = 10,
  max_ai_retries = 5,
  retry_delay_seconds = 10,
  enable_deep_search = TRUE,
  enable_residualization = TRUE,
  updated_at = NOW()
WHERE capper_name = 'shiva';

COMMENT ON COLUMN capper_settings.min_factors_required IS 'Minimum number of unique factors needed before generating a pick';
COMMENT ON COLUMN capper_settings.max_ai_retries IS 'Maximum number of times to retry AI research if min_factors not met';
COMMENT ON COLUMN capper_settings.enable_deep_search IS 'Whether to use Perplexity sonar-pro deep search mode';

-- ============================================================================
-- VIEWS FOR EASIER QUERYING
-- ============================================================================

-- View: Best prediction head per pick
CREATE OR REPLACE VIEW best_prediction_heads AS
SELECT * FROM prediction_heads
WHERE is_selected = TRUE OR rank = 1;

COMMENT ON VIEW best_prediction_heads IS 'Shows the selected (or highest EV) prediction head for each pick';

-- ============================================================================
-- COMPLETE
-- ============================================================================

-- This migration transforms the system from abstract confidence scores
-- to professional sharp betting with market-deviation analysis and EV calculation

