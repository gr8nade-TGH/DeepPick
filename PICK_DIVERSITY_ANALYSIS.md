# Pick Diversity Analysis - Why All Cappers Agree

## Executive Summary

After thorough investigation, I've identified **5 critical issues** causing all cappers to generate picks on the same side despite having different baseline methods, factor weights, and AI archetypes.

---

## Issue 1: Baseline Regression to Vegas (60% Weight)

**Location:** `src/lib/cappers/shiva-wizard-orchestrator.ts` lines 828-833

```typescript
// FIX: Regress toward Vegas to avoid systematic OVER bias
const REGRESSION_WEIGHT = 0.60 // 60% Vegas, 40% stats
const regressedBaseline = (rawBaseline * (1 - REGRESSION_WEIGHT)) + (vegasFallback * REGRESSION_WEIGHT)
```

**Problem:** All 3 baseline models (pace-efficiency, ppg-based, matchup-defensive) are regressed 60% toward Vegas. This means:
- If Vegas = 223.5 and raw model predicts 235, final baseline = 235×0.4 + 223.5×0.6 = **228.1**
- If Vegas = 223.5 and raw model predicts 228, final baseline = 228×0.4 + 223.5×0.6 = **225.3**
- Maximum difference between baselines: **~3-5 points** (not enough to flip direction)

**Impact:** Baselines produce nearly identical values since all are anchored to Vegas.

---

## Issue 2: Factors Are Shared Across Cappers (Same Stats Bundle)

**Location:** `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts`

All cappers query the **same NBA stats API** for the same game, producing identical input data:
- Same `awayORtgLast10`, `homeORtgLast10`
- Same pace, defensive ratings, shooting percentages
- Same injury data

**Even with different factor weights**, the underlying signals are identical:

| Factor | Signal | SHIVA (42%) | IFRIT (80%) | Contribution Difference |
|--------|--------|-------------|-------------|-------------------------|
| paceIndex | +0.6 | +0.6×0.42 = **+0.252** | +0.6×0.80 = **+0.480** | Same direction (OVER) |
| offForm | +0.4 | +0.4×0.42 = **+0.168** | +0.4×0.60 = **+0.240** | Same direction (OVER) |

**Impact:** Weights only scale magnitude, not direction. If all factors point OVER, different weights don't help.

---

## Issue 3: Edge vs Market Dominates (100% Fixed Weight)

**Location:** `src/lib/cappers/shiva-wizard-orchestrator.ts` lines 149-159

```typescript
edgeVsMarketFactor = createEdgeVsMarketFactor(predictedTotal, marketTotalLine, marketEdgePts)
const factorWeights = {
  ...steps.step3.factorWeights,
  edgeVsMarket: 100 // 100% weight (fixed)
}
```

**Problem:** Edge vs Market factor has 100% weight, while base factors total 250%. 
- Edge vs Market = 100 / 350 = **28.6% of total influence**
- All base factors combined = 250 / 350 = 71.4%

Edge vs Market is calculated as: `predictedTotal - marketTotalLine`

Since all cappers have similar `predictedTotal` (due to Issue 1 & 2), their Edge vs Market factors are nearly identical.

---

## Issue 4: AI Archetype Only Adds to Existing Direction (Doesn't Flip)

**Location:** `src/lib/cappers/shiva-wizard-orchestrator.ts` Step 5.5

AI Archetype adds 0-5 points to one side based on external AI analysis (Grok). However:
- It's called **after** the pick direction is already determined
- It can only **strengthen** a pick, not flip it
- Different archetypes (pulse, mathematician, interpreter, influencer) often agree on high-profile games

**Impact:** AI Archetypes add marginal differentiation but can't reverse a consensus direction.

---

## Issue 5: Factor Weights Don't Sum to Different Totals

**Current Capper Config Analysis:**

| Capper | baseline_model | Total Weight | Top Weighted Factor |
|--------|----------------|--------------|---------------------|
| SHIVA | pace-efficiency | 250% | All balanced at 42% |
| IFRIT | matchup-defensive | 250% | paceIndex 80% |
| SENTINEL | pace-efficiency | 250% | defErosion 80% |
| NEXUS | matchup-defensive | 250% | defStrength 80% |
| BLITZ | ppg-based | 250% | threeEnv 80% |

All cappers have factor weights normalized to 250%. Different factor emphasis doesn't help because:
1. The underlying factor signals are all pointing the same direction (same stats data)
2. Weights only amplify/dampen, they don't flip direction

---

## Root Cause Summary

The pick direction is determined by:
```
pickDirection = predictedTotal > marketTotalLine ? 'OVER' : 'UNDER'
```

Where:
```
predictedTotal = statsBaseline + edgeRaw
```

For picks to disagree, we need `predictedTotal` to be on different sides of `marketTotalLine` for different cappers. Currently:
1. **statsBaseline** is 60% Vegas for everyone (minimal difference)
2. **edgeRaw** (sum of factor contributions) is similar because same stats data
3. **All components point same direction** → All cappers agree

---

## Proposed Solutions

### Solution A: Reduce Vegas Regression (Quick Fix)
Change from 60% Vegas to **30% Vegas** for more model diversity:
```typescript
const REGRESSION_WEIGHT = 0.30 // 30% Vegas, 70% stats
```
**Risk:** May reintroduce OVER bias if not monitored.

### Solution B: Per-Capper Regression Weights (Medium Fix)
Allow each baseline model to have different regression:
- `pace-efficiency`: 40% Vegas (more stats-driven)
- `ppg-based`: 50% Vegas (balanced)
- `matchup-defensive`: 60% Vegas (more conservative)

### Solution C: Contrarian Factor (Best Fix)
Add a "contrarian" factor that:
- Explicitly favors the opposite of what other cappers pick
- Calculates based on "market consensus" from other cappers
- Gives some cappers a systematic UNDER bias

### Solution D: Archetype-Specific Baseline Adjustments
Apply baseline modifiers based on archetype philosophy:
```typescript
if (archetype === 'the-fade') {
  // The Fade: Systematically fades public consensus
  statsBaseline = statsBaseline - 3 // -3 point adjustment (toward UNDER)
} else if (archetype === 'pace-prophet') {
  // Pace Prophet: Believes pace projections are undervalued
  statsBaseline = statsBaseline * 1.02 // +2% (toward OVER)
}
```

### Solution E: Historical Bias Per Capper
Track each capper's historical OVER/UNDER split and adjust:
- If SHIVA has been 70% OVER historically, add -2 baseline adjustment
- Forces natural rebalancing toward 50/50 over time

---

## Recommended Implementation Priority

1. **Solution A** (10 min): Reduce Vegas regression to 30-40%
2. **Solution D** (30 min): Add archetype-specific baseline adjustments
3. **Solution B** (20 min): Per-capper regression weights
4. **Solution C** (1-2 hrs): Full contrarian factor implementation

---

## Next Steps

When you wake up, review this analysis and let me know which solution(s) you'd like to implement. I recommend starting with **A + D** as a quick win that provides meaningful diversity without major refactoring.

