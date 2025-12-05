# 🤖 AI Archetype Insights - 3-Pass Verification System

## 📋 Overview

Implement AI-powered archetype-specific insights with a 3-pass verification system to ensure data reliability and prevent hallucinations. Each of the 24 archetypes (12 TOTALS, 12 SPREAD) will generate quantifiable insights that feed into the pick generation factor system.

---

## 🎯 Goals

1. **AI-Powered Analysis**: Each archetype uses OpenAI to analyze matchups through its unique lens
2. **3-Pass Verification**: Prevent hallucinations with Researcher → Auditor → Judge pipeline
3. **Quantifiable Outputs**: Pass 3 produces X, Y, Z values for factor computation
4. **Quality Scoring**: Each insight has reliability score (0.0-1.0)
5. **Admin Testing UI**: Test each archetype's 3-pass flow before production

---

## 🏗️ Architecture

### **The 3-Pass Pipeline**

```
PASS 1: The Researcher (GPT-4o-mini)
  ↓ Generates initial analysis with specific claims
  
PASS 2: The Auditor (GPT-4o-mini)
  ↓ Verifies claims against ground truth data
  
PASS 3: The Judge (GPT-4.1)
  ↓ Synthesizes verified data into quantifiable X, Y, Z values
  
FACTOR COMPUTATION
  ↓ Uses X, Y, Z to compute factor signal (-1 to +1)
```

### **Quality Control**

- **Pass 2 Quality < 0.70**: Reject insight (don't store)
- **Pass 2 Quality 0.70-0.85**: Flag for review
- **Pass 2 Quality > 0.85**: Proceed to Pass 3
- **Overall Quality < 0.75**: Mark as 'flagged', don't use in picks
- **Overall Quality ≥ 0.75**: Mark as 'verified', use in picks

---

## 📊 Database Schema

```sql
CREATE TABLE game_archetype_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  archetype_id TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  
  -- PASS 1: Initial Analysis
  pass1_raw_analysis TEXT,
  pass1_claims JSONB,
  pass1_timestamp TIMESTAMP,
  pass1_tokens_used INTEGER,
  
  -- PASS 2: Fact Verification
  pass2_validation_report JSONB,
  pass2_data_quality_score DECIMAL,
  pass2_timestamp TIMESTAMP,
  pass2_tokens_used INTEGER,
  
  -- PASS 3: Final Synthesis
  pass3_insight_score DECIMAL NOT NULL,
  pass3_confidence TEXT NOT NULL,
  pass3_direction TEXT NOT NULL,
  pass3_magnitude DECIMAL NOT NULL,
  pass3_reasoning TEXT NOT NULL,
  pass3_key_factors JSONB NOT NULL,
  pass3_timestamp TIMESTAMP,
  pass3_tokens_used INTEGER,
  
  -- Quality Metrics
  overall_quality_score DECIMAL,
  verification_status TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  total_tokens_used INTEGER,
  
  UNIQUE(game_id, archetype_id),
  INDEX idx_verification_status ON game_archetype_insights(verification_status)
);
```

---

## 💰 Cost Analysis

**Per Archetype Per Game:**
- Pass 1: ~1000 tokens (GPT-4o-mini) = $0.0008
- Pass 2: ~1500 tokens (GPT-4o-mini) = $0.0012
- Pass 3: ~800 tokens (GPT-4.1) = $0.01
- **Total: $0.012 per archetype**

**Per Game (24 archetypes):**
- 24 × $0.012 = **$0.29 per game**

**Per Day (15 games):**
- 15 × $0.29 = **$4.35/day**

**Per Month:**
- **$130/month** (using GPT-4.1 for Pass 3)
- **$35/month** (using GPT-4o-mini for all passes - optimization option)

---

## 📝 Implementation Phases

### **Phase 1: Admin UI + Infrastructure (PRIORITY)**

**Goal**: Build AI Manager admin page for testing

**Tasks**:
1. Create `/admin/ai-manager` page
2. Display all 24 archetypes with descriptions
3. Show Pass 1, 2, 3 prompts for each archetype
4. Add "Test" button to run 3-pass flow on sample matchup
5. Display results after each pass
6. Show final X, Y, Z values from Pass 3

**Files to Create**:
- `src/app/admin/ai-manager/page.tsx` - Main admin UI
- `src/lib/ai-insights/archetype-definitions.ts` - Archetype metadata
- `src/lib/ai-insights/prompt-templates.ts` - Pass 1, 2, 3 prompts
- `src/app/api/admin/test-archetype/route.ts` - Test endpoint

**Deliverable**: Admin can select archetype, click "Test", see all 3 passes execute, verify X/Y/Z outputs

---

### **Phase 2: 3-Pass Pipeline Core (After Phase 1)**

**Goal**: Build the actual 3-pass verification system

**Tasks**:
1. Implement Pass 1 (Researcher) - OpenAI structured output
2. Implement Pass 2 (Auditor) - Fact verification against MySportsFeeds
3. Implement Pass 3 (Judge) - Final synthesis with X, Y, Z outputs
4. Add quality scoring logic
5. Add rejection/flagging logic

**Files to Create**:
- `src/lib/ai-insights/pass1-researcher.ts`
- `src/lib/ai-insights/pass2-auditor.ts`
- `src/lib/ai-insights/pass3-judge.ts`
- `src/lib/ai-insights/pipeline.ts` - Orchestrates all 3 passes
- `src/lib/ai-insights/quality-scoring.ts`

**Deliverable**: Can run full 3-pass pipeline for any archetype + game

---

### **Phase 3: All 24 Archetype Prompts**

**Goal**: Write production-quality prompts for all archetypes

**Tasks**:
1. Write Pass 1, 2, 3 prompts for all 12 TOTALS archetypes
2. Write Pass 1, 2, 3 prompts for all 12 SPREAD archetypes
3. Define X, Y, Z formulas for each archetype
4. Test each archetype with real game data
5. Tune quality thresholds per archetype

**Files to Update**:
- `src/lib/ai-insights/prompt-templates.ts` - Add all 72 prompts (24 × 3)
- `src/lib/ai-insights/archetype-definitions.ts` - Add X/Y/Z formulas

**Deliverable**: All 24 archetypes have tested, working prompts

---

### **Phase 4: Factor Integration**

**Goal**: Integrate AI insights into factor system

**Tasks**:
1. Create F10 (TOTALS AI Archetype Insight factor)
2. Create S14 (SPREAD AI Archetype Insight factor)
3. Add to factor registry
4. Update orchestrators to compute AI factors
5. Test pick generation with AI factors

**Files to Create**:
- `src/lib/factors/definitions/nba/totals/f10-ai-archetype-insight.ts`
- `src/lib/factors/definitions/nba/spread/s14-ai-archetype-insight.ts`

**Files to Update**:
- `src/lib/factors/registry.ts` - Register F10 and S14
- `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts`
- `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts`

**Deliverable**: AI insights flow into pick generation as factors

---

### **Phase 5: Cache Warming Cron**

**Goal**: Pre-generate insights before pick generation

**Tasks**:
1. Create cron job that runs 30min before games
2. Fetch today's games
3. Run 3-pass pipeline for all 24 archetypes per game
4. Store verified insights in database
5. Add monitoring/alerting for quality scores

**Files to Create**:
- `src/app/api/cron/warm-ai-insights/route.ts`

**Deliverable**: Insights pre-cached, pick generation is instant

---

### **Phase 6: Production Monitoring**

**Goal**: Monitor AI insight quality in production

**Tasks**:
1. Add quality metrics dashboard to AI Manager
2. Track rejection rates per archetype
3. Alert if >20% insights rejected
4. Cost tracking (tokens used)
5. Performance metrics (latency per pass)

**Files to Update**:
- `src/app/admin/ai-manager/page.tsx` - Add monitoring tab

**Deliverable**: Can monitor AI system health in real-time

---

## 🎨 Admin UI Specification

### **AI Manager Page (`/admin/ai-manager`)**

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ AI Archetype Insights Manager                           │
├─────────────────────────────────────────────────────────┤
│ [TOTALS Tab] [SPREAD Tab] [Monitoring Tab]             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ TOTALS ARCHETYPES (12)                                  │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 🚀 The Pace Prophet                              │   │
│ │ Tempo is destiny. Fast pace = more points.       │   │
│ │ Bet Type: TOTAL                                  │   │
│ │                                                   │   │
│ │ [View Prompts ▼] [Test Archetype]               │   │
│ │                                                   │   │
│ │ Pass 1 Prompt: [Collapsed - Click to expand]    │   │
│ │ Pass 2 Prompt: [Collapsed]                       │   │
│ │ Pass 3 Prompt: [Collapsed]                       │   │
│ │                                                   │   │
│ │ Required Outputs:                                │   │
│ │ X = Pace differential vs league avg              │   │
│ │ Y = Recent matchup pace                          │   │
│ │ Z = Confidence multiplier (0.0-1.0)              │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 📊 The Efficiency Expert                         │   │
│ │ Elite offense + weak defense = points.           │   │
│ │ ...                                              │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Test Flow**:
1. User clicks "Test Archetype" button
2. Modal opens: "Select a matchup to test"
3. Dropdown shows today's games (e.g., "LAL @ BOS")
4. User selects game, clicks "Run Test"
5. UI shows:
   ```
   ✓ Pass 1 Complete (0.8s, 1024 tokens)
   [View Pass 1 Results ▼]

   ⏳ Running Pass 2...
   ```
6. After Pass 2:
   ```
   ✓ Pass 2 Complete (1.2s, 1536 tokens)
   Data Quality: 0.87 ✓
   [View Pass 2 Results ▼]

   ⏳ Running Pass 3...
   ```
7. After Pass 3:
   ```
   ✓ Pass 3 Complete (1.5s, 892 tokens)

   Final Outputs:
   X = 2.05 (Pace differential)
   Y = 103.8 (Recent matchup pace)
   Z = 0.9 (Confidence multiplier)

   Insight Score: 7.2/10 (OVER)
   Confidence: high
   Direction: over
   Magnitude: 0.85

   Reasoning: "Both teams play significantly faster than league
   average (102.3 and 101.8 vs 99.5). Their recent meeting
   confirmed high pace at 103.8. Minimal injuries support
   scoring environment."

   Overall Quality: 0.875 ✓
   Status: VERIFIED ✓

   [✓ PASS] [View Full Report]
   ```

---

## 📚 Archetype Definitions

### **TOTALS ARCHETYPES (12)**

#### 1. **The Pace Prophet** 🚀
- **Description**: "Tempo is destiny. Fast pace creates more possessions, more possessions create more points."
- **Bet Type**: TOTAL
- **Philosophy**: Pace differential is the #1 predictor of totals
- **X**: Pace differential vs league avg
- **Y**: Recent matchup pace
- **Z**: Confidence multiplier

#### 2. **The Efficiency Expert** 📊
- **Description**: "Elite offense meets weak defense. Quality over quantity wins every time."
- **Bet Type**: TOTAL
- **Philosophy**: ORtg/DRtg matchups reveal scoring potential
- **X**: Combined ORtg differential
- **Y**: Combined DRtg differential
- **Z**: Confidence multiplier

#### 3. **The Hot Hand Hunter** 🔥
- **Description**: "Shooting streaks are real. Hot teams stay hot, cold teams stay cold."
- **Bet Type**: TOTAL
- **Philosophy**: 3PT shooting momentum predicts scoring
- **X**: 3PT% differential (last 5 games)
- **Y**: 3PT volume differential
- **Z**: Confidence multiplier

#### 4. **The Whistle Hunter** 🎺
- **Description**: "Refs control the game. Free throws are free points that inflate totals."
- **Bet Type**: TOTAL
- **Philosophy**: FT rate + aggressive drivers = easy overs
- **X**: Combined FT rate differential
- **Y**: Ref whistle tendency
- **Z**: Confidence multiplier

#### 5. **The Sharp Scholar** ⚖️
- **Description**: "Trust the math. Balanced analysis across all variables produces consistent edge."
- **Bet Type**: TOTAL
- **Philosophy**: No single factor dominates
- **X**: Weighted composite score
- **Y**: Variance measure
- **Z**: Confidence multiplier

#### 6. **The Fade Artist** 📉
- **Description**: "Bet against the cold. Eroding defense and declining offense bleed points."
- **Bet Type**: TOTAL
- **Philosophy**: Defensive erosion tells the truth
- **X**: Defensive rating trend
- **Y**: Offensive rating trend
- **Z**: Confidence multiplier

#### 7. **The Tempo Tyrant** ❄️
- **Description**: "Slow games grind. Low possessions plus strong defense equals unders."
- **Bet Type**: TOTAL
- **Philosophy**: Pace + defense together reveal grind-it-out games
- **X**: Pace differential (negative = slower)
- **Y**: Combined defensive strength
- **Z**: Confidence multiplier

#### 8. **The Injury Assassin** 💀
- **Description**: "Missing stars change everything. The market adjusts too slowly."
- **Bet Type**: TOTAL
- **Philosophy**: Injuries create exploitable totals edges
- **X**: PPG impact of injuries
- **Y**: Defensive scheme change impact
- **Z**: Confidence multiplier

#### 9. **The Locksmith** 🔒
- **Description**: "Elite defense creates low-scoring games. Lock it down, bet the under."
- **Bet Type**: TOTAL
- **Philosophy**: Defense wins and limits scoring
- **X**: Combined defensive strength
- **Y**: Cold shooting factor
- **Z**: Confidence multiplier

#### 10. **The Grinder** 🏔️
- **Description**: "Slow, ugly, under. Pace kills scoring, fatigue kills offense."
- **Bet Type**: TOTAL
- **Philosophy**: Slow pace + cold shooting = grinding unders
- **X**: Pace differential (negative)
- **Y**: Shooting efficiency decline
- **Z**: Confidence multiplier

#### 11. **The Rest Detective** 🛏️
- **Description**: "Fatigue kills performance. Fresh legs score, tired legs miss."
- **Bet Type**: TOTAL
- **Philosophy**: Schedule tells the scoring story
- **X**: Rest advantage differential
- **Y**: Back-to-back impact
- **Z**: Confidence multiplier

#### 12. **The Cold Hunter** 🧊
- **Description**: "Fade the slump. Cold shooting teams don't suddenly heat up."
- **Bet Type**: TOTAL
- **Philosophy**: Shooting regression favors unders
- **X**: Cold shooting magnitude
- **Y**: Shooting trend direction
- **Z**: Confidence multiplier

---

### **SPREAD ARCHETYPES (12)**

#### 1. **The Hot Hand** 📈
- **Description**: "Shooting streaks are real. Ride the hot teams, fade the cold."
- **Bet Type**: SPREAD
- **Philosophy**: Recent shooting momentum predicts ATS performance
- **X**: Shooting efficiency differential
- **Y**: Shooting trend strength
- **Z**: Confidence multiplier

#### 2. **The Matchup Master** ⚔️
- **Description**: "Ignore records, focus on matchups. Offense vs defense reveals truth."
- **Bet Type**: SPREAD
- **Philosophy**: Four factors reveal true team quality
- **X**: Four factors differential
- **Y**: Matchup-specific adjustments
- **Z**: Confidence multiplier

#### 3. **The Disruptor** 🌀
- **Description**: "Chaos wins games. Force turnovers, control destiny."
- **Bet Type**: SPREAD
- **Philosophy**: Turnovers are the great equalizer
- **X**: Turnover differential
- **Y**: Defensive pressure rating
- **Z**: Confidence multiplier

#### 4. **The Closer** 🏆
- **Description**: "Net rating determines winners. Fundamentals beat narratives."
- **Bet Type**: SPREAD
- **Philosophy**: Better teams close games and cover
- **X**: Net rating differential
- **Y**: Clutch performance rating
- **Z**: Confidence multiplier

#### 5. **The Injury Hawk** 🦅
- **Description**: "Lines move slow. Beat the book before they fully adjust to injuries."
- **Bet Type**: SPREAD
- **Philosophy**: Star absences create 4-7 point swings
- **X**: Injury impact on spread
- **Y**: Line movement vs injury news
- **Z**: Confidence multiplier

#### 6. **The Board Bully** 💪
- **Description**: "Control the glass, control the game. Rebounding wins ATS."
- **Bet Type**: SPREAD
- **Philosophy**: Offensive boards = 2nd chances, defensive boards = end possessions
- **X**: Rebounding differential
- **Y**: Second-chance points impact
- **Z**: Confidence multiplier

#### 7. **The Cold Blooded** 👁️
- **Description**: "Ignore the noise. Net rating plus four factors equals truth."
- **Bet Type**: SPREAD
- **Philosophy**: Sharps trust math, public chases hype
- **X**: Net rating differential
- **Y**: Four factors composite
- **Z**: Confidence multiplier

#### 8. **The Grinder** ⛰️
- **Description**: "Ball security wins. Low turnover teams frustrate and cover."
- **Bet Type**: SPREAD
- **Philosophy**: Discipline beats talent
- **X**: Turnover differential
- **Y**: Ball security rating
- **Z**: Confidence multiplier

#### 9. **The Ball Mover** 🤝
- **Description**: "Unselfish teams with chemistry cover. High AST/TOV ratio wins."
- **Bet Type**: SPREAD
- **Philosophy**: Smart decisions create quality shots
- **X**: Assist efficiency differential
- **Y**: Ball movement rating
- **Z**: Confidence multiplier

#### 10. **Ice Veins** 🎯
- **Description**: "Clutch shooting wins close games. Nerves of steel cover spreads."
- **Bet Type**: SPREAD
- **Philosophy**: FT% and FG% under pressure separate winners
- **X**: Clutch shooting differential
- **Y**: Pressure performance rating
- **Z**: Confidence multiplier

#### 11. **The Lockdown** 🛡️
- **Description**: "Defense travels. Elite perimeter defense limits opponents and covers."
- **Bet Type**: SPREAD
- **Philosophy**: Great 3PT defense controls modern NBA
- **X**: Perimeter defense differential
- **Y**: Opponent FG% allowed
- **Z**: Confidence multiplier

#### 12. **The Point Machine** 🔥
- **Description**: "Outscore everyone. Scoring margin is destiny, simple math."
- **Bet Type**: SPREAD
- **Philosophy**: PPG differential reveals true quality
- **X**: Scoring margin differential
- **Y**: Consistency rating
- **Z**: Confidence multiplier

---

## 🔧 Technical Implementation Details

### **Pass 1: Researcher Prompt Structure**

```typescript
interface Pass1Output {
  analysis: string  // 3-4 sentence analysis
  claims: Array<{
    claim: string
    source: string
    confidence: 'low' | 'medium' | 'high'
    verifiable: boolean
    date_range?: string
  }>
  preliminary_score: number  // -10 to +10
  uncertainty_flags: string[]
}
```

### **Pass 2: Auditor Prompt Structure**

```typescript
interface Pass2Output {
  verified_claims: Array<{
    claim: string
    status: 'verified'
    actual_value: number
    claimed_value: number
    variance: number
    sources_checked: string[]
  }>
  flagged_claims: Array<{
    claim: string
    status: 'incorrect_date' | 'incorrect_value' | 'missing_data'
    correction: string
  }>
  corrected_claims: Array<{
    original: string
    corrected: string
    source: string
  }>
  data_quality_score: number  // 0.0 to 1.0
  recommendation: 'proceed' | 'flag_for_review' | 'reject'
}
```

### **Pass 3: Judge Prompt Structure**

```typescript
interface Pass3Output {
  insight_score: number  // -10.0 to +10.0
  confidence: 'low' | 'medium' | 'high'
  direction: 'over' | 'under' | 'away' | 'home' | 'neutral'
  magnitude: number  // 0.0 to 1.0

  reasoning: string  // 2-3 sentences

  key_factors: {
    [key: string]: any  // Archetype-specific factors
  }

  factor_inputs: {
    X: number
    Y: number
    Z: number
  }

  quality_assessment: {
    pass1_accuracy: number
    data_reliability: number
    overall_quality: number
  }
}
```

---

## 🚀 Getting Started

### **Step 1: Create Admin UI**

Start by building the AI Manager page so you can test as you build:

```bash
# Create the admin page
src/app/admin/ai-manager/page.tsx

# Create archetype definitions
src/lib/ai-insights/archetype-definitions.ts

# Create test endpoint
src/app/api/admin/test-archetype/route.ts
```

### **Step 2: Test with One Archetype**

Pick "The Pace Prophet" as the prototype:
1. Write Pass 1, 2, 3 prompts
2. Test with real game data
3. Verify X, Y, Z outputs
4. Tune quality thresholds

### **Step 3: Scale to All 24**

Once one archetype works:
1. Replicate prompt structure for all 24
2. Customize X, Y, Z formulas per archetype
3. Test each archetype
4. Document any edge cases

---

## 📊 Success Criteria

**Phase 1 Complete When**:
- ✅ Admin UI shows all 24 archetypes
- ✅ Can click "Test" and run 3-pass flow
- ✅ Pass 1, 2, 3 results display correctly
- ✅ X, Y, Z values show in UI
- ✅ Quality scores calculate correctly

**Phase 2 Complete When**:
- ✅ All 24 archetypes have working prompts
- ✅ Pass 2 catches hallucinations (tested)
- ✅ Pass 3 produces reliable X, Y, Z values
- ✅ Quality thresholds tuned per archetype

**Phase 3 Complete When**:
- ✅ F10 and S14 factors integrate with system
- ✅ Pick generation uses AI insights
- ✅ Insight cards display AI reasoning
- ✅ Cache warming cron runs successfully

---

## 🎯 Next Steps for Primary Agent

1. **Read this document fully**
2. **Start with Phase 1**: Build AI Manager admin page
3. **Create archetype definitions file** with all 24 archetypes
4. **Build test UI** so user can test each archetype
5. **Implement one archetype end-to-end** (Pace Prophet recommended)
6. **Get user approval** before scaling to all 24

**Key Files to Reference**:
- Current archetypes: `src/app/cappers/create/page.tsx` (lines 357-701)
- Factor system: `src/lib/factors/types.ts`
- Orchestrators: `src/lib/cappers/shiva-v1/factors/nba-*-orchestrator.ts`

**Production URL**: https://deep-pick.vercel.app

**Repository**: https://github.com/gr8nade-TGH/DeepPick.git

---

## 💡 Important Notes

- **Don't push to production** until user approves
- **Test thoroughly** in admin UI before integrating with pick generation
- **Monitor costs** - track tokens used per archetype
- **Quality over speed** - Better to have 12 working archetypes than 24 broken ones
- **Ask questions** - If prompts need refinement, ask user for guidance

---

**Ready to build! Start with Phase 1 and the AI Manager admin page.** 🚀

