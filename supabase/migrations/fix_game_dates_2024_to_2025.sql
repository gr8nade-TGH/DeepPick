-- Fix game dates from 2024 back to 2025
-- We incorrectly changed them to 2024, but it's actually 2025

-- Update all games with dates in 2024 back to 2025
UPDATE games
SET 
  game_date = (game_date + INTERVAL '1 year')::date
WHERE 
  EXTRACT(YEAR FROM game_date) = 2024
  AND sport = 'nba';

-- Also update game_start_timestamp if it exists
UPDATE games
SET 
  game_start_timestamp = (game_start_timestamp + INTERVAL '1 year')
WHERE 
  game_start_timestamp IS NOT NULL
  AND EXTRACT(YEAR FROM game_start_timestamp) = 2024
  AND sport = 'nba';

-- Verify the update
SELECT 
  COUNT(*) as total_games,
  MIN(game_date) as earliest_game,
  MAX(game_date) as latest_game,
  COUNT(CASE WHEN EXTRACT(YEAR FROM game_date) = 2024 THEN 1 END) as games_still_in_2024,
  COUNT(CASE WHEN EXTRACT(YEAR FROM game_date) = 2025 THEN 1 END) as games_in_2025
FROM games
WHERE sport = 'nba';

