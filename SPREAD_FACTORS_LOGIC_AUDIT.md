# SPREAD FACTORS LOGIC AUDIT

## Summary

Audited all 5 SPREAD factors (S1-S5) to verify they award points to the correct team.

**Convention:**
- **Positive signal** → Favors AWAY team → `awayScore` gets points
- **Negative signal** → Favors HOME team → `homeScore` gets points

---

## ✅ S1: Net Rating Differential

**File:** `src/lib/cappers/shiva-v1/factors/s1-net-rating-differential.ts`

### Logic (Lines 84-127):
```typescript
// Calculate net rating differential (positive = away advantage)
const netRatingDiff = awayNetRtg - homeNetRtg

// Calculate expected margin (adjusted for pace)
const expectedMargin = netRatingDiff * (pace / 100)

// Calculate signal
const signal = tanh(cappedEdge / SCALE)

if (signal > 0) {
  awayScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
} else if (signal < 0) {
  homeScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
}
```

### Status: ✅ **CORRECT**

**BUT FOUND BUG IN SPREAD EDGE CALCULATION (Lines 96-106):**

```typescript
if (spreadLine !== undefined) {
  const awaySpread = -spreadLine  // ❌ SAME BUG AS WIZARD ORCHESTRATOR!
  spreadEdge = expectedMargin - awaySpread
  edgeForSignal = spreadEdge
}
```

**Issue:** Same negation bug - should be `spreadEdge = expectedMargin - spreadLine`

**Impact:** When spread line is provided, the edge calculation is inverted (same as EM factor bug)

---

## ✅ S2: Turnover Differential

**File:** `src/lib/cappers/shiva-v1/factors/s2-turnover-differential.ts`

### Logic (Lines 75-94):
```typescript
// Positive = away advantage (home commits more TOV)
// Negative = home advantage (away commits more TOV)
const turnoverDifferential = input.homeTOV - input.awayTOV
const expectedPointImpact = turnoverDifferential * POINTS_PER_TURNOVER

const signal = clamp(tanh(expectedPointImpact / 5.0), -1, 1)

if (signal > 0) {
  awayScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
} else if (signal < 0) {
  homeScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
}
```

### Verification:
- `turnoverDifferential = homeTOV - awayTOV`
- If home commits more TOV: `homeTOV > awayTOV` → `differential > 0` → `signal > 0` → `awayScore` ✅
- If away commits more TOV: `awayTOV > homeTOV` → `differential < 0` → `signal < 0` → `homeScore` ✅

### Status: ✅ **CORRECT**

---

## ✅ S3: Shooting Efficiency + Momentum

**File:** `src/lib/cappers/shiva-v1/factors/s3-shooting-efficiency-momentum.ts`

### Logic (Lines 80-128):
```typescript
// Shooting differential
const shootingDiff = awayShootingScore - homeShootingScore

// Momentum differential
const momentumDiff = awayMomentum - homeMomentum

// Combined signal
const combinedSignal = (efficiencySignal * 0.6) + (momentumSignal * 0.4)
const signal = Math.tanh(combinedSignal / 6.0)

// Convert to scores
const awayScore = signal > 0 ? Math.abs(signal) * 5.0 : 0  // ✅ CORRECT
const homeScore = signal < 0 ? Math.abs(signal) * 5.0 : 0  // ✅ CORRECT
```

### Verification:
- `shootingDiff = awayShootingScore - homeShootingScore`
- If away shoots better: `awayShootingScore > homeShootingScore` → `shootingDiff > 0` → `signal > 0` → `awayScore` ✅
- If home shoots better: `homeShootingScore > awayShootingScore` → `shootingDiff < 0` → `signal < 0` → `homeScore` ✅

### Status: ✅ **CORRECT**

---

## ❌ S4: Pace Mismatch

**File:** `src/lib/cappers/shiva-v1/factors/s4-pace-mismatch.ts`

### Logic (Lines 74-104):
```typescript
// Calculate pace differential
// Positive = away team plays faster
// Negative = home team plays faster
const paceDiff = input.awayPace - input.homePace

// Calculate expected ATS impact
// Theory: Slower teams control tempo and often cover as underdogs
// When away team is faster (paceDiff > 0), home team (slower) gets slight edge
// When home team is faster (paceDiff < 0), away team (slower) gets slight edge
const expectedImpact = paceDiff * IMPACT_PER_POSSESSION

const signal = clamp(tanh(expectedImpact / 3.0), -1, 1)

if (signal > 0) {
  // Positive signal = away team plays faster, home team (slower) gets ATS edge
  homeScore = Math.abs(signal) * MAX_POINTS  // ❌ INVERTED!
} else if (signal < 0) {
  // Negative signal = home team plays faster, away team (slower) gets ATS edge
  awayScore = Math.abs(signal) * MAX_POINTS  // ❌ INVERTED!
}
```

### Issue: **INVERTED LOGIC!**

**Current Logic:**
- `paceDiff > 0` (away faster) → `signal > 0` → `homeScore` gets points
- `paceDiff < 0` (home faster) → `signal < 0` → `awayScore` gets points

**This violates the convention!**
- Positive signal should ALWAYS favor away
- Negative signal should ALWAYS favor home

**The Fix:**

The theory is correct (slower teams get ATS edge), but the implementation is backwards.

**Option 1: Flip the signal calculation**
```typescript
// Invert the signal so slower team gets positive signal
const expectedImpact = -paceDiff * IMPACT_PER_POSSESSION  // Negate!
const signal = clamp(tanh(expectedImpact / 3.0), -1, 1)

if (signal > 0) {
  awayScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
} else if (signal < 0) {
  homeScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
}
```

**Option 2: Keep signal, flip score assignment (NOT RECOMMENDED - breaks convention)**

### Status: ❌ **INVERTED - NEEDS FIX**

---

## ✅ S5: Four Factors Differential

**File:** `src/lib/cappers/shiva-v1/factors/s5-four-factors-differential.ts`

### Logic (Lines 103-123):
```typescript
// Calculate differential (positive = away advantage, negative = home advantage)
const differential = awayRating - homeRating

// Convert to expected point margin
const expectedMargin = differential * 120

// Apply tanh scaling
const signal = clamp(tanh(expectedMargin / 8.0), -1, 1)

if (signal > 0) {
  awayScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
} else if (signal < 0) {
  homeScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
}
```

### Verification:
- `differential = awayRating - homeRating`
- If away has better rating: `awayRating > homeRating` → `differential > 0` → `signal > 0` → `awayScore` ✅
- If home has better rating: `homeRating > awayRating` → `differential < 0` → `signal < 0` → `homeScore` ✅

### Status: ✅ **CORRECT**

---

## Summary of Issues Found

### 🚨 Critical Bugs:

1. **S1: Net Rating Differential - Spread Edge Calculation**
   - **File:** `src/lib/cappers/shiva-v1/factors/s1-net-rating-differential.ts`
   - **Line:** 100
   - **Issue:** `const awaySpread = -spreadLine` (unnecessary negation)
   - **Fix:** Remove negation, use `spreadEdge = expectedMargin - spreadLine`
   - **Impact:** When spread line is provided, edge calculation is inverted

2. **S4: Pace Mismatch - Inverted Score Assignment**
   - **File:** `src/lib/cappers/shiva-v1/factors/s4-pace-mismatch.ts`
   - **Lines:** 98-104
   - **Issue:** Positive signal awards homeScore, negative signal awards awayScore (backwards!)
   - **Fix:** Negate the expectedImpact calculation: `const expectedImpact = -paceDiff * IMPACT_PER_POSSESSION`
   - **Impact:** Factor is awarding points to the WRONG team

### ✅ Correct Factors:

- **S2: Turnover Differential** ✅
- **S3: Shooting Efficiency + Momentum** ✅
- **S5: Four Factors Differential** ✅

---

## Recommended Fixes

### Fix 1: S1 Spread Edge Calculation

**Current (WRONG):**
```typescript
const awaySpread = -spreadLine
spreadEdge = expectedMargin - awaySpread
```

**Fixed:**
```typescript
spreadEdge = expectedMargin - spreadLine
```

### Fix 2: S4 Pace Mismatch Signal

**Current (WRONG):**
```typescript
const expectedImpact = paceDiff * IMPACT_PER_POSSESSION
const signal = clamp(tanh(expectedImpact / 3.0), -1, 1)

if (signal > 0) {
  homeScore = Math.abs(signal) * MAX_POINTS  // ❌ BACKWARDS
} else if (signal < 0) {
  awayScore = Math.abs(signal) * MAX_POINTS  // ❌ BACKWARDS
}
```

**Fixed:**
```typescript
// Negate so slower team gets positive signal in their favor
const expectedImpact = -paceDiff * IMPACT_PER_POSSESSION
const signal = clamp(tanh(expectedImpact / 3.0), -1, 1)

if (signal > 0) {
  awayScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
} else if (signal < 0) {
  homeScore = Math.abs(signal) * MAX_POINTS  // ✅ CORRECT
}
```

**Verification:**
- Away faster (`paceDiff > 0`) → `expectedImpact < 0` → `signal < 0` → `homeScore` (slower team) ✅
- Home faster (`paceDiff < 0`) → `expectedImpact > 0` → `signal > 0` → `awayScore` (slower team) ✅

