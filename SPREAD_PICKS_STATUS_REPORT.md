# SPREAD PICKS IMPLEMENTATION - STATUS REPORT
**Date**: 2025-11-03  
**Last Updated**: Based on codebase analysis and git history

---

## 📊 EXECUTIVE SUMMARY

### Current Status: **PHASE 1 COMPLETE ✅ | PHASE 2 NOT STARTED ⏸️**

**What Works:**
- ✅ Infrastructure for SPREAD picks is fully in place
- ✅ UI can select SPREAD bet type
- ✅ Configure Factors modal loads SPREAD factors correctly
- ✅ **Configure Factors CAN save SPREAD configurations** (this was the last issue resolved)
- ✅ Wizard orchestrator routes SPREAD requests to spread orchestrator
- ✅ Confidence calculator handles awayScore/homeScore for SPREAD

**What Doesn't Work:**
- ❌ **No actual SPREAD factor implementations** (S1-S5 are all stubbed out)
- ❌ SPREAD picks return empty factor arrays
- ❌ Cannot generate meaningful SPREAD picks (no factor logic)

---

## ✅ PHASE 1: FOUNDATION & INFRASTRUCTURE (COMPLETE)

### What Was Completed

#### 1. **Bet Type Parameter Support** ✅
- `executeWizardPipeline()` accepts `betType: 'TOTAL' | 'SPREAD'`
- Wizard orchestrator routes to correct factor orchestrator based on betType
- File: `src/lib/cappers/shiva-wizard-orchestrator.ts` (lines 356-368)

#### 2. **Confidence Calculator Updated** ✅
- Handles `awayScore` and `homeScore` for SPREAD calculations
- Properly interprets signal: `signal > 0 → AWAY`, `signal < 0 → HOME`
- File: `src/lib/cappers/shiva-v1/confidence-calculator.ts` (lines 145-210)

#### 3. **Spread Orchestrator Created** ✅
- File: `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts`
- **Status**: Stub implementation - fetches data but returns empty factors
- **Lines 125-140**: All factor implementations are commented out (TODO)

#### 4. **Factor Registry Updated** ✅
- 5 SPREAD factors added to registry with metadata:
  - `netRatingDiff` - Net Rating Differential (30% weight)
  - `restAdvantage` - Rest Advantage (25% weight)
  - `atsMomentum` - Recent ATS Momentum (20% weight)
  - `homeCourtAdv` - Home Court Advantage (15% weight)
  - `fourFactorsDiff` - Four Factors Differential (10% weight)
- File: `src/lib/cappers/shiva-v1/factor-registry.ts` (lines 103-175)

#### 5. **UI Components Updated** ✅
- Header filters include SPREAD bet type selector
- Factor config modal shows SPREAD factors when selected
- Factors are properly filtered by `getFactorsByContext(sport, betType)`
- Files:
  - `src/app/cappers/shiva/management/components/header-filters.tsx`
  - `src/app/cappers/shiva/management/components/factor-config-modal.tsx`

#### 6. **API Endpoints Updated** ✅
- `/api/factors/config` GET/POST support SPREAD bet type
- Schema validation includes `betType: z.enum(['SPREAD', 'TOTAL'])`
- File: `src/app/api/factors/config/route.ts` (line 24, 51)

#### 7. **Configure Factors Save Functionality** ✅
- **ISSUE RESOLVED**: SPREAD factor configurations can now be saved
- Payload correctly includes `betType: 'SPREAD'`
- Database insert sets `is_default: true` for pick generation
- File: `src/app/api/factors/config/route.ts` (lines 184-357)

---

## ❌ PHASE 2: SPREAD FACTOR IMPLEMENTATION (NOT STARTED)

### What Needs to Be Implemented

#### **5 SPREAD Factors (S1-S5) - ALL MISSING**

The orchestrator is ready but all factor implementations are stubbed:

```typescript
// TODO: Implement spread factors in Phase 2
// if (enabledFactorKeys.includes('netRatingDiff')) {
//   factors.push(computeNetRatingDifferential(bundle!, ctx))
// }
// ... (lines 126-140 in nba-spread-orchestrator.ts)
```

#### **Files That Need to Be Created:**

1. **`s1-net-rating-differential.ts`** (30% weight)
   - Calculate: `(awayORtg - awayDRtg) - (homeORtg - homeDRtg)`
   - Expected margin: `netRatingDiff * (pace / 100)`
   - Compare to spread line
   - Award points based on edge

2. **`s2-rest-advantage.ts`** (25% weight)
   - Check back-to-back situations
   - Calculate days of rest differential
   - Award 3-5 point ATS swing for significant rest advantages

3. **`s3-ats-momentum.ts`** (20% weight)
   - Fetch last 10 games ATS records
   - Calculate ATS win percentage
   - Award points for teams on ATS hot streaks (7-3 or better)

4. **`s4-home-court-advantage.ts`** (15% weight)
   - Calculate home/away point differential
   - Compare to league average HCA (2.5 points)
   - Award points for elite HCA (5-7 pts) vs weak HCA (1-2 pts)

5. **`s5-four-factors.ts`** (10% weight)
   - Calculate Dean Oliver's Four Factors:
     - eFG% = (FGM + 0.5*3PM) / FGA
     - TOV% = TOV / Possessions
     - OREB% = OREB / (OREB + Opp DREB)
     - FTR = FTA / FGA
   - Calculate composite rating differential
   - Award points based on expected margin vs spread

---

## 🔍 CURRENT WORKFLOW STATUS

### What Happens When You Select SPREAD:

1. ✅ **UI Selection**: Bet type dropdown shows SPREAD option
2. ✅ **Configure Factors**: Modal loads 5 SPREAD factors with correct metadata
3. ✅ **Weight Configuration**: Can adjust weights (must sum to 250%)
4. ✅ **Save Configuration**: Successfully saves to `capper_profiles` table
5. ✅ **Wizard Execution**: Routes to `computeSpreadFactors()`
6. ❌ **Factor Computation**: Returns empty array (no implementations)
7. ❌ **Confidence Calculation**: Gets 0 confidence (no factor scores)
8. ❌ **Pick Generation**: Cannot generate meaningful picks

### Example Output (Current State):

```json
{
  "factors": [],  // ❌ Empty - no implementations
  "factor_version": "nba_spread_v1",
  "baseline_avg": 0,
  "totals_debug": {
    "factor_keys": [],  // ❌ No factors computed
    "console_logs": {
      "branch_used": { "sport": "NBA", "betType": "SPREAD" },
      "rows_z_points": []  // ❌ No points awarded
    }
  }
}
```

---

## 🎯 NEXT IMMEDIATE TASK

### **Implement S1: Net Rating Differential**

**Why Start Here:**
- Highest weight (30%)
- Most straightforward calculation
- Data already available in `NBAStatsBundle`
- Clear test cases in documentation

**Implementation Steps:**

1. Create `src/lib/cappers/shiva-v1/factors/s1-net-rating-differential.ts`
2. Implement `computeNetRatingDifferential(bundle, ctx)` function
3. Return `FactorComputation` with:
   - `awayScore` and `homeScore` (0-5 points each)
   - `signal` (-1 to +1)
   - `parsed_values_json` with metadata
4. Uncomment line 127 in `nba-spread-orchestrator.ts`
5. Test with wizard UI

**Expected Behavior:**
- Input: Warriors @ Kings, spread -4.5
- Calculate net rating differential
- Award points to team with better net rating
- Compare expected margin to spread line
- Return factor with awayScore/homeScore

---

## 📋 REMAINING WORK BREAKDOWN

### **Phase 2: Factor Implementation** (12-16 hours)
- [ ] S1: Net Rating Differential (3-4 hours)
- [ ] S2: Rest Advantage (2-3 hours)
- [ ] S3: ATS Momentum (3-4 hours)
- [ ] S4: Home Court Advantage (2-3 hours)
- [ ] S5: Four Factors Differential (2-3 hours)

### **Phase 3: Testing & Validation** (4-6 hours)
- [ ] Test each factor individually
- [ ] Test full SPREAD pick generation via wizard
- [ ] Verify confidence calculations
- [ ] Test cooldown creation
- [ ] Validate against test data from docs

### **Phase 4: Cron Integration** (6-8 hours)
- [ ] Update cron job to loop through bet types
- [ ] Add 30-second delay between TOTAL and SPREAD
- [ ] Add `ENABLE_SPREAD_PICKS` feature flag
- [ ] Create SPREAD insight card component
- [ ] Deploy and monitor

---

## 🚨 CRITICAL NOTES

### **Why Configure Factors Works Now:**
The save functionality was previously working but there was confusion about whether it worked for SPREAD. Analysis confirms:
- ✅ API schema accepts `betType: 'SPREAD'`
- ✅ Validation passes for SPREAD configurations
- ✅ Database insert works correctly
- ✅ Profile is set as `is_default: true`

### **Why Picks Don't Generate:**
The infrastructure is complete, but **zero factor implementations exist**. The orchestrator returns an empty factor array, resulting in:
- 0 confidence score
- No pick recommendation
- Empty insight card

### **No Regression Risk:**
- TOTALS picks are completely isolated
- SPREAD orchestrator is separate file
- Bet type routing is explicit
- No shared factor code

---

## 📝 RECOMMENDED NEXT STEPS

1. **Implement S1 (Net Rating Differential)** - Start here, highest impact
2. **Test S1 in isolation** - Verify calculations match expected outputs
3. **Implement S2-S5 sequentially** - One at a time, test each
4. **Full integration test** - Generate complete SPREAD pick via wizard
5. **Cron integration** - Add to automated pick generation
6. **Production deployment** - Feature flag rollout

---

## 🎓 KEY LEARNINGS

1. **Infrastructure is solid** - Phase 1 was done correctly
2. **Factor implementations are the blocker** - Need S1-S5 code
3. **No architectural issues** - System design is sound
4. **Clear path forward** - Just need to write the factor logic

**Estimated Time to Complete**: 22-30 hours (3-4 days of focused work)

**Ready to proceed with S1 implementation when you give the go-ahead!** 🚀

