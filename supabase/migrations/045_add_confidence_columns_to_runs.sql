-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 045: ADD CONFIDENCE COLUMNS TO RUNS TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- PURPOSE:
--   Add separate columns for confidence values to the runs table to eliminate
--   dependency on nested metadata.steps structure
--   
-- CHANGES:
--   1. Add conf7 column (base confidence from Step 4)
--   2. Add conf_market_adj column (market edge adjustment from Step 5)
--   3. Add conf_final column (final confidence from Step 5)
--
-- RATIONALE:
--   - Makes data queryable and easy to validate
--   - Consistent with existing pattern (factor_contributions, predicted_total, etc.)
--   - Eliminates fragile nested metadata paths
--   - Works identically for both TOTAL and SPREAD bet types
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Add confidence columns to runs table
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS conf7 DECIMAL,
  ADD COLUMN IF NOT EXISTS conf_market_adj DECIMAL,
  ADD COLUMN IF NOT EXISTS conf_final DECIMAL;

-- Add comments to document the columns
COMMENT ON COLUMN runs.conf7 IS 'Base confidence score from Step 4 (before market edge adjustment). Range: 0-10. Same for both TOTAL and SPREAD bet types.';
COMMENT ON COLUMN runs.conf_market_adj IS 'Market edge adjustment from Step 5 (Edge vs Market factor contribution). Can be positive or negative.';
COMMENT ON COLUMN runs.conf_final IS 'Final confidence score from Step 5 (after market edge adjustment). Range: 0-15+. Used for unit allocation.';

