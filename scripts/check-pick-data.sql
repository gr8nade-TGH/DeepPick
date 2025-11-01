-- Query to check what data is actually stored in the database for a specific pick
-- Replace the pick_id with your actual pick ID

-- 1. Get the pick record
SELECT 
  id,
  run_id,
  sport,
  matchup,
  confidence,
  units,
  pick_type,
  selection,
  created_at
FROM picks
WHERE id = '56d51cf4-bb22-4f98-937a-059e752b7315';

-- 2. Get the run record (using run_id from above)
SELECT 
  id,
  run_id,
  game_id,
  capper,
  bet_type,
  units,
  confidence,
  pick_type,
  selection,
  -- Check if factor_contributions is populated
  CASE 
    WHEN factor_contributions IS NULL THEN 'NULL'
    WHEN jsonb_array_length(factor_contributions) = 0 THEN 'EMPTY ARRAY'
    ELSE 'HAS DATA (' || jsonb_array_length(factor_contributions)::text || ' factors)'
  END as factor_contributions_status,
  -- Check predicted scores
  predicted_total,
  predicted_home_score,
  predicted_away_score,
  baseline_avg,
  market_total,
  -- Check bold predictions
  CASE 
    WHEN bold_predictions IS NULL THEN 'NULL'
    ELSE 'HAS DATA'
  END as bold_predictions_status,
  created_at,
  updated_at
FROM runs
WHERE run_id = (SELECT run_id FROM picks WHERE id = '56d51cf4-bb22-4f98-937a-059e752b7315');

-- 3. Get the full factor_contributions array
SELECT 
  run_id,
  factor_contributions
FROM runs
WHERE run_id = (SELECT run_id FROM picks WHERE id = '56d51cf4-bb22-4f98-937a-059e752b7315');

-- 4. Get the bold_predictions
SELECT 
  run_id,
  bold_predictions
FROM runs
WHERE run_id = (SELECT run_id FROM picks WHERE id = '56d51cf4-bb22-4f98-937a-059e752b7315');

-- 5. Check if there are multiple runs for the same game (potential duplicates)
SELECT 
  r.id,
  r.run_id,
  r.game_id,
  r.units,
  r.confidence,
  jsonb_array_length(r.factor_contributions) as factor_count,
  r.predicted_total,
  r.created_at,
  r.updated_at
FROM runs r
WHERE r.game_id = (
  SELECT game_id 
  FROM runs 
  WHERE run_id = (SELECT run_id FROM picks WHERE id = '56d51cf4-bb22-4f98-937a-059e752b7315')
)
ORDER BY r.created_at DESC;

