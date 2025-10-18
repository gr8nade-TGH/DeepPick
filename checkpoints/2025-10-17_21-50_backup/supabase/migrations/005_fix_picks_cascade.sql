-- Fix the picks table to preserve picks when games are archived
-- Make game_id nullable and change foreign key to SET NULL

-- Drop the existing foreign key constraint
ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_game_id_fkey;

-- Make game_id nullable
ALTER TABLE picks ALTER COLUMN game_id DROP NOT NULL;

-- Add foreign key back with SET NULL on delete
ALTER TABLE picks 
  ADD CONSTRAINT picks_game_id_fkey 
  FOREIGN KEY (game_id) 
  REFERENCES games(id) 
  ON DELETE SET NULL;

