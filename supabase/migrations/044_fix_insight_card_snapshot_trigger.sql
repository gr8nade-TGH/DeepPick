-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 044: FIX INSIGHT CARD SNAPSHOT TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE:
--   Update the lock_insight_card_on_pick_insert trigger function to include
--   predicted_home_score and predicted_away_score in the insight card snapshot
--   
-- CHANGES:
--   1. Update lock_insight_card_on_pick_insert function to include predicted scores
--
-- RATIONALE:
--   - The insight card API was updated to use predicted_home_score and predicted_away_score
--   - The trigger function was missing these fields, causing insight cards to show 0 scores
--   - This fix ensures the locked insight card snapshot includes all necessary data
--
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION lock_insight_card_on_pick_insert()
RETURNS TRIGGER AS $$
DECLARE
  run_record RECORD;
  game_record RECORD;
  insight_card JSONB;
BEGIN
  -- Only lock insight card if run_id is present
  IF NEW.run_id IS NULL THEN
    RAISE WARNING 'Pick % has no run_id - cannot lock insight card', NEW.id;
    RETURN NEW;
  END IF;

  -- Get run data
  SELECT * INTO run_record FROM runs WHERE run_id = NEW.run_id LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Run % not found for pick % - cannot lock insight card', NEW.run_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Get game data
  SELECT * INTO game_record FROM games WHERE id = NEW.game_id LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Game % not found for pick % - cannot lock insight card', NEW.game_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Build insight card snapshot
  insight_card := jsonb_build_object(
    'pick', jsonb_build_object(
      'id', NEW.id,
      'selection', NEW.selection,
      'units', NEW.units,
      'confidence', NEW.confidence,
      'pick_type', NEW.pick_type,
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
      'predicted_home_score', run_record.predicted_home_score,
      'predicted_away_score', run_record.predicted_away_score
    ),
    'metadata', jsonb_build_object(
      'created_at', NEW.created_at,
      'locked_by', 'system',
      'version', '1.0',
      'immutable', true
    )
  );

  -- Lock the insight card
  NEW.insight_card_snapshot := insight_card;
  NEW.insight_card_locked_at := NOW();

  RAISE NOTICE 'Insight card locked for pick % at %', NEW.id, NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION lock_insight_card_on_pick_insert() IS 
  'Automatically locks insight card snapshot when a new pick is inserted. Updated to include predicted_home_score and predicted_away_score.';

