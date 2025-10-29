# 🔱 SHIVA Capper Management System - Deep Dive

## Overview

The **SHIVA Capper Management Page** is a sophisticated UI for manually controlling and debugging the SHIVA pick generation algorithm. It provides a step-by-step wizard interface to walk through the entire prediction pipeline, from game selection to final pick generation.

**Location**: `/cappers/shiva/management`

---

## 🏗️ Architecture

### Core Components

1. **Header Filters** (`header-filters.tsx`)
   - Capper selection (SHIVA, IFRIT, etc.)
   - Sport selection (NBA, NFL, MLB)
   - Bet type toggle (TOTAL vs SPREAD/MONEYLINE)
   - Mode switcher (Write vs Auto)
   - Provider overrides for AI models

2. **Game Inbox** (`inbox.tsx`)
   - Lists available games from database
   - Shows game status, odds, and timing
   - Allows manual game selection
   - Sync button to fetch fresh games from MySportsFeeds

3. **Pick Generator Wizard** (`wizard.tsx`)
   - 9-step pipeline visualization
   - Step-by-step execution with progress tracking
   - Real-time factor analysis display
   - Insight card generation

4. **Run Log Table** (`run-log.tsx`)
   - Historical run tracking
   - Performance metrics
   - Success/failure status

---

## 🎯 Pick Generation Pipeline (9 Steps)

### **Step 1: Game Selection**
- **API**: `/api/shiva/step1-scanner`
- **Purpose**: Find eligible games for prediction
- **Logic**:
  - Filters games by status (scheduled)
  - Checks timing (>30min before start)
  - Verifies no existing picks for this bet type
  - Returns first eligible game or uses manually selected game

### **Step 2: Odds Snapshot**
- **API**: `/api/shiva/odds/snapshot`
- **Purpose**: Lock in current market odds
- **Data Captured**:
  - Moneyline (home/away averages)
  - Spread (favorite team, line, odds)
  - Total (line, over/under odds)
  - Books considered (count)
  - Raw payload for audit trail

### **Step 3: Factor Analysis**
- **API**: `/api/shiva/factors/step3`
- **Purpose**: Compute 6 NBA totals factors
- **Factors** (for NBA TOTAL bets):
  1. **Pace Index** - Game tempo prediction
  2. **Offensive Form** - Recent scoring efficiency
  3. **Defensive Erosion** - Defensive rating trends
  4. **3-Point Environment** - Shooting variance
  5. **Whistle Environment** - Free throw rate
  6. **Injury/Availability** - Player impact (AI-powered)

- **Data Sources**:
  - MySportsFeeds API (team stats, game logs)
  - Perplexity AI (injury research)
  - StatMuse (advanced metrics)

### **Step 4: Score Predictions**
- **API**: `/api/shiva/factors/step4`
- **Purpose**: Generate predicted final scores
- **Method**:
  - Uses factor signals to calculate delta-100
  - Predicts pace, ORtg, DRtg
  - Calculates total points and spread
  - Outputs confidence score (0-10 scale)

### **Step 5: Market Edge Analysis**
- **API**: `/api/shiva/factors/step5`
- **Purpose**: Compare prediction to Vegas line
- **Calculation**:
  - Edge = Predicted Total - Market Total
  - Confidence adjustment based on edge size
  - Unit allocation (0-5 units)
  - Decision: PASS if confidence < 2.5

### **Step 6: Bold Player Predictions**
- **API**: `/api/shiva/pick/generate` (Step 6 body)
- **Purpose**: Generate player prop predictions
- **Status**: Currently placeholder/future feature

### **Step 7: Pick Finalization**
- **API**: `/api/shiva/pick/generate`
- **Purpose**: Write final pick to database
- **Data Written**:
  - Pick selection (e.g., "OVER 225.5")
  - Units (1-5)
  - Confidence score
  - Locked odds snapshot
  - Reasoning array
  - Run ID for traceability

### **Step 8: Insight Card**
- **API**: `/api/shiva/insight-card`
- **Purpose**: Generate shareable pick card
- **Contents**:
  - Game matchup
  - Pick recommendation
  - Key factors visualization
  - Confidence breakdown
  - AI research summary

### **Step 9: Debug Report**
- **Purpose**: Full pipeline audit trail
- **Contents**:
  - All step responses
  - Factor raw values
  - API call timings
  - Error logs

---

## 🔄 MySportsFeeds Migration Issues

### **What Changed**

Previously used **The Odds API** for:
- Live odds data
- Game schedules
- Historical scores

Now using **MySportsFeeds** for:
- ✅ Odds data (`odds_gamelines.json`)
- ✅ Team statistics (`team_gamelogs.json`)
- ✅ Game scores (`scoreboard.json`)
- ✅ Box scores (`game_boxscore.json`)

### **Current Problems**

#### 1. **Game Data Format Mismatch**
**Issue**: MySportsFeeds returns different data structure than The Odds API

**The Odds API Format**:
```json
{
  "id": "abc123",
  "home_team": "Los Angeles Lakers",
  "away_team": "Golden State Warriors",
  "commence_time": "2025-01-29T02:00:00Z"
}
```

**MySportsFeeds Format**:
```json
{
  "game": {
    "id": 12345,
    "homeTeamAbbreviation": "LAL",
    "awayTeamAbbreviation": "GSW",
    "startTime": "2025-01-29T02:00:00.000Z"
  }
}
```

**Impact**: 
- Game IDs are now prefixed with `msf_` in database
- Team names are abbreviations instead of full names
- Existing code expects full team names

#### 2. **Odds Structure Different**
**The Odds API**:
```json
{
  "bookmakers": [
    {
      "key": "draftkings",
      "markets": [
        {
          "key": "totals",
          "outcomes": [
            { "name": "Over", "price": -110, "point": 225.5 }
          ]
        }
      ]
    }
  ]
}
```

**MySportsFeeds**:
```json
{
  "lines": [
    {
      "totals": [
        {
          "total": {
            "gameSegment": "FULL",
            "overLine": { "decimal": 1.91 },
            "underLine": { "decimal": 1.91 },
            "totalValue": 225.5
          }
        }
      ]
    }
  ]
}
```

**Impact**:
- Odds format conversion needed (decimal vs American)
- Different path to access total line
- Multiple game segments (FULL, HALF, QUARTER)

#### 3. **Missing Team Name Resolution**
**Problem**: MySportsFeeds uses abbreviations (BOS, LAL), but SHIVA expects full names

**Current Code** (`sync/mysportsfeeds-games/route.ts`):
```typescript
home_team: { name: homeTeam, abbreviation: homeTeam }
// homeTeam is "LAL", but should be "Los Angeles Lakers"
```

**Needed**: Team abbreviation → full name mapping

#### 4. **API Authentication Issues**
**MySportsFeeds v2.0** uses Basic Auth:
```typescript
const credentials = `${API_KEY}:MYSPORTSFEEDS`
const encoded = Buffer.from(credentials).toString('base64')
headers['Authorization'] = `Basic ${encoded}`
```

**Common Errors**:
- 401 Unauthorized (wrong API key format)
- 403 Forbidden (subscription tier limits)
- Empty responses (wrong endpoint URL)

#### 5. **Season Format Confusion**
**MySportsFeeds** requires specific season format:
- ✅ Correct: `2024-2025-regular`
- ❌ Wrong: `2024-25`
- ❌ Wrong: `2024-2025`

**Current Code**:
```typescript
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.0/pull/nba/2024-2025-regular'
```

---

## 🐛 Specific Errors You're Likely Seeing

### Error 1: "No games found in inbox"
**Cause**: MySportsFeeds sync failing or returning empty data

**Debug Steps**:
1. Check `/api/test/mysportsfeeds` endpoint
2. Verify `MYSPORTSFEEDS_API_KEY` in environment
3. Check console for API errors
4. Verify date format (YYYYMMDD)

### Error 2: "Step 3 failed - No stats data"
**Cause**: Team stats fetching broken

**Root Issue**: 
```typescript
// In mysportsfeeds-stats.ts
const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/team_stats_totals.json?team=${teamAbbrev}`
```
This endpoint might not exist or require different parameters

### Error 3: "Odds snapshot missing total_line"
**Cause**: Odds parsing logic expects The Odds API format

**Fix Needed**: Update odds extraction in `sync/mysportsfeeds-games/route.ts`

### Error 4: "Factor computation failed"
**Cause**: NBA stats bundle incomplete

**Chain Reaction**:
1. MySportsFeeds stats fetch fails
2. `fetchNBAStatsBundle()` returns defaults
3. Factors compute with league averages
4. Confidence score is unreliable
5. Pick generation passes or generates weak picks

---

## 🔧 How to Fix

### Priority 1: Team Name Mapping
Create `src/lib/data-sources/team-mappings.ts`:
```typescript
export const NBA_TEAM_MAP: Record<string, { full: string; abbrev: string; city: string }> = {
  'LAL': { full: 'Los Angeles Lakers', abbrev: 'LAL', city: 'Los Angeles' },
  'GSW': { full: 'Golden State Warriors', abbrev: 'GSW', city: 'Golden State' },
  // ... all 30 teams
}

export function getFullTeamName(abbrev: string): string {
  return NBA_TEAM_MAP[abbrev]?.full || abbrev
}
```

### Priority 2: Fix Odds Parsing
Update `sync/mysportsfeeds-games/route.ts`:
```typescript
// Extract total line correctly
if (lines.totals && lines.totals.length > 0) {
  const fullTotal = lines.totals.find((t: any) => t.total?.gameSegment === 'FULL')
  if (fullTotal) {
    oddsData.total = {
      line: fullTotal.total.totalValue,
      over: convertDecimalToAmerican(fullTotal.total.overLine.decimal),
      under: convertDecimalToAmerican(fullTotal.total.underLine.decimal)
    }
  }
}
```

### Priority 3: Fix Stats Fetching
The current endpoint might be wrong. Try:
```typescript
// Option 1: Use seasonal stats
const url = `${MYSPORTSFEEDS_BASE_URL}/2024-2025-regular/team_stats_totals.json?team=${teamAbbrev}`

// Option 2: Use game logs
const url = `${MYSPORTSFEEDS_BASE_URL}/2024-2025-regular/player_gamelogs.json?team=${teamAbbrev}&limit=5`
```

### Priority 4: Add Error Handling
Wrap all MySportsFeeds calls:
```typescript
try {
  const data = await fetchOddsGameLines(dateStr)
  if (!data || !data.gameLines) {
    throw new Error('Invalid response structure')
  }
} catch (error) {
  console.error('[MySportsFeeds] Error:', error)
  // Fallback to cached data or return empty
  return { gameLines: [] }
}
```

---

## 📊 Data Flow Diagram

```
User Selects Game
       ↓
Step 1: Scanner finds eligible game
       ↓
Step 2: Snapshot current odds → Supabase (shiva_odds_snapshots)
       ↓
Step 3: Fetch team stats from MySportsFeeds
       ↓  ↓  ↓
    F1-F5: NBA Stats (Pace, ORtg, DRtg, 3P%, FTr)
    F6: AI Research (Perplexity → Injuries)
       ↓
Step 4: Calculate predictions (total, spread, scores)
       ↓
Step 5: Compare to market → Edge calculation
       ↓
Step 7: Write pick to database (if units > 0)
       ↓
Step 8: Generate insight card
```

---

## 🎮 Testing Workflow

1. **Test MySportsFeeds Connection**
   - Visit `/api-test` page
   - Click "Test MySportsFeeds API"
   - Should see games with odds

2. **Sync Games to Database**
   - Go to `/cappers/shiva/management`
   - Click "Sync Games" button in inbox
   - Check console for errors

3. **Run Single Pick**
   - Select a game from inbox
   - Click "Run" button in header
   - Watch wizard steps execute
   - Check for failures in step responses

4. **Check Database**
   - Verify games table has `msf_` prefixed IDs
   - Check odds structure in `odds` column
   - Verify picks table has new entries

---

## 🚨 Common Gotchas

1. **Dry Run Mode**: If `NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED !== 'true'`, picks won't save
2. **Idempotency**: Same run_id won't re-execute (by design)
3. **Cooldowns**: Can't generate pick for same game/capper/bet_type within 2 hours
4. **Time Validation**: Games must start >30 minutes in future
5. **Factor Weights**: Must sum to 1.0 in profile configuration

---

## 📝 Next Steps

1. **Immediate**: Fix team name mapping
2. **Short-term**: Validate MySportsFeeds odds parsing
3. **Medium-term**: Add comprehensive error handling
4. **Long-term**: Build MySportsFeeds adapter layer to abstract API differences


