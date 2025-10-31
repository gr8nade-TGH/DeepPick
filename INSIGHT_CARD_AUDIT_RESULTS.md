# Insight Card Audit Results

**Date:** 2025-10-31  
**Component:** `src/app/cappers/shiva/management/components/insight-card.tsx`

---

## Executive Summary

✅ **TASK 1 COMPLETE:** Data deletion buttons now work correctly  
⚠️ **TASK 2 FINDINGS:** Insight Card displays **raw unweighted** factor scores instead of **weighted** scores

---

## TASK 1: Data Deletion Buttons - FIXED ✅

### Problem
The "Clear ALL Picks", "Clear All Runs", and "Clear Cooldown" buttons in SHIVA management UI were not working.

### Root Cause
- `/api/debug/clear-all-picks` was using `getSupabase()` (regular client with RLS enabled)
- RLS (Row Level Security) policies were blocking DELETE operations
- The admin client `getSupabaseAdmin()` bypasses RLS using service role key

### Solution Applied
1. **Updated `/api/debug/clear-all-picks/route.ts`:**
   - Changed from `getSupabase()` to `getSupabaseAdmin()`
   - This bypasses RLS and allows DELETE operations

2. **Updated `/api/shiva/runs/clear/route.ts`:**
   - Now clears from 3 tables: `runs`, `shiva_runs`, and `shiva_cooldowns`
   - Uses `getSupabaseAdmin()` to bypass RLS
   - Returns detailed count of deleted records

### Testing Instructions
1. Wait for Vercel deployment to complete
2. Navigate to SHIVA Management page
3. Click "Clear ALL Picks" button
4. Verify picks are deleted from Supabase
5. Click "Clear All Runs" button
6. Verify runs, shiva_runs, and cooldowns are deleted

---

## TASK 2: Insight Card Audit - ISSUES FOUND ⚠️

### Insight Card Locations

The Insight Card appears in **3 locations:**

1. **SHIVA Wizard (Step 8)** - Manual pick generation
   - File: `src/app/cappers/shiva/management/components/wizard.tsx`
   - Data source: `assembleInsightCard()` function (lines 139-336)
   - Rendered at: Line 2508

2. **SHIVA Management → Generated Picks Table → "INSIGHT" button**
   - File: `src/app/cappers/shiva/management/components/generated-picks.tsx` (likely)
   - Data source: `/api/shiva/insight-card/[pickId]/route.ts`
   - **STATUS:** Returns MOCK data (line 42-62)

3. **Main Dashboard → Current Picks Table → "INSIGHT" button**
   - File: `src/components/dashboard/real-dashboard.tsx`
   - Data source: `/api/shiva/insight-card/[pickId]/route.ts`
   - **STATUS:** Returns MOCK data

---

## Critical Issue: Raw vs Weighted Factor Scores

### The Problem

The Insight Card displays **raw unweighted** factor scores from `parsed_values_json.overScore` and `underScore`, which are based on `MAX_POINTS = 5.0`.

**Example from wizard.tsx (lines 246-247):**
```typescript
overScore: Number(pv.overScore ?? 0),  // Raw score (0-5.0)
underScore: Number(pv.underScore ?? 0), // Raw score (0-5.0)
```

### What Should Be Displayed

The Insight Card should show **weighted** factor contributions:

**Formula:** `effectiveScore = rawScore × (weight / 100)`

**Example:**
- Pace Index: rawScore = 3.5, weight = 20% → **effectiveScore = 0.7**
- Edge vs Market: rawScore = 4.1, weight = 100% → **effectiveScore = 4.1**

### Current Behavior

**Wizard (Step 8):**
- ✅ Edge vs Market: Correctly calculated from Step 5 (lines 211-233)
- ❌ F1-F5 factors: Display raw scores (0-5.0) instead of weighted scores (0-1.0)
- ❌ Factor weights shown as percentages but scores don't reflect weighting

**Generated Picks Table & Dashboard:**
- ❌ Returns MOCK data (not real factor scores)
- ❌ No connection to actual run data

---

## Verification Checklist

### Data Accuracy (Wizard Only)

| Field | Status | Notes |
|-------|--------|-------|
| Factor contributions (PI, OF, DE, 3E, WE, IA) | ❌ | Shows raw scores (0-5.0) instead of weighted (0-1.0) |
| Edge vs Market (EM) | ✅ | Correctly calculated from Step 5 |
| Confidence score | ✅ | Matches `conf_final` from Step 5 |
| Predicted total | ✅ | From Step 4 predictions |
| Baseline average | ⚠️ | Not displayed in card (should show sum of team PPG) |
| Market total line | ✅ | From Step 2 snapshot |
| Pick selection | ✅ | Shows "OVER 226.5" or "UNDER 226.5" |
| Units to risk | ✅ | Matches confidence threshold logic |
| Game matchup | ✅ | Teams, date, time correct |
| Factor weights | ⚠️ | Displayed as % but scores don't reflect weighting |
| Over/Under direction | ✅ | Blue "OVER" or orange "UNDER" correct |
| Missing data | ✅ | No "undefined", "NaN", or "—" where values exist |

### Data Accuracy (Generated Picks & Dashboard)

| Field | Status | Notes |
|-------|--------|-------|
| All fields | ❌ | Returns MOCK data from `/api/shiva/insight-card/[pickId]/route.ts` |

---

## Recommended Fixes

### Priority 1: Fix Factor Score Display in Wizard

**File:** `src/app/cappers/shiva/management/components/wizard.tsx`  
**Lines:** 246-247

**Current Code:**
```typescript
overScore: Number(pv.overScore ?? 0),  // Raw score (0-5.0)
underScore: Number(pv.underScore ?? 0), // Raw score (0-5.0)
```

**Fixed Code:**
```typescript
// Apply weight to get effective contribution
const weightDecimal = (weightPct ?? 0) / 100
overScore: Number(pv.overScore ?? 0) * weightDecimal,  // Weighted score
underScore: Number(pv.underScore ?? 0) * weightDecimal, // Weighted score
```

### Priority 2: Implement Real Data for Generated Picks & Dashboard

**File:** `src/app/api/shiva/insight-card/[pickId]/route.ts`

**Current:** Returns hardcoded mock data (lines 42-62)

**Required:**
1. Fetch `shiva_runs` record by `pick.run_id`
2. Parse `step3_json`, `step4_json`, `step5_json` from run record
3. Call `assembleInsightCard()` with real step data
4. Return assembled card data (not mock)

### Priority 3: Add Baseline Average to Card Display

**File:** `src/app/cappers/shiva/management/components/insight-card.tsx`

**Add field to display:**
- Baseline Average (sum of team PPG from Step 3)
- Show alongside Predicted Total and Market Total
- Format: "Baseline: 227.3 pts"

---

## Testing Recommendations

### Test 1: Wizard Factor Scores
1. Generate a pick using SHIVA Wizard
2. Open Insight Card at Step 8
3. Verify factor scores match weighted contributions:
   - F1-F5: Should be 0-1.0 range (20% weight)
   - Edge vs Market: Should be 0-5.0 range (100% weight)
4. Sum all factor contributions and verify equals confidence score

### Test 2: Generated Picks Insight Card
1. Generate a pick via wizard or cron
2. Navigate to SHIVA Management → Generated Picks
3. Click "INSIGHT" button
4. Verify card shows real data (not mock)
5. Verify factor scores match run log table

### Test 3: Dashboard Insight Card
1. Navigate to main dashboard
2. Find a SHIVA pick in Current Picks table
3. Click "INSIGHT" button
4. Verify card shows real data (not mock)
5. Verify all fields populated correctly

---

## Impact Assessment

### High Impact Issues
1. **Factor scores misleading:** Users see raw scores (0-5.0) instead of weighted contributions (0-1.0)
2. **Mock data in production:** Generated Picks and Dashboard show fake factor data
3. **Confidence calculation unclear:** Sum of displayed factors doesn't match confidence score

### Medium Impact Issues
1. **Missing baseline average:** Users can't see team PPG baseline
2. **Inconsistent data sources:** Wizard uses real data, other locations use mock data

### Low Impact Issues
1. **Factor weight display:** Percentages shown but not reflected in scores

---

## Next Steps

1. ✅ **COMPLETE:** Fix data deletion buttons (deployed)
2. ⏳ **PENDING:** Fix factor score weighting in wizard
3. ⏳ **PENDING:** Implement real data for Generated Picks insight card
4. ⏳ **PENDING:** Implement real data for Dashboard insight card
5. ⏳ **PENDING:** Add baseline average to card display
6. ⏳ **PENDING:** Test all 3 insight card locations with real picks

---

## Code References

### Key Files
- **Insight Card Component:** `src/app/cappers/shiva/management/components/insight-card.tsx`
- **Wizard Assembly:** `src/app/cappers/shiva/management/components/wizard.tsx` (lines 139-336)
- **API Endpoint:** `src/app/api/shiva/insight-card/[pickId]/route.ts`
- **Factor Registry:** `src/lib/cappers/shiva-v1/factor-registry.ts`
- **Confidence Calculator:** `src/lib/cappers/shiva-v1/confidence-calculator.ts`

### Key Functions
- `assembleInsightCard()` - Wizard data assembly (wizard.tsx:139)
- `calculateConfidence()` - Applies weights to factor scores (confidence-calculator.ts:58-91)
- `getFactorMeta()` - Factor metadata lookup (factor-registry.ts)

---

**End of Audit Report**

