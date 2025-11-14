# Deterministic Injury Factors Implementation ✅

## Summary

Successfully implemented **deterministic injury factors** for both TOTALS and SPREAD bet types, replacing the AI-powered approach with fast, consistent, formula-based calculations.

---

## ✅ What Was Implemented

### **F6: Key Injuries & Availability - Totals (Deterministic)**
**File**: `src/lib/cappers/shiva-v1/factors/f6-injury-availability-deterministic.ts`

**Formula**:
```typescript
// Offensive Impact (reduces scoring)
offensiveImpact = PPG / 10

// Defensive Impact (increases scoring)
defensiveImpact = baseDefense × minutesFactor × statsFactor

Where:
- baseDefense = 2.5 (Centers), 1.5 (Forwards), 1.0 (Guards)
- minutesFactor = min(MPG / 36, 1.0)
- statsFactor = min((BPG + SPG) / 2 / 1.5, 1.5)

// Net Impact per team
netImpact = defensiveImpact - offensiveImpact

// Total Impact (both teams)
totalImpact = awayNetImpact + homeNetImpact

// Signal
signal = tanh(totalImpact / 8.0)
Positive signal → OVER (defensive injuries increase scoring)
Negative signal → UNDER (offensive injuries decrease scoring)
```

**Status Adjustments**:
- OUT: 100% impact
- DOUBTFUL: 75% impact
- QUESTIONABLE: 50% impact
- PROBABLE: 25% impact

**Multiple Injuries Multiplier**:
- 2+ players: 1.3x
- 3+ players: 1.5x

**Example**:
```
Lakers vs Celtics
- Lakers: LeBron James (28 PPG, 36 MPG, F) - OUT
  - Offensive Impact: 28/10 = 2.8
  - Defensive Impact: 1.5 × (36/36) × 1.0 = 1.5
  - Net Impact: 1.5 - 2.8 = -1.3 (favors Under)
  
- Celtics: No injuries
  - Net Impact: 0

Total Impact: -1.3 + 0 = -1.3
Signal: tanh(-1.3/8.0) = -0.16
Under Score: 0.16 × 5.0 = 0.8 points
```

---

### **S6: Key Injuries & Availability - Spread (Deterministic)**
**File**: `src/lib/cappers/shiva-v1/factors/s6-injury-availability.ts`

**Formula**:
```typescript
// Player Impact (competitive balance shift)
playerImpact = (PPG / 10) + (MPG / 48) × 2

Examples:
- 30 PPG, 36 MPG: (30/10) + (36/48)×2 = 3.0 + 1.5 = 4.5 points
- 20 PPG, 32 MPG: (20/10) + (32/48)×2 = 2.0 + 1.33 = 3.33 points
- 15 PPG, 28 MPG: (15/10) + (28/48)×2 = 1.5 + 1.17 = 2.67 points
- 10 PPG, 20 MPG: (10/10) + (20/48)×2 = 1.0 + 0.83 = 1.83 points

// Net Differential
netDifferential = awayImpact - homeImpact

// Signal (negative because more injuries = disadvantage)
signal = -tanh(netDifferential / 5.0)
Positive signal → AWAY ATS advantage (home has more injuries)
Negative signal → HOME ATS advantage (away has more injuries)
```

**Status Adjustments**: Same as TOTALS (OUT=100%, DOUBTFUL=75%, QUESTIONABLE=50%, PROBABLE=25%)

**Multiple Injuries Multiplier**: Same as TOTALS (2+=1.3x, 3+=1.5x)

**Example**:
```
Lakers (-4.5) vs Celtics (+4.5)
- Lakers: LeBron James (28 PPG, 36 MPG) - OUT
  - Impact: (28/10) + (36/48)×2 = 2.8 + 1.5 = 4.3 points
  
- Celtics: No injuries
  - Impact: 0

Net Differential: 4.3 - 0 = 4.3
Signal: -tanh(4.3/5.0) = -tanh(0.86) = -0.69
Home Score: 0.69 × 5.0 = 3.45 points toward CELTICS ATS
```

---

## 📁 Files Created

1. **`src/lib/cappers/shiva-v1/factors/f6-injury-availability-deterministic.ts`**
   - Deterministic TOTALS injury factor
   - Replaces AI-powered `f6-injury-availability.ts`
   - Considers offensive AND defensive impact
   - Uses position-based defensive ratings

2. **`src/lib/cappers/shiva-v1/factors/s6-injury-availability.ts`**
   - NEW deterministic SPREAD injury factor
   - Focuses on competitive balance shift
   - Simple formula: (PPG/10) + (MPG/48)×2
   - Net differential determines ATS advantage

---

## 📝 Files Modified

### **1. `src/app/cappers/create/page.tsx`**
**Changes**:
- Added `UserX` icon import
- Added `injuryImpact` to `FACTOR_DETAILS`:
  ```typescript
  injuryImpact: {
    name: 'Key Injuries & Availability',
    icon: UserX,
    description: 'Impact of injured players on game outcome (deterministic formula)',
    importance: 'Missing key players significantly impacts scoring (TOTALS) and competitive balance (SPREAD).',
    example: 'Star player (30 PPG, 36 MPG) OUT → 4.5 point impact. TOTALS: favors Under. SPREAD: opponent gets ATS edge.',
    defaultWeight: 25,
    color: 'red'
  }
  ```
- Added `injuryImpact` to `AVAILABLE_FACTORS`:
  ```typescript
  TOTAL: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays', 'injuryImpact']
  SPREAD: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact']
  ```

### **2. `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts`**
**Changes**:
- Changed import from `computeInjuryAvailabilityAsync` to `computeInjuryAvailability`
- Updated factor key from `injuryAvailability` to `injuryImpact`
- Removed AI-specific logic (Perplexity/OpenAI calls)
- Simplified error handling

**Before**:
```typescript
import { computeInjuryAvailabilityAsync } from './f6-injury-availability'

if (enabledFactorKeys.includes('injuryAvailability')) {
  const gameDate = new Date().toISOString().split('T')[0]
  const injuryFactor = await computeInjuryAvailabilityAsync(ctx, 'perplexity', gameDate)
  factors.push(injuryFactor)
}
```

**After**:
```typescript
import { computeInjuryAvailability } from './f6-injury-availability-deterministic'

if (enabledFactorKeys.includes('injuryImpact')) {
  const injuryFactor = await computeInjuryAvailability(bundle, ctx)
  factors.push(injuryFactor)
}
```

### **3. `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts`**
**Changes**:
- Added import for `computeInjuryAvailabilitySpread`
- Added S6 factor computation after S5
- Added error handling for injury factor

**New Code**:
```typescript
import { computeInjuryAvailabilitySpread } from './s6-injury-availability'

// S6: Injury Availability (deterministic)
if (enabledFactorKeys.includes('injuryImpact')) {
  console.log('[SPREAD:S6] Computing Key Injuries & Availability...')
  try {
    const injuryFactor = await computeInjuryAvailabilitySpread(bundle, ctx)
    factors.push(injuryFactor)
  } catch (error) {
    // Error handling...
  }
}
```

---

## 🎯 Key Differences: TOTALS vs SPREAD

| Aspect | TOTALS (F6) | SPREAD (S6) |
|--------|-------------|-------------|
| **Goal** | Predict impact on total scoring | Predict impact on competitive balance |
| **Offensive Impact** | PPG / 10 (reduces scoring) | (PPG / 10) + (MPG / 48) × 2 |
| **Defensive Impact** | Position + stats based (increases scoring) | Not considered (only competitive balance) |
| **Signal Direction** | Positive = Over, Negative = Under | Positive = Away ATS, Negative = Home ATS |
| **Scaling Factor** | 8.0 (broader range) | 5.0 (tighter range) |
| **Use Case** | Over/Under betting | Spread/ATS betting |

---

## ✅ Benefits of Deterministic Approach

1. **Consistency**: Same injury always produces same impact (no AI randomness)
2. **Speed**: Instant calculation (no API calls to Perplexity/OpenAI)
3. **Cost**: No AI API costs ($0 vs $0.01-0.05 per call)
4. **Transparency**: Users can understand the math
5. **Reliability**: No AI hallucinations or errors
6. **Testability**: Easy to unit test with known inputs/outputs

---

## 🧪 Testing Recommendations

### **Test Case 1: Star Player OUT**
```
Input:
- Team: Lakers
- Player: LeBron James (28 PPG, 36 MPG, F) - OUT

Expected TOTALS Impact:
- Offensive: 2.8 points
- Defensive: ~1.5 points
- Net: -1.3 (favors Under)

Expected SPREAD Impact:
- Impact: 4.3 points
- If Lakers are away: Home gets 3.45 point ATS edge
```

### **Test Case 2: Multiple Injuries**
```
Input:
- Team: Warriors
- Player 1: Curry (30 PPG, 34 MPG, G) - OUT
- Player 2: Thompson (20 PPG, 32 MPG, G) - QUESTIONABLE

Expected TOTALS Impact:
- Curry: -3.0 + 1.0 = -2.0
- Thompson: (-2.0 + 1.0) × 0.5 = -0.5
- Total: (-2.0 + -0.5) × 1.3 = -3.25 (multiple injury multiplier)
- Strong Under signal

Expected SPREAD Impact:
- Curry: 4.42 points
- Thompson: 3.33 × 0.5 = 1.67 points
- Total: (4.42 + 1.67) × 1.3 = 7.92 points
- Very strong opponent ATS edge
```

### **Test Case 3: Defensive Injury (Center)**
```
Input:
- Team: Nuggets
- Player: Jokic (26 PPG, 34 MPG, C, 1.0 BPG, 1.5 SPG) - OUT

Expected TOTALS Impact:
- Offensive: -2.6
- Defensive: 2.5 × (34/36) × 1.0 = 2.36
- Net: -0.24 (slight Under lean, but defensive loss partially offsets)

Expected SPREAD Impact:
- Impact: 4.02 points
- Opponent gets ATS edge
```

---

## 📊 Next Steps

1. ✅ **Implement factors** - DONE
2. ✅ **Add to UI** - DONE
3. ✅ **Update orchestrators** - DONE
4. ⏳ **Test with real game data** - TODO
5. ⏳ **Monitor pick generation** - TODO
6. ⏳ **Add to strategic presets** - TODO (part of preset configuration feature)

---

## 🔗 Related Files

- **Old AI-powered TOTALS factor**: `src/lib/cappers/shiva-v1/factors/f6-injury-availability.ts` (can be deprecated)
- **Injury data merger**: `src/lib/cappers/shiva-v1/factors/injury-data-merger.ts` (still used for data fetching)
- **MySportsFeeds player stats**: `src/lib/data-sources/mysportsfeeds-players.ts` (data source)
- **Player injury types**: `src/lib/data-sources/types/player-injury.ts` (type definitions)

---

## 🎉 Summary

Both deterministic injury factors (F6 for TOTALS, S6 for SPREAD) are now:
- ✅ Implemented with clear, testable formulas
- ✅ Integrated into orchestrators
- ✅ Available in UI factor selection
- ✅ Ready for testing with real game data

The system now has **6 TOTALS factors** and **6 SPREAD factors**, with injury impact properly handled for both bet types using fast, consistent, deterministic calculations.

