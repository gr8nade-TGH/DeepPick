-- ═══════════════════════════════════════════════════════════
-- COMPLETE PICK GRADING SYSTEM FIX
-- ═══════════════════════════════════════════════════════════
-- This migration fixes the pick grading trigger to handle:
-- 1. TOTAL picks (OVER/UNDER)
-- 2. SPREAD picks (point spread)
-- 3. MONEYLINE picks (straight win/loss)
-- 4. Variable odds (not just -110)
-- 5. Edge cases (postponed, cancelled, null scores)
-- ═══════════════════════════════════════════════════════════

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_grade_picks ON games;
DROP FUNCTION IF EXISTS grade_picks_for_game();

-- Create comprehensive grading function
CREATE OR REPLACE FUNCTION grade_picks_for_game()
RETURNS TRIGGER AS $$
DECLARE
  pick_record RECORD;
  pick_won BOOLEAN;
  is_push BOOLEAN;
  payout DECIMAL(10, 2);
  home_score INTEGER;
  away_score INTEGER;
  total_score INTEGER;
  point_diff DECIMAL(5, 2);
  line_value DECIMAL(5, 2);
  selected_team TEXT;
  grading_notes TEXT;
BEGIN
  -- Only grade when status changes to 'final' and we have scores
  IF NEW.status = 'final' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    
    RAISE NOTICE '🏀 [GRADING] Game completed: % @ % (% - %)', 
      NEW.away_team->>'name', NEW.home_team->>'name', NEW.away_score, NEW.home_score;
    
    -- Extract scores
    home_score := NEW.home_score;
    away_score := NEW.away_score;
    total_score := home_score + away_score;
    point_diff := home_score - away_score; -- Positive = home won, Negative = away won
    
    -- Loop through all pending picks for this game
    FOR pick_record IN 
      SELECT * FROM picks 
      WHERE game_id = NEW.id 
      AND status = 'pending'
    LOOP
      -- Reset flags
      pick_won := false;
      is_push := false;
      payout := 0;
      grading_notes := '';
      
      RAISE NOTICE '📊 [GRADING] Processing pick: % - % (type: %)', 
        pick_record.id, pick_record.selection, pick_record.pick_type;
      
      -- ═══════════════════════════════════════════════════════════
      -- GRADE BASED ON PICK TYPE
      -- ═══════════════════════════════════════════════════════════
      
      -- ───────────────────────────────────────────────────────────
      -- TOTAL PICKS (OVER/UNDER)
      -- ───────────────────────────────────────────────────────────
      IF pick_record.pick_type = 'total' OR pick_record.pick_type LIKE '%total%' THEN
        -- Extract line from selection (e.g., "OVER 235.5" → 235.5)
        line_value := NULLIF(regexp_replace(pick_record.selection, '[^0-9.]', '', 'g'), '')::DECIMAL;
        
        IF line_value IS NULL THEN
          RAISE WARNING '⚠️  [GRADING] Could not extract line from selection: %', pick_record.selection;
          CONTINUE;
        END IF;
        
        IF pick_record.selection ILIKE '%OVER%' THEN
          pick_won := total_score > line_value;
          is_push := total_score = line_value;
          grading_notes := format('Total: %s, Line: %s, Result: %s', 
            total_score, line_value, 
            CASE WHEN is_push THEN 'PUSH' WHEN pick_won THEN 'WON' ELSE 'LOST' END);
          
        ELSIF pick_record.selection ILIKE '%UNDER%' THEN
          pick_won := total_score < line_value;
          is_push := total_score = line_value;
          grading_notes := format('Total: %s, Line: %s, Result: %s', 
            total_score, line_value,
            CASE WHEN is_push THEN 'PUSH' WHEN pick_won THEN 'WON' ELSE 'LOST' END);
        ELSE
          RAISE WARNING '⚠️  [GRADING] Unknown TOTAL selection format: %', pick_record.selection;
          CONTINUE;
        END IF;
      
      -- ───────────────────────────────────────────────────────────
      -- SPREAD PICKS
      -- ───────────────────────────────────────────────────────────
      ELSIF pick_record.pick_type = 'spread' THEN
        -- Extract team and spread from selection
        -- Format examples: "Lakers -4.5", "Celtics +3.5", "AWAY -2.5", "HOME +1.5"
        
        -- Check if selection contains team name or AWAY/HOME
        IF pick_record.selection ILIKE '%AWAY%' THEN
          selected_team := 'away';
        ELSIF pick_record.selection ILIKE '%HOME%' THEN
          selected_team := 'home';
        ELSIF pick_record.selection ILIKE '%' || (NEW.away_team->>'name') || '%' THEN
          selected_team := 'away';
        ELSIF pick_record.selection ILIKE '%' || (NEW.home_team->>'name') || '%' THEN
          selected_team := 'home';
        ELSE
          RAISE WARNING '⚠️  [GRADING] Could not determine team from SPREAD selection: %', pick_record.selection;
          CONTINUE;
        END IF;
        
        -- Extract spread line (e.g., "-4.5" or "+3.5")
        line_value := NULLIF(regexp_replace(pick_record.selection, '[^0-9.\-+]', '', 'g'), '')::DECIMAL;
        
        IF line_value IS NULL THEN
          RAISE WARNING '⚠️  [GRADING] Could not extract spread line from selection: %', pick_record.selection;
          CONTINUE;
        END IF;
        
        -- Calculate if pick covers the spread
        IF selected_team = 'away' THEN
          -- Away team picked: away_score + spread > home_score
          -- Example: Away -4.5 means away must win by more than 4.5
          pick_won := (away_score + line_value) > home_score;
          is_push := (away_score + line_value) = home_score;
          grading_notes := format('Away spread: %s, Actual diff: %s (away won by %s), Result: %s',
            line_value, away_score - home_score, away_score - home_score,
            CASE WHEN is_push THEN 'PUSH' WHEN pick_won THEN 'WON' ELSE 'LOST' END);
        ELSE
          -- Home team picked: home_score + spread > away_score
          pick_won := (home_score + line_value) > away_score;
          is_push := (home_score + line_value) = away_score;
          grading_notes := format('Home spread: %s, Actual diff: %s (home won by %s), Result: %s',
            line_value, home_score - away_score, home_score - away_score,
            CASE WHEN is_push THEN 'PUSH' WHEN pick_won THEN 'WON' ELSE 'LOST' END);
        END IF;
      
      -- ───────────────────────────────────────────────────────────
      -- MONEYLINE PICKS
      -- ───────────────────────────────────────────────────────────
      ELSIF pick_record.pick_type = 'moneyline' THEN
        -- Determine which team was picked
        IF pick_record.selection ILIKE '%' || (NEW.home_team->>'name') || '%' THEN
          pick_won := home_score > away_score;
          is_push := home_score = away_score;
          grading_notes := format('Picked: %s, Score: %s-%s, Result: %s',
            NEW.home_team->>'name', home_score, away_score,
            CASE WHEN is_push THEN 'PUSH' WHEN pick_won THEN 'WON' ELSE 'LOST' END);
            
        ELSIF pick_record.selection ILIKE '%' || (NEW.away_team->>'name') || '%' THEN
          pick_won := away_score > home_score;
          is_push := home_score = away_score;
          grading_notes := format('Picked: %s, Score: %s-%s, Result: %s',
            NEW.away_team->>'name', away_score, home_score,
            CASE WHEN is_push THEN 'PUSH' WHEN pick_won THEN 'WON' ELSE 'LOST' END);
        ELSE
          RAISE WARNING '⚠️  [GRADING] Could not determine team from MONEYLINE selection: %', pick_record.selection;
          CONTINUE;
        END IF;
      
      ELSE
        RAISE WARNING '⚠️  [GRADING] Unknown pick type: %', pick_record.pick_type;
        CONTINUE;
      END IF;
      
      -- ═══════════════════════════════════════════════════════════
      -- UPDATE PICK WITH RESULT
      -- ═══════════════════════════════════════════════════════════
      
      -- Handle PUSH
      IF is_push THEN
        UPDATE picks 
        SET status = 'push',
            net_units = 0,
            graded_at = NOW(),
            result = jsonb_build_object(
              'outcome', 'push',
              'final_score', jsonb_build_object('home', home_score, 'away', away_score),
              'notes', grading_notes
            )
        WHERE id = pick_record.id;
        
        RAISE NOTICE '➖ [GRADING] PUSH: % (0 units)', pick_record.selection;
        CONTINUE;
      END IF;
      
      -- Calculate payout for WIN/LOSS
      IF pick_won THEN
        -- Calculate payout based on odds
        IF pick_record.odds > 0 THEN
          -- Positive odds (underdog): +150 means risk $100 to win $150
          payout := (pick_record.odds::DECIMAL / 100.0) * pick_record.units;
        ELSIF pick_record.odds < 0 THEN
          -- Negative odds (favorite): -150 means risk $150 to win $100
          payout := (100.0 / ABS(pick_record.odds)::DECIMAL) * pick_record.units;
        ELSE
          -- Even odds (+100 or -100)
          payout := pick_record.units;
        END IF;
        
        UPDATE picks 
        SET status = 'won',
            net_units = payout,
            graded_at = NOW(),
            result = jsonb_build_object(
              'outcome', 'won',
              'payout', payout,
              'final_score', jsonb_build_object('home', home_score, 'away', away_score),
              'notes', grading_notes
            )
        WHERE id = pick_record.id;
        
        RAISE NOTICE '✅ [GRADING] WON: % (+%s units)', pick_record.selection, payout;
        
      ELSE
        -- Pick LOST
        UPDATE picks 
        SET status = 'lost',
            net_units = -pick_record.units,
            graded_at = NOW(),
            result = jsonb_build_object(
              'outcome', 'lost',
              'payout', -pick_record.units,
              'final_score', jsonb_build_object('home', home_score, 'away', away_score),
              'notes', grading_notes
            )
        WHERE id = pick_record.id;
        
        RAISE NOTICE '❌ [GRADING] LOST: % (-%s units)', pick_record.selection, pick_record.units;
      END IF;
      
    END LOOP;
    
    RAISE NOTICE '🏁 [GRADING] Completed grading for game: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-grade picks
CREATE TRIGGER trigger_grade_picks
  AFTER UPDATE OF status, home_score, away_score, final_score ON games
  FOR EACH ROW
  EXECUTE FUNCTION grade_picks_for_game();

COMMENT ON FUNCTION grade_picks_for_game() IS 'Automatically grades all pending picks when a game is marked as final. Handles TOTAL, SPREAD, and MONEYLINE picks with variable odds.';

