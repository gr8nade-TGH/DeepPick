-- =====================================================
-- CAPPER STATS: SINGLE SOURCE OF TRUTH
-- =====================================================
-- This migration creates a materialized view that serves as the
-- single source of truth for all capper statistics across the app.
-- Used by: Dashboard, Leaderboard, Public Profiles, Battle Map, etc.

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS capper_stats CASCADE;

-- Create materialized view for capper statistics
CREATE MATERIALIZED VIEW capper_stats AS
WITH graded_picks AS (
  -- Get all graded picks (won, lost, push)
  SELECT 
    capper,
    status,
    units,
    net_units,
    created_at,
    game_snapshot
  FROM picks
  WHERE status IN ('won', 'lost', 'push')
),
capper_aggregates AS (
  -- Aggregate stats per capper
  SELECT
    capper,
    COUNT(*) as total_picks,
    SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as losses,
    SUM(CASE WHEN status = 'push' THEN 1 ELSE 0 END) as pushes,
    SUM(units) as units_bet,
    SUM(net_units) as net_units,
    MIN(created_at) as first_pick_date,
    MAX(created_at) as last_pick_date
  FROM graded_picks
  GROUP BY capper
)
SELECT
  ca.capper,
  ca.total_picks,
  ca.wins,
  ca.losses,
  ca.pushes,
  -- Win Rate = (wins / (wins + losses)) * 100 - EXCLUDES PUSHES
  CASE 
    WHEN (ca.wins + ca.losses) > 0 
    THEN ROUND((ca.wins::DECIMAL / (ca.wins + ca.losses)) * 100, 1)
    ELSE 0
  END as win_rate,
  ca.units_bet,
  ca.net_units,
  -- ROI = (net_units / units_bet) * 100
  CASE 
    WHEN ca.units_bet > 0 
    THEN ROUND((ca.net_units / ca.units_bet) * 100, 1)
    ELSE 0
  END as roi,
  ca.first_pick_date,
  ca.last_pick_date,
  -- Join with user_cappers to get display name and type
  COALESCE(uc.display_name, UPPER(ca.capper)) as display_name,
  COALESCE(uc.is_system_capper, false) as is_system_capper,
  uc.avatar_url,
  uc.color_theme,
  NOW() as last_refreshed
FROM capper_aggregates ca
LEFT JOIN user_cappers uc ON ca.capper = uc.capper_id;

-- Create unique index on capper for fast lookups
CREATE UNIQUE INDEX idx_capper_stats_capper ON capper_stats(capper);

-- Create index on ROI for leaderboard sorting
CREATE INDEX idx_capper_stats_roi ON capper_stats(roi DESC);

-- Create index on net_units for leaderboard sorting
CREATE INDEX idx_capper_stats_net_units ON capper_stats(net_units DESC);

-- Add comments
COMMENT ON MATERIALIZED VIEW capper_stats IS 'Single source of truth for all capper statistics. Refreshed automatically on pick grading.';
COMMENT ON COLUMN capper_stats.capper IS 'Capper ID (lowercase)';
COMMENT ON COLUMN capper_stats.total_picks IS 'Total graded picks (won + lost + push)';
COMMENT ON COLUMN capper_stats.win_rate IS 'Win rate percentage (excludes pushes)';
COMMENT ON COLUMN capper_stats.roi IS 'Return on investment percentage';
COMMENT ON COLUMN capper_stats.last_refreshed IS 'Timestamp of last materialized view refresh';

-- =====================================================
-- AUTO-REFRESH TRIGGER
-- =====================================================
-- Automatically refresh the materialized view when picks are graded

CREATE OR REPLACE FUNCTION refresh_capper_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if status changed to/from graded state
  IF (NEW.status IN ('won', 'lost', 'push') AND OLD.status NOT IN ('won', 'lost', 'push'))
     OR (OLD.status IN ('won', 'lost', 'push') AND NEW.status NOT IN ('won', 'lost', 'push')) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY capper_stats;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_capper_stats
AFTER UPDATE OF status ON picks
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats();

-- Also refresh on new graded picks
CREATE OR REPLACE FUNCTION refresh_capper_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('won', 'lost', 'push') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY capper_stats;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_capper_stats_on_insert
AFTER INSERT ON picks
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats_on_insert();

-- Initial refresh
REFRESH MATERIALIZED VIEW capper_stats;

