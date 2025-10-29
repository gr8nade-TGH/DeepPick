# ⚡ Quick Fix Guide - Get SHIVA Working in 30 Minutes

## 🎯 Goal
Get SHIVA generating picks again by implementing the missing data fetcher.

---

## ✅ Step 1: Verify MySportsFeeds API Key (2 minutes)

### Check Environment Variable
```bash
# In your terminal
cat .env.local | grep MYSPORTSFEEDS
```

**Expected Output**:
```
MYSPORTSFEEDS_API_KEY=your-api-key-here
```

**If missing**: Add to `.env.local`:
```
MYSPORTSFEEDS_API_KEY=your-actual-api-key
```

### Test API Connection
```bash
# Visit in browser
http://localhost:3000/api/test/mysportsfeeds
```

**Expected**: JSON response with `"success": true`

**If error**: Check API key, check MySportsFeeds subscription status

---

## ✅ Step 2: Create Team Name Mapping (5 minutes)

### Create New File
**Path**: `src/lib/data-sources/team-mappings.ts`

```typescript
export const NBA_TEAMS: Record<string, { full: string; abbrev: string; city: string }> = {
  'ATL': { full: 'Atlanta Hawks', abbrev: 'ATL', city: 'Atlanta' },
  'BOS': { full: 'Boston Celtics', abbrev: 'BOS', city: 'Boston' },
  'BKN': { full: 'Brooklyn Nets', abbrev: 'BKN', city: 'Brooklyn' },
  'CHA': { full: 'Charlotte Hornets', abbrev: 'CHA', city: 'Charlotte' },
  'CHI': { full: 'Chicago Bulls', abbrev: 'CHI', city: 'Chicago' },
  'CLE': { full: 'Cleveland Cavaliers', abbrev: 'CLE', city: 'Cleveland' },
  'DAL': { full: 'Dallas Mavericks', abbrev: 'DAL', city: 'Dallas' },
  'DEN': { full: 'Denver Nuggets', abbrev: 'DEN', city: 'Denver' },
  'DET': { full: 'Detroit Pistons', abbrev: 'DET', city: 'Detroit' },
  'GSW': { full: 'Golden State Warriors', abbrev: 'GSW', city: 'Golden State' },
  'HOU': { full: 'Houston Rockets', abbrev: 'HOU', city: 'Houston' },
  'IND': { full: 'Indiana Pacers', abbrev: 'IND', city: 'Indiana' },
  'LAC': { full: 'Los Angeles Clippers', abbrev: 'LAC', city: 'Los Angeles' },
  'LAL': { full: 'Los Angeles Lakers', abbrev: 'LAL', city: 'Los Angeles' },
  'MEM': { full: 'Memphis Grizzlies', abbrev: 'MEM', city: 'Memphis' },
  'MIA': { full: 'Miami Heat', abbrev: 'MIA', city: 'Miami' },
  'MIL': { full: 'Milwaukee Bucks', abbrev: 'MIL', city: 'Milwaukee' },
  'MIN': { full: 'Minnesota Timberwolves', abbrev: 'MIN', city: 'Minnesota' },
  'NOP': { full: 'New Orleans Pelicans', abbrev: 'NOP', city: 'New Orleans' },
  'NYK': { full: 'New York Knicks', abbrev: 'NYK', city: 'New York' },
  'OKC': { full: 'Oklahoma City Thunder', abbrev: 'OKC', city: 'Oklahoma City' },
  'ORL': { full: 'Orlando Magic', abbrev: 'ORL', city: 'Orlando' },
  'PHI': { full: 'Philadelphia 76ers', abbrev: 'PHI', city: 'Philadelphia' },
  'PHX': { full: 'Phoenix Suns', abbrev: 'PHX', city: 'Phoenix' },
  'POR': { full: 'Portland Trail Blazers', abbrev: 'POR', city: 'Portland' },
  'SAC': { full: 'Sacramento Kings', abbrev: 'SAC', city: 'Sacramento' },
  'SAS': { full: 'San Antonio Spurs', abbrev: 'SAS', city: 'San Antonio' },
  'TOR': { full: 'Toronto Raptors', abbrev: 'TOR', city: 'Toronto' },
  'UTA': { full: 'Utah Jazz', abbrev: 'UTA', city: 'Utah' },
  'WAS': { full: 'Washington Wizards', abbrev: 'WAS', city: 'Washington' }
}

export function resolveTeamName(input: string): { full: string; abbrev: string } {
  // Try abbreviation lookup
  const upper = input.toUpperCase()
  if (NBA_TEAMS[upper]) {
    return { full: NBA_TEAMS[upper].full, abbrev: NBA_TEAMS[upper].abbrev }
  }
  
  // Try full name lookup
  const entry = Object.values(NBA_TEAMS).find(t => 
    t.full.toLowerCase() === input.toLowerCase()
  )
  if (entry) {
    return { full: entry.full, abbrev: entry.abbrev }
  }
  
  // Fallback
  console.warn(`[TEAM_MAPPING] Unknown team: ${input}`)
  return { full: input, abbrev: input.substring(0, 3).toUpperCase() }
}

export function getTeamAbbrev(input: string): string {
  return resolveTeamName(input).abbrev
}

export function getTeamFullName(input: string): string {
  return resolveTeamName(input).full
}
```

---

## ✅ Step 3: Fix MySportsFeeds Stats Endpoint (3 minutes)

### Edit File
**Path**: `src/lib/data-sources/mysportsfeeds-stats.ts`

**Find** (around line 62):
```typescript
const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/team_stats_totals.json?team=${teamAbbrev}`
```

**Replace with**:
```typescript
// Use 2024-2025 season game logs
const season = '2024-2025-regular'
const url = `${MYSPORTSFEEDS_BASE_URL.replace('2024-2025-regular', season)}/team_gamelogs.json?team=${teamAbbrev}&limit=${n}`
```

**Or simpler**:
```typescript
const url = `https://api.mysportsfeeds.com/v2.1/pull/nba/2024-2025-regular/team_gamelogs.json?team=${teamAbbrev}&limit=${n}`
```

---

## ✅ Step 4: Implement Data Fetcher (15 minutes)

### Edit File
**Path**: `src/lib/cappers/shiva-v1/factors/data-fetcher.ts`

**Replace entire file with**:

```typescript
/**
 * NBA Totals Data Fetcher
 * Uses MySportsFeeds API to fetch team statistics
 */

import { searchInjuries } from '../news'
import { RunCtx, NBAStatsBundle, InjuryImpact } from './types'
import { getTeamFormData } from '@/lib/data-sources/mysportsfeeds-stats'

/**
 * Fetch all required data for NBA totals factor computation
 */
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  console.log('[DATA_FETCHER:START]', { away: ctx.away, home: ctx.home })
  
  try {
    // Fetch last 10 games for recent form
    const [awayRecent, homeRecent] = await Promise.all([
      getTeamFormData(ctx.away, 10).catch(err => {
        console.error(`[DATA_FETCHER] Error fetching ${ctx.away} recent:`, err)
        return null
      }),
      getTeamFormData(ctx.home, 10).catch(err => {
        console.error(`[DATA_FETCHER] Error fetching ${ctx.home} recent:`, err)
        return null
      })
    ])
    
    // Fetch season stats (use 30 games as proxy for season)
    const [awaySeason, homeSeason] = await Promise.all([
      getTeamFormData(ctx.away, 30).catch(err => {
        console.error(`[DATA_FETCHER] Error fetching ${ctx.away} season:`, err)
        return null
      }),
      getTeamFormData(ctx.home, 30).catch(err => {
        console.error(`[DATA_FETCHER] Error fetching ${ctx.home} season:`, err)
        return null
      })
    ])
    
    // Use defaults if any fetch failed
    const awayRecentData = awayRecent || getDefaultTeamStats()
    const homeRecentData = homeRecent || getDefaultTeamStats()
    const awaySeasonData = awaySeason || getDefaultTeamStats()
    const homeSeasonData = homeSeason || getDefaultTeamStats()
    
    const bundle: NBAStatsBundle = {
      // Pace
      awayPaceSeason: awaySeasonData.pace,
      awayPaceLast10: awayRecentData.pace,
      homePaceSeason: homeSeasonData.pace,
      homePaceLast10: homeRecentData.pace,
      leaguePace: 100.1,
      
      // Offensive Rating
      awayORtgLast10: awayRecentData.ortg,
      homeORtgLast10: homeRecentData.ortg,
      leagueORtg: 110.0,
      
      // Defensive Rating
      awayDRtgSeason: awaySeasonData.drtg,
      homeDRtgSeason: homeSeasonData.drtg,
      leagueDRtg: 110.0,
      
      // 3-Point Stats
      away3PAR: awayRecentData.threeP_rate,
      home3PAR: homeRecentData.threeP_rate,
      awayOpp3PAR: 0.39, // TODO: Fetch opponent stats
      homeOpp3PAR: 0.39,
      away3Pct: awayRecentData.threeP_pct,
      home3Pct: homeRecentData.threeP_pct,
      away3PctLast10: awayRecentData.threeP_pct,
      home3PctLast10: homeRecentData.threeP_pct,
      league3PAR: 0.39,
      league3Pct: 0.35,
      league3Pstdev: 0.036,
      
      // Free Throw Rate
      awayFTr: awayRecentData.ft_rate,
      homeFTr: homeRecentData.ft_rate,
      awayOppFTr: 0.22, // TODO: Fetch opponent stats
      homeOppFTr: 0.22,
      leagueFTr: 0.22,
      
      // Points Per Game
      awayPointsPerGame: awayRecentData.ortg * awayRecentData.pace / 100,
      homePointsPerGame: homeRecentData.ortg * homeRecentData.pace / 100
    }
    
    console.log('[DATA_FETCHER:SUCCESS]', {
      awayPace: bundle.awayPaceLast10.toFixed(1),
      homePace: bundle.homePaceLast10.toFixed(1),
      awayORtg: bundle.awayORtgLast10.toFixed(1),
      homeORtg: bundle.homeORtgLast10.toFixed(1)
    })
    
    return bundle
    
  } catch (error) {
    console.error('[DATA_FETCHER:ERROR]', error)
    console.warn('[DATA_FETCHER] Falling back to league averages')
    return getDefaultBundle()
  }
}

function getDefaultTeamStats() {
  return {
    team: 'UNKNOWN',
    pace: 100.1,
    ortg: 110.0,
    drtg: 110.0,
    threeP_pct: 0.35,
    threeP_rate: 0.39,
    ft_rate: 0.22
  }
}

function getDefaultBundle(): NBAStatsBundle {
  console.warn('[DATA_FETCHER] Using default bundle - all league averages')
  return {
    awayPaceSeason: 100.1,
    awayPaceLast10: 100.1,
    homePaceSeason: 100.1,
    homePaceLast10: 100.1,
    awayORtgLast10: 110.0,
    homeORtgLast10: 110.0,
    awayDRtgSeason: 110.0,
    homeDRtgSeason: 110.0,
    away3PAR: 0.39,
    home3PAR: 0.39,
    awayOpp3PAR: 0.39,
    homeOpp3PAR: 0.39,
    away3Pct: 0.35,
    home3Pct: 0.35,
    away3PctLast10: 0.35,
    home3PctLast10: 0.35,
    awayFTr: 0.22,
    homeFTr: 0.22,
    awayOppFTr: 0.22,
    homeOppFTr: 0.22,
    leaguePace: 100.1,
    leagueORtg: 110.0,
    leagueDRtg: 110.0,
    league3PAR: 0.39,
    league3Pct: 0.35,
    leagueFTr: 0.22,
    league3Pstdev: 0.036,
    awayPointsPerGame: 110.0,
    homePointsPerGame: 110.0
  }
}

/**
 * Fetch injury impact via LLM (Legacy - now replaced by AI factor)
 * @deprecated Use computeInjuryAvailabilityAsync instead
 */
export async function summarizeAvailabilityWithLLM(ctx: RunCtx): Promise<InjuryImpact> {
  console.log('[INJURY_LLM:LEGACY]', 'Using legacy injury analysis')
  
  try {
    const injuryData = await searchInjuries(ctx.away, ctx.home, 48)
    
    return {
      defenseImpactA: 0,
      defenseImpactB: 0,
      summary: `Legacy injury analysis for ${ctx.away} vs ${ctx.home}`,
      rawResponse: JSON.stringify(injuryData)
    }
  } catch (error) {
    console.error('[INJURY_LLM:ERROR]', error)
    return {
      defenseImpactA: 0,
      defenseImpactB: 0,
      summary: 'Legacy injury analysis failed',
      rawResponse: ''
    }
  }
}
```

---

## ✅ Step 5: Test the Fix (5 minutes)

### 1. Restart Dev Server
```bash
# Stop server (Ctrl+C)
# Start server
npm run dev
```

### 2. Test MySportsFeeds Stats
```bash
# Visit
http://localhost:3000/api-test

# Click "Test Pace" button
```

**Expected**: Should see real team pace data (not error)

### 3. Test SHIVA Pick Generation
```bash
# Visit
http://localhost:3000/cappers/shiva/management

# 1. Click "Sync Games" in inbox
# 2. Select a game
# 3. Click "Run" button
# 4. Watch Step 3 execute
```

**Expected**: 
- Step 3 completes (green checkmark)
- Factor values are NOT all 100.1, 110.0
- Step 4 generates predictions
- Step 5 calculates edge

---

## 🎉 Success Criteria

- [ ] No error in Step 3
- [ ] Factors show varying values
- [ ] Picks generate with different confidence scores
- [ ] Console shows `[DATA_FETCHER:SUCCESS]`

---

## 🚨 If Still Broken

### Error: "getTeamFormData is not a function"
**Fix**: Check import in data-fetcher.ts

### Error: "MySportsFeeds API returned 401"
**Fix**: Check API key in .env.local, restart server

### Error: "Cannot find module 'team-mappings'"
**Fix**: Make sure you created the file in correct location

### Step 3 still uses defaults (100.1, 110.0)
**Fix**: Check console for MySportsFeeds API errors

---

## 📞 Next Steps After This Works

1. ✅ Add opponent stats fetching
2. ✅ Implement caching layer
3. ✅ Fix odds format conversion
4. ✅ Add comprehensive error handling

See **MIGRATION_ACTION_PLAN.md** for details.


