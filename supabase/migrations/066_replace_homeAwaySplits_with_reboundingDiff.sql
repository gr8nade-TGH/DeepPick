-- Migration: Replace homeAwaySplits with reboundingDiff in all capper factor configs
-- The homeAwaySplits factor was broken (MySportsFeeds doesn't provide home/away split data)
-- Replacing with reboundingDiff which uses reliably available rebounding stats

-- Update all user_cappers that have homeAwaySplits in their SPREAD factor config
UPDATE user_cappers
SET factor_config = jsonb_set(
  factor_config,
  '{SPREAD}',
  (
    SELECT jsonb_build_object(
      'enabled_factors', 
      (
        SELECT jsonb_agg(
          CASE 
            WHEN elem = 'homeAwaySplits' THEN 'reboundingDiff'
            WHEN elem = 'paceMismatch' THEN 'reboundingDiff'
            ELSE elem
          END
        )
        FROM jsonb_array_elements_text(factor_config->'SPREAD'->'enabled_factors') AS elem
      ),
      'weights',
      (
        SELECT jsonb_object_agg(
          CASE 
            WHEN key = 'homeAwaySplits' THEN 'reboundingDiff'
            WHEN key = 'paceMismatch' THEN 'reboundingDiff'
            ELSE key
          END,
          value
        )
        FROM jsonb_each(factor_config->'SPREAD'->'weights')
      )
    )
  )
)
WHERE factor_config->'SPREAD'->'enabled_factors' IS NOT NULL
  AND (
    factor_config->'SPREAD'->'enabled_factors' @> '"homeAwaySplits"'::jsonb
    OR factor_config->'SPREAD'->'enabled_factors' @> '"paceMismatch"'::jsonb
  );

-- Log the migration
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % user_cappers with reboundingDiff replacing homeAwaySplits/paceMismatch', updated_count;
END $$;

