# S1: Net Rating Differential - Implementation Complete ✅

**Date**: 2025-11-03  
**Status**: IMPLEMENTED & INTEGRATED  
**Next**: Ready for testing via wizard UI

---

## 📋 IMPLEMENTATION SUMMARY

### **What Was Implemented**

1. **New File Created**: `src/lib/cappers/shiva-v1/factors/s1-net-rating-differential.ts`
2. **Orchestrator Updated**: `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts`
3. **Pattern Consistency**: Follows exact same structure as TOTALS factors (F1-F5)

---

## 🎯 FACTOR LOGIC

### **Net Rating Calculation**
```typescript
awayNetRtg = awayORtg - awayDRtg
homeNetRtg = homeORtg - homeDRtg
netRatingDiff = awayNetRtg - homeNetRtg
```

### **Expected Margin Calculation**
```typescript
expectedMargin = netRatingDiff * (pace / 100)
```

**Example**:
- Away Net Rating: +5.0 (115 ORtg - 110 DRtg)
- Home Net Rating: +2.0 (112 ORtg - 110 DRtg)
- Net Rating Diff: +3.0 (away advantage)
- Pace: 100
- **Expected Margin**: +3.0 points (away expected to win by 3)

### **Spread Edge Calculation** (Optional)
```typescript
spreadEdge = expectedMargin - awaySpread
```

**Example**:
- Expected Margin: +3.0 (away favored by 3)
- Spread Line: -4.5 (home favored by 4.5)
- Away Spread: +4.5 (away getting 4.5 points)
- **Spread Edge**: +3.0 - (+4.5) = -1.5 (home has value)

### **Signal Calculation**
```typescript
signal = tanh(spreadEdge / 8.0)
// Clamped to [-1, 1]
```

**Signal Interpretation**:
- `signal > 0` → Favors AWAY team
- `signal < 0` → Favors HOME team
- `signal = 0` → Neutral

### **Point Award**
```typescript
if (signal > 0) {
  awayScore = Math.abs(signal) * 5.0
} else if (signal < 0) {
  homeScore = Math.abs(signal) * 5.0
}
```

**Max Points**: 5.0 per team

---

## 📊 DATA SOURCES

### **From NBAStatsBundle**:
- `awayORtgLast10` - Away offensive rating (last 10 games)
- `awayDRtgSeason` - Away defensive rating (season)
- `homeORtgLast10` - Home offensive rating (last 10 games)
- `homeDRtgSeason` - Home defensive rating (season)
- `leaguePace` - League average pace

### **From Context** (Optional):
- `ctx.spreadLine` - Spread line for edge calculation (e.g., -4.5)

---

## 🔧 IMPLEMENTATION DETAILS

### **Function Signature**
```typescript
export function calculateNetRatingDiffPoints(input: NetRatingDiffInput): NetRatingDiffOutput
```

### **Input Type**
```typescript
interface NetRatingDiffInput {
  awayORtg: number
  awayDRtg: number
  homeORtg: number
  homeDRtg: number
  pace: number
  spreadLine?: number // Optional
}
```

### **Output Type**
```typescript
interface NetRatingDiffOutput {
  awayScore: number
  homeScore: number
  signal: number
  meta: {
    awayNetRtg: number
    homeNetRtg: number
    netRatingDiff: number
    expectedMargin: number
    spreadEdge?: number
    reason?: string
  }
}
```

### **Orchestrator Integration**
```typescript
// S1: Net Rating Differential
if (enabledFactorKeys.includes('netRatingDiff')) {
  console.log('[SPREAD:S1] Computing Net Rating Differential...')
  factors.push(computeNetRatingDifferential(bundle!, ctx))
}
```

---

## ✅ CONSISTENCY WITH TOTALS FACTORS

### **Pattern Matching**:
1. ✅ **Calculation Function**: `calculateNetRatingDiffPoints()` (like `calculatePaceFactorPoints()`)
2. ✅ **Wrapper Function**: `computeNetRatingDifferential()` (like `computePaceIndex()`)
3. ✅ **Signal Range**: -1 to +1 (same as F1-F5)
4. ✅ **Max Points**: 5.0 (same as F1-F5)
5. ✅ **Tanh Scaling**: Smooth saturation (same as F1-F5)
6. ✅ **Input Validation**: Checks for finite positive values
7. ✅ **Return Structure**: `factor_no`, `key`, `name`, `normalized_value`, `raw_values_json`, `parsed_values_json`, `caps_applied`, `cap_reason`, `notes`
8. ✅ **Null Handling**: Returns zero scores if bundle is null

### **Adaptations for SPREAD**:
1. ✅ **Away/Home Scores**: Instead of `overScore`/`underScore`
2. ✅ **Signal Interpretation**: Positive = AWAY, Negative = HOME
3. ✅ **Spread Edge**: Compares expected margin to spread line
4. ✅ **Net Rating Focus**: Uses team efficiency differentials

---

## 🧪 TESTING PLAN

### **Test Case 1: Strong Away Advantage**
**Input**:
- Away: 118 ORtg, 108 DRtg → Net Rating: +10
- Home: 112 ORtg, 112 DRtg → Net Rating: 0
- Pace: 100
- Spread: -3.5 (home favored)

**Expected Output**:
- Net Rating Diff: +10 (away advantage)
- Expected Margin: +10 points
- Away Spread: +3.5
- Spread Edge: +10 - (+3.5) = +6.5 (strong away value)
- Signal: ~+0.65 (positive = away)
- Away Score: ~3.25 points
- Home Score: 0 points

### **Test Case 2: Strong Home Advantage**
**Input**:
- Away: 108 ORtg, 115 DRtg → Net Rating: -7
- Home: 116 ORtg, 109 DRtg → Net Rating: +7
- Pace: 100
- Spread: -8.5 (home favored)

**Expected Output**:
- Net Rating Diff: -14 (home advantage)
- Expected Margin: -14 points
- Away Spread: +8.5
- Spread Edge: -14 - (+8.5) = -22.5 (capped to -20, strong home value)
- Signal: ~-0.99 (negative = home)
- Away Score: 0 points
- Home Score: ~4.95 points

### **Test Case 3: Neutral (No Edge)**
**Input**:
- Away: 112 ORtg, 110 DRtg → Net Rating: +2
- Home: 114 ORtg, 112 DRtg → Net Rating: +2
- Pace: 100
- Spread: 0 (pick'em)

**Expected Output**:
- Net Rating Diff: 0
- Expected Margin: 0 points
- Spread Edge: 0
- Signal: 0
- Away Score: 0 points
- Home Score: 0 points

---

## 🚀 NEXT STEPS

### **Immediate Testing**:
1. **Enable S1 in Configure Factors**:
   - Go to Shiva Management → Configure Factors
   - Select SPREAD bet type
   - Enable "Net Rating Differential" (S1)
   - Set weight to 100% (for isolated testing)
   - Save configuration

2. **Generate Test Pick**:
   - Go to Wizard UI
   - Select an upcoming NBA game
   - Select SPREAD bet type
   - Click "Generate Pick"

3. **Verify Output**:
   - Check console logs for `[SPREAD:S1]` messages
   - Verify factor appears in `factors` array
   - Check `awayScore` and `homeScore` values
   - Verify `signal` is between -1 and +1
   - Check `notes` field for readable summary

4. **Review Debug Data**:
   - Check `raw_values_json` for calculation inputs
   - Check `parsed_values_json` for scores and signal
   - Verify `expectedMargin` and `spreadEdge` calculations

### **After S1 Testing Passes**:
- ✅ Mark S1 as complete
- 🚀 Proceed to **S2: Rest Advantage** implementation
- 📝 Document any issues or adjustments needed

---

## 📝 NOTES

### **Design Decisions**:
1. **Spread Line is Optional**: Factor works without spread line (uses expected margin only)
2. **Pace Adjustment**: Expected margin scales with game pace (faster pace = larger margins)
3. **Tanh Scaling**: Prevents extreme outliers from dominating (8-point scale)
4. **Safety Caps**: Edge clamped to ±20 points to prevent mathematical issues

### **Potential Enhancements** (Future):
- Add recent form weighting (last 5 games vs last 10 games)
- Incorporate home/away splits for ORtg/DRtg
- Add confidence intervals based on sample size
- Weight by strength of schedule

---

## ✅ CHECKLIST

- [x] S1 implementation file created
- [x] Orchestrator integration complete
- [x] TypeScript compilation successful (no errors)
- [x] Pattern consistency verified (matches F1-F5)
- [x] Documentation complete
- [ ] **PENDING**: Test via wizard UI
- [ ] **PENDING**: Verify factor output
- [ ] **PENDING**: User approval to proceed to S2

---

**Ready for testing! Please test S1 via the wizard UI and provide feedback before I implement S2.** 🚀

