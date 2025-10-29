# 🚨 MySportsFeeds Migration Issues & Fixes

## Critical Issue: Data Fetcher Not Implemented

### **The Root Problem**

In `src/lib/cappers/shiva-v1/factors/data-fetcher.ts` (line 18-19):

```typescript
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  // TODO: This file needs to be completely refactored to use MySportsFeeds instead of NBA Stats API
  throw new Error('fetchNBAStatsBundle is being refactored to use MySportsFeeds. Not yet implemented.')
}
```

**This function is called by Step 3 (Factor Analysis) and is currently throwing an error!**

---

## 🔍 What's Broken

### 1. **Step 3 Factor Analysis Fails**

**Call Chain**:
```
Wizard Step 3 Click
  → POST /api/shiva/factors/step3
    → computeTotalsFactors()
      → fetchNBAStatsBundle()  ❌ THROWS ERROR
```

**Error Message**:
```
fetchNBAStatsBundle is being refactored to use MySportsFeeds. Not yet implemented.
```

### 2. **All Factors Use Default Values**

When `fetchNBAStatsBundle()` fails, the orchestrator falls back to league averages:

```typescript
// From nba-totals-orchestrator.ts
const bundle = {
  awayPaceSeason: 100.1,      // League average
  awayPaceLast10: 100.1,      // League average
  homePaceSeason: 100.1,      // League average
  homePaceLast10: 100.1,      // League average
  awayORtgLast10: 110.0,      // League average
  homeORtgLast10: 110.0,      // League average
  // ... all defaults
}
```

**Result**: Every pick has the same confidence because all teams look identical!

### 3. **Pick Generation Becomes Unreliable**

- Factors compute with no real data
- Confidence scores are meaningless
- Picks are essentially random
- SHIVA can't find any edge

---

## 🛠️ How to Fix

### **Option 1: Quick Fix - Use MySportsFeeds Stats (Recommended)**

Replace `fetchNBAStatsBundle()` with MySportsFeeds implementation:

```typescript
// src/lib/cappers/shiva-v1/factors/data-fetcher.ts

import { getTeamFormData } from '@/lib/data-sources/mysportsfeeds-stats'

export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  console.log('[DATA_FETCHER:START]', { away: ctx.away, home: ctx.home })
  
  try {
    // Fetch team stats from MySportsFeeds
    const [awayStats, homeStats] = await Promise.all([
      getTeamFormData(ctx.away, 10), // Last 10 games
      getTeamFormData(ctx.home, 10)
    ])
    
    // Also get season-long stats
    const [awaySeasonStats, homeSeasonStats] = await Promise.all([
      getTeamFormData(ctx.away, 82), // Full season
      getTeamFormData(ctx.home, 82)
    ])
    
    const bundle: NBAStatsBundle = {
      // Pace
      awayPaceSeason: awaySeasonStats.pace,
      awayPaceLast10: awayStats.pace,
      homePaceSeason: homeSeasonStats.pace,
      homePaceLast10: homeStats.pace,
      leaguePace: 100.1, // NBA league average
      
      // Offensive Rating
      awayORtgLast10: awayStats.ortg,
      homeORtgLast10: homeStats.ortg,
      leagueORtg: 110.0,
      
      // Defensive Rating
      awayDRtgSeason: awaySeasonStats.drtg,
      homeDRtgSeason: homeSeasonStats.drtg,
      leagueDRtg: 110.0,
      
      // 3-Point Stats
      away3PAR: awayStats.threeP_rate,
      home3PAR: homeStats.threeP_rate,
      awayOpp3PAR: 0.39, // TODO: Get opponent stats
      homeOpp3PAR: 0.39,
      away3Pct: awayStats.threeP_pct,
      home3Pct: homeStats.threeP_pct,
      away3PctLast10: awayStats.threeP_pct,
      home3PctLast10: homeStats.threeP_pct,
      league3PAR: 0.39,
      league3Pct: 0.35,
      league3Pstdev: 0.036,
      
      // Free Throw Rate
      awayFTr: awayStats.ft_rate,
      homeFTr: homeStats.ft_rate,
      awayOppFTr: 0.22, // TODO: Get opponent stats
      homeOppFTr: 0.22,
      leagueFTr: 0.22,
      
      // Points Per Game (for reference)
      awayPointsPerGame: awayStats.ortg * awayStats.pace / 100,
      homePointsPerGame: homeStats.ortg * homeStats.pace / 100
    }
    
    console.log('[DATA_FETCHER:SUCCESS]', { bundle })
    return bundle
    
  } catch (error) {
    console.error('[DATA_FETCHER:ERROR]', error)
    
    // Return league averages as fallback
    return getDefaultBundle()
  }
}

function getDefaultBundle(): NBAStatsBundle {
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
```

### **Option 2: Fix MySportsFeeds Stats Fetcher**

The current `mysportsfeeds-stats.ts` has issues:

**Problem 1**: Wrong endpoint
```typescript
// Current (WRONG)
const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/team_stats_totals.json?team=${teamAbbrev}`

// Should be
const url = `${MYSPORTSFEEDS_BASE_URL}/2024-2025-regular/team_gamelogs.json?team=${teamAbbrev}&limit=${n}`
```

**Problem 2**: Missing opponent stats
```typescript
// Current code only gets team stats, not opponent stats
opponentFGA: 0, // Need to get from opponent game log
opponentFTA: 0,
opponentOREB: 0,
opponentTOV: 0,
```

**Fix**: Fetch both team and opponent game logs

---

## 🧪 Testing Steps

### 1. Test MySportsFeeds API Connection
```bash
# Visit in browser
http://localhost:3000/api/test/mysportsfeeds
```

**Expected Response**:
```json
{
  "success": true,
  "message": "MySportsFeeds Odds API successful!",
  "gamesWithOdds": 10,
  "lastUpdatedOn": "2025-01-29T..."
}
```

**If you get errors**:
- ❌ 401 Unauthorized → Check `MYSPORTSFEEDS_API_KEY` in `.env.local`
- ❌ 403 Forbidden → Check subscription tier
- ❌ Empty response → Check season format in URL

### 2. Test Game Sync
```bash
# In SHIVA management page
1. Click "Sync Games" button in inbox
2. Check browser console for errors
3. Verify games appear in inbox
```

**Expected Console Output**:
```
[Sync Games] Fetching MySportsFeeds odds data for 20250129...
[MySportsFeeds] Fetching: https://api.mysportsfeeds.com/v2.0/pull/nba/2024-2025-regular/date/20250129/odds_gamelines.json
[MySportsFeeds] Response status: 200
[Sync Games] Got 10 games with odds
```

### 3. Test Factor Calculation
```bash
# Visit
http://localhost:3000/api-test

# Click "Test Pace" button
```

**Expected**: Should see team pace data, not error

**If you get error**: MySportsFeeds stats endpoint is broken

### 4. Test Full Pick Generation
```bash
# In SHIVA management page
1. Select a game from inbox
2. Click "Run" button
3. Watch Step 3 execute
```

**Expected**: Step 3 should show factor values, not error

**If Step 3 fails**: `fetchNBAStatsBundle()` is still throwing error

---

## 📋 Checklist

- [ ] `MYSPORTSFEEDS_API_KEY` set in environment
- [ ] `/api/test/mysportsfeeds` returns data
- [ ] Games sync successfully to database
- [ ] Games appear in SHIVA inbox
- [ ] `fetchNBAStatsBundle()` implemented (not throwing error)
- [ ] Step 3 completes without errors
- [ ] Factor values are non-default (not all 100.1, 110.0)
- [ ] Picks generate with real confidence scores

---

## 🔧 Quick Diagnostic Commands

### Check Environment Variable
```bash
# In terminal
echo $MYSPORTSFEEDS_API_KEY

# Or in Node.js console
console.log(process.env.MYSPORTSFEEDS_API_KEY)
```

### Check Database Games
```sql
-- In Supabase SQL Editor
SELECT id, home_team, away_team, odds 
FROM games 
WHERE id LIKE 'msf_%' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Recent Picks
```sql
SELECT id, capper, selection, confidence, created_at 
FROM picks 
WHERE capper = 'shiva' 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🎯 Priority Fix Order

1. **CRITICAL**: Implement `fetchNBAStatsBundle()` with MySportsFeeds
2. **HIGH**: Fix team name mapping (abbreviations → full names)
3. **HIGH**: Fix odds parsing in sync endpoint
4. **MEDIUM**: Add error handling for API failures
5. **MEDIUM**: Implement opponent stats fetching
6. **LOW**: Add caching layer for API responses

---

## 💡 Temporary Workaround

If you need picks to work NOW while fixing the data fetcher:

```typescript
// In data-fetcher.ts - TEMPORARY ONLY
export async function fetchNBAStatsBundle(ctx: RunCtx): Promise<NBAStatsBundle> {
  console.warn('[DATA_FETCHER] Using mock data - REPLACE WITH REAL IMPLEMENTATION')
  
  // Return slightly randomized data so picks vary
  const randomize = (base: number, variance: number) => 
    base + (Math.random() - 0.5) * variance
  
  return {
    awayPaceSeason: randomize(100, 5),
    awayPaceLast10: randomize(100, 8),
    homePaceSeason: randomize(100, 5),
    homePaceLast10: randomize(100, 8),
    awayORtgLast10: randomize(110, 10),
    homeORtgLast10: randomize(110, 10),
    // ... etc
  }
}
```

**WARNING**: This will generate picks, but they'll be based on random data!

---

## 📞 Need Help?

If you're still stuck, check:
1. Browser console for JavaScript errors
2. Vercel logs for API errors
3. Supabase logs for database errors
4. MySportsFeeds API status page

Common error patterns:
- "fetchNBAStatsBundle is being refactored" → Data fetcher not implemented
- "No games found" → Sync endpoint failing
- "Step 3 failed" → Factor computation error
- "All picks have same confidence" → Using default values


