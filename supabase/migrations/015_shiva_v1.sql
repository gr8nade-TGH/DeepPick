-- SHIVA v1 Core Schema

-- 1) runs
CREATE TABLE IF NOT EXISTS runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_run_id UUID NULL REFERENCES runs(run_id) ON DELETE SET NULL,
  game_id UUID NOT NULL,
  sport TEXT NOT NULL,
  capper TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('NEW', 'IN-PROGRESS', 'COMPLETE', 'VOIDED')),
  ai_step3 TEXT,
  ai_step4 TEXT,
  conf7 NUMERIC,
  conf_market_adj NUMERIC,
  conf_final NUMERIC,
  units NUMERIC,
  pick_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique per (game_id, capper) for non-voided runs
CREATE UNIQUE INDEX IF NOT EXISTS uniq_runs_game_capper_active
  ON runs (game_id, capper)
  WHERE state <> 'VOIDED';

CREATE INDEX IF NOT EXISTS idx_runs_state ON runs(state);

-- 2) odds_snapshots (immutable rows; one active per run)
CREATE TABLE IF NOT EXISTS odds_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active snapshot per run
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_snapshot_per_run
  ON odds_snapshots(run_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_run_active
  ON odds_snapshots(run_id, is_active);

-- 3) factors (versioned; latest per factor_no used for compute)
CREATE TABLE IF NOT EXISTS factors (
  run_id UUID NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  factor_no SMALLINT NOT NULL CHECK (factor_no BETWEEN 1 AND 8),
  raw_values_json JSONB,
  parsed_values_json JSONB,
  normalized_value NUMERIC,
  weight_applied NUMERIC,
  caps_applied BOOLEAN,
  cap_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factors_run_factor
  ON factors(run_id, factor_no);

-- 4) insight_cards
CREATE TABLE IF NOT EXISTS insight_cards (
  run_id UUID PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
  rendered_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) picks.run_id (nullable for legacy; required for SHIVA at app layer)
ALTER TABLE picks ADD COLUMN IF NOT EXISTS run_id UUID NULL REFERENCES runs(run_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_picks_run_id ON picks(run_id);

-- 6) idempotency keys (per run + step)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  run_id UUID NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, step, key)
);

-- 7) Read-only view: shiva_picks_view
CREATE OR REPLACE VIEW shiva_picks_view AS
WITH latest_factors AS (
  SELECT run_id, factor_no, raw_values_json, parsed_values_json, normalized_value, weight_applied, caps_applied, cap_reason
  FROM (
    SELECT f.*, ROW_NUMBER() OVER (PARTITION BY run_id, factor_no ORDER BY created_at DESC) AS rn
    FROM factors f
  ) t
  WHERE rn = 1
), active_snapshots AS (
  SELECT run_id, payload_json AS odds_snapshot
  FROM odds_snapshots
  WHERE is_active = true
)
SELECT p.*, r.sport, r.capper, r.state,
       r.conf7, r.conf_market_adj, r.conf_final, r.units, r.pick_type,
       asnap.odds_snapshot,
       -- derived edge_type based on pick_type (simple mapping)
       CASE 
         WHEN r.pick_type IN ('spread', 'moneyline') THEN 'side'
         WHEN r.pick_type LIKE 'total%' OR r.pick_type = 'total' THEN 'total'
         ELSE NULL
       END AS edge_type
FROM picks p
JOIN runs r ON p.run_id = r.run_id
LEFT JOIN active_snapshots asnap ON asnap.run_id = r.run_id;


