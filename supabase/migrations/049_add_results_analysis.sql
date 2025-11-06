-- Migration: Add Results Analysis & Factor Tuning System
-- Description: Stores post-game analysis, factor accuracy, and tuning suggestions

-- =====================================================
-- TABLE: results_analysis
-- Stores AI-generated post-game analysis for each pick
-- =====================================================
CREATE TABLE IF NOT EXISTS results_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  
  -- Analysis content
  analysis TEXT NOT NULL,  -- AI-generated results analysis
  overall_accuracy DECIMAL(3,2),  -- 0.00 to 1.00
  
  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(pick_id)
);

CREATE INDEX IF NOT EXISTS idx_results_analysis_pick_id ON results_analysis(pick_id);
CREATE INDEX IF NOT EXISTS idx_results_analysis_game_id ON results_analysis(game_id);
CREATE INDEX IF NOT EXISTS idx_results_analysis_generated_at ON results_analysis(generated_at);

COMMENT ON TABLE results_analysis IS 'Post-game analysis comparing predictions to actual results';
COMMENT ON COLUMN results_analysis.analysis IS 'AI-generated bullet-point analysis';
COMMENT ON COLUMN results_analysis.overall_accuracy IS 'Overall factor accuracy score (0-1)';

-- =====================================================
-- TABLE: factor_accuracy
-- Tracks accuracy of individual factors for each pick
-- =====================================================
CREATE TABLE IF NOT EXISTS factor_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  results_analysis_id UUID NOT NULL REFERENCES results_analysis(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  
  -- Factor identification
  factor_id TEXT NOT NULL,  -- e.g., "F1", "S1"
  factor_name TEXT NOT NULL,  -- e.g., "Pace Advantage"
  
  -- Factor performance
  contribution DECIMAL(5,2) NOT NULL,  -- Original contribution (e.g., +4.5 points)
  was_correct BOOLEAN NOT NULL,
  accuracy_score DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  impact TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
  reasoning TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factor_accuracy_results_analysis_id ON factor_accuracy(results_analysis_id);
CREATE INDEX IF NOT EXISTS idx_factor_accuracy_pick_id ON factor_accuracy(pick_id);
CREATE INDEX IF NOT EXISTS idx_factor_accuracy_factor_id ON factor_accuracy(factor_id);
CREATE INDEX IF NOT EXISTS idx_factor_accuracy_was_correct ON factor_accuracy(was_correct);
CREATE INDEX IF NOT EXISTS idx_factor_accuracy_impact ON factor_accuracy(impact);

COMMENT ON TABLE factor_accuracy IS 'Tracks accuracy of individual factors for each pick';
COMMENT ON COLUMN factor_accuracy.contribution IS 'Original factor contribution in points';
COMMENT ON COLUMN factor_accuracy.was_correct IS 'Whether factor predicted correctly';
COMMENT ON COLUMN factor_accuracy.accuracy_score IS 'Accuracy score 0-1 (1 = perfect)';
COMMENT ON COLUMN factor_accuracy.impact IS 'Impact level: high (>=3pts), medium (>=1.5pts), low (<1.5pts)';

-- =====================================================
-- TABLE: tuning_suggestions
-- Stores AI-generated factor tuning suggestions
-- =====================================================
CREATE TABLE IF NOT EXISTS tuning_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  results_analysis_id UUID NOT NULL REFERENCES results_analysis(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  
  -- Factor identification
  factor_id TEXT NOT NULL,
  factor_name TEXT NOT NULL,
  
  -- Tuning recommendation
  current_weight DECIMAL(4,3) NOT NULL,  -- e.g., 0.150
  suggested_weight DECIMAL(4,3) NOT NULL,  -- e.g., 0.112
  change_percent DECIMAL(5,2) NOT NULL,  -- e.g., -25.00
  reason TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  sample_size INTEGER NOT NULL DEFAULT 1,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'applied')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_results_analysis_id ON tuning_suggestions(results_analysis_id);
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_pick_id ON tuning_suggestions(pick_id);
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_factor_id ON tuning_suggestions(factor_id);
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_status ON tuning_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_tuning_suggestions_created_at ON tuning_suggestions(created_at);

COMMENT ON TABLE tuning_suggestions IS 'AI-generated factor weight tuning suggestions';
COMMENT ON COLUMN tuning_suggestions.current_weight IS 'Current factor weight (0-1)';
COMMENT ON COLUMN tuning_suggestions.suggested_weight IS 'Suggested new weight (0-1)';
COMMENT ON COLUMN tuning_suggestions.change_percent IS 'Percentage change (negative = decrease)';
COMMENT ON COLUMN tuning_suggestions.confidence IS 'AI confidence in suggestion (0-1)';
COMMENT ON COLUMN tuning_suggestions.sample_size IS 'Number of games analyzed for this suggestion';
COMMENT ON COLUMN tuning_suggestions.status IS 'pending, accepted, rejected, or applied';

-- =====================================================
-- TABLE: factor_performance_history
-- Aggregated factor performance over time
-- =====================================================
CREATE TABLE IF NOT EXISTS factor_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Factor identification
  capper TEXT NOT NULL,  -- e.g., "shiva"
  sport TEXT NOT NULL,  -- e.g., "NBA"
  bet_type TEXT NOT NULL,  -- e.g., "TOTAL", "SPREAD"
  factor_id TEXT NOT NULL,
  factor_name TEXT NOT NULL,
  
  -- Performance metrics
  total_picks INTEGER NOT NULL DEFAULT 0,
  correct_picks INTEGER NOT NULL DEFAULT 0,
  incorrect_picks INTEGER NOT NULL DEFAULT 0,
  accuracy_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,  -- Percentage
  avg_contribution DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  avg_accuracy_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  
  -- Weight tracking
  current_weight DECIMAL(4,3),
  suggested_weight DECIMAL(4,3),
  weight_change_history JSONB DEFAULT '[]'::jsonb,
  
  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factor_performance_capper ON factor_performance_history(capper);
CREATE INDEX IF NOT EXISTS idx_factor_performance_sport ON factor_performance_history(sport);
CREATE INDEX IF NOT EXISTS idx_factor_performance_bet_type ON factor_performance_history(bet_type);
CREATE INDEX IF NOT EXISTS idx_factor_performance_factor_id ON factor_performance_history(factor_id);
CREATE INDEX IF NOT EXISTS idx_factor_performance_accuracy_rate ON factor_performance_history(accuracy_rate);
CREATE INDEX IF NOT EXISTS idx_factor_performance_period ON factor_performance_history(period_start, period_end);

COMMENT ON TABLE factor_performance_history IS 'Aggregated factor performance metrics over time';
COMMENT ON COLUMN factor_performance_history.accuracy_rate IS 'Percentage of correct predictions (0-100)';
COMMENT ON COLUMN factor_performance_history.avg_contribution IS 'Average point contribution per pick';
COMMENT ON COLUMN factor_performance_history.avg_accuracy_score IS 'Average accuracy score (0-1)';
COMMENT ON COLUMN factor_performance_history.weight_change_history IS 'Array of weight changes over time';

-- =====================================================
-- FUNCTION: Update factor performance history
-- Automatically updates aggregated metrics when new factor accuracy is added
-- =====================================================
CREATE OR REPLACE FUNCTION update_factor_performance_history()
RETURNS TRIGGER AS $$
DECLARE
  v_capper TEXT;
  v_sport TEXT;
  v_bet_type TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Get pick metadata
  SELECT p.capper, g.sport, p.bet_type
  INTO v_capper, v_sport, v_bet_type
  FROM picks p
  JOIN games g ON p.game_id = g.id
  WHERE p.id = NEW.pick_id;
  
  -- Define rolling 30-day period
  v_period_end := NOW();
  v_period_start := v_period_end - INTERVAL '30 days';
  
  -- Upsert factor performance record
  INSERT INTO factor_performance_history (
    capper,
    sport,
    bet_type,
    factor_id,
    factor_name,
    total_picks,
    correct_picks,
    incorrect_picks,
    accuracy_rate,
    avg_contribution,
    avg_accuracy_score,
    period_start,
    period_end,
    last_updated
  )
  SELECT
    v_capper,
    v_sport,
    v_bet_type,
    NEW.factor_id,
    NEW.factor_name,
    COUNT(*),
    SUM(CASE WHEN was_correct THEN 1 ELSE 0 END),
    SUM(CASE WHEN NOT was_correct THEN 1 ELSE 0 END),
    (SUM(CASE WHEN was_correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100),
    AVG(contribution),
    AVG(accuracy_score),
    v_period_start,
    v_period_end,
    NOW()
  FROM factor_accuracy fa
  JOIN picks p ON fa.pick_id = p.id
  JOIN games g ON p.game_id = g.id
  WHERE fa.factor_id = NEW.factor_id
    AND p.capper = v_capper
    AND g.sport = v_sport
    AND p.bet_type = v_bet_type
    AND fa.created_at >= v_period_start
  ON CONFLICT (capper, sport, bet_type, factor_id, period_start, period_end)
  DO UPDATE SET
    total_picks = EXCLUDED.total_picks,
    correct_picks = EXCLUDED.correct_picks,
    incorrect_picks = EXCLUDED.incorrect_picks,
    accuracy_rate = EXCLUDED.accuracy_rate,
    avg_contribution = EXCLUDED.avg_contribution,
    avg_accuracy_score = EXCLUDED.avg_accuracy_score,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_factor_performance ON factor_accuracy;
CREATE TRIGGER trigger_update_factor_performance
  AFTER INSERT ON factor_accuracy
  FOR EACH ROW
  EXECUTE FUNCTION update_factor_performance_history();

COMMENT ON FUNCTION update_factor_performance_history IS 'Automatically updates factor performance metrics when new accuracy data is added';

-- =====================================================
-- Add unique constraint to factor_performance_history
-- =====================================================
ALTER TABLE factor_performance_history
  ADD CONSTRAINT unique_factor_performance_period
  UNIQUE (capper, sport, bet_type, factor_id, period_start, period_end);

