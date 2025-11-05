# SHIVA Pick Generation System - Technical Context

## Overview
SHIVA is an automated sports betting AI system for NBA games that generates picks for TOTALS (over/under) and SPREAD (point spread) bets. The system uses a 7-step wizard pipeline with factor-based analysis and confidence scoring.

---

## 🔴 HIGH PRIORITY: Core System Architecture

### 1. Pick Generation Pipeline (7-Step Wizard)

The wizard pipeline is the heart of SHIVA. Both manual UI picks and automated cron jobs use **IDENTICAL** logic:

**Step 1: Game Selection**
- Scanner (`/api/shiva/step1-scanner`) fetches upcoming NBA games
- Filters out games with existing picks or active cooldowns
- Checks game start time (must be >5 minutes away)
- Returns eligible games for processing

**Step 2: Odds Snapshot**
- Captures current odds from MySportsFeeds API
- Locks in spread line, total line, moneyline odds
- Stores snapshot in `game_snapshot` JSONB field
- Critical for grading picks later

**Step 3: Factor Analysis**
- **TOTALS (F1-F5)**: Pace Index, Offensive Form, Defensive Erosion, Three-Point Environment, Free-Throw Environment
- **SPREAD (S1-S5)**: Net Rating, Turnover Differential, Shooting Efficiency, Pace Advantage, Four Factors
- Each factor returns a score (-10 to +10) and weighted contribution
- Calculates `baseline_avg` (sum of team PPG for TOTALS, 0 for SPREAD)

**Step 4: Score Predictions**
- **TOTALS**: `predictedTotal = baseline_avg + (edgeRaw * 2.0)` (clamped 180-280)
- **SPREAD**: `predictedMargin = edgeRaw * 1.5`, then split into home/away scores
- **CRITICAL**: `total_pred_points` should be NULL for SPREAD picks (bug fixed in commit 72c3e43)
- Calculates confidence score (0-10 scale)

**Step 5: Market Edge Adjustment**
- Compares predicted value vs market line
- Applies 1.2x multiplier for market edge
- Final confidence = base confidence + market edge adjustment
- Determines pick direction (OVER/UNDER for TOTALS, team for SPREAD)

**Step 6: Bold Player Predictions**
- AI-powered player prop predictions (SKIPPED for cron jobs)
- Only used in manual wizard UI

**Step 7: Pick Finalization**
- Determines units based on confidence thresholds:
  - 9.0+ → 5 units
  - 8.0-9.0 → 4 units
  - 7.0-8.0 → 3 units
  - 6.0-7.0 → 2 units
  - 5.0-6.0 → 1 unit
  - <5.0 → PASS (no pick)
- Returns PICK or PASS decision

### 2. Bet Types: TOTAL vs SPREAD

| Aspect | TOTAL (Over/Under) | SPREAD (Point Spread) |
|--------|-------------------|----------------------|
| **Factors** | F1-F5 (Pace, Offense, Defense, 3PT, FT) | S1-S5 (Net Rating, Turnovers, Shooting, Pace, Four Factors) |
| **Prediction** | Total points scored (e.g., 225.5) | Point margin (e.g., -5.5) |
| **baseline_avg** | Sum of team PPG (e.g., 220) | 0 (no inherent advantage) |
| **predicted_total** | Calculated value | **NULL** (CRITICAL!) |
| **market_total** | Total line from odds | **NULL** for SPREAD |
| **Selection** | "OVER 225.5" or "UNDER 225.5" | "Dallas Mavericks -5.5" |

**CRITICAL BUG FIXED (Commit 72c3e43)**: SPREAD picks were showing `predicted_total=220` and `baseline_avg=220` in the run log. These values should be NULL for SPREAD picks.

### 3. Cooldown System & Duplicate Prevention

**Purpose**: Prevent generating multiple picks for the same game/bet_type combination.

**Database Table**: `pick_generation_cooldowns`
```sql
CREATE TABLE pick_generation_cooldowns (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  capper TEXT,
  bet_type TEXT, -- 'total' or 'spread' (lowercase!)
  result TEXT, -- 'PICK_GENERATED' or 'PASS'
  units DECIMAL,
  confidence_score DECIMAL,
  reason TEXT,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  UNIQUE(game_id, capper, bet_type)
)
```

**Cooldown Rules**:
- **PICK_GENERATED**: Permanent cooldown (until 2099-12-31) - never generate another pick for this game/bet_type
- **PASS**: 2-hour temporary cooldown - can retry after 2 hours if conditions change

**RPC Function**: `can_generate_pick(game_id, capper, bet_type, cooldown_hours)`
- Returns TRUE if no active cooldown exists
- Returns FALSE if cooldown is active

**CRITICAL BUG FIXED (Commit 72c3e43)**: Race condition where multiple cron jobs generated duplicate picks simultaneously.

**Root Cause**:
1. Scanner filters games with existing picks/cooldowns
2. Scanner calls `/api/shiva/generate-pick` endpoint
3. Endpoint runs wizard pipeline (takes 30-60 seconds)
4. Endpoint saves pick to database
5. Endpoint creates cooldown record
6. **BUG**: Next cron job (8 minutes later) runs scanner BEFORE cooldown is created → generates duplicate pick

**Solution**:
Added duplicate check at the **START** of `/api/shiva/generate-pick` endpoint:
```typescript
// Check for existing picks BEFORE running wizard
const { data: existingPicks } = await supabase
  .from('picks')
  .select('id, pick_type, status, selection')
  .eq('game_id', game.id)
  .eq('capper', 'shiva')
  .eq('pick_type', betTypeLower)
  .in('status', ['pending', 'won', 'lost', 'push'])

if (existingPicks && existingPicks.length > 0) {
  return NextResponse.json({
    success: false,
    decision: 'DUPLICATE',
    message: `Game already has ${betType} pick: ${existingPicks[0].selection}`,
    existing_pick_id: existingPicks[0].id
  }, { status: 409 }) // 409 Conflict
}

// Check for active cooldowns BEFORE running wizard
const { data: cooldownData } = await supabase
  .from('pick_generation_cooldowns')
  .select('cooldown_until, result, reason')
  .eq('game_id', game.id)
  .eq('capper', 'shiva')
  .eq('bet_type', betTypeLower)
  .gt('cooldown_until', nowIso)
  .single()

if (cooldownData) {
  return NextResponse.json({
    success: false,
    decision: 'COOLDOWN',
    message: `Game is in cooldown until ${cooldownData.cooldown_until}`,
    cooldown_until: cooldownData.cooldown_until,
    reason: cooldownData.reason
  }, { status: 429 }) // 429 Too Many Requests
}
```

### 4. Database Schema

**`games` table**:
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY,
  sport TEXT,
  league TEXT,
  home_team JSONB, -- { id, name, abbreviation }
  away_team JSONB,
  game_date DATE,
  game_time TIME,
  game_start_timestamp TIMESTAMPTZ, -- CRITICAL: Full UTC timestamp
  status TEXT, -- 'Scheduled', 'InProgress', 'Final'
  odds JSONB, -- Raw odds data
  total_line DECIMAL,
  spread_line DECIMAL,
  home_ml INTEGER,
  away_ml INTEGER
)
```

**`runs` table** (stores ALL wizard runs, including PASS decisions):
```sql
CREATE TABLE runs (
  id UUID PRIMARY KEY,
  run_id TEXT UNIQUE, -- 'shiva_1762331062449_7b4tvj'
  game_id UUID REFERENCES games(id),
  capper TEXT,
  bet_type TEXT, -- 'TOTAL' or 'SPREAD'
  units DECIMAL,
  confidence DECIMAL,
  pick_type TEXT,
  selection TEXT,
  factor_contributions JSONB, -- Array of factor objects
  predicted_total DECIMAL, -- NULL for SPREAD
  baseline_avg DECIMAL, -- NULL for SPREAD
  market_total DECIMAL, -- NULL for SPREAD
  predicted_home_score DECIMAL,
  predicted_away_score DECIMAL,
  bold_predictions JSONB,
  metadata JSONB, -- Legacy field for backwards compatibility
  state TEXT, -- 'COMPLETE', 'ERROR'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**`picks` table** (stores only PICK_GENERATED decisions):
```sql
CREATE TABLE picks (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  run_id TEXT REFERENCES runs(run_id), -- Links to wizard run
  capper TEXT,
  pick_type TEXT, -- 'total', 'spread', 'moneyline'
  selection TEXT, -- 'OVER 225.5', 'Dallas Mavericks -5.5'
  odds INTEGER,
  units DECIMAL,
  confidence DECIMAL,
  game_snapshot JSONB, -- Locked odds at time of pick
  status TEXT, -- 'pending', 'won', 'lost', 'push', 'voided'
  result JSONB, -- Grading details
  net_units DECIMAL, -- Units won/lost
  is_system_pick BOOLEAN,
  reasoning TEXT,
  algorithm_version TEXT,
  insight_card_snapshot JSONB, -- Locked at insert via trigger
  insight_card_locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ
)
```

**Trigger**: `lock_insight_card_on_pick_insert()`
- Automatically creates insight card snapshot when pick is inserted
- Locks matchup, factors, predictions at time of pick
- **BUG FIXED (Commit 8d98d91)**: COALESCE type mismatch (DATE vs JSONB)
- **Solution**: Cast both to TEXT: `COALESCE(game_record.game_date::TEXT, (NEW.game_snapshot->>'game_date'))`

### 5. Recent Critical Bugs Fixed

**Bug #1: Duplicate SPREAD Picks (Commit 72c3e43)**
- **Symptom**: 8 identical Dallas Mavericks -5.5 picks generated 8 minutes apart
- **Root Cause**: Race condition - no duplicate check in generate-pick endpoint
- **Fix**: Added duplicate/cooldown checks at START of endpoint (before wizard runs)
- **Status**: ✅ FIXED

**Bug #2: COALESCE Type Mismatch (Commit 8d98d91)**
- **Symptom**: PostgreSQL error when saving picks: "COALESCE types date and jsonb cannot be matched"
- **Root Cause**: Trigger tried to COALESCE DATE and JSONB types
- **Fix**: Cast both to TEXT before COALESCE
- **Status**: ✅ FIXED

**Bug #3: Incorrect Proj/Avg Values for SPREAD (Commit 72c3e43)**
- **Symptom**: SPREAD picks showing `Proj: 220.0` and `Avg: 220.0` (should be NULL)
- **Root Cause**: Wizard set `total_pred_points=220` for SPREAD picks
- **Fix**: Set `total_pred_points=null` for SPREAD in wizard orchestrator
- **Fix**: Conditional extraction of TOTALS-only fields in pick/generate endpoint
- **Status**: ✅ FIXED

---

## 🟡 MEDIUM PRIORITY: API Endpoints & UI

### API Endpoints

**`/api/shiva/step1-scanner` (GET)**
- Scans for eligible games
- Filters by bet type, existing picks, cooldowns
- Returns list of games ready for processing

**`/api/shiva/generate-pick` (POST)**
- Main entry point for cron jobs
- Runs full 7-step wizard pipeline
- Saves pick to database if confidence > 5.0
- Creates cooldown record
- **NEW**: Duplicate/cooldown checks at START

**`/api/shiva/pick/generate` (POST)**
- Legacy endpoint for saving picks from manual wizard
- Handles both PICK and PASS decisions
- Inserts into `runs` table first, then `picks` table (respects FK constraint)

**`/api/shiva/runs/history` (GET)**
- Returns run log with filters
- Query params: `limit`, `betType` ('TOTAL' or 'SPREAD')
- Joins runs with cooldowns to show PASS/PICK status

### Professional Dashboard

**Design System**: Bloomberg Terminal aesthetic
- **Colors**: Slate-based (`slate-950`, `slate-900`, `slate-800`)
- **Typography**: Compact (`text-[10px]`, `text-[11px]`, `text-xs`)
- **Information Density**: Maximize data visible without scrolling

**Components**:
- **Active Picks**: 12 picks with game status badges (LIVE, FINAL, SCHEDULED)
- **Performance Trend Graph**: Cumulative units over time (Recharts LineChart)
- **Top Cappers Leaderboard**: Win rate, units, ROI
- **Pick History**: 20 recent picks with full details (matchup, type, result, units)

---

## 🟢 LOW PRIORITY: Deployment & Styling

### Vercel Deployment
- Auto-deploys on push to `main` branch
- Build command: `npm run build`
- Recent build errors fixed (syntax errors in dashboard components)

### UI Refinements
- Game status indicators with color coding
- Compact spacing and professional typography
- Gradient fills on performance chart
- Clickable pick cards that open insight modals

