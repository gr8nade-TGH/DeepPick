# SPREAD Picks: Caching Architecture & Validation Analysis

**Date**: 2025-11-03  
**Status**: CRITICAL ISSUES IDENTIFIED  
**Priority**: HIGH - Blocking SPREAD pick generation

---

## 📋 EXECUTIVE SUMMARY

### **Problem 1: Missing SPREAD Capper Profile** ❌
- **Root Cause**: No `capper_profiles` record exists for `SHIVA + NBA + SPREAD`
- **Impact**: Step 3 API fails to fetch factor weights → returns 0 factors
- **Error**: `"No capper profile found. Please configure factors first."`

### **Problem 2: Wizard Validation Hardcoded for TOTALS** ❌
- **Root Cause**: `validateStep3()` expects TOTALS factor keys (`paceIndex`, `offForm`, etc.)
- **Impact**: Even if SPREAD factors are returned, validation fails with weight mismatch
- **Error**: `"Step 3 total weight 0% is not 250%"`

### **Problem 3: Caching Strategy Needs Clarification** ⚠️
- **Current State**: TOTALS and SPREAD share the same `fetchNBAStatsBundle()` function
- **Question**: Should they share the same cache? (Answer: YES, with caveats)

---

## 🔍 DETAILED ANALYSIS

### **1. Caching System Deep Dive**

#### **What Data is Cached?**

The caching system has **3 layers**:

##### **Layer 1: In-Memory Cache (15 minutes TTL)**
- **File**: `src/lib/data-sources/nba-stats-api.ts`
- **Cache Key**: `MD5(teamName:stat)` (e.g., `MD5("Lakers:advanced")`)
- **Data Cached**: `NBATeamStats` (ORtg, DRtg, pace, 3P%, FT%, etc.)
- **TTL**: 15 minutes
- **Scope**: Per serverless function instance (lost on cold start)

##### **Layer 2: Supabase Persistent Cache (4 hours TTL)**
- **File**: `src/lib/data-sources/mysportsfeeds-cache.ts`
- **Table**: `team_stats_cache`
- **Cache Key**: `{teamAbbrev}:{n}` (e.g., `"BOS:10"` for last 10 games)
- **Data Cached**: `TeamFormData` (pace, ORtg, DRtg, 3P%, 3P rate, FT rate, gamesAnalyzed)
- **TTL**: 4 hours
- **Scope**: Global (persists across cold starts)
- **Purpose**: Solve rate limiting issue where in-memory cache resets on cold starts

##### **Layer 3: Player Stats Cache (5 minutes TTL)**
- **File**: `src/lib/data-sources/mysportsfeeds-players.ts`
- **Cache Key**: `teamAbbrev` (e.g., `"BOS"`)
- **Data Cached**: `PlayerInjuryData[]` (player stats + injury status)
- **TTL**: 5 minutes (injury status changes quickly)
- **Scope**: In-memory only

#### **What API Calls Does Caching Reduce?**

**Without Cache** (per pick generation):
- 2 calls to MySportsFeeds `/team_gamelogs` (away + home teams)
- 2 calls to MySportsFeeds `/player_stats_totals` (away + home rosters)
- **Total**: 4 API calls per pick

**With Cache** (4-hour window):
- First pick: 4 API calls (cache miss)
- Subsequent picks (same teams): 0 API calls (cache hit)
- **Savings**: ~75% reduction in API calls during active game windows

#### **Cache Key Structure**

```typescript
// Supabase Cache (Layer 2 - most important)
const cacheKey = `${teamAbbrev}:${n}`
// Examples:
// "BOS:10" → Celtics last 10 games
// "LAL:10" → Lakers last 10 games

// In-Memory Cache (Layer 1)
const cacheKey = MD5(`${teamName}:${stat}`)
// Examples:
// MD5("Lakers:advanced") → Lakers advanced stats
// MD5("Celtics:last10") → Celtics last 10 games
```

---

### **2. Should SPREAD and TOTALS Share the Same Cache?**

#### **Answer: YES - They Already Do (And Should Continue To)**

**Rationale**:
1. **Both bet types need identical team stats**:
   - ORtg, DRtg, pace, 3P%, FT rate, etc.
   - TOTALS uses these for F1-F5 factors
   - SPREAD uses these for S1-S5 factors

2. **Shared cache reduces API calls**:
   - If TOTALS pick is generated at 5:00 PM for Lakers vs Celtics
   - SPREAD pick generated at 5:05 PM can use cached data
   - **No additional API calls needed**

3. **No risk of data contamination**:
   - Cache stores raw team stats (not derived factors)
   - TOTALS factors (F1-F5) and SPREAD factors (S1-S5) compute different signals from same raw data
   - Example: F1 (Pace Index) uses `pace` to predict OVER/UNDER
   - Example: S1 (Net Rating Diff) uses `ORtg, DRtg, pace` to predict AWAY/HOME

4. **Current implementation already shares cache**:
   - Both orchestrators call `fetchNBAStatsBundle(ctx)` from `data-fetcher.ts`
   - `fetchNBAStatsBundle()` calls `getTeamFormData()` which uses Supabase cache
   - **No changes needed to caching logic**

#### **Risks of Sharing Cache** (Mitigated)

| Risk | Mitigation |
|------|------------|
| **Stale data for SPREAD picks** | 4-hour TTL is appropriate for both bet types (team stats don't change mid-day) |
| **Cache key collision** | Cache key is `{team}:{n}` (no betType in key), but this is intentional - same data for both |
| **Different data needs** | Both bet types need same stats (ORtg, DRtg, pace, etc.) - no conflict |

#### **Recommendation**: ✅ **Keep Shared Cache**

**No changes needed**. The current caching architecture is optimal for both TOTALS and SPREAD picks.

---

### **3. Current Issue: SPREAD Pick Generation Failure**

#### **Console Logs Analysis**

```
[Step 3] Missing factors: paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability
[Step 4] Step 3 validation failed: Step 3 total weight 0% is not 250%
```

#### **Root Cause #1: Missing Capper Profile**

**File**: `src/app/api/shiva/factors/step3/route.ts` (lines 89-112)

```typescript
const profileRes = await admin
  .from('capper_profiles')
  .select('factors')
  .eq('capper_id', 'SHIVA')
  .eq('sport', 'NBA')
  .eq('bet_type', betType)  // ← Looking for 'SPREAD'
  .eq('is_default', true)
  .single()

if (profileRes.data?.factors && profileRes.data.factors.length > 0) {
  factorWeights = getFactorWeightsFromProfile({ factors: profileRes.data.factors })
} else {
  throw new Error('No capper profile found. Please configure factors first.')
  // ↑ THIS ERROR IS THROWN - No SPREAD profile exists
}
```

**Database Query**:
```sql
SELECT factors FROM capper_profiles
WHERE capper_id = 'SHIVA'
  AND sport = 'NBA'
  AND bet_type = 'SPREAD'  -- ❌ No record exists
  AND is_default = true
LIMIT 1;
```

**Result**: No rows returned → `factorWeights = {}` → `computeSpreadFactors()` not called → 0 factors returned

#### **Root Cause #2: Wizard Validation Hardcoded for TOTALS**

**File**: `src/app/cappers/shiva/management/components/wizard.tsx` (lines 814-857)

```typescript
function validateStep3(): { isValid: boolean; error?: string; data?: any } {
  const factors = step3Data.factors
  
  // ❌ HARDCODED TOTALS FACTOR KEYS
  const expectedFactorKeys = ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability']
  const actualFactorKeys = factors.map((f: any) => f.key)

  // Check for missing critical factors (only warn, don't block)
  const missingFactors = expectedFactorKeys.filter(key => !actualFactorKeys.includes(key))
  if (missingFactors.length > 0) {
    console.warn(`[Step 3] Missing factors: ${missingFactors.join(', ')}`)
    // ↑ THIS WARNING IS LOGGED (all TOTALS factors missing)
  }

  // ❌ WEIGHT VALIDATION FAILS
  const totalWeight = factors.reduce((sum: number, f: any) => sum + (f.weight_total_pct || 0), 0)
  if (Math.abs(totalWeight - 250) > 1) {
    return { isValid: false, error: `Step 3 total weight ${totalWeight}% is not 250%` }
    // ↑ THIS ERROR IS THROWN (0% !== 250%)
  }

  return { isValid: true, data: step3Data }
}
```

**Problem**: Validation expects TOTALS factors, but SPREAD returns different factor keys:
- **TOTALS**: `paceIndex`, `offForm`, `defErosion`, `threeEnv`, `whistleEnv`, `injuryAvailability`
- **SPREAD**: `netRatingDiff`, `restAdvantage`, `atsMomentum`, `homeCourtAdv`, `fourFactorsDiff`

---

## 🛠️ FIXES REQUIRED

### **Fix #1: Create SPREAD Capper Profile** (CRITICAL)

**Option A: Manual Database Insert** (Quick Fix)

```sql
INSERT INTO capper_profiles (
  id,
  capper_id,
  sport,
  bet_type,
  name,
  description,
  factors,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'SHIVA',
  'NBA',
  'SPREAD',
  'SHIVA NBA Spread Default',
  'Default factor configuration for NBA spread picks',
  '[
    {"key": "netRatingDiff", "enabled": true, "weight": 30, "dataSource": "mysportsfeeds"},
    {"key": "restAdvantage", "enabled": true, "weight": 25, "dataSource": "mysportsfeeds"},
    {"key": "atsMomentum", "enabled": false, "weight": 20, "dataSource": "mysportsfeeds"},
    {"key": "homeCourtAdv", "enabled": false, "weight": 15, "dataSource": "mysportsfeeds"},
    {"key": "fourFactorsDiff", "enabled": false, "weight": 10, "dataSource": "mysportsfeeds"},
    {"key": "edgeVsMarketSpread", "enabled": true, "weight": 100, "dataSource": "odds"}
  ]'::jsonb,
  true,
  true,
  NOW(),
  NOW()
);
```

**Option B: Use Configure Factors UI** (Recommended)

1. Navigate to SHIVA Management → Configure Factors
2. Select **Sport**: NBA, **Bet Type**: SPREAD
3. Enable S1 (Net Rating Diff) with 30% weight
4. Enable Edge vs Market (Spread) with 100% weight
5. Save configuration

**Note**: Only S1 is implemented. S2-S5 should remain disabled until implemented.

---

### **Fix #2: Update Wizard Validation to Support Both Bet Types** (CRITICAL)

**File**: `src/app/cappers/shiva/management/components/wizard.tsx`

**Current Code** (lines 814-857):
```typescript
function validateStep3(): { isValid: boolean; error?: string; data?: any } {
  const factors = step3Data.factors

  // ❌ HARDCODED TOTALS FACTOR KEYS
  const expectedFactorKeys = ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability']
  const actualFactorKeys = factors.map((f: any) => f.key)

  // Check for missing critical factors (only warn, don't block)
  const missingFactors = expectedFactorKeys.filter(key => !actualFactorKeys.includes(key))
  if (missingFactors.length > 0) {
    console.warn(`[Step 3] Missing factors: ${missingFactors.join(', ')}`)
  }

  // Check weight validation
  const totalWeight = factors.reduce((sum: number, f: any) => sum + (f.weight_total_pct || 0), 0)
  if (Math.abs(totalWeight - 250) > 1) {
    return { isValid: false, error: `Step 3 total weight ${totalWeight}% is not 250%` }
  }

  return { isValid: true, data: step3Data }
}
```

**Fixed Code**:
```typescript
function validateStep3(): { isValid: boolean; error?: string; data?: any } {
  const step3Data = stepLogsRef.current[3]?.json || stepLogs[3]?.json
  const step3Status = stepLogsRef.current[3]?.status || stepLogs[3]?.status

  if (!step3Data) {
    return { isValid: false, error: 'Step 3 not executed' }
  }
  if (step3Status && (step3Status < 200 || step3Status >= 300)) {
    return { isValid: false, error: `Step 3 failed with status ${step3Status}` }
  }

  const factors = step3Data.factors
  const actualFactorKeys = factors.map((f: any) => f.key)

  // ✅ DYNAMIC FACTOR KEY VALIDATION BASED ON BET TYPE
  const betType = props.betType || 'TOTAL'
  const expectedFactorKeys = betType === 'TOTAL'
    ? ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability']
    : ['netRatingDiff', 'restAdvantage', 'atsMomentum', 'homeCourtAdv', 'fourFactorsDiff']

  // Check if we have at least some factors (minimum 1)
  if (factors.length < 1) {
    return { isValid: false, error: `Step 3 only generated ${factors.length} factors, expected at least 1` }
  }

  // Check for missing critical factors (only warn, don't block)
  const missingFactors = expectedFactorKeys.filter(key => !actualFactorKeys.includes(key))
  if (missingFactors.length > 0) {
    console.warn(`[Step 3] Missing factors: ${missingFactors.join(', ')} - this may be intentional based on configuration`)
  }

  // Check if all factors have valid data structure
  for (const factor of factors) {
    if (!factor.key || !factor.name) {
      return { isValid: false, error: `Step 3 factor missing key or name: ${JSON.stringify(factor)}` }
    }
    if (typeof factor.normalized_value !== 'number') {
      return { isValid: false, error: `Step 3 factor ${factor.key} missing normalized_value` }
    }
    if (!factor.parsed_values_json) {
      return { isValid: false, error: `Step 3 factor ${factor.key} missing parsed_values_json` }
    }
  }

  // Check for suspicious data patterns (all factors returning 0)
  const allFactorsZero = factors.every((f: any) => f.normalized_value === 0)
  if (allFactorsZero) {
    console.warn('[VALIDATION WARNING] Step 3: All factors returning 0 - this may indicate a data issue')
  }

  // ✅ WEIGHT VALIDATION (250% total)
  const totalWeight = factors.reduce((sum: number, f: any) => sum + (f.weight_total_pct || 0), 0)
  if (Math.abs(totalWeight - 250) > 1) {
    return { isValid: false, error: `Step 3 total weight ${totalWeight}% is not 250%` }
  }

  return { isValid: true, data: step3Data }
}
```

**Key Changes**:
1. ✅ Dynamic `expectedFactorKeys` based on `betType` prop
2. ✅ TOTALS: `paceIndex`, `offForm`, etc.
3. ✅ SPREAD: `netRatingDiff`, `restAdvantage`, etc.
4. ✅ Weight validation remains at 250% (same for both bet types)

---

### **Fix #3: Update Step 4 Validation for SPREAD** (MEDIUM PRIORITY)

**File**: `src/app/cappers/shiva/management/components/wizard.tsx` (lines 862-906)

**Current Issue**: Step 4 validation checks for `total_pred_points` (150-300 range), which is TOTALS-specific.

**SPREAD picks should validate**:
- `predictions.scores.away` and `predictions.scores.home` (point spread prediction)
- `predictions.winner` (AWAY or HOME)
- No `total_pred_points` field for SPREAD

**Recommendation**: Add conditional validation based on `betType`:

```typescript
function validateStep4(): { isValid: boolean; error?: string; data?: any } {
  const step4Data = stepLogsRef.current[4]?.json || stepLogs[4]?.json
  const step4Status = stepLogsRef.current[4]?.status || stepLogs[4]?.status

  if (!step4Data) {
    return { isValid: false, error: 'Step 4 not executed' }
  }
  if (step4Status && (step4Status < 200 || step4Status >= 300)) {
    return { isValid: false, error: `Step 4 failed with status ${step4Status}` }
  }
  if (!step4Data.predictions) {
    return { isValid: false, error: 'Step 4 did not generate predictions' }
  }

  const predictions = step4Data.predictions
  const betType = props.betType || 'TOTAL'

  // ✅ BET TYPE SPECIFIC VALIDATION
  if (betType === 'TOTAL') {
    // TOTALS validation
    if (typeof predictions.total_pred_points !== 'number') {
      return { isValid: false, error: 'Step 4 predictions missing total_pred_points' }
    }
    if (predictions.total_pred_points < 150 || predictions.total_pred_points > 300) {
      return { isValid: false, error: `Step 4 total_pred_points ${predictions.total_pred_points} seems anomalous (expected 150-300)` }
    }
  } else if (betType === 'SPREAD') {
    // SPREAD validation
    if (!predictions.scores || !predictions.scores.home || !predictions.scores.away) {
      return { isValid: false, error: 'Step 4 predictions missing home/away scores' }
    }
    if (typeof predictions.scores.home !== 'number' || typeof predictions.scores.away !== 'number') {
      return { isValid: false, error: 'Step 4 predictions scores not numeric' }
    }
    if (predictions.scores.home < 50 || predictions.scores.home > 200) {
      return { isValid: false, error: `Step 4 home score ${predictions.scores.home} seems anomalous (expected 50-200)` }
    }
    if (predictions.scores.away < 50 || predictions.scores.away > 200) {
      return { isValid: false, error: `Step 4 away score ${predictions.scores.away} seems anomalous (expected 50-200)` }
    }
    if (!predictions.winner || !['home', 'away'].includes(predictions.winner)) {
      return { isValid: false, error: 'Step 4 predictions missing or invalid winner' }
    }
  }

  // Check confidence data (common to both bet types)
  if (!step4Data.confidence || typeof step4Data.confidence.base_confidence !== 'number') {
    return { isValid: false, error: 'Step 4 missing confidence data' }
  }

  return { isValid: true, data: step4Data }
}
```

---

## 📊 CACHING ARCHITECTURE SUMMARY

### **Cache Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                    PICK GENERATION REQUEST                   │
│              (TOTALS or SPREAD - doesn't matter)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           fetchNBAStatsBundle(ctx)                          │
│           (src/lib/cappers/shiva-v1/factors/data-fetcher.ts)│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           getTeamFormData(teamAbbrev, n=10)                 │
│           (src/lib/data-sources/mysportsfeeds-stats.ts)     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────────┐
│ Supabase Cache   │          │ MySportsFeeds API    │
│ (4 hour TTL)     │          │ (Rate Limited)       │
│                  │          │                      │
│ Cache Hit? ✅    │          │ Cache Miss? ❌       │
│ Return cached    │          │ Fetch fresh data     │
│ TeamFormData     │          │ Store in cache       │
└──────────────────┘          └──────────────────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    NBAStatsBundle                           │
│  {                                                          │
│    awayPaceSeason, awayPaceLast10,                         │
│    homePaceSeason, homePaceLast10,                         │
│    awayORtgLast10, homeORtgLast10,                         │
│    awayDRtgSeason, homeDRtgSeason,                         │
│    ...                                                      │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────────┐
│ TOTALS Factors   │          │ SPREAD Factors       │
│ (F1-F5)          │          │ (S1-S5)              │
│                  │          │                      │
│ F1: Pace Index   │          │ S1: Net Rating Diff  │
│ F2: Off Form     │          │ S2: Rest Advantage   │
│ F3: Def Erosion  │          │ S3: ATS Momentum     │
│ F4: 3P Env       │          │ S4: Home Court Adv   │
│ F5: Whistle Env  │          │ S5: Four Factors     │
└──────────────────┘          └──────────────────────┘
```

### **Key Insights**:
1. ✅ **Shared cache is optimal** - Both bet types use same raw stats
2. ✅ **No risk of contamination** - Factors compute different signals from same data
3. ✅ **Reduces API calls by ~75%** - 4-hour TTL covers most game windows
4. ✅ **No changes needed** - Current implementation already shares cache correctly

---

## 🎯 ACTION ITEMS

### **Immediate (Blocking SPREAD Picks)**:
1. ✅ **Create SPREAD capper profile** (Use Configure Factors UI or SQL insert)
2. ✅ **Fix wizard validation** (Update `validateStep3()` to support both bet types)

### **Short-Term (Before S2-S5 Implementation)**:
3. ⚠️ **Update Step 4 validation** (Add SPREAD-specific checks)
4. ⚠️ **Test SPREAD pick generation** (Verify S1 works end-to-end)

### **Long-Term (After S1-S5 Complete)**:
5. 📝 **Document caching strategy** (Add comments to data-fetcher.ts)
6. 📝 **Add cache monitoring** (Log cache hit/miss rates)

---

## 💡 RECOMMENDATIONS

### **Senior Developer Perspective**:

1. **Caching Strategy**: ✅ **Keep shared cache**
   - No changes needed
   - Already optimal for both bet types
   - Reduces API calls without breaking TOTALS

2. **Validation Logic**: ⚠️ **Refactor to be bet-type aware**
   - Current hardcoded TOTALS keys will break SPREAD
   - Use dynamic validation based on `betType` prop
   - Consider extracting to separate validation functions

3. **Profile Management**: ⚠️ **Create SPREAD profile ASAP**
   - Use Configure Factors UI (recommended)
   - Enable only S1 + Edge vs Market (130% total weight)
   - Disable S2-S5 until implemented

4. **Testing Strategy**: ⚠️ **Test incrementally**
   - Fix #1 (profile) → Test wizard (should get past Step 3)
   - Fix #2 (validation) → Test wizard (should complete all steps)
   - Verify S1 calculations are correct
   - Then proceed to S2 implementation

---

## 🚨 CRITICAL PATH TO UNBLOCK SPREAD PICKS

```
Step 1: Create SPREAD Profile (5 min)
   ↓
Step 2: Fix Wizard Validation (10 min)
   ↓
Step 3: Test SPREAD Pick Generation (5 min)
   ↓
Step 4: Verify S1 Calculations (10 min)
   ↓
✅ SPREAD Picks Unblocked
```

**Total Time**: ~30 minutes to unblock SPREAD pick generation


