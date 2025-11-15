-- Migration 062: Add capper_profiles entries for preset system cappers
-- This enables the Configure Factors modal on the management page to work with all system cappers
-- 
-- Background:
-- - SHIVA and IFRIT use capper_profiles table for factor configuration
-- - New preset cappers (SENTINEL, NEXUS, BLITZ, TITAN, THIEF) were created in user_cappers table
-- - Both systems use the SAME factor calculation formulas from src/lib/cappers/shiva-v1/factors/
-- - This migration adds capper_profiles entries so all system cappers can be managed the same way
--
-- Factor Mapping:
-- - paceIndex: Matchup Pace Index (F1)
-- - offForm: Offensive Form vs League (F2) 
-- - defErosion: Defensive Erosion (F3)
-- - threeEnv: 3-Point Environment (F4)
-- - whistleEnv: Free-Throw/Whistle Environment (F5)
-- - injuryAvailability: Key Injuries & Availability (F6)
-- - edgeVsMarket: Edge vs Market - Totals (always 100%, locked)
--
-- SPREAD factors:
-- - netRatingDiff: Net Rating Differential (S1)
-- - turnoverDiff: Turnover Differential (S2)
-- - shootingMomentum: Shooting Efficiency + Momentum (S3)
-- - paceMismatch: Pace Mismatch (S4)
-- - fourFactorsDiff: Four Factors Differential (S5)
-- - injuryAvailabilitySpread: Key Injuries & Availability - Spread (S6)
-- - edgeVsMarketSpread: Edge vs Market - Spread (always 100%, locked)

-- SENTINEL (Conservative) - Low-risk, defensive focus
INSERT INTO capper_profiles (id, capper_id, sport, bet_type, name, description, factors, is_active, is_default) VALUES 
('sentinel-nba-total-default', 'SENTINEL', 'NBA', 'TOTAL', 'SENTINEL NBA TOTAL', 'Conservative low-risk capper emphasizing defensive stability', 
'[{"key":"edgeVsMarket","weight":100,"enabled":true},{"key":"paceIndex","weight":20,"enabled":true},{"key":"offForm","weight":70,"enabled":true},{"key":"defErosion","weight":40,"enabled":true},{"key":"whistleEnv","weight":60,"enabled":true},{"key":"injuryAvailability","weight":60,"enabled":true}]'::jsonb, true, true),
('sentinel-nba-spread-default', 'SENTINEL', 'NBA', 'SPREAD', 'SENTINEL NBA SPREAD', 'Conservative spread capper emphasizing defensive balance', 
'[{"key":"edgeVsMarketSpread","weight":100,"enabled":true},{"key":"netRatingDiff","weight":70,"enabled":true},{"key":"turnoverDiff","weight":60,"enabled":true},{"key":"shootingMomentum","weight":30,"enabled":true},{"key":"fourFactorsDiff","weight":40,"enabled":true},{"key":"injuryAvailabilitySpread","weight":50,"enabled":true}]'::jsonb, true, true)
ON CONFLICT (id) DO NOTHING;

-- NEXUS (Balanced Sharp) - Even distribution, data-driven
INSERT INTO capper_profiles (id, capper_id, sport, bet_type, name, description, factors, is_active, is_default) VALUES 
('nexus-nba-total-default', 'NEXUS', 'NBA', 'TOTAL', 'NEXUS NBA TOTAL', 'Balanced data-driven capper with even weight distribution', 
'[{"key":"edgeVsMarket","weight":100,"enabled":true},{"key":"paceIndex","weight":45,"enabled":true},{"key":"offForm","weight":50,"enabled":true},{"key":"defErosion","weight":50,"enabled":true},{"key":"threeEnv","weight":50,"enabled":true},{"key":"injuryAvailability","weight":55,"enabled":true}]'::jsonb, true, true),
('nexus-nba-spread-default', 'NEXUS', 'NBA', 'SPREAD', 'NEXUS NBA SPREAD', 'Balanced spread capper with even weight distribution', 
'[{"key":"edgeVsMarketSpread","weight":100,"enabled":true},{"key":"netRatingDiff","weight":50,"enabled":true},{"key":"turnoverDiff","weight":50,"enabled":true},{"key":"shootingMomentum","weight":50,"enabled":true},{"key":"paceMismatch","weight":50,"enabled":true},{"key":"injuryAvailabilitySpread","weight":50,"enabled":true}]'::jsonb, true, true)
ON CONFLICT (id) DO NOTHING;

-- BLITZ (Pace Demon) - High-scoring, pace emphasis
INSERT INTO capper_profiles (id, capper_id, sport, bet_type, name, description, factors, is_active, is_default) VALUES 
('blitz-nba-total-default', 'BLITZ', 'NBA', 'TOTAL', 'BLITZ NBA TOTAL', 'Aggressive high-scoring capper emphasizing pace and offense', 
'[{"key":"edgeVsMarket","weight":100,"enabled":true},{"key":"paceIndex","weight":100,"enabled":true},{"key":"offForm","weight":50,"enabled":true},{"key":"threeEnv","weight":70,"enabled":true},{"key":"defErosion","weight":30,"enabled":true}]'::jsonb, true, true),
('blitz-nba-spread-default', 'BLITZ', 'NBA', 'SPREAD', 'BLITZ NBA SPREAD', 'Aggressive spread capper emphasizing pace mismatch', 
'[{"key":"edgeVsMarketSpread","weight":100,"enabled":true},{"key":"paceMismatch","weight":80,"enabled":true},{"key":"netRatingDiff","weight":60,"enabled":true},{"key":"shootingMomentum","weight":50,"enabled":true},{"key":"turnoverDiff","weight":30,"enabled":true},{"key":"fourFactorsDiff","weight":30,"enabled":true}]'::jsonb, true, true)
ON CONFLICT (id) DO NOTHING;

-- TITAN (Grind-It-Out) - Defensive efficiency, slow pace
INSERT INTO capper_profiles (id, capper_id, sport, bet_type, name, description, factors, is_active, is_default) VALUES 
('titan-nba-total-default', 'TITAN', 'NBA', 'TOTAL', 'TITAN NBA TOTAL', 'Defensive grind-it-out capper emphasizing low-pace games', 
'[{"key":"edgeVsMarket","weight":100,"enabled":true},{"key":"offForm","weight":80,"enabled":true},{"key":"whistleEnv","weight":70,"enabled":true},{"key":"defErosion","weight":50,"enabled":true},{"key":"injuryAvailability","weight":35,"enabled":true},{"key":"paceIndex","weight":15,"enabled":true}]'::jsonb, true, true),
('titan-nba-spread-default', 'TITAN', 'NBA', 'SPREAD', 'TITAN NBA SPREAD', 'Defensive spread capper emphasizing efficiency and turnovers', 
'[{"key":"edgeVsMarketSpread","weight":100,"enabled":true},{"key":"netRatingDiff","weight":80,"enabled":true},{"key":"turnoverDiff","weight":70,"enabled":true},{"key":"fourFactorsDiff","weight":40,"enabled":true},{"key":"shootingMomentum","weight":30,"enabled":true},{"key":"injuryAvailabilitySpread","weight":30,"enabled":true}]'::jsonb, true, true)
ON CONFLICT (id) DO NOTHING;

-- THIEF (Contrarian) - Fade public, underlying metrics
INSERT INTO capper_profiles (id, capper_id, sport, bet_type, name, description, factors, is_active, is_default) VALUES 
('thief-nba-total-default', 'THIEF', 'NBA', 'TOTAL', 'THIEF NBA TOTAL', 'Contrarian capper fading public perception and finding value', 
'[{"key":"edgeVsMarket","weight":100,"enabled":true},{"key":"offForm","weight":80,"enabled":true},{"key":"threeEnv","weight":60,"enabled":true},{"key":"paceIndex","weight":50,"enabled":true},{"key":"defErosion","weight":20,"enabled":true},{"key":"whistleEnv","weight":20,"enabled":true},{"key":"injuryAvailability","weight":20,"enabled":true}]'::jsonb, true, true),
('thief-nba-spread-default', 'THIEF', 'NBA', 'SPREAD', 'THIEF NBA SPREAD', 'Contrarian spread capper emphasizing underlying efficiency metrics', 
'[{"key":"edgeVsMarketSpread","weight":100,"enabled":true},{"key":"netRatingDiff","weight":80,"enabled":true},{"key":"fourFactorsDiff","weight":80,"enabled":true},{"key":"paceMismatch","weight":50,"enabled":true},{"key":"injuryAvailabilitySpread","weight":20,"enabled":true},{"key":"turnoverDiff","weight":10,"enabled":true},{"key":"shootingMomentum","weight":10,"enabled":true}]'::jsonb, true, true)
ON CONFLICT (id) DO NOTHING;

-- Verification query (commented out - for manual testing):
-- SELECT id, capper_id, sport, bet_type, name FROM capper_profiles WHERE capper_id IN ('SENTINEL', 'NEXUS', 'BLITZ', 'TITAN', 'THIEF') ORDER BY capper_id, bet_type;

