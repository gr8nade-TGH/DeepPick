# 🏀 NBA SPREAD Pick Generation - Implementation Summary

**Created**: 2025-11-02  
**Status**: Planning Complete - Ready to Begin Implementation  
**Checkpoint**: `checkpoint-insight-card-redesign` (commit 9d8d6b9)

---

## 📋 Executive Summary

This document summarizes the comprehensive plan to add NBA SPREAD (Against The Spread) pick generation to the existing TOTALS system without breaking any functionality.

### **Key Decisions Made**

1. ✅ **Architecture**: Unified system with `betType` parameter (Option B from analysis)
2. ✅ **Execution**: Sequential processing (TOTAL first, then SPREAD with 30s delay)
3. ✅ **Same Game**: TOTAL and SPREAD picks can be generated for the same game
4. ✅ **Confidence Thresholds**: SPREAD uses same thresholds as TOTALS (5.0=1U, 6.0=2U, etc.)
5. ✅ **Insight Card**: SPREAD will have customized insight card similar to TOTALS format

---

## 🎯 The 5 SPREAD Factors (from NBA-ATS-5-Critical-Factors.md)

| Factor | Weight | Purpose | Data Source |
|--------|--------|---------|-------------|
| **S1: Net Rating Differential** | 30% | Measures expected point differential per 100 possessions vs spread | MySportsFeeds `team_stats_totals` |
| **S2: Rest Advantage** | 25% | Back-to-back & travel create 3-5 point ATS swings | MySportsFeeds `games` schedule |
| **S3: Recent ATS Momentum** | 20% | Teams on ATS hot streaks (7-3 L10) are undervalued | MySportsFeeds `games` + odds |
| **S4: Home Court Advantage** | 15% | Elite HCA (5-7 pts) vs weak HCA (1-2 pts) creates edges | MySportsFeeds team stats (home/away splits) |
| **S5: Four Factors Differential** | 10% | Dean Oliver's Four Factors (eFG%, TOV%, OREB%, FTR) | MySportsFeeds `team_stats_totals` |

**Total Weight**: 100% (same as TOTALS system)

---

## 📊 Factor Scoring Logic Difference

### **TOTALS (Existing)**
```typescript
// Factors award points to OVER vs UNDER
interface TotalsFactorOutput {
  overScore: number    // 0-5 points
  underScore: number   // 0-5 points
  signal: number       // -1 to +1
  meta: any
}
```

### **SPREAD (New)**
```typescript
// Factors award points to AWAY vs HOME
interface SpreadFactorOutput {
  awayScore: number    // 0-5 points
  homeScore: number    // 0-5 points
  signal: number       // -1 to +1 (same as totals)
  meta: any
}
```

**Key Insight**: The `signal` (-1 to +1) is bet-type agnostic. Only the **interpretation** changes:
- **TOTALS**: signal > 0 → OVER, signal < 0 → UNDER
- **SPREAD**: signal > 0 → AWAY, signal < 0 → HOME

---

## 🗂️ File Structure

### **New Files to Create**
```
src/lib/cappers/shiva-v1/factors/
├── nba-spread-orchestrator.ts          (NEW - coordinates S1-S5)
├── s1-net-rating-differential.ts       (NEW - Factor 1)
├── s2-rest-advantage.ts                (NEW - Factor 2)
├── s3-ats-momentum.ts                  (NEW - Factor 3)
├── s4-home-court-advantage.ts          (NEW - Factor 4)
└── s5-four-factors.ts                  (NEW - Factor 5)

src/app/cappers/shiva/management/components/
└── spread-insight-card.tsx             (NEW - SPREAD insight card)
```

### **Files to Modify**
```
src/lib/cappers/shiva-wizard-orchestrator.ts     (Add betType parameter)
src/lib/cappers/shiva-v1/confidence-calculator.ts (Handle awayScore/homeScore)
src/lib/cappers/shiva-v1/factor-registry.ts      (Add S1-S5 metadata)
src/app/cappers/shiva/management/components/factor-config-modal.tsx (Show SPREAD factors)
src/app/api/cron/shiva-auto-picks/route.ts       (Loop through bet types)
```

---

## 🚀 Implementation Phases

### **PHASE 1: Foundation & Infrastructure** (No Breaking Changes)
**Goal**: Add `betType` parameter support without modifying TOTALS code paths

**Tasks**:
1. ✅ Add `betType` parameter to `executeWizardPipeline()`
2. ✅ Update confidence calculator for `awayScore`/`homeScore`
3. ✅ Create `nba-spread-orchestrator.ts` stub (empty factors)
4. ✅ Add S1-S5 to factor registry with metadata
5. ✅ Update factor config modal to show SPREAD factors
6. ✅ **CRITICAL**: Test TOTALS picks still work (regression test)
7. ✅ Create checkpoint: `checkpoint-before-spread-factors`

**Estimated Time**: 4-6 hours  
**Risk**: LOW (no changes to existing TOTALS logic)

---

### **PHASE 2: Spread Factor Implementation** (S1-S5)
**Goal**: Implement all 5 spread factors with MySportsFeeds API integration

**Tasks**:

#### **S1: Net Rating Differential (30% weight)**
- Create `s1-net-rating-differential.ts`
- Fetch team stats: `ptsPerGame`, `possessions`, `ptsAgainstPerGame`
- Calculate: `OffRtg = (points / possessions) * 100`
- Calculate: `DefRtg = (oppPoints / possessions) * 100`
- Calculate: `NetRating = OffRtg - DefRtg`
- Calculate: `differential = awayNetRating - homeNetRating`
- Calculate: `expectedMargin = (differential / 100) * pace`
- Calculate: `atsEdge = expectedMargin - spread`
- Award points to away/home based on edge
- **Test**: Bucks vs Pistons example (spread -12.5, expected +4.5 edge)

#### **S2: Rest Advantage (25% weight)**
- Create `s2-rest-advantage.ts`
- Fetch team schedules from MySportsFeeds `games` API
- Calculate rest days: `(currentGameDate - previousGameDate) / (1000*60*60*24)`
- Identify back-to-back: `restDays === 1`
- Award +3.5 points if opponent on back-to-back
- Award +1.5 additional if road back-to-back
- **Test**: Suns @ Nuggets example (Nuggets B2B, +4.0 advantage for Suns)

#### **S3: Recent ATS Momentum (20% weight)**
- Create `s3-ats-momentum.ts`
- Fetch last 10 games for both teams
- Calculate ATS record: `atsMargin = actualMargin + spread`
- Count covers (atsMargin > 0) and losses (atsMargin < 0)
- Award momentum score:
  - 70%+ ATS: +3.0 points
  - 60%+ ATS: +1.5 points
  - 50% ATS: 0.0 points
  - 40%- ATS: -1.5 points
  - 30%- ATS: -3.0 points
- Calculate differential between teams
- **Test**: Heat (7-3 ATS) vs Celtics (4-6 ATS), +4.5 differential

#### **S4: Home Court Advantage (15% weight)**
- Create `s4-home-court-advantage.ts`
- Fetch home/away splits from MySportsFeeds
- Calculate: `homeWinRate = homeWins / homeGames`
- Calculate: `roadWinRate = roadWins / roadGames`
- Calculate: `HCA = (homeWinRate - roadWinRate) * 30`
- Calculate: `hcaEdge = HCA - 3.0` (league average)
- Award points to home team if edge exists
- **Test**: Nuggets (68.3% home, 43.9% road) vs Lakers, +4.3 edge

#### **S5: Four Factors Differential (10% weight)**
- Create `s5-four-factors.ts`
- Fetch: `fgMade`, `fg3Made`, `fgAtt`, `turnovers`, `possessions`, `offReb`, `oppDefReb`, `ftAtt`
- Calculate: `eFG = (fgMade + 0.5*fg3Made) / fgAtt`
- Calculate: `TOV% = turnovers / possessions`
- Calculate: `OREB% = offReb / (offReb + oppDefReb)`
- Calculate: `FTR = ftAtt / fgAtt`
- Calculate: `rating = (0.50*eFG) - (0.30*TOV%) + (0.15*OREB%) + (0.05*FTR)`
- Calculate: `differential = awayRating - homeRating`
- Calculate: `expectedMargin = differential * 120`
- Award points based on margin vs spread
- **Test**: Warriors vs Kings example (spread -4.5, Kings value)

**Estimated Time**: 12-16 hours  
**Risk**: MEDIUM (new API calls, complex calculations)

---

### **PHASE 3: Testing & Validation**
**Goal**: Verify SPREAD picks work correctly without breaking TOTALS

**Tasks**:
1. ✅ Test SPREAD pick generation via wizard UI
2. ✅ Verify SPREAD cooldown creation `(game_id, shiva, SPREAD)`
3. ✅ Verify SPREAD pick saved to database (`pick_type='spread'`)
4. ✅ Test TOTAL and SPREAD on same game (separate cooldowns)
5. ✅ Validate factor calculations with test data from docs
6. ✅ Test confidence thresholds (5.0=1U, 6.0=2U, etc.)

**Estimated Time**: 4-6 hours  
**Risk**: LOW (testing only)

---

### **PHASE 4: Cron Integration & Deployment**
**Goal**: Deploy SPREAD picks to production with monitoring

**Tasks**:
1. ✅ Update cron job to loop through `['TOTAL', 'SPREAD']` sequentially
2. ✅ Add 30-second delay between bet types (MySportsFeeds backoff)
3. ✅ Add `ENABLE_SPREAD_PICKS` feature flag (default: false)
4. ✅ Add `betType` logging to all operations
5. ✅ Create SPREAD insight card template
6. ✅ Deploy to production with `ENABLE_SPREAD_PICKS=false`
7. ✅ Monitor TOTALS picks for 24 hours (no regression)
8. ✅ Enable SPREAD picks: `ENABLE_SPREAD_PICKS=true`
9. ✅ Monitor for 48 hours (cron logs, picks, cooldowns, API rate limiting)
10. ✅ Create checkpoint: `checkpoint-spread-picks-live`

**Estimated Time**: 6-8 hours  
**Risk**: MEDIUM (production deployment)

---

## ⚠️ Critical Safeguards

1. **Feature Flag**: `ENABLE_SPREAD_PICKS` environment variable
2. **Gradual Rollout**: Deploy with SPREAD disabled, monitor TOTALS, then enable SPREAD
3. **Sequential Execution**: 30-second delay between TOTAL and SPREAD to avoid API rate limits
4. **Checkpoints**: 
   - `checkpoint-insight-card-redesign` (current)
   - `checkpoint-before-spread-factors` (after Phase 1)
   - `checkpoint-spread-picks-live` (after Phase 4)
5. **Rollback Plan**: Can revert to `checkpoint-picks-working` (commit 7d30921) if needed

---

## 📈 Estimated Total Time

- **Phase 1**: 4-6 hours
- **Phase 2**: 12-16 hours
- **Phase 3**: 4-6 hours
- **Phase 4**: 6-8 hours

**Total**: 26-36 hours (3-5 days of focused work)

---

## 🎯 Success Criteria

1. ✅ TOTALS picks continue to generate without regression
2. ✅ SPREAD picks generate successfully via wizard UI
3. ✅ SPREAD picks generate successfully via cron job
4. ✅ Cooldowns work correctly for both TOTAL and SPREAD on same game
5. ✅ MySportsFeeds API rate limiting respected (no 429 errors)
6. ✅ Factor calculations match expected outputs from test data
7. ✅ Confidence thresholds award correct units (1U-5U)
8. ✅ SPREAD insight card displays correctly

---

## 📝 Next Steps

1. **Review this summary** and the detailed task list
2. **Begin Phase 1**: Foundation & Infrastructure
3. **Mark tasks as IN_PROGRESS** and **COMPLETE** as you go
4. **Create checkpoints** after each phase
5. **Monitor production** closely during Phase 4

**Ready to begin implementation!** 🚀

