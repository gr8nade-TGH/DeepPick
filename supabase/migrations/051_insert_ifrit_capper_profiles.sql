-- Migration: Insert IFRIT capper profiles for TOTAL and SPREAD
-- This creates factor configurations for IFRIT in capper_profiles table
-- IFRIT uses aggressive weights emphasizing offensive efficiency and pace

-- IFRIT NBA TOTAL Profile
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
) VALUES (
  'ifrit-nba-total-default',
  'IFRIT',
  'NBA',
  'TOTAL',
  'IFRIT NBA TOTAL Default',
  'Aggressive high-variance capper emphasizing offensive efficiency and pace',
  '[
    {
      "key": "edgeVsMarket",
      "icon": "⚖️",
      "name": "Edge vs Market - Totals",
      "scope": "global",
      "sport": "NBA",
      "weight": 100,
      "betType": "TOTAL",
      "enabled": true,
      "maxPoints": 3,
      "shortName": "Edge vs Market",
      "dataSource": "system",
      "description": "Final confidence adjustment based on predicted vs market line for totals"
    },
    {
      "key": "paceIndex",
      "icon": "⏱️",
      "name": "Matchup Pace Index",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 150,
      "betType": "TOTAL",
      "enabled": true,
      "maxPoints": 2,
      "shortName": "Pace",
      "dataSource": "nba-stats-api",
      "description": "Expected game pace vs league average (IFRIT: 1.5x weight)"
    },
    {
      "key": "offForm",
      "icon": "🔥",
      "name": "Offensive Form vs League",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 80,
      "betType": "TOTAL",
      "enabled": true,
      "maxPoints": 2,
      "shortName": "Offense",
      "dataSource": "nba-stats-api",
      "description": "Combined team offensive efficiency vs league average (IFRIT: 0.8x weight)"
    },
    {
      "key": "defErosion",
      "icon": "🛡️",
      "name": "Defensive Erosion",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 130,
      "betType": "TOTAL",
      "enabled": true,
      "maxPoints": 2,
      "shortName": "Defense",
      "dataSource": "nba-stats-api",
      "description": "Defensive rating decline + injury impact (IFRIT: 1.3x weight)"
    },
    {
      "key": "threeEnv",
      "icon": "🏹",
      "name": "3-Point Environment & Volatility",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 120,
      "betType": "TOTAL",
      "enabled": true,
      "maxPoints": 1,
      "shortName": "3P Env",
      "dataSource": "nba-stats-api",
      "description": "3-point attempt rate and recent shooting variance (IFRIT: 1.2x weight)"
    },
    {
      "key": "whistleEnv",
      "icon": "⛹️‍♂️",
      "name": "Free-Throw / Whistle Environment",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 70,
      "betType": "TOTAL",
      "enabled": true,
      "maxPoints": 1,
      "shortName": "FT Env",
      "dataSource": "nba-stats-api",
      "description": "Free throw rate environment for both teams (IFRIT: 0.7x weight)"
    }
  ]'::jsonb,
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  factors = EXCLUDED.factors,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

-- IFRIT NBA SPREAD Profile
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
) VALUES (
  'ifrit-nba-spread-default',
  'IFRIT',
  'NBA',
  'SPREAD',
  'IFRIT NBA SPREAD Default',
  'Aggressive spread capper emphasizing net rating and recent form',
  '[
    {
      "key": "edgeVsMarket",
      "icon": "⚖️",
      "name": "Edge vs Market - Spread",
      "scope": "global",
      "sport": "NBA",
      "weight": 100,
      "betType": "SPREAD",
      "enabled": true,
      "maxPoints": 3,
      "shortName": "Edge vs Market",
      "dataSource": "system",
      "description": "Final confidence adjustment based on predicted vs market spread"
    },
    {
      "key": "netRatingDiff",
      "icon": "📊",
      "name": "Net Rating Differential",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 140,
      "betType": "SPREAD",
      "enabled": true,
      "maxPoints": 2,
      "shortName": "NetRtg",
      "dataSource": "nba-stats-api",
      "description": "Offensive rating minus defensive rating differential (IFRIT: 1.4x weight)"
    },
    {
      "key": "recentForm",
      "icon": "📈",
      "name": "Recent Form Differential",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 110,
      "betType": "SPREAD",
      "enabled": true,
      "maxPoints": 2,
      "shortName": "Form",
      "dataSource": "nba-stats-api",
      "description": "Last 10 games performance differential (IFRIT: 1.1x weight)"
    },
    {
      "key": "homeCourtAdvantage",
      "icon": "🏠",
      "name": "Home Court Advantage",
      "scope": "team",
      "sport": "NBA",
      "weight": 90,
      "betType": "SPREAD",
      "enabled": true,
      "maxPoints": 1.5,
      "shortName": "Home",
      "dataSource": "nba-stats-api",
      "description": "Historical home/away performance differential (IFRIT: 0.9x weight)"
    },
    {
      "key": "h2hMatchup",
      "icon": "🤝",
      "name": "Head-to-Head Matchup",
      "scope": "matchup",
      "sport": "NBA",
      "weight": 130,
      "betType": "SPREAD",
      "enabled": true,
      "maxPoints": 1.5,
      "shortName": "H2H",
      "dataSource": "nba-stats-api",
      "description": "Recent head-to-head performance (IFRIT: 1.3x weight)"
    },
    {
      "key": "injuries",
      "icon": "🏥",
      "name": "Key Injuries & Availability",
      "scope": "team",
      "sport": "NBA",
      "weight": 120,
      "betType": "SPREAD",
      "enabled": true,
      "maxPoints": 1,
      "shortName": "Injuries",
      "dataSource": "llm",
      "description": "Impact of missing key players (IFRIT: 1.2x weight)"
    }
  ]'::jsonb,
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  factors = EXCLUDED.factors,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

