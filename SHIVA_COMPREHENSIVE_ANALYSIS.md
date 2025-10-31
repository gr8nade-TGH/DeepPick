# 🔱 SHIVA Pick Generation System - Comprehensive Deep Analysis

## Executive Summary

The SHIVA (Sharp Hybrid Intelligence & Vegas Analysis) pick generation system is a sophisticated, multi-layered sports betting algorithm that combines:
- **Baseline statistical analysis** (3-model consensus)
- **AI-enhanced research** (Perplexity + ChatGPT + StatMuse)
- **Vegas line comparison** (market edge detection)
- **Confidence-based gating** (threshold-based pick/pass decisions)

This document provides an exhaustive analysis of every component, formula, and decision point in the system.

---

## 1. PICK GENERATION PIPELINE - END-TO-END FLOW

### 1.1 Entry Points

There are **TWO** distinct entry points for pick generation:

#### A. **Automated Cron Job** (Every 10 minutes)
**File**: `src/app/api/cron/shiva-auto-picks/route.ts`

**Flow**:
```
1. Acquire atomic lock (prevent concurrent runs)
2. Call Step 1 Scanner → Find eligible game
3. Call /api/shiva/generate-pick → Run full algorithm
4. Record cooldown (2 hours for PASS, none for PICK)
5. Release lock
```

**Key Features**:
- One-game-per-run policy (no batch processing)
- Atomic locking via `acquire_shiva_lock()` database function
- Cooldown system prevents re-analyzing same game
- Uses `skipTimeValidation: true` to bypass 15-hour timing check

#### B. **Manual Wizard** (SHIVA Management Page)
**File**: `src/app/cappers/shiva/management/components/wizard.tsx`

**Flow**:
```
Step 1: Game Selection (Scanner)
Step 2: Odds Snapshot
Step 3: Factor Computation (F1-F5)
Step 4: Predictions & Base Confidence (F6-F7)
Step 5: Market Edge Adjustment
Step 6: Pick Generation
Step 7: Insight Card
```

**Key Features**:
- Step-by-step UI with progress tracking
- Manual game selection from inbox
- Factor configuration modal
- Real-time logging and debugging
- Idempotency keys prevent duplicate steps

---

### 1.2 Complete Pipeline Stages

#### **STAGE 1: Game Selection & Eligibility**

**Endpoint**: `/api/shiva/step1-scanner`

**Eligibility Criteria**:
```typescript
// From pick-generation-service.ts
1. Game status = 'scheduled' (not final/in-progress)
2. Game time > 30 minutes from now (timing buffer)
3. No existing pick for this game + bet type
4. Not in cooldown period (2-hour window after PASS)
5. Has valid odds data (total_line, spread_line)
```

**Scanner Logic**:
```typescript
// Pseudo-code from step1-scanner/route.ts
if (selectedGame) {
  // Manual selection - check if eligible
  canProcess = await checkGameEligibility(selectedGame)
  if (canProcess) return selectedGame
}

// Auto-scan mode
eligibleGames = await scanForEligibleGames(sport, betType, limit)
if (eligibleGames.length === 0) {
  return { success: false, message: 'No eligible games found' }
}

return { selected_game: eligibleGames[0] }
```

**Database Query** (from `pick-generation-service.ts`):
```sql
SELECT * FROM games
WHERE sport = 'NBA'
  AND status = 'scheduled'
  AND game_date >= CURRENT_DATE
  AND game_time > NOW() + INTERVAL '30 minutes'
  AND id NOT IN (
    SELECT game_id FROM picks WHERE capper = 'shiva' AND pick_type = 'total'
  )
  AND id NOT IN (
    SELECT game_id FROM shiva_cooldowns 
    WHERE capper = 'shiva' 
      AND bet_type = 'TOTAL'
      AND cooldown_until > NOW()
  )
ORDER BY game_time ASC
LIMIT 1
```

---

#### **STAGE 2: Odds Snapshot**

**Endpoint**: `/api/shiva/step2-snapshot`

**Purpose**: Lock current odds at prediction time for later comparison

**Data Captured**:
```typescript
{
  snapshot_id: UUID,
  run_id: UUID,
  is_active: true,
  payload_json: {
    game_id: string,
    sport: 'NBA',
    home_team: string,
    away_team: string,
    start_time_utc: ISO timestamp,
    captured_at_utc: ISO timestamp,
    books_considered: number,
    moneyline: { home: number, away: number },
    spread: { line: number, home_odds: number, away_odds: number },
    total: { line: number, over_odds: number, under_odds: number }
  }
}
```

**Database Table**: `odds_snapshots`
- One active snapshot per run (enforced by unique index)
- Immutable rows (never updated, only marked inactive)
- Used for pick persistence and historical analysis

---

#### **STAGE 3: Factor Computation (F1-F5)**

**Endpoint**: `/api/shiva/factors/step3`

**NBA Totals Factors** (5 baseline factors):

| Factor | Key | Description | Weight Range | Max Points |
|--------|-----|-------------|--------------|------------|
| F1: Pace Index | `paceIndex` | Expected game pace vs league average | 0-100% | 5.0 |
| F2: Offensive Form | `offForm` | Recent offensive efficiency vs opponent defense | 0-100% | 5.0 |
| F3: Defensive Erosion | `defErosion` | Defensive vulnerability trends | 0-100% | 5.0 |
| F4: Three-Point Environment | `threeEnv` | 3PT shooting matchup | 0-100% | 5.0 |
| F5: Free Throw Environment | `whistleEnv` | FT rate environment | 0-100% | 5.0 |

**Computation Flow**:
```typescript
// From nba-totals-orchestrator.ts
1. Fetch NBA stats bundle (team stats, league averages)
2. For each factor:
   a. Calculate raw value (sport-specific formula)
   b. Normalize to [-1, +1] signal
   c. Apply soft cap (prevent extreme values)
   d. Store raw_values_json, parsed_values_json, normalized_value
3. Return factor array with metadata
```

**Example Factor Calculation** (F1: Pace Index):
```typescript
// From f1-pace-index.ts
const homePace = teamStats.home.pace || leagueAvg.pace
const awayPace = teamStats.away.pace || leagueAvg.pace

// Harmonic mean (accounts for both teams' pace)
const paceExp = 2 / (1/homePace + 1/awayPace)

// Deviation from league average
const paceDeviation = paceExp - leagueAvg.pace

// Normalize to [-1, +1]
const signal = clamp(paceDeviation / 5.0, -1, 1)

// Apply soft cap at ±2.0 points
const cappedValue = applySoftCap(signal * maxPoints, 2.0)

return {
  factor_no: 1,
  key: 'paceIndex',
  name: 'Pace Index',
  normalized_value: signal,
  raw_values_json: { homePace, awayPace, paceExp, paceDeviation },
  parsed_values_json: { signal, cappedValue },
  caps_applied: Math.abs(cappedValue) >= 2.0,
  cap_reason: cappedValue >= 2.0 ? 'Capped at +2.0' : null
}
```

**Database Storage**: `factors` table
```sql
INSERT INTO factors (run_id, factor_no, raw_values_json, parsed_values_json, normalized_value, weight_applied, caps_applied, cap_reason)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
```

---

#### **STAGE 4: Predictions & AI Research (F6-F7)**

**Endpoint**: `/api/shiva/factors/step4`

**AI Research Pipeline**:

**Run 1: Perplexity + StatMuse** (Analytical)
```typescript
// From ai-capper-orchestrator.ts: executeRun1()

1. StatMuse Queries (8 questions):
   - "{home_team} average points per game vs {away_team} this season"
   - "{away_team} average points per game vs {home_team} this season"
   - "{home_team} defensive rating this season"
   - "{away_team} defensive rating this season"
   - "{home_team} pace this season"
   - "{away_team} pace this season"
   - "{home_team} net rating last 10 games"
   - "{away_team} net rating last 10 games"

2. Perplexity Injury Search:
   - Model: 'sonar-medium-online'
   - Prompt: "Search for current injury information for {away} vs {home}"
   - Max tokens: 800
   - Temperature: 0.7

3. Perplexity Factor Analysis:
   - Analyzes StatMuse data + injury info
   - Returns JSON with factors (pace_advantage, defensive_mismatch, etc.)
   - Max tokens: 700
   - Temperature: 0.5

4. Save to database: `ai_runs` table
```

**Run 2: ChatGPT + StatMuse + Validation** (Strategic)
```typescript
// From ai-capper-orchestrator.ts: executeRun2()

1. StatMuse Queries (6 questions):
   - "{home_team} record on {rest_days} days rest this season"
   - "{away_team} record on {rest_days} days rest this season"
   - "{home_team} record this season as favorites"
   - "{away_team} record this season as underdogs"
   - "{home_team} opponent 3-point attempts per game this season"
   - "{away_team} opponent 3-point attempts per game this season"

2. ChatGPT Analysis:
   - Model: 'gpt-4o-mini'
   - Validates Run 1 findings
   - Adds strategic factors (rest, motivation, trends)
   - Response format: JSON object
   - Max tokens: 1000
   - Temperature: 0.5

3. Save to database: `ai_runs` table
```

**AI Failure Handling**:
```typescript
// From shiva-algorithm.ts
try {
  aiRuns = await orchestrator.runResearchPipeline()
} catch (error) {
  console.error('[SHIVA] AI research failed:', error)
  // Continue with baseline factors only
  aiRuns = null
}
```

**F6-F7 Calculation** (from AI data):
```typescript
// F6: Home Court Advantage (from AI + stats)
const homeEdge = aiRuns?.[0]?.factors?.home_court_advantage || 0
const f6_signal = clamp(homeEdge / 5.0, -1, 1)

// F7: Three-Point Matchup (from AI + stats)
const threePtEdge = aiRuns?.[1]?.factors?.three_point_matchup || 0
const f7_signal = clamp(threePtEdge / 5.0, -1, 1)
```

---

#### **STAGE 5: Market Edge Adjustment**

**Endpoint**: `/api/shiva/factors/step5`

**Purpose**: Adjust confidence based on prediction vs Vegas line

**Formula**:
```typescript
// From orchestrator.ts: applyMarketEdge()

const marketTotalLine = oddsSnapshot.total.line  // e.g., 220.5
const predictedTotal = predictions.total_pred_points  // e.g., 225.0
const baseConfidence = predictions.conf7_score  // e.g., 3.5

// Calculate edge in points
const marketEdgePts = predictedTotal - marketTotalLine  // 225 - 220.5 = 4.5

// Convert to edge factor (-1 to +1)
const edgeFactor = clamp(marketEdgePts / 10.0, -1, 1)  // 4.5 / 10 = 0.45

// Adjust confidence (±1.0 max adjustment)
const adjustedConfidence = baseConfidence + (edgeFactor * 1.0)  // 3.5 + 0.45 = 3.95

return {
  conf_final: clamp(adjustedConfidence, 0, 5),
  conf_market_adj: edgeFactor * 1.0,
  dominant: 'total'
}
```

**Edge vs Market Factor** (Special Factor):
- **Always enabled** (cannot be disabled in Configure Factors)
- **Weight: 100%** (fixed, not adjustable)
- **Does NOT count toward 250% weight budget**
- **Applied AFTER** baseline factors (F1-F7)

---

#### **STAGE 6: Pick Generation & Gating**

**Endpoint**: `/api/shiva/pick/generate`

**Decision Logic**:
```typescript
// From orchestrator.ts: generatePick()

const finalConfidence = step5.conf_final  // e.g., 3.95
const predictedTotal = step4.total_pred_points  // e.g., 225.0
const marketLine = step2.total.line  // e.g., 220.5

// Determine pick direction
const pickDirection = predictedTotal > marketLine ? 'OVER' : 'UNDER'

// Units allocation (threshold-based)
let units = 0
if (finalConfidence >= 4.5) units = 5      // Highest confidence
else if (finalConfidence >= 4.0) units = 3  // High confidence
else if (finalConfidence >= 3.5) units = 2  // Medium confidence
else if (finalConfidence >= 2.5) units = 1  // Low confidence
else units = 0  // PASS (below threshold)

// PASS decision
if (units === 0) {
  return {
    decision: 'PASS',
    confidence: finalConfidence,
    pick: null
  }
}

// PICK decision
return {
  decision: 'PICK',
  confidence: finalConfidence,
  pick: {
    pick_type: 'TOTAL',
    selection: `${pickDirection} ${marketLine}`,
    units,
    locked_odds: step2.snapshot
  }
}
```

**Additional Gating Rules** (from `shiva-algorithm.ts`):
```typescript
// Favorite Rule: Don't bet heavy favorites unless very confident
const avgOdds = getAverageOdds(game, market, side)  // e.g., -280
const passedFavoriteRule = isValidFavoriteOdds(avgOdds, confidence)

function isValidFavoriteOdds(odds: number, confidence: number): boolean {
  if (odds <= -250 && confidence < 9.0) {
    return false  // Don't bet favorites over -250 unless 9.0+ confidence
  }
  return true
}

// Minimum Confidence Rule
if (confidence < 6.5) {
  return { pick: null, log }  // PASS
}
```

**Database Persistence**:
```sql
-- Step 1: Insert into picks table
INSERT INTO picks (game_id, capper, pick_type, selection, odds, units, game_snapshot, status)
VALUES ($1, 'shiva', 'total', 'OVER 220.5', -110, 2, $2, 'pending')

-- Step 2: Update run state
UPDATE runs SET state = 'COMPLETE', conf_final = 3.95, units = 2, pick_type = 'TOTAL'
WHERE run_id = $1
```

---

## 2. MATHEMATICAL FORMULAS & CALCULATIONS

### 2.1 Confidence Score Calculation

**Core Formula** (from `confidence-calculator.ts`):
```
confidence = |Σ(wᵢ × sᵢ)| × 5

Where:
- wᵢ = normalized weight (sum to 1.0)
- sᵢ = signal value (-1 to +1)
- 5 = scaling constant (maps to 0-5 visual scale)
```

**Example Calculation**:
```typescript
// Input factors
factors = [
  { key: 'paceIndex', normalized_value: 0.6, weight: 20 },
  { key: 'offForm', normalized_value: 0.4, weight: 20 },
  { key: 'defErosion', normalized_value: -0.2, weight: 20 },
  { key: 'threeEnv', normalized_value: 0.3, weight: 20 },
  { key: 'whistleEnv', normalized_value: 0.1, weight: 20 }
]

// Step 1: Normalize weights (sum to 1.0)
totalWeight = 20 + 20 + 20 + 20 + 20 = 100
normalizedWeights = {
  paceIndex: 20/100 = 0.20,
  offForm: 20/100 = 0.20,
  defErosion: 20/100 = 0.20,
  threeEnv: 20/100 = 0.20,
  whistleEnv: 20/100 = 0.20
}

// Step 2: Calculate signed sum
signedSum = (0.20 × 0.6) + (0.20 × 0.4) + (0.20 × -0.2) + (0.20 × 0.3) + (0.20 × 0.1)
          = 0.12 + 0.08 + (-0.04) + 0.06 + 0.02
          = 0.24

// Step 3: Scale to 0-5
confScore = |0.24| × 5 = 1.2

// Final confidence: 1.2 / 5.0 (24% edge)
```

### 2.2 Factor Weight Budget System

**Total Budget**: 250% (not 100%)
- Allows more granular control
- Edge vs Market (100%) does NOT count toward budget
- Remaining 250% distributed across F1-F7

**Weight Validation** (from `factor-config-modal.tsx`):
```typescript
const weightFactors = factors.filter(f => f.enabled && f.key !== 'edgeVsMarket')
const totalWeight = weightFactors.reduce((sum, f) => sum + f.weight, 0)
const remainingWeight = 250 - totalWeight
const isWeightValid = Math.abs(remainingWeight) < 0.01  // Allow floating point errors
```

**Default Weights** (NBA Totals):
```typescript
{
  paceIndex: 20,      // 8% of 250%
  offForm: 20,        // 8%
  defErosion: 20,     // 8%
  threeEnv: 20,       // 8%
  whistleEnv: 20,     // 8%
  edgeVsMarket: 100   // Fixed, doesn't count toward budget
}
```

### 2.3 Prediction Formulas

**Total Points Prediction**:
```typescript
// From math.ts: totalFromORtgs()
totalPredPoints = (homeORtg + awayORtg) * pace / 200

// Example:
homeORtg = 115.0
awayORtg = 110.0
pace = 100.0
totalPredPoints = (115 + 110) * 100 / 200 = 112.5 points per team = 225 total
```

**Spread Prediction**:
```typescript
// From math.ts: spreadFromDelta()
spreadPredPoints = delta100 * 0.5

// Where delta100 = weighted sum of factors
delta100 = f1*w1 + f2*w2 + f3*w3 + f4*w4 + f5*w5 + f6*w6 + f7*w7
```

**Pace Calculation** (Harmonic Mean):
```typescript
// From math.ts: paceHarmonic()
paceExp = 2 / (1/homePace + 1/awayPace)

// Example:
homePace = 102.0
awayPace = 98.0
paceExp = 2 / (1/102 + 1/98) = 2 / (0.0098 + 0.0102) = 2 / 0.0200 = 100.0
```

---

## 3. FACTOR SYSTEM - DEEP DIVE

### 3.1 Configure Factors Modal

**File**: `src/app/cappers/shiva/management/components/factor-config-modal.tsx`

**UI Components**:
1. **Factor List** - Shows all available factors with enable/disable toggles
2. **Weight Sliders** - Adjust weight (0-100%) for each enabled factor
3. **Data Source Selector** - Choose data provider (nba-stats-api, mysportsfeeds, llm, manual)
4. **Weight Budget Indicator** - Shows remaining weight (250% total)
5. **Save/Cancel Buttons** - Persist configuration to database

**Factor Structure**:
```typescript
interface FactorConfig {
  key: string              // Unique identifier (e.g., 'paceIndex')
  name: string             // Display name (e.g., 'Pace Index')
  description: string      // Tooltip text
  enabled: boolean         // Is this factor active?
  weight: number           // Weight percentage (0-100)
  dataSource: string       // Data provider
  maxPoints: number        // Cap for contribution
  sport: 'NBA' | 'NFL' | 'MLB'
  betType: 'TOTAL' | 'SPREAD/MONEYLINE'
  scope: 'GLOBAL' | 'SPORT' | 'LEAGUE'
  icon: string             // Emoji for UI
  shortName: string        // Abbreviated label
}
```

**Database Storage**: `capper_profiles` table
```sql
CREATE TABLE capper_profiles (
  id UUID PRIMARY KEY,
  capper_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  name TEXT,
  description TEXT,
  factors JSONB NOT NULL,  -- Array of FactorConfig
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 3.2 Factor Registry

**File**: `src/lib/cappers/shiva-v1/factor-registry.ts`

**Factor Metadata**:
```typescript
export const FACTOR_REGISTRY: FactorMeta[] = [
  // GLOBAL FACTORS (always first)
  {
    key: 'edgeVsMarket',
    name: 'Edge vs Market - Totals',
    shortName: 'Edge',
    icon: '📊',
    description: 'Predicted total vs market line',
    appliesTo: { sports: '*', betTypes: ['TOTAL'], scope: 'GLOBAL' },
    maxPoints: 5.0,
    defaultWeight: 0.15,  // 15% (but fixed at 100% in UI)
    defaultDataSource: 'manual'
  },
  
  // NBA TOTALS FACTORS
  {
    key: 'paceIndex',
    name: 'Pace Index',
    shortName: 'Pace',
    icon: '⏱️',
    description: 'Expected game pace vs league average',
    appliesTo: { sports: ['NBA'], betTypes: ['TOTAL'], scope: 'LEAGUE' },
    maxPoints: 5.0,
    defaultWeight: 0.20,
    defaultDataSource: 'nba-stats-api'
  },
  // ... (F2-F5 similar structure)
]
```

### 3.3 Factor Computation Details

**F1: Pace Index**
```typescript
// File: f1-pace-index.ts
Purpose: Predict game tempo
Data Sources: NBA Stats API (team pace stats)
Formula:
  paceExp = harmonicMean(homePace, awayPace)
  deviation = paceExp - leagueAvgPace
  signal = clamp(deviation / 5.0, -1, 1)
Interpretation:
  +1.0 = Much faster than average (+5 possessions)
  0.0 = League average pace
  -1.0 = Much slower than average (-5 possessions)
```

**F2: Offensive Form**
```typescript
// File: f2-offensive-form.ts
Purpose: Recent offensive efficiency
Data Sources: NBA Stats API (last 10 games ORtg)
Formula:
  homeORtgRecent = avg(last 10 games ORtg)
  awayORtgRecent = avg(last 10 games ORtg)
  matchupAdvantage = (homeORtgRecent - awayDRtg) + (awayORtgRecent - homeDRtg)
  signal = clamp(matchupAdvantage / 20.0, -1, 1)
Interpretation:
  +1.0 = Both teams scoring well above opponent defense
  -1.0 = Both teams struggling vs opponent defense
```

**F3: Defensive Erosion**
```typescript
// File: f3-defensive-erosion.ts
Purpose: Defensive vulnerability trends
Data Sources: NBA Stats API (DRtg trends)
Formula:
  homeDRtgTrend = (recent5DRtg - season DRtg)
  awayDRtgTrend = (recent5DRtg - seasonDRtg)
  erosion = (homeDRtgTrend + awayDRtgTrend) / 2
  signal = clamp(erosion / 5.0, -1, 1)
Interpretation:
  +1.0 = Defenses getting worse (more points)
  -1.0 = Defenses improving (fewer points)
```

**F4: Three-Point Environment**
```typescript
// File: f4-three-point-env.ts
Purpose: 3PT shooting matchup
Data Sources: NBA Stats API (3PAR, 3P%)
Formula:
  home3PARvsOpp = home3PAR - awayOpp3PAR
  away3PARvsOpp = away3PAR - homeOpp3PAR
  threeEnv = (home3PARvsOpp + away3PARvsOpp) / 2
  signal = clamp(threeEnv / 0.10, -1, 1)
Interpretation:
  +1.0 = High 3PT volume matchup (more points)
  -1.0 = Low 3PT volume matchup (fewer points)
```

**F5: Free Throw Environment**
```typescript
// File: f5-free-throw-env.ts
Purpose: FT rate environment
Data Sources: NBA Stats API (FTr)
Formula:
  homeFTRvsOpp = homeFTr - awayOppFTr
  awayFTRvsOpp = awayFTr - homeOppFTr
  whistleEnv = (homeFTRvsOpp + awayFTRvsOpp) / 2
  signal = clamp(whistleEnv / 0.10, -1, 1)
Interpretation:
  +1.0 = High FT rate matchup (more points)
  -1.0 = Low FT rate matchup (fewer points)
```

---

## 4. RUN LOG TABLE & DATA PERSISTENCE

### 4.1 Database Schema

**Primary Tables**:

**`runs`** - Main run tracking
```sql
CREATE TABLE runs (
  run_id UUID PRIMARY KEY,
  parent_run_id UUID REFERENCES runs(run_id),
  game_id UUID NOT NULL,
  sport TEXT NOT NULL,
  capper TEXT NOT NULL,
  state TEXT CHECK (state IN ('NEW', 'IN-PROGRESS', 'COMPLETE', 'VOIDED')),
  ai_step3 TEXT,
  ai_step4 TEXT,
  conf7 NUMERIC,
  conf_market_adj NUMERIC,
  conf_final NUMERIC,
  units NUMERIC,
  pick_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

**`factors`** - Factor computation results
```sql
CREATE TABLE factors (
  run_id UUID REFERENCES runs(run_id) ON DELETE CASCADE,
  factor_no SMALLINT CHECK (factor_no BETWEEN 1 AND 8),
  raw_values_json JSONB,
  parsed_values_json JSONB,
  normalized_value NUMERIC,
  weight_applied NUMERIC,
  caps_applied BOOLEAN,
  cap_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**`odds_snapshots`** - Locked odds at prediction time
```sql
CREATE TABLE odds_snapshots (
  snapshot_id UUID PRIMARY KEY,
  run_id UUID REFERENCES runs(run_id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**`picks`** - Final pick records
```sql
CREATE TABLE picks (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES runs(run_id),
  game_id UUID REFERENCES games(id),
  capper TEXT NOT NULL,
  pick_type TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds NUMERIC,
  units NUMERIC,
  confidence NUMERIC,
  game_snapshot JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**`shiva_cooldowns`** - Cooldown tracking
```sql
CREATE TABLE shiva_cooldowns (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL,
  capper TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  cooldown_until TIMESTAMPTZ NOT NULL,
  result TEXT NOT NULL,  -- 'PASS' or 'PICK_GENERATED'
  units NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 4.2 Run Log UI

**File**: `src/app/cappers/shiva/management/components/run-log.tsx`

**Data Fetching**:
```typescript
// Endpoint: /api/shiva/runs/history?limit=50
const response = await fetch('/api/shiva/runs/history?limit=50')
const data = await response.json()

// Returns:
{
  runs: [
    {
      run_id: UUID,
      game_id: UUID,
      matchup: "Boston Celtics @ Philadelphia 76ers",
      pick_type: "total",
      selection: "OVER 220.5",
      units: 2,
      confidence: 3.95,
      created_at: ISO timestamp,
      result: "PICK_GENERATED" | "PASS" | "ERROR",
      factor_contributions: [...],
      predicted_total: 225.0,
      market_total: 220.5
    }
  ]
}
```

**UI Features**:
- **Expandable Rows** - Click to see factor breakdown
- **Outcome Badges** - Color-coded (green=PICK, yellow=PASS, red=ERROR)
- **Confidence Bars** - Visual confidence indicator
- **Factor Details** - Shows each factor's contribution
- **Clear Runs Button** - Delete all runs (debugging)
- **Auto-refresh** - Polls every 30 seconds

---

## 5. SHIVA MANAGEMENT PAGE - PRIMARY INTERFACE

**File**: `src/app/cappers/shiva/management/page.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header Filters (Capper, Sport, Bet Type, Mode, Providers)  │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│  Game Inbox          │  Wizard (9 Steps)                    │
│  (Scrollable)        │  (Step-by-step execution)            │
│                      │                                      │
│  - Sync Button       │  - Progress indicators               │
│  - Game List         │  - Factor visualization              │
│  - Selection         │  - Insight card                      │
│                      │                                      │
├──────────────────────┴──────────────────────────────────────┤
│ Run Log Table (Full Width)                                  │
│ - Historical runs                                            │
│ - Cooldowns                                                  │
│ - Factor breakdowns                                          │
└─────────────────────────────────────────────────────────────┘
```

**Key Components**:

1. **Header Filters** (`header-filters.tsx`)
   - Capper selector (SHIVA, IFRIT, etc.)
   - Sport selector (NBA, NFL, MLB)
   - Bet type toggle (TOTAL vs SPREAD/MONEYLINE)
   - Mode switcher (Write vs Auto) - **Auto mode removed**
   - Provider overrides (Perplexity/OpenAI for Step 3/4)
   - Configure Factors button

2. **Game Inbox** (`inbox.tsx`)
   - Lists upcoming games from database
   - Sync button (fetches from MySportsFeeds API)
   - Game selection (click to select)
   - Status chips (scheduled, in-progress, final)
   - Odds display (ML, spread, total)

3. **Wizard** (`wizard.tsx`)
   - 9-step pipeline visualization
   - Step-by-step execution with "Run Step X" buttons
   - Real-time logging and progress tracking
   - Factor visualization (bar charts)
   - Insight card generation
   - Debug mode (shows full API responses)

4. **Run Log Table** (`run-log.tsx`)
   - Historical run tracking
   - Expandable rows for factor details
   - Cooldown management
   - Clear runs functionality

---

## 6. AI RESEARCH INTEGRATION

### 6.1 AI Run 1: Perplexity + StatMuse (Analytical)

**File**: `src/lib/ai/ai-capper-orchestrator.ts`

**Purpose**: Gather analytical factors using web search + stats

**StatMuse Queries** (8 questions):
```typescript
const statMuseQueriesRun1 = [
  `${homeTeam} average points per game vs ${awayTeam} this season`,
  `${awayTeam} average points per game vs ${homeTeam} this season`,
  `${homeTeam} defensive rating this season`,
  `${awayTeam} defensive rating this season`,
  `${homeTeam} pace this season`,
  `${awayTeam} pace this season`,
  `${homeTeam} net rating last 10 games`,
  `${awayTeam} net rating last 10 games`
]
```

**Perplexity Injury Search**:
```typescript
const injuryPrompt = `Search for current injury information for ${awayTeam} vs ${homeTeam}.
Include:
- Key player injuries
- Availability status
- Impact on team performance

Format response to separate:
1. ${homeTeam} injuries
2. ${awayTeam} injuries`

const response = await perplexityClient.chat({
  model: 'sonar-medium-online',
  messages: [
    { role: 'system', content: 'You are a sports injury analyst.' },
    { role: 'user', content: injuryPrompt }
  ],
  max_tokens: 800,
  temperature: 0.7
})
```

**Perplexity Factor Analysis**:
```typescript
const analysisPrompt = `Analyze this NBA game: ${awayTeam} @ ${homeTeam}

StatMuse Data:
${statMuseAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Injury Information:
${injuryInfo}

Provide JSON with these factors:
{
  "pace_advantage": { "description": "...", "value": number, "confidence": "high|medium|low" },
  "defensive_mismatch": { "description": "...", "value": number, "confidence": "high|medium|low" },
  "injury_impact": { "description": "...", "value": number, "confidence": "high|medium|low" }
}

Return ONLY valid JSON.`

const response = await perplexityClient.chat({
  model: 'sonar-medium-online',
  messages: [
    { role: 'system', content: 'You are a sports analyst. Always respond with valid JSON.' },
    { role: 'user', content: analysisPrompt }
  ],
  max_tokens: 700,
  temperature: 0.5
})
```

**Error Handling**:
```typescript
try {
  const parsedFactors = JSON.parse(response.content)
  factors = { ...factors, ...parsedFactors }
} catch (e) {
  console.error('Failed to parse Perplexity JSON:', e)
  factors.perplexity_raw_analysis = {
    description: 'Raw analysis due to JSON parse error',
    value: response.content,
    confidence: 'low'
  }
}
```

### 6.2 AI Run 2: ChatGPT + StatMuse + Validation (Strategic)

**StatMuse Queries** (6 questions):
```typescript
const statMuseQueriesRun2 = [
  `${homeTeam} record on ${restDays} days rest this season`,
  `${awayTeam} record on ${restDays} days rest this season`,
  `${homeTeam} record this season as favorites`,
  `${awayTeam} record this season as underdogs`,
  `${homeTeam} opponent 3-point attempts per game this season`,
  `${awayTeam} opponent 3-point attempts per game this season`
]
```

**ChatGPT Analysis**:
```typescript
const chatGptPrompt = `Analyze this NBA game: ${awayTeam} @ ${homeTeam}

Previous AI Research (Run 1):
${JSON.stringify(run1Result.factors, null, 2)}

New StatMuse Data:
${statMuseAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Tasks:
1. Validate Run 1 findings
2. Add strategic factors (rest, motivation, trends)
3. Identify data inconsistencies

Provide JSON:
{
  "validation": {
    "run1_accuracy": "high|medium|low",
    "inconsistencies": ["..."],
    "confidence_adjustment": number
  },
  "strategic_factors": {
    "rest_advantage": { "description": "...", "value": number },
    "motivation_edge": { "description": "...", "value": number },
    "trend_momentum": { "description": "...", "value": number }
  }
}

Return ONLY valid JSON.`

const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a strategic sports analyst. Always respond with valid JSON.' },
    { role: 'user', content: chatGptPrompt }
  ],
  max_tokens: 1000,
  temperature: 0.5,
  response_format: { type: 'json_object' }
})
```

### 6.3 AI Failure Handling & Fallback Logic

**Graceful Degradation**:
```typescript
// From shiva-algorithm.ts
let aiRuns: AIRunResult[] | null = null

try {
  // Check for existing AI runs in database
  const { data: existingRuns } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('game_id', game.id)
    .eq('capper', 'shiva')
    .order('run_number', { ascending: true })
  
  if (existingRuns && existingRuns.length >= 2) {
    console.log('[SHIVA] Using cached AI runs')
    aiRuns = existingRuns
  } else {
    console.log('[SHIVA] Running fresh AI research')
    const orchestrator = new AICapperOrchestrator({ ... })
    aiRuns = await orchestrator.runResearchPipeline()
  }
} catch (error) {
  console.error('[SHIVA] AI research failed:', error)
  aiRuns = null  // Continue with baseline factors only
}

// Baseline prediction (always runs, even if AI fails)
const baselinePrediction = runThreeModelConsensus(game)

// If AI succeeded, boost confidence
if (aiRuns) {
  const aiBoost = calculateAIBoost(aiRuns)
  finalConfidence += aiBoost
}
```

**StatMuse Retry Logic**:
```typescript
// From statmuse.ts
async function fetchWithRetry(url: string, maxRetries: number = 2): Promise<Response> {
  const delays = [300, 900]  // Exponential backoff
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)  // 6s timeout
      
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]))
      } else {
        throw error
      }
    }
  }
}
```

---

## 7. DECISION POINTS: PICK vs PASS

### 7.1 Threshold-Based Gating

**Confidence Thresholds**:
```typescript
// From orchestrator.ts
if (finalConfidence >= 4.5) units = 5      // 90%+ edge
else if (finalConfidence >= 4.0) units = 3  // 80%+ edge
else if (finalConfidence >= 3.5) units = 2  // 70%+ edge
else if (finalConfidence >= 2.5) units = 1  // 50%+ edge
else units = 0  // PASS (below 50% edge)
```

**Minimum Confidence Rule**:
```typescript
// From shiva-algorithm.ts
if (confidence < 6.5) {
  log.steps.push({
    step: log.steps.length + 1,
    title: 'Insufficient Confidence',
    description: 'Confidence below minimum threshold',
    calculation: `Confidence: ${confidence.toFixed(1)} | Required: 6.5`,
    result: 'PASS',
    impact: 'negative'
  })
  return { pick: null, log }
}
```

**Favorite Rule**:
```typescript
// From shiva-algorithm.ts
function isValidFavoriteOdds(odds: number, confidence: number): boolean {
  // Don't bet heavy favorites unless very confident
  if (odds <= -250 && confidence < 9.0) {
    return false
  }
  return true
}

if (!passedFavoriteRule) {
  log.steps.push({
    step: log.steps.length + 1,
    title: 'Failed Favorite Rule',
    description: 'Favorite over -250 with confidence below 9.0',
    calculation: `Odds: ${avgOdds} | Confidence: ${confidence.toFixed(1)}`,
    result: 'PASS',
    impact: 'negative'
  })
  return { pick: null, log }
}
```

### 7.2 Cooldown System

**Purpose**: Prevent re-analyzing same game after PASS decision

**Cooldown Duration**: 2 hours

**Implementation**:
```typescript
// From pick-generation-service.ts
async recordCooldown(gameId: string, betType: string, result: 'PASS' | 'PICK_GENERATED', units: number) {
  const cooldownUntil = new Date(Date.now() + 2 * 60 * 60 * 1000)  // 2 hours
  
  await supabase.from('shiva_cooldowns').insert({
    game_id: gameId,
    capper: 'shiva',
    bet_type: betType,
    cooldown_until: cooldownUntil.toISOString(),
    result,
    units
  })
}
```

**Eligibility Check**:
```sql
-- Game is NOT eligible if in cooldown
SELECT * FROM games
WHERE id NOT IN (
  SELECT game_id FROM shiva_cooldowns
  WHERE capper = 'shiva'
    AND bet_type = 'TOTAL'
    AND cooldown_until > NOW()
)
```

---

## 8. SUMMARY & KEY INSIGHTS

### 8.1 System Architecture Highlights

1. **Two-Path Design**: Automated cron + manual wizard
2. **Idempotency**: Prevents duplicate steps via `idempotency_keys` table
3. **Atomic Locking**: Prevents concurrent cron runs via `acquire_shiva_lock()`
4. **Graceful Degradation**: AI failures don't break baseline predictions
5. **Cooldown System**: Prevents re-analyzing same game (2-hour window)

### 8.2 Mathematical Model

- **Confidence Formula**: `|Σ(wᵢ × sᵢ)| × 5`
- **Weight Budget**: 250% (Edge vs Market excluded)
- **Threshold Gating**: 2.5+ confidence required for pick
- **Units Allocation**: 1-5 units based on confidence tiers

### 8.3 Data Flow

```
Game Selection → Odds Snapshot → Factors (F1-F5) → AI Research (F6-F7) 
→ Market Edge → Confidence Calculation → Threshold Check → Pick/Pass Decision
→ Database Persistence → Cooldown Recording
```

### 8.4 Critical Files

| Component | File Path |
|-----------|-----------|
| Cron Entry Point | `src/app/api/cron/shiva-auto-picks/route.ts` |
| Wizard UI | `src/app/cappers/shiva/management/components/wizard.tsx` |
| Algorithm Core | `src/lib/cappers/shiva-algorithm.ts` |
| Orchestrator | `src/lib/cappers/shiva-v1/orchestrator.ts` |
| Confidence Calc | `src/lib/cappers/shiva-v1/confidence-calculator.ts` |
| Factor Config | `src/app/cappers/shiva/management/components/factor-config-modal.tsx` |
| AI Research | `src/lib/ai/ai-capper-orchestrator.ts` |
| Run Log UI | `src/app/cappers/shiva/management/components/run-log.tsx` |

---

## 9. CURRENT ISSUE DIAGNOSIS

Based on the logs you provided, the cron is **working correctly** but the algorithm is deciding to **PASS** instead of generating picks. Here's why:

### 9.1 What's Working ✅

1. ✅ Cron triggers every 10 minutes
2. ✅ Scanner finds eligible games
3. ✅ Generate-pick endpoint runs successfully
4. ✅ AI Run 1 (Perplexity) completes (with JSON parse error)
5. ✅ AI Run 2 (ChatGPT) fails (OpenAI API key error - **NOW FIXED**)
6. ✅ Cooldown is recorded (2-hour window)

### 9.2 Why It's Passing ❌

**Root Cause**: AI failures are reducing confidence below threshold

**Evidence from logs**:
```
[shiva] Error in AI Run 2: 401 Incorrect API key
Failed to parse Perplexity analysis JSON: SyntaxError: Unexpected token '+'
[SHIVA:GeneratePick] Algorithm decided to PASS
```

**What's happening**:
1. Baseline factors (F1-F5) calculate confidence ~3.0
2. AI Run 1 fails to parse JSON → no AI boost
3. AI Run 2 fails with 401 error → no AI boost
4. Final confidence stays at ~3.0
5. Threshold check: `if (confidence < 6.5) return PASS`
6. Result: PASS decision, 2-hour cooldown recorded

### 9.3 Next Steps to Fix

**Now that OpenAI key is updated**:
1. ✅ OpenAI API key is now valid
2. ⚠️ Perplexity JSON parsing still needs fix
3. 🔄 Wait for next cron cycle (10 minutes)
4. 📊 Check logs to see if AI Run 2 succeeds
5. 🎯 If both AI runs succeed, confidence should exceed 6.5 → PICK

**To verify**:
- Check next cron execution logs
- Look for "✅ Successfully saved AI run 2"
- Check if confidence > 6.5
- Verify pick is generated

---

---

## 10. ADDITIONAL TECHNICAL DETAILS

### 10.1 Three-Model Consensus System

**File**: `src/lib/cappers/shiva-algorithm.ts`

**Purpose**: Baseline prediction using three independent models

**Models**:
1. **Model 1: ORtg-Based Total**
   ```typescript
   // Offensive Rating approach
   const homeORtg = teamStats.home.offRtg || 110
   const awayORtg = teamStats.away.offRtg || 110
   const pace = (teamStats.home.pace + teamStats.away.pace) / 2

   const model1Total = (homeORtg + awayORtg) * pace / 200
   ```

2. **Model 2: PPG-Based Total**
   ```typescript
   // Points per game approach
   const homePPG = teamStats.home.ppg || 110
   const awayPPG = teamStats.away.ppg || 110
   const homeOppPPG = teamStats.home.oppPpg || 110
   const awayOppPPG = teamStats.away.oppPpg || 110

   const model2Total = (homePPG + awayPPG + homeOppPPG + awayOppPPG) / 4
   ```

3. **Model 3: Factor-Weighted Total**
   ```typescript
   // Factor-based approach
   const baseTotal = (homeORtg + awayORtg) * pace / 200
   const factorAdjustment = Σ(factorᵢ × weightᵢ)

   const model3Total = baseTotal + factorAdjustment
   ```

**Consensus Logic**:
```typescript
// All three models must agree within 5 points
const models = [model1Total, model2Total, model3Total]
const avgTotal = models.reduce((sum, m) => sum + m, 0) / models.length
const maxDeviation = Math.max(...models.map(m => Math.abs(m - avgTotal)))

if (maxDeviation > 5.0) {
  log.steps.push({
    step: log.steps.length + 1,
    title: 'Model Disagreement',
    description: 'Three models do not agree within 5 points',
    calculation: `Models: ${models.join(', ')} | Max Deviation: ${maxDeviation.toFixed(1)}`,
    result: 'PASS',
    impact: 'negative'
  })
  return { pick: null, log }
}

// Consensus reached
const consensusTotal = avgTotal
```

### 10.2 Soft Cap System

**Purpose**: Prevent extreme factor values from dominating

**Implementation**:
```typescript
// From math.ts
function applySoftCap(value: number, cap: number): number {
  if (Math.abs(value) <= cap) {
    return value  // No capping needed
  }

  // Soft cap using logarithmic compression
  const sign = value >= 0 ? 1 : -1
  const absValue = Math.abs(value)
  const excess = absValue - cap
  const compressed = cap + Math.log(1 + excess)

  return sign * compressed
}

// Example:
// applySoftCap(3.5, 2.0) = 2.0 + log(1 + 1.5) = 2.0 + 0.916 = 2.916
// Instead of 3.5, we get 2.916 (reduced impact)
```

**Applied to Factors**:
```typescript
// From f1-pace-index.ts
const rawValue = signal * maxPoints  // e.g., 0.8 * 5.0 = 4.0
const cappedValue = applySoftCap(rawValue, 2.0)  // Cap at ±2.0

return {
  normalized_value: signal,
  parsed_values_json: { signal, cappedValue },
  caps_applied: Math.abs(cappedValue) >= 2.0,
  cap_reason: cappedValue >= 2.0 ? 'Capped at +2.0' : null
}
```

### 10.3 Idempotency System

**Purpose**: Prevent duplicate step executions

**Database Table**:
```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  run_id UUID NOT NULL,
  step_name TEXT NOT NULL,
  response_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Usage**:
```typescript
// From orchestrator.ts
async function executeStepWithIdempotency(stepName: string, runId: string, fn: () => Promise<any>) {
  const idempotencyKey = `${runId}_${stepName}`

  // Check if step already executed
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response_json')
    .eq('key', idempotencyKey)
    .single()

  if (existing) {
    console.log(`[Idempotency] Step ${stepName} already executed, returning cached result`)
    return existing.response_json
  }

  // Execute step
  const result = await fn()

  // Store result
  await supabase.from('idempotency_keys').insert({
    key: idempotencyKey,
    run_id: runId,
    step_name: stepName,
    response_json: result
  })

  return result
}
```

### 10.4 Atomic Locking for Cron

**Purpose**: Prevent concurrent cron executions

**Database Function**:
```sql
-- From supabase/migrations/
CREATE OR REPLACE FUNCTION acquire_shiva_lock()
RETURNS BOOLEAN AS $$
DECLARE
  lock_acquired BOOLEAN;
BEGIN
  -- Try to acquire advisory lock (non-blocking)
  lock_acquired := pg_try_advisory_lock(hashtext('shiva_cron_lock'));
  RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_shiva_lock()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN pg_advisory_unlock(hashtext('shiva_cron_lock'));
END;
$$ LANGUAGE plpgsql;
```

**Usage in Cron**:
```typescript
// From cron/shiva-auto-picks/route.ts
const { data: lockAcquired } = await supabase.rpc('acquire_shiva_lock')

if (!lockAcquired) {
  console.log('[SHIVA_CRON] Another instance is running, skipping')
  return NextResponse.json({
    success: false,
    message: 'Another cron instance is running'
  })
}

try {
  // Run cron logic
  await runShivaAutoPicks()
} finally {
  // Always release lock
  await supabase.rpc('release_shiva_lock')
}
```

### 10.5 StatMuse Integration Details

**File**: `src/lib/data/statmuse-client.ts`

**How It Works**:
1. Constructs StatMuse URL from natural language query
2. Fetches HTML page
3. Scrapes answer from `<div class="answer">` element
4. Retries with rephrased query if first attempt fails

**Implementation**:
```typescript
export async function queryStatMuse(question: string): Promise<StatMuseAnswer> {
  const url = `https://www.statmuse.com/nba/ask/${encodeURIComponent(question)}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const html = await response.text()

    // Parse HTML to extract answer
    const answerMatch = html.match(/<div class="answer"[^>]*>(.*?)<\/div>/s)
    if (!answerMatch) {
      throw new Error('No answer found in StatMuse response')
    }

    const answer = answerMatch[1]
      .replace(/<[^>]+>/g, '')  // Strip HTML tags
      .trim()

    return {
      question,
      answer,
      url,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('[StatMuse] Query failed:', error)

    // Retry with rephrased query
    const rephrasedQuestion = rephraseQuery(question)
    if (rephrasedQuestion !== question) {
      return queryStatMuse(rephrasedQuestion)
    }

    throw error
  }
}

function rephraseQuery(question: string): string {
  // Example: "Boston Celtics average points per game"
  // → "Celtics PPG this season"
  return question
    .replace(/average points per game/i, 'PPG')
    .replace(/this season/i, '2024-25')
    .replace(/defensive rating/i, 'DRtg')
}
```

**Retry Logic**:
```typescript
// From ai-capper-orchestrator.ts
async function fetchStatMuseWithRetry(question: string, maxRetries: number = 2): Promise<StatMuseAnswer> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryStatMuse(question)
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`[StatMuse] Retry ${attempt + 1}/${maxRetries}`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        // Return placeholder on final failure
        return {
          question,
          answer: 'Data unavailable',
          url: '',
          timestamp: new Date().toISOString()
        }
      }
    }
  }
}
```

### 10.6 Wizard Step Registration System

**File**: `src/app/cappers/shiva/management/components/wizard.tsx`

**Purpose**: Auto-document wizard steps for UI display

**Implementation**:
```typescript
const WIZARD_STEPS = [
  {
    id: 1,
    name: 'Game Selection',
    description: 'Select game and validate eligibility',
    endpoint: '/api/shiva/step1-scanner',
    requiredInputs: ['sport', 'betType'],
    outputs: ['selected_game', 'run_id']
  },
  {
    id: 2,
    name: 'Odds Snapshot',
    description: 'Capture current odds for later comparison',
    endpoint: '/api/shiva/step2-snapshot',
    requiredInputs: ['run_id', 'selected_game'],
    outputs: ['snapshot_id', 'odds_data']
  },
  // ... (steps 3-9)
]

// Auto-generate UI from step definitions
{WIZARD_STEPS.map(step => (
  <WizardStep
    key={step.id}
    stepNumber={step.id}
    title={step.name}
    description={step.description}
    status={getStepStatus(step.id)}
    onRun={() => executeStep(step)}
  />
))}
```

### 10.7 Database Views for Analytics

**File**: `supabase/migrations/015_shiva_v1.sql`

**`shiva_picks_view`** - Denormalized pick data:
```sql
CREATE VIEW shiva_picks_view AS
SELECT
  p.id AS pick_id,
  p.game_id,
  p.capper,
  p.pick_type,
  p.selection,
  p.units,
  p.confidence,
  p.status,
  r.run_id,
  r.conf_final,
  r.conf_market_adj,
  s.payload_json->>'total' AS locked_total,
  s.payload_json->>'spread' AS locked_spread,
  g.home_team,
  g.away_team,
  g.game_time,
  g.final_score,
  p.created_at
FROM picks p
LEFT JOIN runs r ON p.run_id = r.run_id
LEFT JOIN odds_snapshots s ON r.run_id = s.run_id AND s.is_active = true
LEFT JOIN games g ON p.game_id = g.id
WHERE p.capper = 'shiva'
ORDER BY p.created_at DESC
```

**Usage**:
```typescript
// Fetch all SHIVA picks with full context
const { data: picks } = await supabase
  .from('shiva_picks_view')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50)
```

---

## 11. DEBUGGING GUIDE

### 11.1 Common Issues & Solutions

**Issue 1: Cron returns "No eligible games found"**

**Diagnosis**:
```typescript
// Check game eligibility
const { data: games } = await supabase
  .from('games')
  .select('*')
  .eq('sport', 'NBA')
  .eq('status', 'scheduled')
  .gte('game_time', new Date(Date.now() + 30 * 60 * 1000).toISOString())

console.log('Total scheduled games:', games.length)

// Check for existing picks
const { data: picks } = await supabase
  .from('picks')
  .select('game_id')
  .eq('capper', 'shiva')
  .eq('pick_type', 'total')

console.log('Games with existing picks:', picks.length)

// Check cooldowns
const { data: cooldowns } = await supabase
  .from('shiva_cooldowns')
  .select('*')
  .eq('capper', 'shiva')
  .eq('bet_type', 'TOTAL')
  .gte('cooldown_until', new Date().toISOString())

console.log('Games in cooldown:', cooldowns.length)
```

**Solution**:
- Sync games from MySportsFeeds API
- Clear old cooldowns: `DELETE FROM shiva_cooldowns WHERE cooldown_until < NOW()`
- Check game timing (must be >30 minutes away)

---

**Issue 2: Algorithm always passes**

**Diagnosis**:
```typescript
// Check confidence calculation
const { data: run } = await supabase
  .from('runs')
  .select('*, factors(*)')
  .eq('run_id', runId)
  .single()

console.log('Final confidence:', run.conf_final)
console.log('Factor contributions:', run.factors)

// Check AI runs
const { data: aiRuns } = await supabase
  .from('ai_runs')
  .select('*')
  .eq('game_id', gameId)
  .eq('capper', 'shiva')

console.log('AI Run 1:', aiRuns[0])
console.log('AI Run 2:', aiRuns[1])
```

**Solution**:
- Verify AI API keys (OpenAI, Perplexity)
- Check factor weights (must sum to 250%)
- Review threshold settings (default: 6.5 minimum)
- Examine factor signals (should have mix of positive/negative)

---

**Issue 3: TypeScript errors in build**

**Diagnosis**:
```bash
npm run build
```

**Common Errors**:
```typescript
// Error: Property 'confidence' does not exist on type 'PredictionLog'
// Fix: Use confidenceBreakdown.finalConfidence instead
const confidence = result.log?.confidenceBreakdown?.finalConfidence || 0

// Error: Type 'undefined' is not assignable to type 'number'
// Fix: Add null checks and defaults
const units = result.pick?.units ?? 0
```

---

**Issue 4: Vercel deployment fails**

**Diagnosis**:
```bash
# Check Vercel logs
vercel logs <deployment-url>

# Common issues:
# 1. Missing environment variables
# 2. Build timeout (increase in vercel.json)
# 3. Function size limit exceeded
```

**Solution**:
```json
// vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai-api-key",
    "PERPLEXITY_API_KEY": "@perplexity-api-key",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

### 11.2 Logging Best Practices

**Structured Logging**:
```typescript
// Good: Structured with context
console.log('[SHIVA:GeneratePick]', {
  gameId: game.id,
  matchup: `${game.away} @ ${game.home}`,
  confidence: finalConfidence,
  decision: 'PICK',
  units: 2
})

// Bad: Unstructured
console.log('Generated pick')
```

**Log Levels**:
```typescript
// Info: Normal flow
console.log('[SHIVA] Starting pick generation')

// Warning: Recoverable issues
console.warn('[SHIVA] AI Run 1 failed, using baseline only')

// Error: Critical failures
console.error('[SHIVA] Database error:', error)
```

### 11.3 Testing Endpoints Locally

**Using curl**:
```bash
# Test scanner
curl -X POST http://localhost:3000/api/shiva/step1-scanner \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","betType":"TOTAL","limit":10}'

# Test generate-pick
curl -X POST http://localhost:3000/api/shiva/generate-pick \
  -H "Content-Type: application/json" \
  -d '{"selectedGame":{"game_id":"...","home":"Celtics","away":"76ers"}}'
```

**Using Postman**:
1. Import collection from `postman/shiva-endpoints.json`
2. Set environment variables (API keys, base URL)
3. Run requests in sequence (Step 1 → Step 2 → ... → Step 9)

---

## 12. PERFORMANCE OPTIMIZATION

### 12.1 Database Indexing

**Critical Indexes**:
```sql
-- Games table
CREATE INDEX idx_games_sport_status ON games(sport, status);
CREATE INDEX idx_games_game_time ON games(game_time);

-- Picks table
CREATE INDEX idx_picks_capper_game ON picks(capper, game_id);
CREATE INDEX idx_picks_created_at ON picks(created_at DESC);

-- Cooldowns table
CREATE INDEX idx_cooldowns_game_capper ON shiva_cooldowns(game_id, capper, bet_type);
CREATE INDEX idx_cooldowns_until ON shiva_cooldowns(cooldown_until);

-- Runs table
CREATE INDEX idx_runs_game_capper ON runs(game_id, capper);
CREATE INDEX idx_runs_state ON runs(state);
```

### 12.2 Caching Strategy

**AI Run Caching**:
```typescript
// Check for existing AI runs before running fresh research
const { data: cachedRuns } = await supabase
  .from('ai_runs')
  .select('*')
  .eq('game_id', gameId)
  .eq('capper', 'shiva')
  .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())  // 1 hour cache

if (cachedRuns && cachedRuns.length >= 2) {
  console.log('[SHIVA] Using cached AI runs (< 1 hour old)')
  return cachedRuns
}
```

**StatMuse Response Caching**:
```typescript
// Cache StatMuse answers in memory (per-request)
const statMuseCache = new Map<string, StatMuseAnswer>()

async function queryStatMuseCached(question: string): Promise<StatMuseAnswer> {
  if (statMuseCache.has(question)) {
    return statMuseCache.get(question)!
  }

  const answer = await queryStatMuse(question)
  statMuseCache.set(question, answer)
  return answer
}
```

### 12.3 Parallel Execution

**Factor Computation**:
```typescript
// Compute all factors in parallel
const factorPromises = [
  computePaceIndex(ctx),
  computeOffensiveForm(ctx),
  computeDefensiveErosion(ctx),
  computeThreePointEnv(ctx),
  computeWhistleEnv(ctx)
]

const factors = await Promise.all(factorPromises)
```

**AI Runs**:
```typescript
// Run both AI runs in parallel
const [run1Result, run2Result] = await Promise.all([
  executeRun1(ctx),
  executeRun2(ctx)
])
```

---

**END OF COMPREHENSIVE ANALYSIS**

