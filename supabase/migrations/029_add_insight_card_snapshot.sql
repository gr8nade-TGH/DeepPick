-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 029: ADD INSIGHT CARD SNAPSHOT TO PICKS TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE:
--   Lock and save insight card data as immutable "signed agreement" for transparency
--   
-- CHANGES:
--   1. Add insight_card_snapshot JSONB column to picks table
--   2. Add insight_card_locked_at timestamp column
--   3. Create function to lock insight card when pick is created
--   4. Create trigger to automatically lock insight card on pick insert
--
-- RATIONALE:
--   - Insight cards must be documented like signed agreements
--   - Once a pick is generated, the insight card should be immutable
--   - Provides transparency and accountability for the system
--   - Prevents retroactive changes to pick rationale
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. ADD INSIGHT CARD SNAPSHOT COLUMNS TO PICKS TABLE
-- ───────────────────────────────────────────────────────────────────────────

-- Add insight_card_snapshot column to store complete insight card data
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS insight_card_snapshot JSONB DEFAULT NULL;

-- Add timestamp for when insight card was locked
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS insight_card_locked_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for querying locked insight cards
CREATE INDEX IF NOT EXISTS idx_picks_insight_card_locked 
  ON picks(insight_card_locked_at) 
  WHERE insight_card_locked_at IS NOT NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN picks.insight_card_snapshot IS 
  'Immutable snapshot of the insight card at the time the pick was generated. Acts as a signed agreement for transparency.';

COMMENT ON COLUMN picks.insight_card_locked_at IS 
  'Timestamp when the insight card was locked. Once locked, the insight card cannot be modified.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CREATE FUNCTION TO BUILD AND LOCK INSIGHT CARD
-- ───────────────────────────────────────────────────────────────────────────

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

  -- Build insight card snapshot
  insight_card := jsonb_build_object(
    'locked_at', NOW(),
    'pick_id', NEW.id,
    'run_id', NEW.run_id,
    'game_id', NEW.game_id,
    'capper', NEW.capper,
    'sport', 'NBA',
    'pick', jsonb_build_object(
      'type', UPPER(NEW.pick_type),
      'selection', NEW.selection,
      'units', NEW.units,
      'confidence', NEW.confidence,
      'locked_odds', NEW.game_snapshot
    ),
    'matchup', jsonb_build_object(
      'away', COALESCE(game_record.away_team, NEW.game_snapshot->'away_team'),
      'home', COALESCE(game_record.home_team, NEW.game_snapshot->'home_team'),
      'game_date', COALESCE(game_record.game_date, NEW.game_snapshot->'game_date')
    ),
    'factors', COALESCE(run_record.factor_contributions, '[]'::jsonb),
    'predictions', jsonb_build_object(
      'predicted_total', run_record.predicted_total,
      'baseline_avg', run_record.baseline_avg,
      'market_total', run_record.market_total
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

-- ───────────────────────────────────────────────────────────────────────────
-- 3. CREATE TRIGGER TO AUTO-LOCK INSIGHT CARD ON PICK INSERT
-- ───────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_lock_insight_card ON picks;

CREATE TRIGGER trigger_lock_insight_card
  BEFORE INSERT ON picks
  FOR EACH ROW
  EXECUTE FUNCTION lock_insight_card_on_pick_insert();

COMMENT ON TRIGGER trigger_lock_insight_card ON picks IS 
  'Automatically locks insight card snapshot when a new pick is inserted. Ensures transparency and immutability.';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. BACKFILL EXISTING PICKS (OPTIONAL - RUN MANUALLY IF NEEDED)
-- ───────────────────────────────────────────────────────────────────────────

-- This section is commented out by default
-- Uncomment and run manually if you want to backfill existing picks

/*
DO $$
DECLARE
  pick_record RECORD;
  run_record RECORD;
  game_record RECORD;
  insight_card JSONB;
  backfilled_count INTEGER := 0;
BEGIN
  -- Loop through all picks that don't have insight card snapshot
  FOR pick_record IN 
    SELECT * FROM picks 
    WHERE insight_card_snapshot IS NULL 
      AND run_id IS NOT NULL
    ORDER BY created_at DESC
  LOOP
    -- Get run data
    SELECT * INTO run_record FROM runs WHERE run_id = pick_record.run_id LIMIT 1;
    
    IF NOT FOUND THEN
      RAISE WARNING 'Run % not found for pick % - skipping', pick_record.run_id, pick_record.id;
      CONTINUE;
    END IF;

    -- Get game data
    SELECT * INTO game_record FROM games WHERE id = pick_record.game_id LIMIT 1;

    -- Build insight card snapshot
    insight_card := jsonb_build_object(
      'locked_at', pick_record.created_at,  -- Use original creation time
      'pick_id', pick_record.id,
      'run_id', pick_record.run_id,
      'game_id', pick_record.game_id,
      'capper', pick_record.capper,
      'sport', 'NBA',
      'pick', jsonb_build_object(
        'type', UPPER(pick_record.pick_type),
        'selection', pick_record.selection,
        'units', pick_record.units,
        'confidence', pick_record.confidence,
        'locked_odds', pick_record.game_snapshot
      ),
      'matchup', jsonb_build_object(
        'away', COALESCE(game_record.away_team, pick_record.game_snapshot->'away_team'),
        'home', COALESCE(game_record.home_team, pick_record.game_snapshot->'home_team'),
        'game_date', COALESCE(game_record.game_date::TEXT, (pick_record.game_snapshot->>'game_date'))
      ),
      'factors', COALESCE(run_record.factor_contributions, '[]'::jsonb),
      'predictions', jsonb_build_object(
        'predicted_total', run_record.predicted_total,
        'baseline_avg', run_record.baseline_avg,
        'market_total', run_record.market_total
      ),
      'metadata', jsonb_build_object(
        'created_at', pick_record.created_at,
        'locked_by', 'backfill',
        'version', '1.0',
        'immutable', true
      )
    );

    -- Update pick with locked insight card
    UPDATE picks 
    SET 
      insight_card_snapshot = insight_card,
      insight_card_locked_at = pick_record.created_at
    WHERE id = pick_record.id;

    backfilled_count := backfilled_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % picks with insight card snapshots', backfilled_count;
END $$;
*/

