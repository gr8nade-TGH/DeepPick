-- Check if the pick exists
SELECT 
  id,
  run_id,
  pick_type,
  selection,
  units,
  confidence,
  created_at
FROM picks
WHERE id = '7b6f08d0-a471-417b-9b4d-dcc319b7d79a';

-- Check if the run exists
SELECT 
  id,
  run_id,
  game_id,
  capper,
  state,
  created_at,
  CASE 
    WHEN metadata IS NULL THEN 'NULL'
    WHEN jsonb_typeof(metadata) = 'object' THEN 'HAS METADATA'
    ELSE 'INVALID'
  END as metadata_status
FROM runs
WHERE run_id = (SELECT run_id FROM picks WHERE id = '7b6f08d0-a471-417b-9b4d-dcc319b7d79a');

