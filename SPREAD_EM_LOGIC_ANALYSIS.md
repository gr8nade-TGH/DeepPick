# SPREAD EDGE vs MARKET LOGIC ANALYSIS

## User's Example Scenario

**Given:**
- Market Spread (Avg): **+4.0** (away team getting 4 points, home favored by 4)
- Predicted Margin (Proj): **-2.0** (home team favored by 2)

**Question:** What EM does this result in? Is it logical?

---

## Current Implementation Analysis

### Step 1: Understanding Spread Conventions

**Market Spread Convention:**
- Negative spread = home team favored
- Positive spread = away team favored
- Example: `-4.0` means home favored by 4 points
- Example: `+4.0` means away favored by 4 points (home is underdog)

**Predicted Margin Convention:**
- Positive margin = away team wins by X points
- Negative margin = home team wins by X points
- Example: `+5.0` means away wins by 5
- Example: `-5.0` means home wins by 5

---

## Current Code Calculation (Lines 171-175)

```typescript
// Market spread convention: negative = home favored (e.g., -4.5 means home favored by 4.5)
// Convert to away perspective: awaySpread = -marketSpread
const awaySpread = -marketSpread
marketEdgePts = predictedMargin - awaySpread
```

### Applying to User's Example:

**Given:**
- `marketSpread = +4.0` (away favored by 4, or home is +4 underdog)
- `predictedMargin = -2.0` (home wins by 2)

**Calculation:**
```
awaySpread = -marketSpread = -(+4.0) = -4.0
marketEdgePts = predictedMargin - awaySpread
marketEdgePts = (-2.0) - (-4.0)
marketEdgePts = -2.0 + 4.0
marketEdgePts = +2.0
```

**Signal Calculation (Line 634):**
```
signal = tanh(marketEdgePts / 3.0)
signal = tanh(+2.0 / 3.0)
signal = tanh(0.667)
signal ≈ +0.58
```

**Score Assignment (Lines 640-646):**
```
Since signal > 0:
  awayScore = |0.58| × 5.0 = 2.9
  homeScore = 0.0
```

---

## PROBLEM IDENTIFIED! 🚨

### The Issue:

**Market says:** Away team favored by 4 points (away -4, home +4)
**We predict:** Home team wins by 2 points (home -2, away +2)

**We DISAGREE with the market:**
- Market: Away wins by 4
- Us: Home wins by 2
- **We should be betting HOME** (we think home is undervalued)

**But the current logic gives:**
- `awayScore = 2.9` (suggests betting AWAY)
- `homeScore = 0.0`

**This is BACKWARDS!** ❌

---

## Root Cause Analysis

The problem is in the **spread convention interpretation**.

### Current Code Assumption:
```typescript
// Market spread convention: negative = home favored (e.g., -4.5 means home favored by 4.5)
const awaySpread = -marketSpread
```

This assumes `marketSpread` is from **home team perspective**.

### But MySportsFeeds Returns:
The `spread.line` we're storing is the **home team's spread**.

**Example from MySportsFeeds:**
- If home is favored by 4.5: `homeSpread = -4.5`
- If away is favored by 4.5: `homeSpread = +4.5`

So when we have `marketSpread = +4.0`, it means:
- Home team is getting +4.0 points (home is underdog)
- Away team is favored by 4.0 points

---

## Correct Logic

### What We Want:

**Edge Calculation:**
```
Edge = (Our predicted margin) - (Market's predicted margin)
```

**Interpretation:**
- Positive edge = We think away team will do BETTER than market expects
- Negative edge = We think home team will do BETTER than market expects

### Example 1: User's Scenario

**Market:** `homeSpread = +4.0` → Market thinks away wins by 4
**Us:** `predictedMargin = -2.0` → We think home wins by 2

**Market's implied margin:** Away wins by 4 = `+4.0` (away perspective)
**Our predicted margin:** Home wins by 2 = `-2.0` (away perspective)

**Edge:**
```
Edge = predictedMargin - marketSpread
Edge = (-2.0) - (+4.0)
Edge = -6.0
```

**Interpretation:**
- Edge = -6.0 (negative, favors home)
- We think home will do 6 points BETTER than market expects
- **Bet: HOME +4.0** ✅

**Signal:**
```
signal = tanh(-6.0 / 3.0) = tanh(-2.0) ≈ -0.96
homeScore = |-0.96| × 5.0 = 4.8
awayScore = 0.0
```

**Result:** High confidence on HOME ✅ CORRECT!

---

### Example 2: Opposite Scenario

**Market:** `homeSpread = -7.0` → Market thinks home wins by 7
**Us:** `predictedMargin = -2.0` → We think home wins by 2

**Edge:**
```
Edge = predictedMargin - marketSpread
Edge = (-2.0) - (-7.0)
Edge = +5.0
```

**Interpretation:**
- Edge = +5.0 (positive, favors away)
- Market thinks home wins by 7, we think only by 2
- Away team is undervalued (getting too many points)
- **Bet: AWAY +7.0** ✅

**Signal:**
```
signal = tanh(+5.0 / 3.0) = tanh(+1.67) ≈ +0.93
awayScore = |+0.93| × 5.0 = 4.65
homeScore = 0.0
```

**Result:** High confidence on AWAY ✅ CORRECT!

---

## THE FIX

### Current Code (WRONG):
```typescript
const awaySpread = -marketSpread
marketEdgePts = predictedMargin - awaySpread
```

### Corrected Code:
```typescript
// marketSpread is already from home perspective (negative = home favored)
// predictedMargin is from away perspective (positive = away wins)
// Both are in the same direction, so direct subtraction works
marketEdgePts = predictedMargin - marketSpread
```

**Remove the negation!** The spread is already in the correct format.

---

## Verification with User's Example

**After Fix:**

**Given:**
- `marketSpread = +4.0` (home is underdog, away favored by 4)
- `predictedMargin = -2.0` (home wins by 2)

**Calculation:**
```
marketEdgePts = predictedMargin - marketSpread
marketEdgePts = (-2.0) - (+4.0)
marketEdgePts = -6.0
```

**Signal:**
```
signal = tanh(-6.0 / 3.0) = tanh(-2.0) ≈ -0.96
```

**Score:**
```
Since signal < 0:
  homeScore = |-0.96| × 5.0 = 4.8
  awayScore = 0.0
```

**Result:** High confidence on HOME ✅ CORRECT!

**Interpretation:**
- Market thinks away wins by 4
- We think home wins by 2
- That's a 6-point edge in favor of home
- **Bet HOME +4.0** with high confidence ✅

---

## Summary

**Problem:** The code was negating the market spread unnecessarily, causing the edge calculation to be inverted.

**Fix:** Remove the `awaySpread = -marketSpread` line and use `marketSpread` directly.

**Impact:** 
- ✅ Edge calculation will be correct
- ✅ Confidence scores will favor the right team
- ✅ SPREAD picks will be accurate

