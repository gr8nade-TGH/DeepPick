-- =====================================================
-- PICKSMITH: Consensus Meta-Capper
-- =====================================================
-- PICKSMITH doesn't analyze games directly. Instead, it:
-- 1. Monitors picks from other system cappers with positive unit records
-- 2. Generates picks when 2+ cappers agree on the same side
-- 3. Skips when cappers are split (1v1 disagreement blocks)
-- 4. Weighs by capper record and bet sizes
-- =====================================================

-- Add PICKSMITH to user_cappers table (system capper registry)
INSERT INTO user_cappers (
  capper_id,
  display_name,
  description,
  sport,
  bet_types,
  is_active,
  is_system_capper,
  avatar_url,
  color_theme,
  created_at,
  updated_at
) VALUES (
  'picksmith',
  'PICKSMITH',
  'Consensus meta-capper that aggregates picks from high-performing system cappers. Only bets when multiple profitable cappers agree on the same side.',
  'NBA',
  ARRAY['TOTAL', 'SPREAD'],
  true,
  true,
  '/cappers/picksmith.png',
  '#FFD700', -- Gold color for the "master smith" theme
  NOW(),
  NOW()
) ON CONFLICT (capper_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  color_theme = EXCLUDED.color_theme,
  updated_at = NOW();

-- Add PICKSMITH profiles for TOTAL and SPREAD
-- Note: PICKSMITH doesn't use traditional factors - it uses consensus logic
INSERT INTO capper_profiles (
  id,
  capper_id,
  sport,
  bet_type,
  name,
  description,
  factors,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES 
(
  'picksmith-nba-total-default',
  'PICKSMITH',
  'NBA',
  'TOTAL',
  'PICKSMITH NBA TOTAL',
  'Consensus-based total picks from profitable system cappers',
  '[
    {
      "key": "consensus",
      "name": "Capper Consensus",
      "description": "Number of profitable cappers agreeing on this pick",
      "weight": 100,
      "enabled": true
    },
    {
      "key": "unitWeight",
      "name": "Unit Weighting",
      "description": "Weighted average of agreeing cappers bet sizes",
      "weight": 50,
      "enabled": true
    },
    {
      "key": "recordWeight",
      "name": "Record Weighting",
      "description": "Weight by capper overall unit record",
      "weight": 50,
      "enabled": true
    }
  ]'::jsonb,
  true,
  true,
  NOW(),
  NOW()
),
(
  'picksmith-nba-spread-default',
  'PICKSMITH',
  'NBA',
  'SPREAD',
  'PICKSMITH NBA SPREAD',
  'Consensus-based spread picks from profitable system cappers',
  '[
    {
      "key": "consensus",
      "name": "Capper Consensus",
      "description": "Number of profitable cappers agreeing on this pick",
      "weight": 100,
      "enabled": true
    },
    {
      "key": "unitWeight",
      "name": "Unit Weighting",
      "description": "Weighted average of agreeing cappers bet sizes",
      "weight": 50,
      "enabled": true
    },
    {
      "key": "recordWeight",
      "name": "Record Weighting",
      "description": "Weight by capper overall unit record",
      "weight": 50,
      "enabled": true
    }
  ]'::jsonb,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  factors = EXCLUDED.factors,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Add comment for documentation
COMMENT ON TABLE user_cappers IS 'Registry of all cappers (system AI cappers + human cappers). PICKSMITH is a special meta-capper that aggregates consensus from other system cappers.';

