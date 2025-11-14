# Injury Factor Analysis - TOTALS vs SPREAD

## ✅ EXISTING: F6 - Key Injuries & Availability (TOTALS)

### Current Implementation
**File**: `src/lib/cappers/shiva-v1/factors/f6-injury-availability.ts`

**How It Works**:
1. **Data Collection**:
   - MySportsFeeds `player_injuries` endpoint (official injury status)
   - Web search via Perplexity API (recent injury news, updates)
   - Player stats from MySportsFeeds (PPG, MPG, games played)

2. **AI-Powered Analysis**:
   - Sends merged data to Perplexity or OpenAI
   - AI uses scoring guidelines to calculate impact

3. **Scoring Guidelines** (from AI prompt):
   ```
   OFFENSIVE PLAYER INJURIES (NEGATIVE impact on scoring):
   - Star player (25+ PPG) OUT: -7 to -8 impact
   - All-star (20-25 PPG) OUT: -5 to -6 impact
   - Key contributor (15-20 PPG) OUT: -3 to -4 impact
   - Role player (10-15 PPG) OUT: -2 to -3 impact
   - Bench player (<10 PPG) OUT: -1 to -2 impact
   
   DEFENSIVE PLAYER INJURIES (POSITIVE impact on scoring):
   - Elite rim protector OUT: +4 to +5 impact (easier to score inside)
   - DPOY candidate OUT: +3 to +4 impact
   - Above-average defender OUT: +2 to +3 impact
   - Average defender OUT: +1 to +2 impact
   ```

4. **Status Adjustments**:
   ```
   - OUT: 100% of impact (no adjustment)
   - DOUBTFUL: 75% of impact
   - QUESTIONABLE: 50% of impact
   - PROBABLE: 25% of impact
   ```

5. **Multiple Injuries Multiplier**:
   ```
   - 2+ key players injured: multiply total impact by 1.3x (depth concerns)
   - 3+ key players injured: multiply total impact by 1.5x (severe depth issues)
   ```

6. **Output**:
   - Returns impact score from -10 to +10
   - Converted to signal: -1 to +1
   - Positive signal → Over, Negative signal → Under
   - Max points: ±5.0

### Example Calculation (TOTALS):
```
Scenario: Lakers vs Celtics
- Lakers: LeBron James (28 PPG, 36 MPG) - OUT
- Celtics: No injuries

Step 1: Calculate LeBron's impact
- Base impact: -7 (star player 25+ PPG)
- Status: OUT (100% impact)
- Final: -7 points

Step 2: Calculate total impact
- Away (Lakers): -7
- Home (Celtics): 0
- Total Impact: (-7 + 0) / 2 = -3.5

Step 3: Convert to signal
- Signal = -3.5 / 10 = -0.35
- Under Score = 0.35 × 5.0 = 1.75 points
- Over Score = 0

Result: 1.75 points toward UNDER
```

---

## 🆕 PROPOSED: S6 - Key Injuries & Availability (SPREAD)

### Why Different Logic for SPREAD?

**TOTALS Logic**: Injuries reduce scoring → Under  
**SPREAD Logic**: Injuries shift competitive balance → Underdog gets edge

### Proposed Calculation Method

#### **Option 1: Deterministic Formula** (Recommended)
**Pros**: Fast, consistent, no AI cost  
**Cons**: Less nuanced than AI

```typescript
function calculateInjuryImpactSpread(
  awayInjuries: PlayerInjury[],
  homeInjuries: PlayerInjury[]
): { signal: number, awayScore: number, homeScore: number } {
  
  // Calculate impact for each team
  const awayImpact = calculateTeamInjuryImpact(awayInjuries)
  const homeImpact = calculateTeamInjuryImpact(homeInjuries)
  
  // Net differential (positive = away has more injuries, home gets edge)
  const netDifferential = awayImpact - homeImpact
  
  // Convert to signal using tanh for smooth saturation
  const signal = -Math.tanh(netDifferential / 5.0) // Negative because more injuries = disadvantage
  
  // Award points
  const awayScore = signal > 0 ? Math.abs(signal) * 5.0 : 0
  const homeScore = signal < 0 ? Math.abs(signal) * 5.0 : 0
  
  return { signal, awayScore, homeScore }
}

function calculateTeamInjuryImpact(injuries: PlayerInjury[]): number {
  let totalImpact = 0
  
  for (const injury of injuries) {
    const ppg = injury.player.averages.avgPoints
    const mpg = injury.player.averages.avgMinutes
    const status = injury.player.currentInjury.playingProbability
    
    // Base impact formula
    let playerImpact = (ppg / 10) + (mpg / 48) * 2
    
    // Examples:
    // 30 PPG, 36 MPG: (30/10) + (36/48)*2 = 3.0 + 1.5 = 4.5 points
    // 20 PPG, 32 MPG: (20/10) + (32/48)*2 = 2.0 + 1.33 = 3.33 points
    // 15 PPG, 28 MPG: (15/10) + (28/48)*2 = 1.5 + 1.17 = 2.67 points
    // 10 PPG, 20 MPG: (10/10) + (20/48)*2 = 1.0 + 0.83 = 1.83 points
    
    // Status adjustments
    if (status === 'QUESTIONABLE') {
      playerImpact *= 0.5 // 50% impact
    } else if (status === 'DOUBTFUL') {
      playerImpact *= 0.75 // 75% impact
    }
    // OUT = 100% impact (no adjustment)
    
    totalImpact += playerImpact
  }
  
  // Multiple injuries multiplier
  if (injuries.length >= 3) {
    totalImpact *= 1.5
  } else if (injuries.length >= 2) {
    totalImpact *= 1.3
  }
  
  return totalImpact
}
```

#### **Option 2: AI-Powered Analysis** (Like TOTALS)
**Pros**: More nuanced, considers defensive impact, matchup-specific  
**Cons**: Slower, costs API credits, less predictable

```typescript
// Similar to F6, but with SPREAD-specific prompt:

AI Prompt for SPREAD:
"""
Analyze injury impact on SPREAD outcome (not total scoring).

SPREAD IMPACT GUIDELINES:
- Missing star player: 3-5 point ATS shift toward opponent
- Missing key contributor: 2-3 point ATS shift
- Missing role player: 1-2 point ATS shift
- Missing defensive anchor: 2-4 point ATS shift toward opponent

Consider:
1. Who replaces the injured player? (bench depth)
2. Is the injured team favored or underdog? (bigger impact on favorites)
3. Defensive vs offensive player? (defensive injuries help opponent score)
4. Recent team performance without player?

Return awayImpact and homeImpact from -10 to +10.
Positive = ATS advantage, Negative = ATS disadvantage
"""
```

### Example Calculation (SPREAD):

**Scenario**: Lakers (-4.5) vs Celtics (+4.5)
- Lakers: LeBron James (28 PPG, 36 MPG) - OUT
- Celtics: No injuries

**Option 1 (Deterministic)**:
```
Step 1: Calculate LeBron's impact
- Base: (28/10) + (36/48)*2 = 2.8 + 1.5 = 4.3 points
- Status: OUT (100%)
- Lakers Impact: 4.3 points

Step 2: Calculate net differential
- Away (Lakers): 4.3
- Home (Celtics): 0
- Net Differential: 4.3 - 0 = 4.3

Step 3: Convert to signal
- Signal = -tanh(4.3 / 5.0) = -tanh(0.86) = -0.69
- Home Score = 0.69 × 5.0 = 3.45 points
- Away Score = 0

Result: 3.45 points toward CELTICS ATS (underdog gets edge)
```

**Option 2 (AI-Powered)**:
```
AI Analysis:
- LeBron OUT = Lakers lose 28 PPG, primary playmaker
- Celtics gain ATS edge: +5 impact (star player missing)
- Lakers were -4.5 favorites, now effectively -0.5 to +0.5
- Signal: -0.5 (moderate home advantage)
- Home Score: 2.5 points toward Celtics ATS

Result: 2.5 points toward CELTICS ATS
```

---

## Recommendation

### For SPREAD Injury Factor (S6):

**Use Option 1: Deterministic Formula**

**Reasons**:
1. **Consistency**: Same injury always produces same impact
2. **Speed**: No API calls, instant calculation
3. **Cost**: No AI API costs
4. **Transparency**: Users can understand the math
5. **Reliability**: No AI hallucinations or errors

**Formula Summary**:
```
Player Impact = (PPG / 10) + (MPG / 48) × 2

Status Adjustments:
- OUT: 100%
- DOUBTFUL: 75%
- QUESTIONABLE: 50%
- PROBABLE: 25%

Multiple Injuries:
- 2+ players: 1.3x multiplier
- 3+ players: 1.5x multiplier

Signal = -tanh(Net Differential / 5.0)
Positive signal → Away ATS advantage
Negative signal → Home ATS advantage
```

---

## Implementation Checklist

### For S6 (SPREAD Injury Factor):

- [ ] Create `src/lib/cappers/shiva-v1/factors/s6-injury-availability.ts`
- [ ] Implement deterministic formula (Option 1)
- [ ] Add to `nba-spread-orchestrator.ts`
- [ ] Add to `AVAILABLE_FACTORS.SPREAD` in UI
- [ ] Add to `FACTOR_DETAILS` with icon `UserX`, color `red`
- [ ] Test with real injury data
- [ ] Add to insight card display
- [ ] Update factor configuration popup

### For F6 (TOTALS - Already Exists):

- [ ] Add to `AVAILABLE_FACTORS.TOTAL` in UI (currently missing!)
- [ ] Add to `FACTOR_DETAILS` with icon `UserX`, color `red`
- [ ] Ensure it's included in default TOTAL factor configs
- [ ] Test that it's being called in orchestrator

---

## Questions for You

1. **Do you want S6 (SPREAD injury factor) to use**:
   - ✅ Option 1: Deterministic formula (fast, consistent)
   - ❌ Option 2: AI-powered (slower, more nuanced)

2. **Should F6 (TOTALS injury factor) continue using AI**, or switch to deterministic?

3. **Do the injury impact formulas make sense**?
   - PPG/10 + MPG/48×2 for SPREAD
   - AI scoring guidelines for TOTALS

Let me know and I'll implement! 🎯

