# Prediction-Based Capper Algorithm System

## Overview

The DeepPick capper system now uses a **prediction-first** approach where each capper must predict the actual game score BEFORE looking at Vegas odds. This creates a more sophisticated confidence weighting system that finds true value bets.

## How It Works

### Step 1: Score Prediction
Each capper analyzes a game and predicts:
- **Home Team Score** (e.g., 28)
- **Away Team Score** (e.g., 24)
- **Total Points** (e.g., 52)
- **Margin of Victory** (e.g., +4 for home)
- **Winner** (home or away)
- **Reasoning** for the prediction

**Example:**
```
Ifrit predicts: Chiefs 31, Broncos 27
Total: 58 points
Margin: +4 (Chiefs win by 4)
```

### Step 2: Compare to Vegas Odds
After making the prediction, the capper compares it to current Vegas lines:
- **Total Line** (O/U)
- **Spread Line**
- **Moneyline odds**

### Step 3: Calculate Weighted Confidence
The system automatically calculates confidence for each bet type based on the gap between prediction and Vegas:

#### Total (O/U) Confidence
| Gap | Confidence | Example |
|-----|-----------|---------|
| 15+ pts | 90% | Predict 70, Vegas 55 |
| 10-14 pts | 80% | Predict 65, Vegas 55 |
| 7-9 pts | 70% | Predict 62, Vegas 55 |
| 4-6 pts | 60% | Predict 59, Vegas 55 |
| < 4 pts | 50% | Predict 57, Vegas 55 |

**Example:**
```
Prediction: 58 total points
Vegas O/U: 55
Gap: 3 points
→ 50% confidence in OVER (minimal edge)
```

**Better Example:**
```
Prediction: 70 total points
Vegas O/U: 55
Gap: 15 points
→ 90% confidence in OVER (MASSIVE edge!)
```

#### Spread Confidence

**Scenario A: Disagree on Winner**
If capper predicts the underdog wins outright:
- **Moneyline Confidence: 85%** (huge value!)
- **Spread Confidence: 80%**

**Example:**
```
Prediction: Broncos win by 3 (+3 margin)
Vegas Spread: Chiefs -7 (Vegas favors Chiefs)
→ MAJOR DISAGREEMENT!
→ 85% confidence on Broncos ML
→ 80% confidence on Broncos +7
```

**Scenario B: Agree on Winner**
Compare predicted margin to spread:

| Margin Difference | Spread Confidence | Example |
|------------------|------------------|---------|
| +7 or more | 85% | Predict win by 14, spread -7 |
| +4 to +6 | 75% | Predict win by 10, spread -6 |
| +1 to +3 | 65% | Predict win by 7, spread -4 |
| -3 to 0 | 55% | Predict win by 5, spread -4 |
| Less than -3 | 40% | Predict win by 3, spread -7 (NO VALUE) |

**Example:**
```
Prediction: Chiefs win by 10
Vegas Spread: Chiefs -3
Margin Diff: 10 - 3 = +7
→ 85% confidence on Chiefs -3 (big edge!)
```

**Bad Example:**
```
Prediction: Chiefs win by 3
Vegas Spread: Chiefs -7
Margin Diff: 3 - 7 = -4
→ 40% confidence (NO VALUE, pass on this bet)
```

#### Moneyline Confidence
Based on predicted margin of victory:

| Predicted Margin | Confidence | Example |
|-----------------|-----------|---------|
| 14+ points | 85% | Blowout expected |
| 10-13 points | 80% | Strong win |
| 7-9 points | 70% | Good win |
| 4-6 points | 60% | Moderate win |
| < 4 points | 55% | Close game |

### Step 4: Select Best Bet
The system:
1. Calculates confidence for all three bet types (total, spread, moneyline)
2. Sorts by confidence
3. Picks the highest confidence bet
4. Applies minimum threshold (e.g., Ifrit requires 60%+)
5. Applies global rules (e.g., no favorites over -250 unless 90%+ confidence)
6. Calculates units based on confidence (higher confidence = more units)

## Ifrit's Specific Strategy

### Philosophy
"Fire and fury. High-scoring games, fast pace, offensive firepower."

### Prediction Approach
1. **Starts with Vegas total as baseline**
2. **Adds sport-specific scoring factors:**
   - NFL: +4 pts for totals 52+, +3 for 48+, +2 for 45+
   - NBA: +6 pts for totals 235+, +4 for 230+, +2 for 225+
   - MLB: +1.5 runs for totals 10+, +1 for 9+, +0.5 for 8+
3. **Adds 5% bonus if Vegas total already high** (expects shootout)
4. **Adds 3% "Ifrit aggression factor"** (always leans toward more scoring)
5. **Distributes total to teams based on spread**

### Example: Ifrit Analyzing an NFL Game

```
Game: Broncos @ Chiefs
Vegas Total: 48
Vegas Spread: Chiefs -7

STEP 1: PREDICT SCORE
- Start: 48 points
- NFL high-scoring factor (48+): +3 pts
- Already high total (5%): +2.4 pts
- Ifrit aggression (3%): +1.4 pts
- Predicted Total: 54.8 → 55 points

- Distribute based on spread (-7 for Chiefs):
  - Chiefs: (55/2) + (7/2) = 31 points
  - Broncos: 55 - 31 = 24 points

PREDICTION: Chiefs 31, Broncos 24 (Total: 55)

STEP 2: COMPARE TO VEGAS
- Total: Predict 55 vs Vegas 48 = 7 point gap
  → 70% confidence in OVER 48
  
- Spread: Predict Chiefs by 7 vs Vegas -7
  → 55% confidence (marginal value)
  
- Moneyline: Predict 7 pt win
  → 70% confidence in Chiefs ML

STEP 3: SELECT BEST BET
Best options:
1. OVER 48 (70% confidence) ✓
2. Chiefs ML (70% confidence) ✓

Ifrit picks: OVER 48 at 70% confidence
Units: 1.0 (would be 1.5 at 75%+, 2.0 at 85%+)
```

## Benefits of This System

1. **Forces cappers to commit to a prediction** before seeing odds
2. **Finds true value bets** by comparing prediction to market
3. **Weighted confidence** based on gap size (bigger gap = more confidence)
4. **Prevents bad bets** (e.g., won't bet spread if predicted margin is smaller)
5. **Transparent reasoning** - every pick shows the prediction and comparison
6. **Scalable** - easy to add new cappers with different prediction strategies

## Next Steps

### Implement for Other Cappers

**Nexus** (Data-Driven Precision)
- Predict based on statistical models
- Conservative adjustments
- Focus on finding small edges

**Shiva** (Contrarian Chaos)
- Predict opposite of public sentiment
- Look for overreactions in lines
- Target undervalued underdogs

**Cerberus** (Multi-Model Consensus)
- Run 3 different prediction models
- Only bet when 2+ models agree
- High confidence when all 3 align

**DeepPick** (Meta-Algorithm)
- Aggregate predictions from all cappers
- Find consensus picks
- Weight by each capper's historical accuracy

## Testing Ifrit

To test the new prediction system:

1. Go to `/cappers/ifrit` page
2. Click "Run Algorithm" button
3. Check console logs for detailed prediction breakdown
4. View generated picks on main dashboard
5. Check "reasoning" field to see score prediction and confidence analysis

## Code Structure

```
src/lib/cappers/
├── shared-logic.ts          # Core confidence calculator
│   ├── ScorePrediction interface
│   ├── calculateConfidenceFromPrediction()
│   └── Helper functions (getTotalLine, getSpreadLine, etc.)
│
└── ifrit-algorithm.ts       # Ifrit's implementation
    ├── predictGameScore()   # Step 1: Make prediction
    ├── analyzeGame()        # Step 2-4: Compare & select bet
    └── analyzeBatch()       # Process multiple games
```

## Database Storage

Picks now include:
- `reasoning` field contains score prediction at the top
- `confidence` field stores the weighted confidence (0-100)
- `algorithm_version` set to "ifrit-v2-prediction"

Example reasoning format:
```
SCORE PREDICTION: Chiefs 31, Broncos 24
Total: 55 | Margin: +7

🏈 NFL: High-scoring game expected (48 total)
🔥 Vegas total already high (48) - expecting shootout, adding 2.4 pts
⚡ Ifrit aggression factor: +1.4 pts
📊 Final prediction: KC 31, DEN 24 (Total: 55)
---
✅ Good total edge: Predicted 55 vs Vegas 48.0 (7.0 point gap)
⚠️ Marginal spread value: Close to Vegas line (7.0 vs 7.0)
✅ Good moneyline: Predicted 7.0 pt win
---
🎯 Best bet: Over 48.0 (70% confidence)
💰 Betting 1 units at -110
```

## Future Enhancements

1. **Historical tracking** - Track prediction accuracy over time
2. **Dynamic adjustments** - Adjust prediction factors based on performance
3. **Team-specific data** - Incorporate pace, offensive efficiency, etc.
4. **Weather factors** - Adjust predictions for weather (NFL/MLB)
5. **Injury impact** - Adjust predictions based on key injuries
6. **Line movement** - Track how Vegas line moves vs our prediction

