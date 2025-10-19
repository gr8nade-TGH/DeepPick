# AI-Enhanced Capper System - Simplified 2-Run Approach

## Overview
Streamlined, cost-effective AI enhancement for cappers using FREE StatMuse + your existing ChatGPT subscription.

**Priority:** Best predictions at lowest cost  
**Target Cost:** ~$0-0.03 per game (under $1/month for 30 games!)  
**Starting with:** SHIVA only

---

## The Stack

### Data Sources
1. **The Odds API** - Odds, lines, scores (you already have this)
2. **StatMuse** - FREE stats via natural language (no API key!)
3. **ChatGPT** - Your existing $20/mo subscription
4. **Perplexity** - Backup for web search (optional)

### Cost Breakdown
```
Run 1: StatMuse queries = $0 (FREE - just HTML parsing)
Run 2: ChatGPT analysis = $0* (your subscription)
       *Or Perplexity = $0.025 if needed

Total per game: ~$0-0.03
30 games/day: ~$0-0.90/month
```

---

## Simplified 2-Phase System

### Phase 1: Baseline (The Odds API only)
```javascript
baselineData = {
  game_id: "abc123",
  teams: { home: "Lakers", away: "Celtics" },
  
  // All from The Odds API
  odds: {
    moneyline: { home: -150, away: +130 },
    spread: { home: -3.5, away: +3.5 },
    total: { line: 225.5, over: -110, under: -110 }
  },
  
  lineMovement: {
    opening_spread: -3.0,
    current_spread: -3.5,
    movement_direction: "toward_favorite"
  }
}
```

**Weed-out filters still apply here** to save AI costs.

---

### Phase 2: AI Enhancement - Run 1 (StatMuse Research)

**Timing:** 4 hours before game (24 hours for NFL)

**Process:**
1. AI generates 5-7 clever stat questions
2. StatMuse scraper fetches answers (FREE!)
3. AI analyzes answers and creates factors

**Example Flow:**

```typescript
// AI generates questions based on capper personality
const shivaQuestions = [
  "Lakers last 5 games record",
  "Celtics last 5 games record",
  "Lakers vs Celtics last 5 meetings who won",
  "Lakers points per game this season",
  "Celtics points allowed per game",
  "Lakers record after 2 days rest",
  "Celtics record on second night of back to back"
]

// Fetch from StatMuse (FREE)
const statmuse = getStatMuseClient()
const answers = await statmuse.askBatch(
  shivaQuestions.map(q => ({ sport: 'nba', question: q }))
)

// Results:
/*
{
  question: "Lakers last 5 games record",
  answer: "The Lakers are 4-1 in their last 5 games",
  extractedValue: "4-1",
  confidence: "high"
}
*/

// AI analyzes and creates factors
const run1Factors = await ai.analyzeStatMuseResults(answers)
```

**Output:**
```javascript
run1Factors = {
  recent_form: {
    home: "4-1 last 5 (hot)",
    away: "2-3 last 5 (cold)",
    edge: "home",
    value: 75,
    weight: 15,
    source: "StatMuse"
  },
  
  head_to_head: {
    record: "Lakers 3-2 in last 5 meetings",
    edge: "home",
    value: 65,
    weight: 10,
    source: "StatMuse"
  },
  
  scoring_matchup: {
    lakers_ppg: 115.2,
    celtics_def: 110.3,
    advantage: "Lakers offense vs Celtics defense",
    value: 70,
    weight: 12,
    source: "StatMuse"
  },
  
  situational: {
    home_rest: "Lakers 18-6 after 2 days rest",
    away_fatigue: "Celtics 8-12 on back-to-backs",
    edge: "significant_home",
    value: 80,
    weight: 13,
    source: "StatMuse"
  }
}
```

**Cost:** $0 (StatMuse is free!)

---

### Phase 2: AI Enhancement - Run 2 (Web Search + Prediction)

**Timing:** Immediately after Run 1 (no 20-min wait needed)

**Process:**
1. Web search for injuries & weather
2. Validate critical data from Run 1 (if needed)
3. Generate score prediction
4. Create AI writeup

**AI Provider Options:**

**Option A: ChatGPT (Your Subscription)**
```typescript
const chatgpt = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  // From your $20/mo subscription
})

const run2 = await chatgpt.chat.completions.create({
  model: "gpt-4o",  // or gpt-4o-mini for cheaper
  messages: [
    {
      role: "system",
      content: "You are SHIVA, a multi-model sports betting analyst."
    },
    {
      role: "user",
      content: `Based on Run 1 data: ${JSON.stringify(run1Factors)}
      
      Task 1: Search web for latest injuries and news on Lakers vs Celtics tonight
      Task 2: Predict final score
      Task 3: Generate writeup with bold prediction
      
      Return JSON.`
    }
  ],
  response_format: { type: "json_object" }
})
```

**Option B: Perplexity (if ChatGPT quota exceeded)**
```typescript
const perplexity = getPerplexityClient()

const run2 = await perplexity.chat({
  model: 'sonar',  // Standard model
  messages: [/* same as above */],
  search_recency_filter: 'day'
})
```

**Output:**
```javascript
run2Factors = {
  injuries: {
    home: [
      { player: "Anthony Davis", status: "Probable", impact: "low" }
    ],
    away: [
      { player: "Jaylen Brown", status: "OUT", impact: "critical" }
    ],
    net_advantage: "Lakers - Celtics missing #2 scorer",
    value: 85,
    weight: 18,
    source: "ESPN"
  },
  
  weather: {
    applicable: false,  // Indoor arena
    weight: 0
  },
  
  score_prediction: {
    home: 118,
    away: 110,
    total: 228,
    margin: 8,
    victor: "Lakers"
  },
  
  writeup: "The Lakers are primed for a decisive home victory...",
  bold_prediction: "LeBron James triple-double with 25+ pts"
}
```

**Cost:** 
- ChatGPT: $0 (your subscription)
- Perplexity: $0.025 (backup)

---

### Phase 3: Vegas Comparison (Up to 30% Weight)

```javascript
function calculateVegasComparison(prediction, currentOdds) {
  const spreadDiff = Math.abs(prediction.margin - Math.abs(currentOdds.spread))
  const totalDiff = Math.abs(prediction.total - currentOdds.total)
  
  const bestEdge = Math.max(spreadDiff, totalDiff)
  
  let confidenceBoost = 0
  let weight = 0
  
  if (bestEdge >= 10) {
    confidenceBoost = +3.0  // HUGE
    weight = 30
  } else if (bestEdge >= 7) {
    confidenceBoost = +2.0  // Strong
    weight = 25
  } else if (bestEdge >= 5) {
    confidenceBoost = +1.5  // Good
    weight = 20
  } else if (bestEdge >= 3) {
    confidenceBoost = +1.0  // Moderate
    weight = 15
  } else if (bestEdge >= 1.5) {
    confidenceBoost = +0.5  // Slight
    weight = 10
  } else {
    // NO EDGE - Wait or pass
    return { action: 'PASS', reason: 'No significant edge vs Vegas' }
  }
  
  return {
    bestEdge,
    confidenceBoost,
    weight,
    action: 'GENERATE_PICK'
  }
}
```

---

### Phase 4: Final Decision

```javascript
function makeFinalDecision(baselineFactors, run1Factors, run2Factors, vegasComparison) {
  // Calculate base confidence from all factors
  const allFactors = {
    ...baselineFactors,  // ~10% weight
    ...run1Factors,      // ~40% weight (StatMuse data)
    ...run2Factors       // ~20% weight (injuries, news)
    // Vegas comparison adds 30% via boost
  }
  
  let baseConfidence = 0
  let totalWeight = 0
  
  for (const factor of Object.values(allFactors)) {
    baseConfidence += (factor.value / 100) * factor.weight
    totalWeight += factor.weight
  }
  
  // Normalize to 7-point scale
  baseConfidence = (baseConfidence / totalWeight) * 7.0
  
  // Add Vegas boost
  const finalConfidence = baseConfidence + vegasComparison.confidenceBoost
  
  // Decision
  if (finalConfidence < 7.0) {
    return {
      action: 'PASS',
      reason: `Confidence ${finalConfidence.toFixed(1)} below 7.0`,
      total_cost: 0  // Saved money by not making pick
    }
  }
  
  // Determine units
  let units = 1
  if (finalConfidence >= 9.5) units = 5
  else if (finalConfidence >= 9.0) units = 4
  else if (finalConfidence >= 8.5) units = 3
  else if (finalConfidence >= 7.5) units = 2
  
  return {
    action: 'GENERATE_PICK',
    confidence: finalConfidence,
    units: units,
    total_cost: 0.025  // Cost for this pick
  }
}
```

---

## Implementation Steps

### 1. Install Dependencies
```bash
npm install cheerio  # For StatMuse HTML parsing
npm install openai   # For ChatGPT API
```

### 2. Environment Variables
```env
# Your existing
THE_ODDS_API_KEY=xxx
OPENWEATHER_API_KEY=xxx

# New
OPENAI_API_KEY=sk-xxx  # From your ChatGPT subscription
PERPLEXITY_API_KEY=pplx-xxx  # Optional backup
```

### 3. Database Tables
```sql
-- Simplified: Only 2 AI runs max
CREATE TABLE ai_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  capper TEXT NOT NULL,
  run_number INTEGER NOT NULL,  -- 1 or 2
  run_type TEXT NOT NULL,  -- 'statmuse' or 'web_search'
  
  -- Data
  factors JSONB NOT NULL,
  cost DECIMAL(6,4) DEFAULT 0,  -- Track cost
  ai_provider TEXT,  -- 'statmuse', 'chatgpt', 'perplexity'
  
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(game_id, capper, run_number)
);
```

### 4. Build Shiva with AI Enhancement
```typescript
// src/lib/cappers/shiva-ai-enhanced.ts

import { getStatMuseClient, generateMatchupQuestions } from '@/lib/data/statmuse-client'
import { OpenAI } from 'openai'

export async function analyzeGameWithAI(game: CapperGame) {
  const log = {
    game_id: game.id,
    capper: 'shiva',
    runs: []
  }
  
  // Phase 1: Baseline (The Odds API)
  const baseline = extractBaseline(game)
  
  // Weed-out filters
  if (!passesFilters(baseline)) {
    return { action: 'PASS', reason: 'Filtered out', cost: 0 }
  }
  
  // Run 1: StatMuse (FREE)
  const questions = generateMatchupQuestions(
    game.home_team.name,
    game.away_team.name,
    game.sport
  )
  
  const statmuse = getStatMuseClient()
  const answers = await statmuse.askBatch(questions)
  
  const run1Factors = await analyzeStatMuseData(answers)
  log.runs.push({ run: 1, type: 'statmuse', cost: 0, factors: run1Factors })
  
  // Run 2: ChatGPT or Perplexity
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  const run2Result = await openai.chat.completions.create({
    model: "gpt-4o-mini",  // Cheap and fast
    messages: [
      {
        role: "system",
        content: "You are SHIVA. Analyze Run 1 data, search for injuries, predict score."
      },
      {
        role: "user",
        content: buildRun2Prompt(baseline, run1Factors)
      }
    ],
    response_format: { type: "json_object" }
  })
  
  const run2Factors = JSON.parse(run2Result.choices[0].message.content)
  log.runs.push({ run: 2, type: 'chatgpt', cost: 0, factors: run2Factors })
  
  // Phase 3: Vegas Comparison
  const vegasComp = calculateVegasComparison(run2Factors.prediction, game.odds)
  
  // Phase 4: Final Decision
  const decision = makeFinalDecision(baseline, run1Factors, run2Factors, vegasComp)
  
  return { ...decision, log }
}
```

---

## Cost Analysis

### Per Game (Shiva Only)
```
Phase 1: Baseline = $0 (Odds API already paid for)
Run 1: StatMuse = $0 (FREE)
Run 2: ChatGPT = $0 (your subscription)
       OR Perplexity = $0.025

Total: $0-0.03 per game
```

### Monthly (30 games/day)
```
Shiva: 30 games × $0.025 = $0.75/month ✅
```

### At Scale (5 cappers, 30 games/day)
```
Without filters: 30 × 5 × $0.025 = $3.75/month ✅
With 70% filtered: 30 × 5 × 0.3 × $0.025 = $1.13/month ✅✅
```

**WAY under budget!** 🎉

---

## Shiva's AI Personality

```javascript
const shivaPersonality = {
  name: "SHIVA",
  style: "Multi-model destroyer - seeks consensus",
  
  // Run 1: StatMuse Questions (Analytical)
  run1_focus: [
    "Recent form (last 5 games)",
    "Head-to-head history",
    "Scoring trends (PPG, defensive ratings)",
    "Situational stats (rest advantage, home/away splits)"
  ],
  
  // Run 2: Web Search (Strategic + Injuries)
  run2_focus: [
    "Latest injuries (critical validation)",
    "Weather (if outdoor)",
    "Betting market trends",
    "Score prediction based on all data"
  ],
  
  risk_tolerance: "Medium - requires 7+ confidence",
  specialty: "Finding edges where multiple data sources agree"
}
```

---

## Next Steps

1. ✅ StatMuse client created
2. ⏭️ Build Shiva AI-enhanced algorithm
3. ⏭️ Add ChatGPT integration
4. ⏭️ Test on a few games
5. ⏭️ Monitor costs and accuracy
6. ⏭️ Scale to other cappers

---

**This is the way forward!** FREE stats + your existing ChatGPT = nearly free AI enhancement! 🚀

