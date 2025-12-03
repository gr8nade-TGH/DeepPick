# Factor Factory: Streamlined Factor Creation System

## Overview

The Factor Factory is a **single source of truth** architecture for factor definitions. Before this system, adding a new factor required updating 12+ files. Now it takes 1-4 files.

## Architecture

```
src/lib/factors/
├── types.ts              # FactorDefinition interface
├── registry.ts           # Auto-loading registry with lookup/compute APIs
├── compat.ts             # Backward compatibility for old code
└── definitions/
    └── nba/
        ├── totals/       # F1-F7 (TOTALS factors)
        │   ├── f1-pace-index.ts
        │   ├── f2-offensive-form.ts
        │   └── ...
        └── spread/       # S1-S7 (SPREAD factors)
            ├── s1-net-rating-diff.ts
            ├── s2-turnover-diff.ts
            └── ...
```

## Adding a New Factor (4 Steps)

### Step 1: Create Factor Definition File

Create `src/lib/factors/definitions/nba/totals/f8-new-factor.ts`:

```typescript
import { FactorDefinition } from '../../../types'

export const F8_NEW_FACTOR: FactorDefinition = {
  key: 'newFactor',
  factorNumber: 8,
  name: 'New Factor Name',
  shortName: 'New',
  sport: 'NBA',
  betType: 'TOTAL',  // or 'SPREAD'
  category: 'situational',  // statistical, momentum, situational, market
  icon: '🆕',
  description: 'What this factor measures',
  logic: 'How the calculation works...',
  dataSource: 'mysportsfeeds',
  dataRequirements: ['team_gamelogs'],
  defaultWeight: 15,
  maxPoints: 5.0,
  compute: (bundle, ctx) => {
    // Your computation logic here
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: { reason: 'computed' }
    }
  }
}
```

### Step 2: Add to Registry

Edit `src/lib/factors/registry.ts`:

```typescript
import { F8_NEW_FACTOR } from './definitions/nba/totals/f8-new-factor'

const ALL_FACTORS: FactorDefinition[] = [
  // ... existing factors
  F8_NEW_FACTOR,
]
```

### Step 3: Update Orchestrator

Edit the appropriate orchestrator to call the new factor:

**For TOTALS:** `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts`
**For SPREAD:** `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts`

```typescript
import { computeNewFactor } from './f8-new-factor'

// In shouldFetchNBAStats check, add the factor key:
shouldFetchNBAStats: enabledFactorKeys.some(key =>
  ['paceIndex', 'offForm', ..., 'newFactor'].includes(key)
),

// Add computation block:
if (enabledFactorKeys.includes('newFactor')) {
  try {
    console.log('[TOTALS:COMPUTING] newFactor...')
    factors.push(computeNewFactor(bundle!, ctx))
    console.log('[TOTALS:SUCCESS] newFactor computed')
  } catch (error) {
    console.error('[TOTALS:ERROR] newFactor failed:', error)
    factorErrors.push(`newFactor: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
```

### Step 4: Database Migration

Create migration to add factor to capper configs:

```sql
-- Add new factor to system cappers
UPDATE user_cappers
SET factor_config = jsonb_set(
  factor_config,
  '{TOTAL,enabled_factors}',
  (factor_config->'TOTAL'->'enabled_factors') || '["newFactor"]'::jsonb
)
WHERE capper_id IN ('shiva', 'nexus', ...);

-- Set default weight
UPDATE user_cappers
SET factor_config = jsonb_set(
  factor_config,
  '{TOTAL,weights,newFactor}',
  '15'
)
WHERE capper_id IN ('shiva', 'nexus', ...);
```

## Data Flow


---

## Capper Diagnostics

### Quick Status Check (SQL)

Run this query to see all cappers and their pick generation status:

```sql
SELECT
  uc.capper_id,
  uc.display_name,
  uc.is_active,
  uc.is_system_capper,
  COALESCE(p.total_picks, 0) as total_picks,
  p.last_pick_at,
  COALESCE(c.picks_in_cooldowns, 0) as picks_in_cooldowns,
  COALESCE(c.passes, 0) as passes,
  COALESCE(c.errors, 0) as errors
FROM user_cappers uc
LEFT JOIN (
  SELECT capper, COUNT(*) as total_picks, MAX(created_at) as last_pick_at
  FROM picks GROUP BY capper
) p ON uc.capper_id = p.capper
LEFT JOIN (
  SELECT capper,
    SUM(CASE WHEN result = 'PICK_GENERATED' THEN 1 ELSE 0 END) as picks_in_cooldowns,
    SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) as passes,
    SUM(CASE WHEN result = 'ERROR' THEN 1 ELSE 0 END) as errors
  FROM pick_generation_cooldowns GROUP BY capper
) c ON uc.capper_id = c.capper
ORDER BY uc.is_system_capper DESC, uc.capper_id;
```

### Interpreting Results

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `total_picks = 0`, `picks_in_cooldowns = 0` | Capper never ran | Check if capper is in `user_cappers` with `is_active = true` |
| `total_picks = 0`, `picks_in_cooldowns > 0` | **Pick insert failing** | Check `is_system_pick` bug, RLS policies, or constraint violations |
| `total_picks < picks_in_cooldowns` | Some picks failed to save | Same as above |
| `errors > 0` | API or data fetch failures | Check MySportsFeeds API, team abbreviation issues |
| `passes` very high | Low confidence on all games | Review factor weights, check if factors are too conservative |

### Troubleshooting Path

```
1. CAPPER NOT GENERATING PICKS?
   ↓
   Check: SELECT * FROM user_cappers WHERE capper_id = '{id}'
   - is_active = true?
   - bet_types array populated?
   - factor_config has enabled_factors?
   ↓
2. CAPPER IN COOLDOWNS BUT NO PICKS?
   ↓
   Check: SELECT * FROM pick_generation_cooldowns
          WHERE capper = '{id}' AND result = 'PICK_GENERATED'
   - If rows exist but no picks → INSERT FAILING
   ↓
   Fix: Check for:
   a) is_system_pick bug (using function instead of boolean result)
   b) RLS policy blocking insert
   c) NOT NULL constraint violation
   d) UNIQUE constraint violation
   ↓
3. ERRORS IN COOLDOWNS?
   ↓
   Check: SELECT reason FROM pick_generation_cooldowns
          WHERE capper = '{id}' AND result = 'ERROR'
   - "No game logs found" → Team hasn't played yet / wrong abbreviation
   - "Failed to fetch stats" → MySportsFeeds API issue
   ↓
4. ALL PASSES, NO PICKS?
   ↓
   Check: SELECT confidence_score, reason FROM pick_generation_cooldowns
          WHERE capper = '{id}' AND result = 'PASS'
   - If confidence always < 5.0 → Factor weights need tuning
   - If specific teams failing → Check team-specific data
```

### Clear Stuck Cooldowns

If a capper has a stuck `PICK_GENERATED` cooldown but no actual pick:

```sql
-- Find the stuck record
SELECT * FROM pick_generation_cooldowns
WHERE capper = '{capper_id}' AND result = 'PICK_GENERATED';

-- Delete to allow retry
DELETE FROM pick_generation_cooldowns
WHERE capper = '{capper_id}'
  AND game_id = '{game_id}'
  AND result = 'PICK_GENERATED';
```

---

## Known Issues & Fixes

### Issue: `is_system_pick` Bug (Fixed Dec 2025)

**Problem:** Code was using `isSystemCapper` (imported function) instead of `isSystemCapperCheck` (boolean result).

**File:** `src/app/api/shiva/generate-pick/route.ts` line 836

**Before:**
```typescript
is_system_pick: isSystemCapper,  // ❌ WRONG - function reference
```

**After:**
```typescript
is_system_pick: isSystemCapperCheck,  // ✅ CORRECT - boolean result
```

**Symptom:** Cooldown shows `PICK_GENERATED` but no row in `picks` table.

### Issue: Cooldown Created Before Pick Insert

**Design:** Cooldown is intentionally created BEFORE the pick insert (lines 698-712) to prevent infinite retry loops if insert fails.

**Trade-off:** If insert fails, cooldown prevents retry. Must manually clear cooldown to retry.

---

## Current Factors

### NBA TOTALS (7 Factors)

| # | Key | Name | Data Source |
|---|-----|------|-------------|
| F1 | `paceIndex` | Pace Index | MySportsFeeds |
| F2 | `offForm` | Offensive Form | MySportsFeeds |
| F3 | `defErosion` | Defensive Erosion | MySportsFeeds |
| F4 | `threeEnv` | 3-Point Environment | MySportsFeeds |
| F5 | `whistleEnv` | Whistle Environment | MySportsFeeds |
| F6 | `injuryAvailability` | Injury Availability | MySportsFeeds |
| F7 | `restAdvantage` | Rest Advantage | MySportsFeeds |

### NBA SPREAD (7 Factors)

| # | Key | Name | Data Source |
|---|-----|------|-------------|
| S1 | `netRatingDiff` | Net Rating Differential | MySportsFeeds |
| S2 | `turnoverDiff` | Turnover Differential | MySportsFeeds |
| S3 | `shootingEfficiencyMomentum` | Shooting Efficiency Momentum | MySportsFeeds |
| S4 | `homeAwaySplits` | Home/Away Splits | MySportsFeeds |
| S5 | `fourFactorsDiff` | Four Factors Differential | MySportsFeeds |
| S6 | `spreadInjuryAvailability` | Injury Availability (Spread) | MySportsFeeds |
| S7 | `momentumIndex` | Momentum Index | MySportsFeeds |

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/factors/types.ts` | `FactorDefinition` interface |
| `src/lib/factors/registry.ts` | Central registry, lookup functions |
| `src/lib/factors/compat.ts` | Backward compatibility layer |
| `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts` | TOTALS factor computation |
| `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts` | SPREAD factor computation |
| `src/lib/cappers/shiva-v1/factors/data-fetcher.ts` | Fetches MySportsFeeds data into bundle |
| `src/lib/data-sources/mysportsfeeds-stats.ts` | Low-level API calls |
| `src/app/api/shiva/generate-pick/route.ts` | Main pick generation endpoint |
| `src/app/api/cron/auto-picks-multi/route.ts` | Multi-capper cron job |
| `src/app/api/cappers/generate-pick/route.ts` | Unified capper pick generation |

