# 🏗️ SPREAD/MONEYLINE ARCHITECTURE ANALYSIS

## Executive Summary

This document provides a comprehensive architectural analysis for adding SPREAD and MONEYLINE pick generation to the existing NBA TOTALS system without breaking current functionality.

**Recommendation**: **Option B - Unified System with bet_type Parameter** (with specific implementation details below)

---

## 1. Current System Architecture

### 1.1 Existing TOTALS System Flow

```
┌─────────────────────────────────────────────────────────────┐
│ VERCEL CRON (Every 6 minutes)                               │
│ /api/cron/shiva-auto-picks                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: SCANNER                                             │
│ /api/shiva/step1-scanner                                    │
│ - Finds 1 eligible game (no cooldown, no existing pick)    │
│ - Filters: sport=NBA, betType=TOTAL, status=scheduled      │
│ - Returns: selectedGame                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: PICK GENERATION                                     │
│ /api/shiva/generate-pick                                    │
│ - Executes wizard pipeline (Steps 1-7)                      │
│ - betType: 'TOTAL' (hardcoded)                              │
│ - Factors: F1-F5 (Pace, Offense, Defense, 3PT, FT)         │
│ - Scoring: overScore vs underScore                          │
│ - Decision: OVER/UNDER or PASS                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ COOLDOWN CREATION                                           │
│ - PASS: 2-hour cooldown (or until game time)               │
│ - PICK_GENERATED: Permanent cooldown (year 2099)           │
│ - Table: pick_generation_cooldowns                          │
│ - Key: (game_id, capper, bet_type)                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

**Database Tables:**
- `games` - Game schedule and odds data
- `picks` - Generated picks (has `pick_type` column: 'total', 'spread', 'moneyline')
- `pick_generation_cooldowns` - Cooldown tracking (has `bet_type` column)
- `runs` - Execution metadata
- `system_locks` - Atomic locking for cron

**Factor Evaluation:**
- **Current**: Factors award points to `overScore` vs `underScore`
- **File**: `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts`
- **Factors**: F1-F5 (Pace Index, Offensive Form, Defensive Erosion, 3PT Env, FT Env)

**Cooldown System:**
- **Unique Key**: `(game_id, capper, bet_type)`
- **PASS**: Temporary cooldown (2 hours or until game time)
- **PICK_GENERATED**: Permanent cooldown (year 2099)
- **Allows**: Multiple bet types per game (e.g., TOTAL + SPREAD on same game)

**MySportsFeeds API:**
- **Global Backoff**: 30 seconds between ANY request
- **File**: `src/lib/data-sources/mysportsfeeds-api.ts`
- **Critical**: All requests share single `lastMySportsFeedsRequest` timestamp

---

## 2. Architectural Challenges & Solutions

### 2.1 Factor Scoring Logic Difference

**Challenge**: Totals factors award points to OVER vs UNDER, but spread/ML factors need to award points to TEAM A vs TEAM B.

**Solution**: Create a **unified factor interface** with bet-type-specific implementations:

```typescript
// Unified factor output interface
interface FactorOutput {
  // For TOTALS
  overScore?: number
  underScore?: number
  
  // For SPREAD/MONEYLINE
  awayScore?: number
  homeScore?: number
  
  // Common
  signal: number  // -1 to +1
  meta: any
}

// Factor computation dispatcher
function computeFactorPoints(
  factor: FactorComputation,
  betType: 'TOTAL' | 'SPREAD' | 'MONEYLINE'
): FactorOutput {
  if (betType === 'TOTAL') {
    return {
      overScore: factor.signal > 0 ? Math.abs(factor.signal) * MAX_POINTS : 0,
      underScore: factor.signal < 0 ? Math.abs(factor.signal) * MAX_POINTS : 0,
      signal: factor.signal,
      meta: factor.meta
    }
  } else {
    // SPREAD/MONEYLINE: Positive signal favors away, negative favors home
    return {
      awayScore: factor.signal > 0 ? Math.abs(factor.signal) * MAX_POINTS : 0,
      homeScore: factor.signal < 0 ? Math.abs(factor.signal) * MAX_POINTS : 0,
      signal: factor.signal,
      meta: factor.meta
    }
  }
}
```

**Key Insight**: The `signal` (-1 to +1) is bet-type agnostic. Only the **interpretation** changes:
- TOTALS: signal > 0 → OVER, signal < 0 → UNDER
- SPREAD/ML: signal > 0 → AWAY, signal < 0 → HOME

### 2.2 Factor Definitions

**Challenge**: TOTALS uses 5 specific factors. SPREAD/ML need different factors.

**Solution**: Create **separate factor sets** per bet type:

```
src/lib/cappers/shiva-v1/factors/
├── nba-totals-orchestrator.ts      (existing - F1-F5)
├── nba-spread-orchestrator.ts      (new - S1-S5)
├── nba-moneyline-orchestrator.ts   (new - M1-M5)
├── f1-pace-index.ts                (existing - reusable for totals)
├── f2-offensive-form.ts            (existing - reusable for totals)
├── f3-defensive-erosion.ts         (existing - reusable for totals)
├── f4-three-point-env.ts           (existing - reusable for totals)
├── f5-free-throw-env.ts            (existing - reusable for totals)
├── s1-head-to-head.ts              (new - spread factor)
├── s2-ats-performance.ts           (new - spread factor)
├── s3-home-away-splits.ts          (new - spread factor)
├── s4-rest-advantage.ts            (new - spread factor)
├── s5-matchup-advantage.ts         (new - spread factor)
└── types.ts                        (shared types)
```

**Reusability**: Some data fetching logic (MySportsFeeds calls) can be shared across bet types.

### 2.3 Concurrent Execution & API Rate Limiting

**Challenge**: If totals and spread run simultaneously, could cause MySportsFeeds 429 errors.

**Solution**: **Sequential execution with shared data caching**

**Option A: Sequential Bet Types (RECOMMENDED)**
```typescript
// In cron job
async function processBetTypes() {
  // Process TOTAL first
  const totalResult = await generatePick(game, 'TOTAL')
  
  // Wait 30 seconds (MySportsFeeds backoff)
  await sleep(30000)
  
  // Process SPREAD second (reuses cached game data if available)
  const spreadResult = await generatePick(game, 'SPREAD')
  
  return { totalResult, spreadResult }
}
```

**Option B: Staggered Cron Jobs**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/shiva-auto-picks-totals",
      "schedule": "*/6 * * * *"  // Every 6 minutes
    },
    {
      "path": "/api/cron/shiva-auto-picks-spreads",
      "schedule": "3-59/6 * * * *"  // Every 6 minutes, offset by 3 minutes
    }
  ]
}
```

**Recommendation**: **Option A (Sequential)** - Simpler, more predictable, easier to debug.

### 2.4 Database Schema

**Challenge**: Does `picks` table support spread/ML? Do we need separate cooldowns?

**Analysis**:
```sql
-- picks table (ALREADY SUPPORTS ALL BET TYPES)
CREATE TABLE picks (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  capper TEXT NOT NULL,
  pick_type TEXT NOT NULL,  -- ✅ 'total', 'spread', 'moneyline'
  selection TEXT NOT NULL,  -- ✅ 'OVER 235.5', 'CHI +7.5', 'CHI ML'
  odds INTEGER,
  units DECIMAL,
  confidence DECIMAL,
  game_snapshot JSONB,
  status TEXT DEFAULT 'pending',
  ...
)

-- pick_generation_cooldowns (ALREADY SUPPORTS MULTIPLE BET TYPES)
CREATE TABLE pick_generation_cooldowns (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL,
  capper TEXT NOT NULL,
  bet_type TEXT NOT NULL,  -- ✅ 'total', 'spread', 'moneyline'
  cooldown_until TIMESTAMPTZ,
  result TEXT,  -- 'PASS' or 'PICK_GENERATED'
  ...
  UNIQUE(game_id, capper, bet_type)  -- ✅ Allows multiple bet types per game
)
```

**Conclusion**: ✅ **NO SCHEMA CHANGES NEEDED!** The database already supports multiple bet types per game.

### 2.5 Code Organization

**Challenge**: Should spread/ML logic live in same endpoint or separate?

**Recommended Structure**:

```
src/app/api/shiva/
├── generate-pick/
│   └── route.ts                    (MODIFY: Add betType parameter)
├── step1-scanner/
│   └── route.ts                    (MODIFY: Add betType parameter)
└── auto-pick-cron/
    └── route.ts                    (MODIFY: Loop through bet types)

src/lib/cappers/shiva-v1/
├── orchestrator.ts                 (MODIFY: Dispatch by betType)
├── factors/
│   ├── nba-totals-orchestrator.ts  (existing)
│   ├── nba-spread-orchestrator.ts  (NEW)
│   └── nba-moneyline-orchestrator.ts (NEW)
└── confidence-calculator.ts        (MODIFY: Handle awayScore/homeScore)
```

**Key Principle**: **Single endpoint, bet-type parameter** - Easier to maintain, share code, and test.

---

## 3. Proposed Architecture: Option B (Unified System)

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ VERCEL CRON (Every 6 minutes)                               │
│ /api/cron/shiva-auto-picks                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ FOR EACH BET TYPE: ['TOTAL', 'SPREAD']                     │
│ (Sequential execution with 30s delay between)              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: SCANNER                                             │
│ /api/shiva/step1-scanner?betType=TOTAL                      │
│ - Finds 1 eligible game for THIS bet type                  │
│ - Checks cooldowns for (game_id, capper, betType)          │
│ - Returns: selectedGame or null                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: PICK GENERATION                                     │
│ /api/shiva/generate-pick?betType=TOTAL                      │
│ - Executes wizard pipeline with betType parameter          │
│ - Dispatches to correct factor orchestrator                │
│ - TOTAL: overScore vs underScore                           │
│ - SPREAD: awayScore vs homeScore                           │
│ - Decision: PICK or PASS                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ COOLDOWN CREATION                                           │
│ - Key: (game_id, 'shiva', betType)                         │
│ - PASS: 2-hour cooldown                                    │
│ - PICK_GENERATED: Permanent cooldown                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Implementation Steps

**Phase 1: Foundation (No Breaking Changes)**
1. Add `betType` parameter to `executeWizardPipeline()`
2. Create `nba-spread-orchestrator.ts` (empty factors for now)
3. Update `computeFactors()` to dispatch by betType
4. Update confidence calculator to handle `awayScore`/`homeScore`
5. Test with TOTAL betType (should work identically)

**Phase 2: Spread Factors**
6. Implement S1-S5 spread factors (you provide definitions)
7. Test spread pick generation manually via wizard
8. Verify cooldowns work correctly for spread

**Phase 3: Cron Integration**
9. Update cron to loop through bet types sequentially
10. Add 30-second delay between bet types
11. Test in production with monitoring

**Phase 4: Moneyline (Future)**
12. Repeat Phase 2 for moneyline factors
13. Add 'MONEYLINE' to cron loop

---

## 4. Risk Assessment

### 4.1 Risks to Existing TOTALS System

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking factor evaluation | LOW | HIGH | Keep TOTALS path unchanged, add new paths |
| Cooldown conflicts | LOW | MEDIUM | Unique key already includes bet_type |
| API rate limiting | MEDIUM | HIGH | Sequential execution + 30s delays |
| Database schema issues | VERY LOW | HIGH | Schema already supports all bet types |
| Cron job failures | LOW | MEDIUM | Atomic locking + error handling |

### 4.2 Critical Safeguards

1. **Feature Flag**: Add `ENABLE_SPREAD_PICKS` environment variable
2. **Gradual Rollout**: Enable TOTAL only first, then add SPREAD
3. **Monitoring**: Log bet_type in all operations
4. **Rollback Plan**: Checkpoint at `checkpoint-picks-working` (commit 7d30921)

---

## 5. Detailed Questions for You

### 5.1 Spread Factor Definitions

**I need you to provide**:
1. **S1-S5 Factor Names** (e.g., "Head-to-Head Record", "ATS Performance")
2. **Data Sources** (MySportsFeeds endpoints, StatMuse queries)
3. **Scoring Logic** (How does each factor favor away vs home?)
4. **Weights** (What % weight for each factor?)

### 5.2 Execution Strategy

**Question**: Should we generate TOTAL and SPREAD picks for the **same game** or **different games**?

**Option A: Same Game, Multiple Bet Types**
- Pro: More picks per game, better coverage
- Con: More complex cooldown logic

**Option B: Different Games, One Bet Type Each**
- Pro: Simpler, less API calls per game
- Con: Fewer total picks

**Recommendation**: Start with **Option B** (different games), migrate to **Option A** later.

### 5.3 Confidence Thresholds

**Question**: Should SPREAD picks use the same confidence thresholds as TOTALS?

**Current TOTALS**:
- Confidence < 5.0 → PASS
- Confidence 5.0-5.9 → 1 Unit
- Confidence 6.0-6.9 → 2 Units
- Confidence 7.0-7.9 → 3 Units
- Confidence 8.0-8.9 → 4 Units
- Confidence 9.0+ → 5 Units

**Should SPREAD use same thresholds or different?**

### 5.4 Insight Card Display

**Question**: Should the insight card show:
- Only the selected bet type (TOTAL or SPREAD)?
- All bet types for the game (TOTAL + SPREAD)?
- Best bet type by EV (like the old 3-heads system)?

---

## 6. Recommended Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Add `betType` parameter to wizard pipeline
- [ ] Create spread factor orchestrator (stub)
- [ ] Update confidence calculator
- [ ] Test TOTALS still work (no regression)
- [ ] Create checkpoint: `checkpoint-before-spread-factors`

### Phase 2: Spread Factors (Week 2)
- [ ] You provide S1-S5 factor definitions
- [ ] Implement spread factors
- [ ] Test manually via wizard UI
- [ ] Verify cooldowns work correctly

### Phase 3: Cron Integration (Week 3)
- [ ] Update cron to process TOTAL + SPREAD sequentially
- [ ] Add monitoring and logging
- [ ] Deploy with feature flag
- [ ] Monitor for 48 hours

### Phase 4: Moneyline (Future)
- [ ] Repeat Phase 2 for moneyline
- [ ] Add to cron loop

---

## 7. Final Recommendation

**✅ RECOMMENDED: Option B - Unified System with bet_type Parameter**

**Why**:
1. ✅ Database already supports it (no schema changes)
2. ✅ Cooldown system already supports it (unique key includes bet_type)
3. ✅ Code reuse (shared data fetching, wizard pipeline)
4. ✅ Easier to maintain (single codebase)
5. ✅ Gradual rollout (add bet types one at a time)
6. ✅ No breaking changes to existing TOTALS system

**Next Steps**:
1. **You provide**: Spread factor definitions (S1-S5)
2. **I implement**: Phase 1 (foundation with no breaking changes)
3. **We test**: TOTALS still work identically
4. **I implement**: Phase 2 (spread factors)
5. **We deploy**: Gradual rollout with monitoring

---

## 8. Open Questions

1. **Spread Factor Definitions**: What are S1-S5 and their weights?
2. **Same Game vs Different Games**: Should we pick TOTAL and SPREAD on same game or different games?
3. **Confidence Thresholds**: Same as TOTALS or different for SPREAD?
4. **Insight Card**: Show one bet type or all bet types?
5. **Moneyline Timeline**: When do you want to add moneyline picks?

**Ready to proceed when you provide answers to these questions!** 🚀

