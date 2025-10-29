# 🎯 MySportsFeeds Migration - Action Plan

## Current State

```
┌─────────────────────────────────────────────────────────────┐
│                    SHIVA PICK GENERATION                     │
│                         (BROKEN)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Step 1: Game  │
                    │    Selection    │ ✅ WORKS
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Step 2: Odds  │
                    │    Snapshot     │ ⚠️  PARTIAL
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Step 3: Factor │
                    │    Analysis     │ ❌ FAILS
                    └─────────────────┘
                              │
                              ▼
                    fetchNBAStatsBundle()
                              │
                              ▼
                    throw new Error(
                      'Not yet implemented'
                    )
```

---

## Root Cause Analysis

### **The Odds API → MySportsFeeds Migration**

| Component | The Odds API | MySportsFeeds | Status |
|-----------|--------------|---------------|--------|
| **Odds Data** | ✅ Working | ⚠️ Partial | Needs format conversion |
| **Game Schedules** | ✅ Working | ⚠️ Partial | Team names broken |
| **Team Stats** | ❌ Removed | ❌ Not implemented | **CRITICAL** |
| **Historical Scores** | ✅ Working | ❌ Not implemented | Needed for stats |

### **What Broke**

1. **Old System** (The Odds API):
   ```
   The Odds API → Game Scores → Calculate Stats → Factors
   ```

2. **New System** (MySportsFeeds):
   ```
   MySportsFeeds → ??? → ??? → Factors
                    ↑
                  MISSING
   ```

3. **The Gap**:
   - MySportsFeeds has the data we need
   - But we haven't written the code to fetch it
   - `fetchNBAStatsBundle()` just throws an error

---

## 🚀 Fix Plan (3 Phases)

### **Phase 1: Emergency Fix (1-2 hours)**
**Goal**: Get picks generating again (even if not perfect)

#### Task 1.1: Implement Basic Stats Fetcher
**File**: `src/lib/cappers/shiva-v1/factors/data-fetcher.ts`

```typescript
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  try {
    // Use MySportsFeeds team stats
    const awayStats = await getTeamFormData(ctx.away, 10)
    const homeStats = await getTeamFormData(ctx.home, 10)
    
    return {
      awayPaceSeason: awayStats.pace,
      awayPaceLast10: awayStats.pace,
      homePaceSeason: homeStats.pace,
      homePaceLast10: homeStats.pace,
      awayORtgLast10: awayStats.ortg,
      homeORtgLast10: homeStats.ortg,
      awayDRtgSeason: awayStats.drtg,
      homeDRtgSeason: homeStats.drtg,
      // ... rest of stats
    }
  } catch (error) {
    console.error('[DATA_FETCHER] Error:', error)
    return getDefaultBundle() // Fallback to league averages
  }
}
```

**Acceptance Criteria**:
- [ ] Step 3 completes without throwing error
- [ ] Factors show non-default values
- [ ] Picks generate with varying confidence

---

#### Task 1.2: Fix MySportsFeeds Stats Endpoint
**File**: `src/lib/data-sources/mysportsfeeds-stats.ts`

**Current Issue**:
```typescript
// Line 62 - WRONG ENDPOINT
const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/team_stats_totals.json?team=${teamAbbrev}`
```

**Fix**:
```typescript
// Use game logs instead
const url = `${MYSPORTSFEEDS_BASE_URL}/2024-2025-regular/team_gamelogs.json?team=${teamAbbrev}&limit=${n}`
```

**Acceptance Criteria**:
- [ ] `/api-test` page shows real team stats
- [ ] Pace, ORtg, DRtg values are realistic
- [ ] No 401/403 errors

---

#### Task 1.3: Add Team Name Mapping
**File**: `src/lib/data-sources/team-mappings.ts` (NEW)

```typescript
export const NBA_TEAMS: Record<string, { full: string; abbrev: string }> = {
  'BOS': { full: 'Boston Celtics', abbrev: 'BOS' },
  'LAL': { full: 'Los Angeles Lakers', abbrev: 'LAL' },
  'GSW': { full: 'Golden State Warriors', abbrev: 'GSW' },
  // ... all 30 teams
}

export function resolveTeamName(input: string): { full: string; abbrev: string } {
  // Try abbreviation lookup
  if (NBA_TEAMS[input]) return NBA_TEAMS[input]
  
  // Try full name lookup
  const entry = Object.values(NBA_TEAMS).find(t => t.full === input)
  if (entry) return entry
  
  // Fallback
  return { full: input, abbrev: input.substring(0, 3).toUpperCase() }
}
```

**Update**: `src/app/api/sync/mysportsfeeds-games/route.ts`
```typescript
import { resolveTeamName } from '@/lib/data-sources/team-mappings'

// Line 108
const homeTeamData = resolveTeamName(homeTeam)
const awayTeamData = resolveTeamName(awayTeam)

home_team: { name: homeTeamData.full, abbreviation: homeTeamData.abbrev },
away_team: { name: awayTeamData.full, abbreviation: awayTeamData.abbrev },
```

**Acceptance Criteria**:
- [ ] Games show full team names in inbox
- [ ] Factor analysis works with abbreviations
- [ ] No "undefined" team names

---

### **Phase 2: Quality Improvements (2-4 hours)**
**Goal**: Make picks reliable and accurate

#### Task 2.1: Implement Opponent Stats
**Challenge**: Need opponent defensive stats for accurate predictions

**Solution**:
```typescript
async function getOpponentStats(teamAbbrev: string, opponentAbbrev: string, n: number) {
  // Fetch opponent's game logs
  const opponentLogs = await fetchTeamGameLogs(opponentAbbrev, n)
  
  // Filter for games against this team
  const h2hGames = opponentLogs.filter(game => 
    game.opponent === teamAbbrev
  )
  
  // Calculate opponent's defensive stats
  return {
    opp3PAR: calculateAverage(h2hGames, 'threePA') / calculateAverage(h2hGames, 'FGA'),
    oppFTr: calculateAverage(h2hGames, 'FTA') / calculateAverage(h2hGames, 'FGA'),
    oppDRtg: calculateDRtg(h2hGames)
  }
}
```

---

#### Task 2.2: Add Caching Layer
**Problem**: MySportsFeeds API has rate limits

**Solution**:
```typescript
// src/lib/data-sources/mysportsfeeds-cache.ts
const cache = new Map<string, { data: any; expires: number }>()

export async function fetchWithCache(
  key: string, 
  fetcher: () => Promise<any>,
  ttlMinutes: number = 15
) {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    console.log('[CACHE:HIT]', key)
    return cached.data
  }
  
  console.log('[CACHE:MISS]', key)
  const data = await fetcher()
  cache.set(key, { data, expires: Date.now() + ttlMinutes * 60 * 1000 })
  return data
}
```

---

#### Task 2.3: Fix Odds Parsing
**File**: `src/app/api/sync/mysportsfeeds-games/route.ts`

**Current Issue**: Odds structure doesn't match expected format

**Fix**:
```typescript
// Helper function to convert decimal to American odds
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100)
  } else {
    return Math.round(-100 / (decimal - 1))
  }
}

// Extract odds correctly
if (lines.totals && lines.totals.length > 0) {
  const fullTotal = lines.totals.find((t: any) => 
    t.total?.gameSegment === 'FULL'
  )
  
  if (fullTotal) {
    oddsData.total = {
      line: fullTotal.total.totalValue,
      over: decimalToAmerican(fullTotal.total.overLine.decimal),
      under: decimalToAmerican(fullTotal.total.underLine.decimal)
    }
  }
}
```

---

### **Phase 3: Production Hardening (4-8 hours)**
**Goal**: Make system robust and maintainable

#### Task 3.1: Comprehensive Error Handling
```typescript
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  const errors: string[] = []
  
  try {
    const awayStats = await getTeamFormData(ctx.away, 10)
      .catch(err => {
        errors.push(`Away stats failed: ${err.message}`)
        return getDefaultTeamStats()
      })
    
    const homeStats = await getTeamFormData(ctx.home, 10)
      .catch(err => {
        errors.push(`Home stats failed: ${err.message}`)
        return getDefaultTeamStats()
      })
    
    if (errors.length > 0) {
      console.warn('[DATA_FETCHER:PARTIAL_FAILURE]', errors)
      // Log to monitoring system
      await logToSupabase('data_fetcher_errors', { errors, ctx })
    }
    
    return buildBundle(awayStats, homeStats)
  } catch (error) {
    console.error('[DATA_FETCHER:CRITICAL_FAILURE]', error)
    // Alert admin
    await sendAlert('SHIVA data fetcher failed', error)
    return getDefaultBundle()
  }
}
```

---

#### Task 3.2: Add Monitoring & Alerts
```typescript
// Track API health
export async function trackAPIHealth() {
  const health = {
    mysportsfeeds_odds: await testEndpoint('/odds_gamelines.json'),
    mysportsfeeds_stats: await testEndpoint('/team_gamelogs.json'),
    mysportsfeeds_scores: await testEndpoint('/scoreboard.json')
  }
  
  // Store in database
  await supabase.from('api_health').insert({
    service: 'mysportsfeeds',
    endpoints: health,
    timestamp: new Date().toISOString()
  })
  
  // Alert if any endpoint is down
  const failures = Object.entries(health).filter(([_, status]) => !status)
  if (failures.length > 0) {
    await sendAlert('MySportsFeeds endpoints down', failures)
  }
}
```

---

#### Task 3.3: Build Adapter Pattern
**Goal**: Abstract MySportsFeeds so we can swap providers later

```typescript
// src/lib/data-sources/stats-provider.ts
export interface StatsProvider {
  getTeamStats(team: string, games: number): Promise<TeamStats>
  getGameOdds(date: string): Promise<GameOdds[]>
  getGameScores(date: string): Promise<GameScore[]>
}

// src/lib/data-sources/mysportsfeeds-provider.ts
export class MySportsFeedsProvider implements StatsProvider {
  async getTeamStats(team: string, games: number): Promise<TeamStats> {
    // MySportsFeeds-specific implementation
  }
  
  async getGameOdds(date: string): Promise<GameOdds[]> {
    // MySportsFeeds-specific implementation
  }
}

// Usage
const provider: StatsProvider = new MySportsFeedsProvider()
const stats = await provider.getTeamStats('BOS', 10)
```

---

## 📊 Success Metrics

### Phase 1 (Emergency Fix)
- [ ] 0 errors in Step 3 execution
- [ ] >0% picks generated (currently 0%)
- [ ] Confidence scores vary (not all same)

### Phase 2 (Quality)
- [ ] Picks match manual analysis >70% of time
- [ ] API response time <2 seconds
- [ ] Cache hit rate >50%

### Phase 3 (Production)
- [ ] 99% uptime for pick generation
- [ ] <1% error rate
- [ ] Automated alerts working
- [ ] Full audit trail in database

---

## 🎯 Immediate Next Steps

1. **Right Now** (5 minutes):
   - [ ] Check if `MYSPORTSFEEDS_API_KEY` is set
   - [ ] Test `/api/test/mysportsfeeds` endpoint
   - [ ] Check browser console for errors

2. **Next 30 Minutes**:
   - [ ] Implement basic `fetchNBAStatsBundle()`
   - [ ] Test Step 3 execution
   - [ ] Verify factors show real values

3. **Next 2 Hours**:
   - [ ] Fix MySportsFeeds stats endpoint
   - [ ] Add team name mapping
   - [ ] Test full pick generation

4. **This Week**:
   - [ ] Implement opponent stats
   - [ ] Add caching layer
   - [ ] Fix odds parsing
   - [ ] Add error handling

---

## 🆘 If You Get Stuck

### Error: "fetchNBAStatsBundle is being refactored"
**Fix**: Implement the function (see Phase 1, Task 1.1)

### Error: "MySportsFeeds API returned 401"
**Fix**: Check API key in environment variables

### Error: "No games found in inbox"
**Fix**: Run game sync, check team name mapping

### Error: "Step 3 returns all default values"
**Fix**: MySportsFeeds stats endpoint is wrong

### Error: "Picks all have same confidence"
**Fix**: Stats bundle is using defaults, not real data

---

## 📞 Support Resources

- **MySportsFeeds Docs**: https://www.mysportsfeeds.com/data-feeds/api-docs/
- **API Status**: https://status.mysportsfeeds.com/
- **Supabase Logs**: https://supabase.com/dashboard/project/YOUR_PROJECT/logs
- **Vercel Logs**: https://vercel.com/YOUR_PROJECT/logs


