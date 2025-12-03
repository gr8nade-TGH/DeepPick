# Sharp Siege - Gotchas & Common Issues

**Last Updated:** 2025-12-03 (Update #25)
**Purpose:** Document tricky bugs, common pitfalls, and fragile areas

---

## ?? Critical Gotchas

### 0. **Home/Away Detection (MySportsFeeds API)** ⚠️ CRITICAL - NEW
**Problem:** MySportsFeeds API has inconsistent home/away data structure across different endpoints
**Impact:** S4 (Home/Away Splits) factor was failing, causing null bundle errors

**Solution (4-tier fallback system):**
```typescript
// Method 1: Direct isHome boolean (most reliable when present)
const isHome = gameLog.isHome;

// Method 2: Compare homeTeam/awayTeam abbreviations (DEN, LAL, etc.)
const isHome = game.homeTeam?.abbreviation === teamAbbrev;

// Method 3: Compare homeTeam/awayTeam IDs
const isHome = game.homeTeam?.id === teamId;

// Method 4: Parse game ID format as fallback (e.g., "20241203-DEN-LAL")
const [date, awayAbbrev, homeAbbrev] = gameId.split('-');
const isHome = homeAbbrev === teamAbbrev;
```

**Files:**
- `src/lib/data-sources/mysportsfeeds-stats.ts` (getTeamFormData function)

**Debugging:**
- Check console logs for "Failed to determine home/away status"
- Verify game.homeTeam and game.schedule.homeTeam structures
- Add full gameLog JSON dump if detection fails

**Fixed in:** Update #25 (commits 57e84d2, 337dcf3, b1dd590, 163ef84, 8865cd2, 66b0310, 27fa35a)

---

### 1. **Bet Type Specificity** ?? HIGH PRIORITY
**Problem:** TOTAL and SPREAD picks must be tracked separately  
**Why:** Capper may be good at TOTALS but bad at SPREADS (or vice versa)  
**Common Bugs:**
- Mixing TOTAL/SPREAD records in tier grading
- Forgetting `bet_type` filter in queries
- Using overall win rate instead of bet-type-specific win rate

**Solution:**
```typescript
// ? WRONG - Missing bet_type filter
const picks = await supabase
  .from('picks')
  .select('*')
  .eq('capper_id', capperId)

// ? CORRECT - Bet type specific
const picks = await supabase
  .from('picks')
  .select('*')
  .eq('capper_id', capperId)
  .eq('bet_type', betType)  // 'total' or 'spread'
```

**Files to Watch:**
- `src/lib/confluence-scoring.ts`
- `src/lib/manual-pick-confluence.ts`
- `src/lib/tier-grading.ts`
- Any capper stats queries

---

### 2. **Team Abbreviation Normalization** ?? MEDIUM PRIORITY
**Problem:** Team names come in different formats from different sources  
**Examples:**
- `DENVER` vs `DEN`
- `U` vs `Under` vs `UNDER`
- `O` vs `Over` vs `OVER`

**Solution:**
```typescript
// Normalize team abbreviations
const normalizeTeam = (team: string): string => {
  const map: Record<string, string> = {
    'DENVER': 'DEN',
    'U': 'Under',
    'O': 'Over',
    // ... add more as needed
  }
  return map[team] || team
}
```

**Files to Watch:**
- `src/lib/cappers/picksmith/` - PICKSMITH consensus
- Pick grid components
- Insight card displays
- Any team name comparisons

---

### 3. **Caching Issues** ?? HIGH PRIORITY
**Problem:** Leaderboard and stats APIs have persistent caching issues  
**Symptoms:**
- New cappers don't appear (e.g., marshal-harris, PICKSMITH)
- Stats don't update after picks are graded
- Stale data shown to users

**Solution:**
```typescript
// Force disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Add cache-busting headers
const response = await fetch(url, {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
})
```

**Files to Watch:**
- `src/app/api/leaderboard/route.ts`
- `src/app/api/capper-stats/route.ts`
- Any API routes returning dynamic data

---

### 4. **SPREAD Bundle Null Errors** ?? MEDIUM PRIORITY
**Problem:** Missing `homeAwaySplits` factor causes null bundle errors  
**Why:** SPREAD picks require specific factors, missing one breaks the bundle

**Solution:**
```typescript
// Check for ALL required SPREAD factors
const requiredSpreadFactors = [
  'netRatingDiff',
  'turnoverDiff',
  'homeCourtAdv',
  'clutchPerf',
  'homeAwaySplits'  // Don't forget this one!
]

const hasAllFactors = requiredSpreadFactors.every(
  factor => bundle[factor] !== undefined
)
```

**Files to Watch:**
- `src/lib/cappers/shiva-v1/nba-spread-orchestrator.ts`
- Factor bundle validation logic

---

### 5. **Tier Grading Scale** ?? MEDIUM PRIORITY
**Problem:** Confidence scale changed from 0-100 to 0-10  
**Why:** Old code may still expect 0-100 scale

**Solution:**
```typescript
// ? CORRECT - 0-10 scale
const confidence = 7.5  // Out of 10

// ? WRONG - Old 0-100 scale
const confidence = 75  // Out of 100
```

**Files to Watch:**
- `src/lib/confluence-scoring.ts`
- `src/lib/tier-grading.ts`
- Any confidence calculations

---

### 6. **Insufficient History Handling** ?? LOW PRIORITY
**Problem:** New cappers have no history, tier grading fails  
**Solution:** Auto-grade as Common, cap at Uncommon max

**Implementation:**
```typescript
// If missing team record or recent form
if (!teamRecord || !recentForm) {
  return {
    tier: 'Common',
    score: 2.0,  // Low but not zero
    breakdown: { /* ... */ }
  }
}
```

**Files to Watch:**
- `src/lib/confluence-scoring.ts`
- `src/lib/manual-pick-confluence.ts`

---

### 7. **PICKSMITH Game Snapshot**  MEDIUM PRIORITY
**Problem:** PICKSMITH needs full team data in game_snapshot  
**Why:** Consensus picks aggregate from multiple cappers, need complete context

**Solution:**
```typescript
// Store full team objects, not just abbreviations
game_snapshot: {
  away_team: { abbreviation: 'DEN', name: 'Denver Nuggets', /* ... */ },
  home_team: { abbreviation: 'LAL', name: 'Los Angeles Lakers', /* ... */ }
}
```

**Files to Watch:**
- `src/lib/cappers/picksmith/` - PICKSMITH implementation
- PICKSMITH insight card generation

---

### 8. **Orphaned Picks**  LOW PRIORITY
**Problem:** Picks without associated games (game deleted/cancelled)  
**Solution:** Add `cancelled` status, handle gracefully in UI

**Files to Watch:**
- Pick grading logic
- Pick display components
- Game sync operations

---

### 9. **Tooltip Clipping**  LOW PRIORITY
**Problem:** Tooltips get clipped by parent containers  
**Solution:** Use React Portal to render outside parent

**Implementation:**
```typescript
import { createPortal } from 'react-dom'

// Render tooltip in document.body
{showTooltip && createPortal(
  <div className="tooltip">{content}</div>,
  document.body
)}
```

**Files to Watch:**
- Insight card tooltips
- Factor tooltips
- Tier breakdown tooltips

---

### 10. **Sync Timeout Issues**  MEDIUM PRIORITY
**Problem:** `sync-game-scores` API times out with large datasets  
**Solution:** Optimize queries, add pagination, increase timeout

**Files to Watch:**
- `src/app/api/sync-game-scores/route.ts`
- Any bulk data sync operations

---

##  Debugging Tips

### Check Tier Grading
```typescript
// Add detailed logging
console.log('Tier Grading Input:', {
  edgeScore,
  betType,
  specializationWinRate,
  winStreak,
  factorAlignment
})

console.log('Tier Grading Output:', {
  tier,
  score,
  breakdown
})
```

### Check Factor Bundle
```typescript
// Verify all factors present
console.log('Factor Bundle:', Object.keys(bundle))
console.log('Missing Factors:', 
  requiredFactors.filter(f => !bundle[f])
)
```

### Check Caching
```typescript
// Add timestamp to verify fresh data
console.log('Data fetched at:', new Date().toISOString())
```

---

##  Pre-Deployment Checklist

Before pushing major changes:

- [ ] Test with both TOTAL and SPREAD picks
- [ ] Test with new capper (no history)
- [ ] Test with established capper (full history)
- [ ] Check team abbreviations display correctly
- [ ] Verify tier grading uses 0-10 scale
- [ ] Confirm all required factors present
- [ ] Test tooltip rendering (no clipping)
- [ ] Check leaderboard updates (no stale cache)
- [ ] Verify PICKSMITH consensus works
- [ ] Test orphaned pick handling

---

##  Don't Touch (Fragile Areas)

### 1. **Confluence Scoring System**
- **Files:** `src/lib/confluence-scoring.ts`, `src/lib/manual-pick-confluence.ts`
- **Why:** Core tier grading logic, affects all picks
- **Rule:** Ask user before modifying

### 2. **Factor Registry**
- **File:** `src/lib/cappers/shiva-v1/factor-registry.ts`
- **Why:** Defines all edge factors, weights, max points
- **Rule:** Ask user before adding/removing factors

### 3. **PICKSMITH Consensus Logic**
- **Files:** `src/lib/cappers/picksmith/`
- **Why:** Complex aggregation logic across multiple cappers
- **Rule:** Ask user before modifying

### 4. **Database Schema**
- **Location:** Supabase
- **Why:** Schema changes affect entire app
- **Rule:** ALWAYS ask user before schema changes

---

##  Quick Fixes

### Leaderboard not updating?
```typescript
// Add to API route
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

### Team names showing wrong?
```typescript
// Normalize before display
const displayName = normalizeTeamAbbreviation(rawName)
```

### Tier grading failing?
```typescript
// Check for missing data
if (!teamRecord || !recentForm) {
  return { tier: 'Common', score: 2.0 }
}
```

### Tooltip clipped?
```typescript
// Use React Portal
{createPortal(<Tooltip />, document.body)}
```

---

##  Remember

1. **Bet type specificity is critical** - Always filter by bet_type
2. **Caching is a persistent problem** - Force disable when needed
3. **Team abbreviations need normalization** - Don't trust raw data
4. **Confidence is 0-10 scale** - Not 0-100
5. **New cappers need special handling** - Auto-grade as Common
6. **SPREAD picks need homeAwaySplits** - Don't forget this factor
7. **PICKSMITH needs full team data** - Not just abbreviations
8. **Always test with both TOTAL and SPREAD** - They're different!

