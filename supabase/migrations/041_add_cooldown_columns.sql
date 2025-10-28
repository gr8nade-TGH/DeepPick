-- Add missing columns to pick_generation_cooldowns table
ALTER TABLE pick_generation_cooldowns 
  ADD COLUMN IF NOT EXISTS run_id TEXT,
  ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('PASS', 'PICK_GENERATED')),
  ADD COLUMN IF NOT EXISTS units NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5, 2);

-- Update unique constraint to include the new structure
ALTER TABLE pick_generation_cooldowns
  DROP CONSTRAINT IF EXISTS pick_generation_cooldowns_game_id_capper_bet_type_key;

ALTER TABLE pick_generation_cooldowns
  ADD CONSTRAINT pick_generation_cooldowns_game_id_capper_bet_type_key 
  UNIQUE(game_id, capper, bet_type);

