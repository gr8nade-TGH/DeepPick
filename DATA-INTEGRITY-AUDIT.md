# 🔍 DATA INTEGRITY AUDIT - DeepPick

## 🚨 CRITICAL ISSUES TO ADDRESS

You're absolutely right - data accuracy is THE foundation of this app. Let me audit every data flow point.

---

## 1️⃣ **GAME START TIME VALIDATION** 

### Current Issues:
❌ **Cappers can make picks AFTER game starts**
- No validation in algorithm endpoints
- `game_snapshot` stores time, but not checked before pick creation

### What Needs to Happen:
```typescript
// In each capper algorithm (nexus, shiva, cerberus, ifrit, deeppick)
const gameStartTime = new Date(`${game.game_date}T${game.game_time}`)
const now = new Date()

if (gameStartTime <= now) {
  log.push('⏰ SKIP: Game already started')
  continue // Skip this game
}

// Also check: Is game starting in next 15 minutes? (buffer time)
const minutesUntilStart = (gameStartTime.getTime() - now.getTime()) / (1000 * 60)
if (minutesUntilStart < 15) {
  log.push('⏰ SKIP: Game starting too soon (< 15 min)')
  continue
}
```

### Where to Fix:
- `src/lib/cappers/nexus-algorithm.ts`
- `src/lib/cappers/shiva-algorithm.ts`
- `src/lib/cappers/cerberus-algorithm.ts`
- `src/lib/cappers/ifrit-algorithm.ts`
- `src/lib/cappers/deeppick-algorithm.ts`

---

## 2️⃣ **GAME STATUS LIFECYCLE**

### Current Issues:
❌ **Game status not reliably updated**
- Status set once during ingestion
- No automated status updates (scheduled → live → final)
- Games stuck in "scheduled" even after completion

### What Should Happen:

```
GAME LIFECYCLE:
1. scheduled → Game created, not started yet
2. live → Game is currently in progress (NOW)
3. final → Game completed, scores available
4. archived → Moved to games_history (5 hours after final)
```

### Required Logic:

**In `/api/simple-ingest`:**
```typescript
const now = new Date()
const gameTime = new Date(`${event.commence_time}`)
const hoursElapsed = (now.getTime() - gameTime.getTime()) / (1000 * 60 * 60)

let status: 'scheduled' | 'live' | 'final'
if (now < gameTime) {
  status = 'scheduled'
} else if (hoursElapsed < 4) { // Assume game lasts ~3-4 hours
  status = 'live'
} else {
  status = 'final' // Should trigger score fetch
}
```

**Problem**: This is a GUESS. We need actual game status from API.

### The Odds API Game Status:
- Check if `completed: true` in API response
- If completed, immediately fetch scores

---

## 3️⃣ **SCORE FETCHING & PICK GRADING**

### Current Issues:
❌ **Scores fetched every 15 minutes for ALL games**
- Wasteful for scheduled games
- Should only fetch for live/final games

❌ **Pick grading logic may be incomplete**
- Need to verify spread/total calculations are correct

### What Should Happen:

**Score Fetch Logic:**
```typescript
// Only fetch scores for games that are:
// 1. Status = 'live' OR 'final'
// 2. Game time was in the past
// 3. Scores not yet recorded

const gamesToFetchScores = await supabase
  .from('games')
  .select('*')
  .in('status', ['live', 'final'])
  .is('home_score', null) // No score yet
  .lt('game_date', todayDate)
```

**Pick Grading Validation:**
```typescript
// For SPREAD picks (e.g., "LAL -5.5")
const [team, spreadStr] = pick.split(' ')
const spread = parseFloat(spreadStr)
const actualMargin = homeScore - awayScore

if (team === homeTeam) {
  // Betting on home team
  const covered = actualMargin > Math.abs(spread)
  result = covered ? 'won' : 'lost'
} else {
  // Betting on away team
  const covered = actualMargin < -Math.abs(spread)
  result = covered ? 'won' : 'lost'
}

// PUSH logic: If margin exactly equals spread
if (Math.abs(actualMargin) === Math.abs(spread)) {
  result = 'push'
}
```

---

## 4️⃣ **MATCHUP IDENTIFICATION**

### Current Issues:
✅ **FIXED** - Was comparing wrong games (odds swings)
✅ **FIXED** - Now using team names for matching
⚠️ **POTENTIAL ISSUE** - Team name variations

### Remaining Risk:
The Odds API might return:
- "Los Angeles Lakers" vs "LA Lakers"
- "New York Giants" vs "NY Giants"

### Solution:
Use **API Event ID** as primary key, not team names.

**In `/api/simple-ingest`:**
```typescript
// Store the API's unique event ID
const apiEventId = event.id

// Check if game exists by API event ID (not team names)
const { data: existingGame } = await supabase
  .from('games')
  .select('*')
  .eq('api_event_id', apiEventId)
  .single()
```

**Required Database Change:**
```sql
ALTER TABLE games ADD COLUMN api_event_id TEXT UNIQUE;
CREATE INDEX idx_games_api_event_id ON games(api_event_id);
```

---

## 5️⃣ **ODDS DATA ACCURACY**

### Current Issues:
✅ **FIXED** - Was only processing 5 games per sport
✅ **FIXED** - Now processes all events
⚠️ **POTENTIAL ISSUE** - Bookmaker data inconsistency

### What to Validate:

**Bookmaker Presence:**
```typescript
// Log which bookmakers returned data
const bookmakers = event.bookmakers.map(b => b.key)
console.log(`Game ${event.id}: ${bookmakers.length} bookmakers - ${bookmakers.join(', ')}`)

// Alert if < 2 bookmakers (data quality issue)
if (bookmakers.length < 2) {
  warnings.push('Low bookmaker count - odds may be unreliable')
}
```

**Odds Sanity Checks:**
```typescript
// Validate odds are in reasonable ranges
const moneyline = market.outcomes.find(o => o.name === homeTeam)?.price
if (moneyline && (moneyline < -2000 || moneyline > 2000)) {
  warnings.push('Extreme moneyline odds - possible data error')
}

// Validate spread is reasonable
if (spread && Math.abs(spread) > 30) {
  warnings.push('Extreme spread - possible data error')
}
```

---

## 6️⃣ **TIMEZONE HANDLING**

### Current Issues:
❌ **CRITICAL** - Game times from API are in UTC
❌ **No timezone conversion** - Displayed times may be wrong

### The Odds API Returns:
```json
{
  "commence_time": "2025-10-20T00:04:00Z" // UTC time
}
```

### What We Store:
```typescript
game_date: "2025-10-20"
game_time: "00:04:00" // This is UTC, not local!
```

### The Problem:
- User sees "12:04 AM" but game actually starts at 8:04 PM EST
- Cappers might make picks thinking game is 12 hours away, but it's actually started

### Solution:
```typescript
// Convert UTC to user's timezone (or a standard timezone like EST)
const utcTime = new Date(event.commence_time)
const estTime = new Date(utcTime.toLocaleString('en-US', { timeZone: 'America/New_York' }))

game_date: estTime.toISOString().split('T')[0]
game_time: estTime.toTimeString().split(' ')[0]
```

**OR** store as full timestamp:
```sql
ALTER TABLE games 
  DROP COLUMN game_date,
  DROP COLUMN game_time,
  ADD COLUMN game_start_timestamp TIMESTAMP WITH TIME ZONE;
```

---

## 7️⃣ **DUPLICATE PREVENTION**

### Current Issues:
✅ **Implemented** - Duplicate checker exists
⚠️ **Not fully tested** - May allow duplicates if line changes

### Test Cases Needed:
```typescript
// Scenario 1: Same game, same bet type, different line
// Pick 1: "HOU -3" at 2:00 PM
// Pick 2: "HOU -4" at 2:30 PM (line moved)
// Expected: BLOCKED (duplicate)

// Scenario 2: Same game, different bet types
// Pick 1: "HOU -3" (spread)
// Pick 2: "Over 45.5" (total)
// Expected: ALLOWED (different bet types)

// Scenario 3: Same team, different games
// Pick 1: "LAL -5" vs GSW on Oct 20
// Pick 2: "LAL -3" vs PHX on Oct 22
// Expected: ALLOWED (different games)
```

### Validation:
Check `src/lib/cappers/duplicate-checker.ts` logic

---

## 8️⃣ **PICK SNAPSHOT DATA**

### Current Issues:
⚠️ **game_snapshot may be stale**
- Snapshot taken at pick creation time
- If game data updates, snapshot is outdated

### What's Stored:
```typescript
game_snapshot: {
  sport: 'nfl',
  home_team: { name: 'Chiefs', abbreviation: 'KC' },
  away_team: { name: 'Broncos', abbreviation: 'DEN' },
  game_date: '2025-10-20',
  game_time: '13:00:00',
  current_odds: { ... }
}
```

### Risk:
- Game time changes (common in MLB due to weather)
- Snapshot shows old time
- Pick appears valid but game already started

### Solution:
**Always validate against live game data:**
```typescript
// When displaying picks, fetch current game data
const currentGame = await supabase
  .from('games')
  .select('game_date, game_time, status')
  .eq('id', pick.game_id)
  .single()

// Compare snapshot vs current
if (currentGame.game_date !== pick.game_snapshot.game_date) {
  // Game time changed!
  alert('Game time has changed since pick was made')
}
```

---

## 9️⃣ **API EVENT ID STABILITY**

### Current Issues:
❌ **No API event ID stored**
- We match games by team names
- If team name changes slightly, we create duplicate game

### The Odds API Provides:
```json
{
  "id": "abc123def456", // Unique event ID
  "home_team": "Los Angeles Lakers",
  "away_team": "Golden State Warriors"
}
```

### Critical Fix Needed:
```sql
-- Add api_event_id column
ALTER TABLE games ADD COLUMN api_event_id TEXT UNIQUE;
CREATE INDEX idx_games_api_event_id ON games(api_event_id);

-- Update simple-ingest to use this for matching
```

---

## 🔟 **ARCHIVE LOGIC**

### Current Issues:
❌ **Archive cron may be too aggressive**
- Debug report showed "games disappearing"
- May be archiving games too soon

### Current Logic:
```typescript
// Archive games that are:
// - Status = 'final'
// - Completed > 5 hours ago
```

### Risk:
- Game marked 'final' prematurely
- Archived before scores fetched
- Picks can't be graded

### Solution:
```typescript
// Only archive if:
// 1. Status = 'final'
// 2. Scores are recorded (home_score IS NOT NULL)
// 3. All picks for this game are graded
// 4. Game completed > 24 hours ago (safer buffer)

const safeToArchive = 
  game.status === 'final' &&
  game.home_score !== null &&
  allPicksGraded &&
  hoursElapsed > 24
```

---

## 📋 **PRIORITY FIX LIST**

### 🔴 CRITICAL (Fix Immediately)
1. **Timezone handling** - Game times are wrong
2. **API Event ID** - Prevents duplicate games
3. **Start time validation** - Block picks after game starts

### 🟡 HIGH PRIORITY (Fix This Week)
4. **Game status lifecycle** - Automated scheduled → live → final
5. **Score fetch optimization** - Only fetch for live/final games
6. **Archive safety** - Don't archive until picks graded

### 🟢 MEDIUM PRIORITY (Fix Next Week)
7. **Odds sanity checks** - Validate extreme values
8. **Bookmaker presence alerts** - Warn if < 2 bookmakers
9. **Duplicate prevention testing** - Verify all scenarios

---

## 🛠️ **IMPLEMENTATION PLAN**

### Phase 1: Database Schema Fixes (30 min)
```sql
-- Run in Supabase SQL Editor
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS api_event_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS game_start_timestamp TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_games_api_event_id ON games(api_event_id);
CREATE INDEX IF NOT EXISTS idx_games_start_timestamp ON games(game_start_timestamp);
```

### Phase 2: simple-ingest Updates (1 hour)
- Store `api_event_id` from API
- Convert UTC times to EST
- Match games by `api_event_id` not team names
- Add odds sanity checks
- Improve status determination logic

### Phase 3: Capper Algorithm Guards (1 hour)
- Add start time validation to all 5 cappers
- Add 15-minute buffer before game start
- Log skip reasons clearly

### Phase 4: Score Fetch Optimization (30 min)
- Only fetch for games with status 'live' or 'final'
- Only fetch if scores not already recorded
- Add retry logic for failed fetches

### Phase 5: Archive Safety (30 min)
- Check all picks graded before archiving
- Increase buffer to 24 hours
- Add logging for archived games

---

## 🧪 **TESTING CHECKLIST**

After fixes, validate:
- [ ] Game times display correctly in user's timezone
- [ ] Cappers cannot make picks on started games
- [ ] Game status updates automatically (scheduled → live → final)
- [ ] Scores fetch only for live/final games
- [ ] Picks grade correctly (spread, total, moneyline)
- [ ] No duplicate games created
- [ ] No duplicate picks allowed (same game, same bet type)
- [ ] Games only archived after picks graded
- [ ] Extreme odds values flagged in debug report
- [ ] Low bookmaker count warnings appear

---

## 📊 **MONITORING ADDITIONS**

Add to debug report:
```
🕐 TIMEZONE VALIDATION
──────────────────────────────────────────────────────────
Current Server Time: 2025-10-18 16:30:00 UTC
Displayed as EST: 2025-10-18 12:30:00 EST
Next game start: 2025-10-20 01:00:00 EST (35.5 hours from now)
✓ Timezone conversion working

🎮 GAME STATUS ACCURACY
──────────────────────────────────────────────────────────
Scheduled: 30 games
Live: 2 games (started < 4 hours ago)
Final: 3 games (completed, scores recorded)
⚠️ 1 game marked 'live' but started > 5 hours ago (check status logic)

🎯 PICK TIMING VALIDATION
──────────────────────────────────────────────────────────
Total Picks: 25
✓ All picks made before game start
⚠️ 2 picks made < 15 min before start (risky)
```

---

This is a comprehensive audit. Let's start with the CRITICAL fixes first!

