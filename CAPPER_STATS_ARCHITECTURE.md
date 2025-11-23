# Capper Stats Architecture: Single Source of Truth

## Problem Statement

Previously, capper statistics (wins, losses, ROI, win rate, etc.) were calculated in multiple places:
- `/api/performance` - Used by public profiles
- `/api/leaderboard` - Used by dashboard and leaderboard page
- `/api/battle-bets/[battleId]` - Used by battle map
- `/api/battle-bets/active` - Used by active battles

This led to **inconsistent data** across the application. For example:
- Sentinel's public profile showed: 44 picks, 27-17-0 record
- Dashboard/Leaderboard showed: 2 picks, 1-1-0 record

## Solution: Materialized View

We've created a **materialized view** called `capper_stats` that serves as the **single source of truth** for all capper statistics.

### Database Schema

```sql
CREATE MATERIALIZED VIEW capper_stats AS
SELECT
  capper,                    -- Capper ID (lowercase)
  total_picks,               -- Total graded picks (won + lost + push)
  wins,                      -- Number of wins
  losses,                    -- Number of losses
  pushes,                    -- Number of pushes
  win_rate,                  -- Win rate % (excludes pushes)
  units_bet,                 -- Total units wagered
  net_units,                 -- Net profit/loss in units
  roi,                       -- Return on investment %
  first_pick_date,           -- Date of first pick
  last_pick_date,            -- Date of most recent pick
  display_name,              -- Capper display name
  is_system_capper,          -- True for SHIVA, SENTINEL, etc.
  avatar_url,                -- Avatar URL (for user cappers)
  color_theme,               -- Color theme
  last_refreshed             -- Timestamp of last refresh
FROM ...
```

### Auto-Refresh Triggers

The materialized view is **automatically refreshed** when:
1. A pick's status changes to/from graded state (won, lost, push)
2. A new graded pick is inserted

This ensures the stats are always up-to-date without manual intervention.

### API Endpoint

**GET `/api/capper-stats`**

Query parameters:
- `capper` - Get stats for specific capper (e.g., `?capper=sentinel`)
- `limit` - Limit number of results (e.g., `?limit=10`)
- `sort` - Sort by `roi`, `net_units`, or `win_rate` (default: `net_units`)

Examples:
```typescript
// Get all cappers sorted by net units
const response = await fetch('/api/capper-stats')

// Get top 10 cappers by ROI
const response = await fetch('/api/capper-stats?sort=roi&limit=10')

// Get specific capper stats
const response = await fetch('/api/capper-stats?capper=sentinel')
```

Response format:
```json
{
  "success": true,
  "data": [
    {
      "capper": "sentinel",
      "total_picks": 44,
      "wins": 27,
      "losses": 17,
      "pushes": 0,
      "win_rate": 61.4,
      "units_bet": 44.0,
      "net_units": 24.2,
      "roi": 21.5,
      "display_name": "SENTINEL",
      "is_system_capper": true,
      "rank": 1
    }
  ]
}
```

## Migration Plan

### Phase 1: Deploy Database Changes ✅
1. Run migration `999_capper_stats_single_source_of_truth.sql`
2. Verify materialized view is created and populated
3. Test auto-refresh triggers

### Phase 2: Update API Routes (IN PROGRESS)
1. Update `/api/leaderboard` to use `/api/capper-stats`
2. Update `/api/performance` to use `/api/capper-stats`
3. Update battle-bets routes to use `/api/capper-stats`

### Phase 3: Update Frontend Components
1. Update Dashboard to use new API
2. Update Leaderboard page to use new API
3. Update Public Profiles to use new API
4. Update Battle Map to use new API

### Phase 4: Cleanup
1. Remove old calculation logic from routes
2. Add monitoring/logging for materialized view refresh
3. Document the new architecture

## Benefits

1. **Consistency**: All parts of the app show the same stats
2. **Performance**: Pre-calculated stats are faster than on-the-fly aggregation
3. **Maintainability**: Single place to update calculation logic
4. **Reliability**: Auto-refresh ensures stats are always current
5. **Scalability**: Materialized views are optimized for read-heavy workloads

## Testing

To verify the materialized view is working:

```sql
-- Check if view exists and has data
SELECT * FROM capper_stats ORDER BY net_units DESC LIMIT 10;

-- Manually refresh (for testing)
REFRESH MATERIALIZED VIEW CONCURRENTLY capper_stats;

-- Check last refresh time
SELECT capper, last_refreshed FROM capper_stats LIMIT 1;
```

## Rollback Plan

If issues arise, we can:
1. Keep old API routes functional during transition
2. Add feature flag to switch between old/new calculation methods
3. Drop materialized view if needed: `DROP MATERIALIZED VIEW capper_stats CASCADE;`

