-- Create battle_matchups table for Battle Bets game
-- This table tracks all battle matchups between cappers with opposing SPREAD picks

CREATE TABLE IF NOT EXISTS battle_matchups (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Game reference
  game_id UUID REFERENCES games(id) NOT NULL,
  
  -- Capper matchup
  left_capper_id TEXT NOT NULL,  -- Capper who picked left team (e.g., 'shiva')
  right_capper_id TEXT NOT NULL, -- Capper who picked right team (e.g., 'ifrit')
  
  -- Pick references
  left_pick_id UUID REFERENCES picks(id) NOT NULL,
  right_pick_id UUID REFERENCES picks(id) NOT NULL,
  
  -- Game info snapshot (at time of battle creation)
  left_team TEXT NOT NULL,   -- Team abbreviation (e.g., 'LAL')
  right_team TEXT NOT NULL,  -- Team abbreviation (e.g., 'MEM')
  spread DECIMAL NOT NULL,   -- e.g., -4.5 (from left team's perspective)
  
  -- Battle state
  status TEXT NOT NULL DEFAULT 'scheduled', 
  -- Possible values: 'scheduled', 'q1_pending', 'q1_complete', 'q2_pending', 'q2_complete', 
  --                  'halftime', 'q3_pending', 'q3_complete', 'q4_pending', 'q4_complete', 
  --                  'final', 'complete'
  current_quarter INT DEFAULT 0,
  
  -- HP tracking (starts at 100 for each capper)
  left_hp INT DEFAULT 100,
  right_hp INT DEFAULT 100,
  
  -- Score tracking (cumulative)
  left_score INT DEFAULT 0,
  right_score INT DEFAULT 0,
  
  -- Quarter completion tracking
  q1_complete BOOLEAN DEFAULT FALSE,
  q2_complete BOOLEAN DEFAULT FALSE,
  q3_complete BOOLEAN DEFAULT FALSE,
  q4_complete BOOLEAN DEFAULT FALSE,
  
  -- Quarter stats (stored after each quarter completes)
  -- Format: { left: { pts: 28, reb: 12, ast: 7, blk: 2, threes: 3 }, right: { pts: 25, reb: 10, ast: 6, blk: 1, threes: 2 } }
  q1_stats JSONB,
  q2_stats JSONB,
  q3_stats JSONB,
  q4_stats JSONB,
  
  -- Timing (estimated quarter end times)
  game_start_time TIMESTAMPTZ,
  q1_end_time TIMESTAMPTZ,
  q2_end_time TIMESTAMPTZ,
  halftime_end_time TIMESTAMPTZ,
  q3_end_time TIMESTAMPTZ,
  q4_end_time TIMESTAMPTZ,
  
  -- Result
  winner TEXT,  -- 'left', 'right', 'draw', NULL (if not complete)
  final_blow_side TEXT,  -- Which side fired final blow ('left', 'right', NULL)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_battle_matchups_game_id ON battle_matchups(game_id);
CREATE INDEX IF NOT EXISTS idx_battle_matchups_status ON battle_matchups(status);
CREATE INDEX IF NOT EXISTS idx_battle_matchups_left_capper ON battle_matchups(left_capper_id);
CREATE INDEX IF NOT EXISTS idx_battle_matchups_right_capper ON battle_matchups(right_capper_id);
CREATE INDEX IF NOT EXISTS idx_battle_matchups_game_start ON battle_matchups(game_start_time);

-- Composite index for finding active battles
CREATE INDEX IF NOT EXISTS idx_battle_matchups_active ON battle_matchups(status, game_start_time) 
WHERE status NOT IN ('complete');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_battle_matchups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_battle_matchups_updated_at
  BEFORE UPDATE ON battle_matchups
  FOR EACH ROW
  EXECUTE FUNCTION update_battle_matchups_updated_at();

-- Comments for documentation
COMMENT ON TABLE battle_matchups IS 'Tracks battle matchups between cappers with opposing SPREAD picks';
COMMENT ON COLUMN battle_matchups.left_capper_id IS 'Capper who picked the left team (home team or first team listed)';
COMMENT ON COLUMN battle_matchups.right_capper_id IS 'Capper who picked the right team (away team or second team listed)';
COMMENT ON COLUMN battle_matchups.spread IS 'Spread line from left team perspective (e.g., -4.5 means left team favored by 4.5)';
COMMENT ON COLUMN battle_matchups.status IS 'Current battle state: scheduled, q1_pending, q1_complete, q2_pending, q2_complete, halftime, q3_pending, q3_complete, q4_pending, q4_complete, final, complete';
COMMENT ON COLUMN battle_matchups.q1_stats IS 'Quarter 1 stats in JSON format: { left: { pts, reb, ast, blk, threes }, right: { pts, reb, ast, blk, threes } }';

