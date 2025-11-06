-- Add bold_predictions, professional_analysis, and injury_summary columns to runs table
-- These columns support the enhanced insight card features with AI-generated content

-- Add columns to runs table
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS bold_predictions JSONB,
  ADD COLUMN IF NOT EXISTS professional_analysis TEXT,
  ADD COLUMN IF NOT EXISTS injury_summary JSONB;

-- Add comments for documentation
COMMENT ON COLUMN runs.bold_predictions IS 'AI-generated player predictions (2-4 predictions with confidence levels) from OpenAI';
COMMENT ON COLUMN runs.professional_analysis IS 'AI-enhanced professional analysis combining internal data and MySportsFeeds insights';
COMMENT ON COLUMN runs.injury_summary IS 'Injury context from MySportsFeeds API (key injuries affecting the game)';

-- Update the insight card snapshot trigger to include new fields
CREATE OR REPLACE FUNCTION lock_insight_card_on_pick_insert()
RETURNS TRIGGER AS $$
DECLARE
  run_record RECORD;
  game_record RECORD;
  insight_card JSONB;
BEGIN
  -- Fetch the run record
  SELECT * INTO run_record
  FROM runs
  WHERE id = NEW.run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run record not found for run_id: %', NEW.run_id;
  END IF;

  -- Fetch the game record (cast game_id to UUID)
  SELECT * INTO game_record
  FROM games
  WHERE id = run_record.game_id::uuid;

  IF NOT FOUND THEN
    RAISE WARNING 'Game record not found for game_id: %, using pick snapshot data', run_record.game_id;
  END IF;

  -- Validate critical data exists
  IF run_record.factor_contributions IS NULL THEN
    RAISE WARNING 'Missing factor_contributions for run_id: %', NEW.run_id;
  END IF;

  IF run_record.predicted_total IS NULL THEN
    RAISE WARNING 'Missing predicted_total for run_id: %', NEW.run_id;
  END IF;

  IF run_record.conf7 IS NULL OR run_record.conf_market_adj IS NULL OR run_record.conf_final IS NULL THEN
    RAISE WARNING 'Missing confidence values for run_id: %', NEW.run_id;
  END IF;

  -- Build insight card snapshot with all data
  insight_card := jsonb_build_object(
    'pick', jsonb_build_object(
      'type', NEW.pick_type,
      'selection', NEW.selection,
      'units', NEW.units,
      'confidence', NEW.confidence,
      'odds', NEW.odds,
      'reasoning', NEW.reasoning
    ),
    'odds', jsonb_build_object(
      'total_line', COALESCE(game_record.total_line, (NEW.game_snapshot->>'total_line')::DECIMAL),
      'spread_line', COALESCE(game_record.spread_line, (NEW.game_snapshot->>'spread_line')::DECIMAL),
      'home_ml', COALESCE(game_record.home_ml, (NEW.game_snapshot->>'home_ml')::INTEGER),
      'away_ml', COALESCE(game_record.away_ml, (NEW.game_snapshot->>'away_ml')::INTEGER),
      'locked_at', NEW.created_at
    ),
    'matchup', jsonb_build_object(
      'away', COALESCE(game_record.away_team, NEW.game_snapshot->'away_team'),
      'home', COALESCE(game_record.home_team, NEW.game_snapshot->'home_team'),
      'game_date', COALESCE(game_record.game_date::TEXT, (NEW.game_snapshot->>'game_date'))
    ),
    'factors', COALESCE(run_record.factor_contributions, '[]'::jsonb),
    'predictions', jsonb_build_object(
      'predicted_total', run_record.predicted_total,
      'baseline_avg', run_record.baseline_avg,
      'market_total', run_record.market_total,
      'predicted_home_score', run_record.metadata->'predicted_home_score',
      'predicted_away_score', run_record.metadata->'predicted_away_score'
    ),
    'confidence', jsonb_build_object(
      'conf7', run_record.conf7,
      'conf_market_adj', run_record.conf_market_adj,
      'conf_final', run_record.conf_final
    ),
    'bold_predictions', COALESCE(run_record.bold_predictions, 'null'::jsonb),
    'professional_analysis', COALESCE(run_record.professional_analysis, ''),
    'injury_summary', COALESCE(run_record.injury_summary, 'null'::jsonb),
    'metadata', jsonb_build_object(
      'created_at', NEW.created_at,
      'locked_by', 'system',
      'version', '1.1',
      'immutable', true,
      'pick_type', NEW.pick_type,
      'bet_type', NEW.pick_type
    )
  );

  -- Lock the insight card
  NEW.insight_card_snapshot := insight_card;
  NEW.insight_card_locked_at := NOW();

  RAISE NOTICE 'Insight card locked for pick % at % (version 1.1 with bold predictions and analysis)', NEW.id, NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION lock_insight_card_on_pick_insert() IS 
  'Automatically locks insight card snapshot when a new pick is inserted. Version 1.1 includes bold_predictions, professional_analysis, and injury_summary.';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 048 complete: Added bold_predictions, professional_analysis, and injury_summary columns to runs table';
  RAISE NOTICE 'Updated insight card snapshot trigger to version 1.1';
END $$;

