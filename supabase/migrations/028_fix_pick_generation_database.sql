-- ═══════════════════════════════════════════════════════════
-- FIX DATABASE ISSUES FOR PICK GENERATION
-- ═══════════════════════════════════════════════════════════
-- Fixes capper_type case sensitivity and ensures all tables exist

-- ───────────────────────────────────────────────────────────
-- 1. ENSURE PICK_GENERATION_COOLDOWNS TABLE EXISTS
-- ───────────────────────────────────────────────────────────

-- Create the table if it doesn't exist (from migration 026)
CREATE TABLE IF NOT EXISTS pick_generation_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  capper capper_type NOT NULL,
  bet_type TEXT NOT NULL,
  cooldown_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT DEFAULT 'pick_generation_attempt',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_pick_generation_cooldowns_game_capper_bet 
ON pick_generation_cooldowns (game_id, capper, bet_type);

CREATE INDEX IF NOT EXISTS idx_pick_generation_cooldowns_cooldown_until 
ON pick_generation_cooldowns (cooldown_until);

CREATE INDEX IF NOT EXISTS idx_pick_generation_cooldowns_created_at 
ON pick_generation_cooldowns (created_at DESC);

-- Enable RLS
ALTER TABLE pick_generation_cooldowns ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pick_generation_cooldowns' 
    AND policyname = 'Allow read access to pick generation cooldowns'
  ) THEN
    CREATE POLICY "Allow read access to pick generation cooldowns" ON pick_generation_cooldowns
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pick_generation_cooldowns' 
    AND policyname = 'Allow insert to pick generation cooldowns'
  ) THEN
    CREATE POLICY "Allow insert to pick generation cooldowns" ON pick_generation_cooldowns
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE pick_generation_cooldowns IS 'Tracks pick generation attempts and cooldown periods to prevent duplicate picks and excessive API calls';

-- ───────────────────────────────────────────────────────────
-- 2. ENSURE CAN_GENERATE_PICK FUNCTION EXISTS
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION can_generate_pick(
  p_game_id UUID,
  p_capper TEXT,
  p_bet_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_existing_pick BOOLEAN := FALSE;
  v_has_active_cooldown BOOLEAN := FALSE;
  v_mapped_capper capper_type;
BEGIN
  -- Map capper to lowercase to match enum
  v_mapped_capper := LOWER(p_capper)::capper_type;
  
  -- Check for existing picks (same game, capper, bet type, and active status)
  SELECT EXISTS(
    SELECT 1 FROM picks 
    WHERE 
      game_id = p_game_id 
      AND capper = v_mapped_capper
      AND pick_type = LOWER(p_bet_type) || '_over' OR pick_type = LOWER(p_bet_type) || '_under'
      AND status IN ('pending', 'active')
  ) INTO v_has_existing_pick;
  
  -- Check for active cooldown
  SELECT EXISTS(
    SELECT 1 FROM pick_generation_cooldowns 
    WHERE 
      game_id = p_game_id 
      AND capper = v_mapped_capper
      AND bet_type = LOWER(p_bet_type)
      AND cooldown_until > NOW()
  ) INTO v_has_active_cooldown;
  
  -- Return true only if no existing pick AND no active cooldown
  RETURN NOT v_has_existing_pick AND NOT v_has_active_cooldown;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_generate_pick IS 'Checks if a pick can be generated for a game/capper/bet_type combination';

-- ───────────────────────────────────────────────────────────
-- 3. ENSURE SHIVA_RUNS TABLE EXISTS
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shiva_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  capper capper_type NOT NULL DEFAULT 'shiva',
  bet_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shiva_runs_game_id ON shiva_runs(game_id);
CREATE INDEX IF NOT EXISTS idx_shiva_runs_capper_bet ON shiva_runs(capper, bet_type);
CREATE INDEX IF NOT EXISTS idx_shiva_runs_status ON shiva_runs(status);
CREATE INDEX IF NOT EXISTS idx_shiva_runs_created_at ON shiva_runs(created_at DESC);

-- Enable RLS
ALTER TABLE shiva_runs ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shiva_runs' 
    AND policyname = 'Allow all access to shiva_runs'
  ) THEN
    CREATE POLICY "Allow all access to shiva_runs" ON shiva_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE shiva_runs IS 'Tracks SHIVA pick generation runs and their status';

-- ───────────────────────────────────────────────────────────
-- 4. ENSURE PICKS TABLE HAS CAPPER COLUMN
-- ───────────────────────────────────────────────────────────

-- Add capper column if it doesn't exist
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS capper capper_type DEFAULT 'shiva';

-- Add pick_type column if it doesn't exist (for over/under distinction)
ALTER TABLE picks 
  ADD COLUMN IF NOT EXISTS pick_type TEXT;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_picks_game_capper_bet ON picks(game_id, capper, bet_type);
CREATE INDEX IF NOT EXISTS idx_picks_capper_status ON picks(capper, status);
CREATE INDEX IF NOT EXISTS idx_picks_pick_type ON picks(pick_type);

COMMENT ON COLUMN picks.capper IS 'Which capper generated this pick';
COMMENT ON COLUMN picks.pick_type IS 'Specific pick type (e.g., total_over, total_under)';

-- ───────────────────────────────────────────────────────────
-- 5. CREATE HELPER FUNCTION FOR PICK TYPE MAPPING
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pick_type(
  p_bet_type TEXT,
  p_direction TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(p_bet_type) || '_' || LOWER(p_direction);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pick_type IS 'Converts bet_type and direction to pick_type (e.g., total + over = total_over)';

-- ───────────────────────────────────────────────────────────
-- 6. CREATE VIEW FOR PICK GENERATION STATUS
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW pick_generation_status AS
SELECT 
  g.id as game_id,
  g.home_team->>'name' as home_team,
  g.away_team->>'name' as away_team,
  g.game_date,
  g.status as game_status,
  capper,
  bet_type,
  COUNT(p.id) as existing_picks,
  MAX(p.created_at) as last_pick_created,
  COUNT(c.id) as active_cooldowns,
  MAX(c.cooldown_until) as cooldown_until,
  can_generate_pick(g.id, capper::TEXT, bet_type) as can_generate
FROM games g
CROSS JOIN (SELECT unnest(enum_range(NULL::capper_type)) as capper) cappers
CROSS JOIN (VALUES ('total'), ('spread'), ('moneyline')) as bet_types(bet_type)
LEFT JOIN picks p ON p.game_id = g.id AND p.capper = cappers.capper AND p.bet_type = bet_types.bet_type
LEFT JOIN pick_generation_cooldowns c ON c.game_id = g.id AND c.capper = cappers.capper AND c.bet_type = bet_types.bet_type
WHERE g.status IN ('scheduled', 'live')
GROUP BY g.id, g.home_team, g.away_team, g.game_date, g.status, cappers.capper, bet_types.bet_type
ORDER BY g.game_date, g.home_team->>'name', cappers.capper, bet_types.bet_type;

COMMENT ON VIEW pick_generation_status IS 'Shows pick generation eligibility for all games/cappers/bet_types';

-- ═══════════════════════════════════════════════════════════
-- ✅ DATABASE ISSUES FIXED
-- ═══════════════════════════════════════════════════════════
-- Next steps:
-- 1. Deploy these migrations to Supabase
-- 2. Update TypeScript code to use lowercase capper names
-- 3. Test pick generation with proper database constraints
-- ═══════════════════════════════════════════════════════════
