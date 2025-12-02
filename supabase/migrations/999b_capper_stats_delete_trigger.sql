-- =====================================================
-- FIX: Add DELETE trigger for capper_stats materialized view
-- =====================================================
-- When picks are deleted, the materialized view needs to refresh
-- Previously only INSERT and UPDATE triggers existed

-- Create function to refresh on delete
CREATE OR REPLACE FUNCTION refresh_capper_stats_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh if deleted pick was graded
  IF OLD.status IN ('won', 'lost', 'push') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY capper_stats;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS trigger_refresh_capper_stats_on_delete ON picks;
CREATE TRIGGER trigger_refresh_capper_stats_on_delete
AFTER DELETE ON picks
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats_on_delete();

-- =====================================================
-- FIX: Include ALL cappers in stats (even without picks)
-- =====================================================
-- New cappers should appear in leaderboard with 0-0 record
-- Currently, only cappers with graded picks appear

DROP MATERIALIZED VIEW IF EXISTS capper_stats CASCADE;

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
),
all_cappers AS (
  -- Get all cappers from user_cappers table (including those without picks)
  SELECT 
    capper_id as capper,
    display_name,
    is_system_capper,
    avatar_url,
    color_theme
  FROM user_cappers
  WHERE is_active = true
)
-- Full outer join: all cappers + all cappers with picks
SELECT
  COALESCE(ac.capper, ca.capper) as capper,
  COALESCE(ca.total_picks, 0) as total_picks,
  COALESCE(ca.wins, 0) as wins,
  COALESCE(ca.losses, 0) as losses,
  COALESCE(ca.pushes, 0) as pushes,
  -- Win Rate = (wins / (wins + losses)) * 100 - EXCLUDES PUSHES
  CASE 
    WHEN COALESCE(ca.wins, 0) + COALESCE(ca.losses, 0) > 0 
    THEN ROUND((COALESCE(ca.wins, 0)::DECIMAL / (COALESCE(ca.wins, 0) + COALESCE(ca.losses, 0))) * 100, 1)
    ELSE 0
  END as win_rate,
  COALESCE(ca.units_bet, 0) as units_bet,
  COALESCE(ca.net_units, 0) as net_units,
  -- ROI = (net_units / units_bet) * 100
  CASE 
    WHEN COALESCE(ca.units_bet, 0) > 0 
    THEN ROUND((COALESCE(ca.net_units, 0) / ca.units_bet) * 100, 1)
    ELSE 0
  END as roi,
  ca.first_pick_date,
  ca.last_pick_date,
  -- Get display name from user_cappers, fallback to uppercased capper ID
  COALESCE(ac.display_name, UPPER(COALESCE(ac.capper, ca.capper))) as display_name,
  COALESCE(ac.is_system_capper, false) as is_system_capper,
  ac.avatar_url,
  ac.color_theme,
  NOW() as last_refreshed
FROM all_cappers ac
FULL OUTER JOIN capper_aggregates ca ON ac.capper = ca.capper;

-- Recreate indexes
CREATE UNIQUE INDEX idx_capper_stats_capper ON capper_stats(capper);
CREATE INDEX idx_capper_stats_roi ON capper_stats(roi DESC);
CREATE INDEX idx_capper_stats_net_units ON capper_stats(net_units DESC);

-- Recreate triggers (they reference the view)
DROP TRIGGER IF EXISTS trigger_refresh_capper_stats ON picks;
DROP TRIGGER IF EXISTS trigger_refresh_capper_stats_on_insert ON picks;

CREATE TRIGGER trigger_refresh_capper_stats
AFTER UPDATE OF status ON picks
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats();

CREATE TRIGGER trigger_refresh_capper_stats_on_insert
AFTER INSERT ON picks
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats_on_insert();

CREATE TRIGGER trigger_refresh_capper_stats_on_delete
AFTER DELETE ON picks
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats_on_delete();

-- Also refresh when new capper is created
CREATE OR REPLACE FUNCTION refresh_capper_stats_on_capper_change()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY capper_stats;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_refresh_capper_stats_on_capper_change ON user_cappers;
CREATE TRIGGER trigger_refresh_capper_stats_on_capper_change
AFTER INSERT OR UPDATE OR DELETE ON user_cappers
FOR EACH ROW
EXECUTE FUNCTION refresh_capper_stats_on_capper_change();

-- Initial refresh
REFRESH MATERIALIZED VIEW capper_stats;

