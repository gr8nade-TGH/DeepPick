-- Add AI-powered capper system
-- This migration adds support for AI cappers that use LLMs for research and decision making

-- Add 'oracle' to the capper enum
ALTER TYPE capper_type ADD VALUE IF NOT EXISTS 'oracle';

-- Add AI-specific columns to picks table
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS ai_insight TEXT, -- Natural language explanation from AI
  ADD COLUMN IF NOT EXISTS ai_research JSONB, -- Web research data and sources
  ADD COLUMN IF NOT EXISTS factors_analyzed JSONB, -- Weighted factors that influenced decision
  ADD COLUMN IF NOT EXISTS ai_model_version TEXT; -- Which AI model was used (e.g., 'perplexity-sonar-pro')

-- Create index for AI picks
CREATE INDEX IF NOT EXISTS idx_picks_ai_model ON picks(ai_model_version) WHERE ai_model_version IS NOT NULL;

-- Add comments
COMMENT ON COLUMN picks.ai_insight IS 'Natural language explanation of why the AI made this pick';
COMMENT ON COLUMN picks.ai_research IS 'Web research data including sources, injury reports, trends, etc.';
COMMENT ON COLUMN picks.factors_analyzed IS 'JSON object of factors and their weights that influenced the decision';
COMMENT ON COLUMN picks.ai_model_version IS 'AI model used (e.g., perplexity-sonar-pro, gpt-4, claude-3.5)';

-- Create a view for AI picks with their insights
CREATE OR REPLACE VIEW ai_picks_with_insights AS
SELECT 
  p.id,
  p.game_id,
  p.pick_type,
  p.selection,
  p.odds,
  p.units,
  p.confidence,
  p.status,
  p.capper,
  p.ai_insight,
  p.ai_research,
  p.factors_analyzed,
  p.ai_model_version,
  p.created_at,
  g.home_team,
  g.away_team,
  g.game_date,
  g.game_time,
  g.sport
FROM picks p
JOIN games g ON p.game_id = g.id
WHERE p.capper = 'oracle' OR p.ai_model_version IS NOT NULL;

COMMENT ON VIEW ai_picks_with_insights IS 'All picks made by AI cappers with their research and insights';
