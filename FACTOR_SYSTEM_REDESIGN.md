# Factor System Redesign - Pro Sports Analyst Intelligence

## 🎯 Overview
Transform Shiva from basic prediction to sophisticated edge detection with transparent, bipolar factor scoring that shows ALL the data.

---

## 📊 Current vs New Factor System

### **Current System (Problems)**
- ✗ All factors are 0-10 (only positive)
- ✗ No raw data shown
- ✗ Teams analyzed in isolation
- ✗ Generic "reasoning" text
- ✗ 10/10 scores too common
- ✗ No negative factors visible

### **New System (Pro Analyst)**
- ✓ Bipolar scoring: -5 to +5 per factor
- ✓ Show raw data that led to score
- ✓ Comparative analysis (Team A vs Team B)
- ✓ Transparent StatMuse Q&A
- ✓ 10/10 extremely rare (perfect alignment)
- ✓ Show factors that HURT the pick

---

## 🧮 Bipolar Factor Scoring

### **Weight Distribution**
Each factor has a max weight (importance), and can score from negative to positive:

```
Factor: Recent Form (Weight: 20%)
Possible Scores: -2.0 to +2.0 (20% of 10-point scale)

Score Breakdown:
  +2.0 = Team dominates recent games vs opponent struggles badly
  +1.0 = Team slightly better recent form
   0.0 = Both teams equal recent form
  -1.0 = Opponent slightly better recent form
  -2.0 = Opponent dominates recent games vs team struggles badly
```

### **Example Factor Weights**
```
Vegas Edge Comparison:    30% (-3.0 to +3.0)
Recent Form:              15% (-1.5 to +1.5)
Head-to-Head History:     10% (-1.0 to +1.0)
Offensive vs Defensive:   15% (-1.5 to +1.5)
Injuries/Rest:            10% (-1.0 to +1.0)
Home/Away Advantage:      10% (-1.0 to +1.0)
Pace/Style Matchup:       05% (-0.5 to +0.5)
Weather Impact:           05% (-0.5 to +0.5)
-------------------------------------------
TOTAL:                   100% (-10.0 to +10.0)
```

### **Confidence Calibration**
```
Total Score → Confidence
  +7.0 to +7.5  = 7.0-7.5 confidence (Slight edge, 1-2U)
  +7.5 to +8.5  = 7.5-8.5 confidence (Strong edge, 2-3U)
  +8.5 to +9.5  = 8.5-9.5 confidence (Very strong, 3-4U)
  +9.5 to +10.0 = 9.5-10.0 confidence (Exceptional, 4-5U) [RARE]

Below +7.0 = NO PICK (not enough edge)
```

---

## 📋 Factor Structure (New)

```typescript
interface Factor {
  name: string
  category: 'vegas' | 'form' | 'matchup' | 'context'
  weight: number // Max possible contribution (e.g., 0.30 = 30%)
  
  // Raw data
  data: {
    teamA: any  // Your pick's team data
    teamB: any  // Opponent's data
    context?: any // Additional context (weather, injuries, etc.)
  }
  
  // Scoring
  rawScore: number      // -1.0 to +1.0 (before weight)
  weightedScore: number // -weight to +weight (after applying weight)
  
  // Transparency
  reasoning: string     // Why this score?
  sources: string[]     // Where did data come from?
  
  // StatMuse (if applicable)
  statmuseQuery?: string
  statmuseResponse?: string
  statmuseFailed?: boolean
}
```

---

## 🤖 AI Research Redesign

### **Perplexity Model Upgrade**

**Available Models:**
- `sonar-medium-online` (current) - Fast, cheap (~$0.001/request)
- `sonar-pro` - Better reasoning, web search (~$0.003/request)
- `sonar-reasoning` - Deep analysis (~$0.005/request)

**Recommendation:** Use `sonar-pro` for Run 1 (more thorough web research)

### **Smarter Prompts (Run 1: Perplexity)**

**OLD:**
```
"Analyze this matchup and find key factors."
```

**NEW:**
```
You are a professional sports bettor analyzing [Team A] vs [Team B].

CRITICAL: Your job is to find EDGE, not just predict a winner.

Research these specific angles:
1. Recent Form COMPARISON:
   - Team A last 10 games: W-L, point differential, trends
   - Team B last 10 games: W-L, point differential, trends
   - Who has momentum? Who is struggling?

2. Head-to-Head History:
   - Last 5 matchups: scores, margins, trends
   - Does one team consistently perform better?

3. Injuries & Rest:
   - Key injuries on either team?
   - Back-to-back games? Travel fatigue?
   - Who is at full strength?

4. Style Matchup:
   - Team A offensive efficiency vs Team B defensive efficiency
   - Pace considerations (fast vs slow)
   - Strengths vs weaknesses alignment

For EACH factor, provide:
- Raw stats for BOTH teams
- Comparative analysis
- Which team has the advantage and WHY

Based on this, generate 2 clever questions for deeper statistical research.
```

### **StatMuse Question Strategy**

**Comparative Questions (Smart):**
```
✓ "Compare [Team A] offensive rating to [Team B] defensive rating this season"
✓ "How does [Team A] perform in [weather condition] vs [Team B]?"
✓ "What is [Team A] record against teams with [Team B's rank] defense?"
✓ "[Team A] scoring average in last 5 road games vs [Team B] points allowed at home"
```

**Bad Questions (Avoid):**
```
✗ "How many points does [Team A] score?" (not comparative)
✗ "Is [Team A] good?" (too vague)
✗ "[Team A] stats" (too broad)
```

### **Retry Logic for StatMuse**

```typescript
async function askStatMuse(question: string): Promise<string> {
  try {
    const response = await statmuseClient.search(question)
    if (!response || response.includes('no data')) {
      // Try rephrased question
      const rephrased = await rephraseQuestion(question)
      return await statmuseClient.search(rephrased)
    }
    return response
  } catch (error) {
    return 'Failed to retrieve data'
  }
}
```

---

## 🎰 Bet Selection Logic (Current)

**How Shiva Chooses Bet Type:**

```typescript
// 1. Generate 3 possible bets
const totalPick = predictedTotal > vegasTotal ? 'OVER' : 'UNDER'
const spreadPick = predictedSpread vs vegasSpread
const moneylinePick = predictedWinner

// 2. Calculate confidence for each
totalConfidence = baseConfidence + vegasEdge + aiBoost
spreadConfidence = baseConfidence + vegasEdge + aiBoost
moneylineConfidence = baseConfidence + vegasEdge + aiBoost

// 3. Filter by minimum (7.0+)
// 4. Sort by confidence
// 5. Pick the HIGHEST confidence bet
```

**Current Logic Issues:**
- All 3 bets get similar confidence scores
- Doesn't consider odds value
- Doesn't account for bet type risk (moneyline riskier than spread)

**Proposed Improvements:**
- Adjust confidence based on line value (is the spread too high/low?)
- Consider vig/juice (avoid -120+ unless strong edge)
- Moneyline should require higher confidence threshold
- Show why THIS bet type was chosen in factor breakdown

---

## 🌦️ Smart Factor Logic Examples

### **Weather Factor (Context-Aware)**

**BAD (Current):**
```
Weather: Bad → Reduce confidence
```

**GOOD (New):**
```typescript
function scoreWeatherFactor(teamA, teamB, weather) {
  if (weather === 'clear') return 0 // No impact
  
  // Get each team's performance in bad weather
  const teamABadWeatherRecord = getRecordInBadWeather(teamA)
  const teamBBadWeatherRecord = getRecordInBadWeather(teamB)
  
  // Team A: 8-2 in rain/snow (80% win rate)
  // Team B: 3-7 in rain/snow (30% win rate)
  
  if (teamABadWeatherRecord > teamBBadWeatherRecord + 0.2) {
    return +0.5 // Weather HELPS our pick
  } else if (teamBBadWeatherRecord > teamABadWeatherRecord + 0.2) {
    return -0.5 // Weather HURTS our pick
  }
  return 0 // Weather neutral
}
```

### **High Scoring ≠ Higher Confidence**

**BAD:**
```
Predicted Score: 120 total → Confidence +1.0
```

**GOOD:**
```typescript
// High scoring only matters if it creates VALUE vs Vegas line
predictedTotal = 125
vegasTotal = 110

// We predict 15 points higher than Vegas
// This is a STRONG signal for OVER
// Factor: Vegas Total Edge → +2.5 / 3.0 (83%)
```

---

## 🎨 UI Transparency Design

### **Factor Display (New)**

```
┌─────────────────────────────────────────────────────┐
│ 🏈 Recent Form Comparison                +1.5 / 1.5 │
├─────────────────────────────────────────────────────┤
│ Your Pick: Lakers                                   │
│   Last 10: 8-2 (+12.5 PPG differential)            │
│   Trend: Won 5 straight                             │
│                                                     │
│ Opponent: Warriors                                  │
│   Last 10: 4-6 (-8.2 PPG differential)             │
│   Trend: Lost 3 of last 4                           │
│                                                     │
│ Analysis: Lakers significantly outperforming        │
│                                                     │
│ [████████████████████████████] 100% (Max Positive)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ⚡ Injuries & Rest                        -0.8 / 1.0 │
├─────────────────────────────────────────────────────┤
│ Your Pick: Lakers                                   │
│   OUT: LeBron James (ankle)                         │
│   Questionable: Anthony Davis (back)                │
│                                                     │
│ Opponent: Warriors                                  │
│   Fully healthy                                     │
│                                                     │
│ Analysis: Key injuries hurt Lakers significantly    │
│                                                     │
│ [█████░░░░░░░░░░░░░░░░] 20% (Negative Impact)      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 📊 Advanced Stats Research               +1.2 / 1.5 │
├─────────────────────────────────────────────────────┤
│ Q: "Lakers offensive rating vs Warriors defensive   │
│     rating this season"                             │
│                                                     │
│ A: "Lakers rank 3rd in offensive efficiency (118.5  │
│     ORtg) while Warriors rank 22nd defensively      │
│     (114.2 DRtg). Lakers average 6.2 more points    │
│     per 100 possessions in this matchup."           │
│                                                     │
│ Analysis: Favorable offensive matchup for Lakers    │
│                                                     │
│ [████████████████████░░░] 80% (Strong Positive)     │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Implementation Checklist

### Phase 1: Database Schema
- [ ] Create `pick_factors` table to store detailed factor breakdowns
- [ ] Add columns for raw_data, statmuse_query, statmuse_response
- [ ] Migration script

### Phase 2: Factor Engine
- [ ] Create `FactorEngine` class with bipolar scoring
- [ ] Implement comparative analysis methods
- [ ] Weather logic (context-aware)
- [ ] Injury impact calculator
- [ ] Recent form comparator

### Phase 3: AI Orchestrator
- [ ] Update to `sonar-pro` model
- [ ] Rewrite prompts for edge detection
- [ ] Implement StatMuse retry logic
- [ ] Generate smarter comparative questions

### Phase 4: Bet Selection
- [ ] Document current logic
- [ ] Add odds value consideration
- [ ] Adjust moneyline threshold
- [ ] Show bet selection reasoning

### Phase 5: UI
- [ ] Factor cards with raw data
- [ ] StatMuse Q&A display
- [ ] Negative factors (red bars)
- [ ] Bet selection explanation

### Phase 6: Testing
- [ ] Test with real games
- [ ] Verify 10/10 is rare
- [ ] Check negative factors display
- [ ] Validate StatMuse retry works

---

## 💰 Cost Impact

**Current:** ~$0.007 per pick
**New:** ~$0.015 per pick

**Breakdown:**
- Perplexity sonar-pro: $0.003 (up from $0.001)
- ChatGPT: $0.002 (same)
- StatMuse: Free
- Retry attempts: +$0.005 max
- Deeper analysis time: 60-90s (up from 30-60s)

**Worth it?** YES - Quality picks > cheap picks

---

## 🎯 Success Metrics

After implementation:
- [ ] Average confidence score drops to 7.5-8.0 (from current 9-10)
- [ ] 10/10 picks are <5% of all picks
- [ ] Negative factors visible in >50% of picks
- [ ] StatMuse data shown in >80% of picks
- [ ] Users understand EXACTLY why pick was made
- [ ] Bet type selection is clear and justified

