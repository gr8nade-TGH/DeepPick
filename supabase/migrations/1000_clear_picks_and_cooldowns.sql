-- Clear all picks and cooldowns
-- This resets the picks system to start fresh with the new factor weighting logic

-- Delete all picks
DELETE FROM picks;

-- Delete all cooldowns
DELETE FROM shiva_cooldowns;

-- Reset any pick-related sequences (if they exist)
-- This ensures pick IDs start fresh

-- Log the reset
DO $$
BEGIN
  RAISE NOTICE 'Cleared all picks and cooldowns at %', NOW();
END $$;

