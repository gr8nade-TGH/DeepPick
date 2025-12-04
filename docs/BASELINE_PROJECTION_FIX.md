# Baseline Projection System Fix

**Date:** December 4, 2025  
**Status:** In Progress - Design Phase Complete, Implementation Next

---

## The Problem

**All 7 cappers are generating identical picks** (e.g., all picking MEM +10, all picking NOP +11.5). There's zero pick diversity despite different factor configurations.

---

## Root Cause Identified

The current code uses **Vegas Line as the baseline** instead of building an independent projection from team stats.

**File:** `src/lib/cappers/shiva-wizard-orchestrator.ts` (lines 613-615, 688-703)

```typescript
// CURRENT (WRONG):
// IMPORTANT: We use the Vegas market line as our baseline (not calculated team stats).
const vegasSpread = baselineAvg // ← USING VEGAS AS THE STARTING POINT!
const factorAdjustment = confidenceResult.edgeRaw // ← Small ±2-3 pt adjustment
const predictedMargin = vegasSpread - factorAdjustment // ← Always close to Vegas
```

**Result:** All cappers start from Vegas (-10), adjust by small amounts, end up near Vegas, all pick the same side.

---

## The Fix Required

### Step 1: Stats-Based Baseline (NOT Vegas)

```typescript
// NEW APPROACH:
function calculateBaseline(homeTeam: Stats, awayTeam: Stats): number {
  const netRatingDiff = homeTeam.netRating - awayTeam.netRating
  const homeCourtAdj = 3.0 // NBA average HCA
  return netRatingDiff + homeCourtAdj // e.g., LAL -6 (from stats, not Vegas)
}
```

### Step 2: Apply Core Factors (Universal for ALL cappers)

These are **situational factors** that don't favor the favorite/underdog - they favor based on the SITUATION:

| Core Factor | Effect | Why It's Neutral |
|-------------|--------|------------------|
| **Home Court Advantage** | +3 pts to home team | Favors HOME, not favorite |
| **Pace Environment** | Affects expected tempo/scoring | About style, not quality |
| **Scoring Environment** | Combined offensive output | About matchup, not who's better |

*(Rest and Injuries already exist as factors)*

### Step 3: Apply Capper-Specific Factors

Each capper's archetype weights different factors:
- SHIVA: Four Factors, Net Rating (efficiency)
- BLITZ: Momentum, Hot Streaks
- TITAN: Situational spots
- etc.

### Step 4: Compare to Vegas for Edge

```typescript
// SHIVA factors give: LAL -12
// TITAN factors give: LAL -7
// Vegas says: LAL -10

// SHIVA: -12 vs -10 → 2 pt edge on LAL ✓
// TITAN: -7 vs -10 → 3 pt edge on MEM ✓  ← DIFFERENT PICK!
```

---

## Why This Creates Pick Diversity

```
BASELINE (from team stats):           LAL -6

CORE FACTORS (all cappers):
  Home Court:                         +3 (MEM at home)
  Rest: LAL on B2B:                   +3 (favors MEM)
  Injuries: LAL missing AD:           +4 (favors MEM)
                                      ─────
ADJUSTED BASELINE:                    EVEN (push)

CAPPER-SPECIFIC:
  SHIVA (efficiency): +6 for LAL →    LAL -6
  TITAN (situational): +1 for LAL →   LAL -1

VS VEGAS (-10):
  SHIVA: 4 pt edge on LAL ✓
  TITAN: 9 pt edge on MEM ✓           ← ORGANIC DIVERSITY!
```

---

## Files to Modify

1. **`src/lib/cappers/shiva-wizard-orchestrator.ts`**
   - Change baseline from Vegas to team stats
   - Add core factor application before capper-specific factors

2. **New file: `src/lib/cappers/core-factors/`**
   - `home-court-advantage.ts`
   - `pace-environment.ts`
   - `scoring-environment.ts`

3. **`src/lib/cappers/shiva-v1/confidence-calculator.ts`**
   - May need updates to handle core vs capper-specific factor flow

---

## Decision Needed

We were deciding on the **2nd and 3rd core factors** (Home Court is confirmed):

| Option | Works for TOTALS | Works for SPREAD | Neutral? |
|--------|------------------|------------------|----------|
| Pace Environment | ✅ High pace → OVER | ✅ Affects variance | ✅ Yes |
| Scoring Environment | ✅ Both offensive → OVER | ⚠️ Indirect | ✅ Yes |
| 3-Point Variance | ✅ More volatile | ✅ More unpredictable | ✅ Yes |
| Travel/Time Zone | ✅ Tired → less scoring | ✅ Tired → underperform | ⚠️ Overlaps with rest |

**Recommendation:** Home Court + Pace Environment + Scoring Environment

---

## Key Insight

The diversity comes from **MAGNITUDE**, not direction:
- All cappers might agree "LAL is better"
- But SHIVA says LAL -12, TITAN says LAL -7
- Compared to Vegas -10, that's opposite sides of the line!

---

## Related Files

- `src/lib/cappers/shiva-wizard-orchestrator.ts` - Main prediction logic
- `src/lib/cappers/shiva-v1/confidence-calculator.ts` - Factor aggregation
- `src/lib/factors/definitions/nba/spread/` - Existing spread factors
- `src/lib/cappers/deep/` - DEEP meta-capper (blocked by net_units = 0)

