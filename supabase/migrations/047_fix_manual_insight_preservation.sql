-- Fix: Preserve manual_insight data in insight_card_snapshot for manual picks
-- The trigger was overwriting the manual_insight field that the API provides

CREATE OR REPLACE FUNCTION lock_insight_card_on_pick_insert()
RETURNS TRIGGER AS $$
DECLARE
  run_record RECORD;
  game_record RECORD;
  insight_card JSONB;
  existing_manual_insight JSONB;
BEGIN
  -- For manual picks without run_id, preserve any manual_insight data passed in
  IF NEW.run_id IS NULL THEN
    RAISE NOTICE 'Manual pick without run_id - building insight card with manual_insight preservation';
    
    -- Extract existing manual_insight if provided
    existing_manual_insight := NEW.insight_card_snapshot->'manual_insight';
    
    -- Build insight card, preserving manual_insight data
    NEW.insight_card_snapshot := jsonb_build_object(
      'pick', jsonb_build_object(
        'type', NEW.pick_type, 
        'selection', NEW.selection, 
        'units', NEW.units, 
        'confidence', NEW.confidence, 
        'odds', NEW.odds, 
        'reasoning', NEW.reasoning
      ),
      'matchup', jsonb_build_object(
        'away', NEW.game_snapshot->'away_team', 
        'home', NEW.game_snapshot->'home_team', 
        'game_date', NEW.game_snapshot->>'game_date'
      ),
      'manual_insight', COALESCE(existing_manual_insight, '{}'::jsonb),
      'metadata', jsonb_build_object(
        'created_at', NEW.created_at, 
        'locked_by', 'manual', 
        'version', '1.2', 
        'immutable', true, 
        'pick_type', NEW.pick_type, 
        'bet_type', NEW.pick_type, 
        'is_manual_pick', true
      )
    );
    NEW.insight_card_locked_at := NOW();
    RETURN NEW;
  END IF;

  -- System picks with run_id - unchanged logic
  SELECT * INTO run_record FROM runs WHERE id = NEW.run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run record not found for run_id: %', NEW.run_id;
  END IF;
  SELECT * INTO game_record FROM games WHERE id = run_record.game_id::uuid;
  IF NOT FOUND THEN
    RAISE WARNING 'Game record not found for game_id: %, using pick snapshot data', run_record.game_id;
  END IF;
  insight_card := jsonb_build_object(
    'pick', jsonb_build_object('type', NEW.pick_type, 'selection', NEW.selection, 'units', NEW.units, 'confidence', NEW.confidence, 'odds', NEW.odds, 'reasoning', NEW.reasoning),
    'odds', jsonb_build_object('total_line', COALESCE(game_record.total_line, (NEW.game_snapshot->>'total_line')::DECIMAL), 'spread_line', COALESCE(game_record.spread_line, (NEW.game_snapshot->>'spread_line')::DECIMAL), 'home_ml', COALESCE(game_record.home_ml, (NEW.game_snapshot->>'home_ml')::INTEGER), 'away_ml', COALESCE(game_record.away_ml, (NEW.game_snapshot->>'away_ml')::INTEGER), 'locked_at', NEW.created_at),
    'matchup', jsonb_build_object('away', COALESCE(game_record.away_team, NEW.game_snapshot->'away_team'), 'home', COALESCE(game_record.home_team, NEW.game_snapshot->'home_team'), 'game_date', COALESCE(game_record.game_date::TEXT, (NEW.game_snapshot->>'game_date'))),
    'factors', COALESCE(run_record.factor_contributions, '[]'::jsonb),
    'predictions', jsonb_build_object('predicted_total', run_record.predicted_total, 'baseline_avg', run_record.baseline_avg, 'market_total', run_record.market_total, 'predicted_home_score', run_record.metadata->'predicted_home_score', 'predicted_away_score', run_record.metadata->'predicted_away_score'),
    'confidence', jsonb_build_object('conf7', run_record.conf7, 'conf_market_adj', run_record.conf_market_adj, 'conf_final', run_record.conf_final),
    'bold_predictions', COALESCE(run_record.bold_predictions, 'null'::jsonb),
    'professional_analysis', COALESCE(run_record.professional_analysis, ''),
    'injury_summary', COALESCE(run_record.injury_summary, 'null'::jsonb),
    'metadata', jsonb_build_object('created_at', NEW.created_at, 'locked_by', 'system', 'version', '1.2', 'immutable', true, 'pick_type', NEW.pick_type, 'bet_type', NEW.pick_type)
  );
  NEW.insight_card_snapshot := insight_card;
  NEW.insight_card_locked_at := NOW();
  RAISE NOTICE 'Insight card locked for pick % at % (version 1.2)', NEW.id, NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

