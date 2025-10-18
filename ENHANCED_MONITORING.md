# Enhanced Monitoring System

## 🎯 What Was Built

### **Problem Identified:**
- Ingestion logs showed "+0 Added, ~11 Updated" but no details on WHAT changed
- Odds oscillating wildly (-670 → -370 → -670) with no way to debug
- No visibility into bookmaker presence/absence
- No data quality alerts for suspicious changes

### **Solution Implemented:**

## 1. Enhanced Data Logging (`api-logger.ts`)

### New Interface: `GameChangeDetail`
```typescript
{
  gameId: string
  matchup: string  // "Miami Dolphins @ Cleveland Browns"
  sport: string
  action: 'added' | 'updated' | 'skipped'
  bookmakersBefore?: string[]  // Track which books were present before
  bookmakersAfter: string[]    // Track which books are present now
  oddsChangesSummary?: {
    moneylineChanged: boolean
    spreadChanged: boolean
    totalChanged: boolean
    largestSwing?: number  // Detect large odds movements
  }
  beforeSnapshot?: any  // Full odds data before update
  afterSnapshot?: any   // Full odds data after update
  warnings?: string[]   // Data quality alerts
}
```

### Updated `IngestionLog`
- Added `gameDetails?: GameChangeDetail[]` field
- Stores detailed per-game changes in JSONB column

## 2. Database Migration (`010_enhanced_ingestion_logs.sql`)

```sql
ALTER TABLE data_ingestion_logs
ADD COLUMN IF NOT EXISTS game_details JSONB;

CREATE INDEX idx_ingestion_logs_game_details 
ON data_ingestion_logs USING GIN (game_details);
```

## 3. Enhanced UI (`monitoring/page.tsx`)

### Features:
- **Expandable Log Entries**: Click to see game-by-game details
- **Bookmaker Tracking**: Shows which sportsbooks returned data
- **Change Detection**: Highlights moneyline, spread, and total changes
- **Data Quality Alerts**:
  - ⚠️ Large odds swings (>100 points)
  - ⚠️ Bookmaker count changes
  - ⚠️ Missing bookmakers
- **Visual Indicators**:
  - 💰 Moneyline changed
  - 📊 Spread changed
  - 🎯 Total changed

### Example Output:
```
10/18/2025, 1:37:14 PM [Success] ▶ 2 games
├─ Added: +0  Updated: ~2  Odds Records: 11  Processing: 0ms
└─ [Expanded]
   ├─ Miami Dolphins @ Cleveland Browns [NFL] [Updated]
   │  ├─ Bookmakers: BetMGM, FanDuel, DraftKings, Caesars
   │  ├─ 💰 Moneyline changed
   │  ├─ 📊 Spread changed
   │  └─ ⚠️ Large swing detected: 430 points
   └─ Los Angeles Rams @ Jacksonville Jaguars [NFL] [Updated]
      ├─ Bookmakers: BetMGM, DraftKings, Caesars
      ├─ ⚠️ Count changed: 4 → 3 (FanDuel missing!)
      └─ 🎯 Total changed
```

## 4. Next Steps (To Be Implemented)

### Capture This Data in `simple-ingest/route.ts`:
```typescript
const gameDetails: GameChangeDetail[] = []

for (const event of events) {
  const bookmakersBefore = existingGame ? 
    Object.keys(existingGame.odds) : undefined
  const bookmakersAfter = Object.keys(sportsbooks)
  
  // Detect large swings
  const largestSwing = calculateLargestSwing(
    existingGame?.odds, 
    sportsbooks
  )
  
  // Generate warnings
  const warnings = []
  if (largestSwing > 100) {
    warnings.push(`Large odds swing: ${largestSwing} points`)
  }
  if (bookmakersBefore && bookmakersBefore.length !== bookmakersAfter.length) {
    warnings.push(`Bookmaker count changed: ${bookmakersBefore.length} → ${bookmakersAfter.length}`)
  }
  
  gameDetails.push({
    gameId,
    matchup: `${event.away_team} @ ${event.home_team}`,
    sport: mapSportKey(sport.key),
    action: existingGame ? 'updated' : 'added',
    bookmakersBefore,
    bookmakersAfter,
    oddsChangesSummary: {
      moneylineChanged: hasMoneylineChanged(existingGame?.odds, sportsbooks),
      spreadChanged: hasSpreadChanged(existingGame?.odds, sportsbooks),
      totalChanged: hasTotalChanged(existingGame?.odds, sportsbooks),
      largestSwing
    },
    beforeSnapshot: existingGame?.odds,
    afterSnapshot: sportsbooks,
    warnings
  })
}

// Pass to logger
await logIngestion({
  ...existingLogData,
  gameDetails
})
```

## 5. Settings Tab (Pending)

Will add a 4th tab to monitoring page with:
- **Per-Sport Toggles**: Enable/disable NFL, NBA, MLB
- **Interval Control**: Dropdown (5, 10, 15, 30, 60 mins)
- **Active Hours**: Time windows for data fetching
- **Quota Display**: Real-time usage tracking

## Benefits

### For Debugging:
- **See exactly what changed** in each ingestion
- **Track bookmaker availability** over time
- **Identify data quality issues** immediately
- **Compare before/after odds** snapshots

### For Optimization:
- Understand which games are updating frequently
- Identify which bookmakers are most reliable
- Detect API inconsistencies early
- Make informed decisions about fetch frequency

## Files Changed

1. `src/lib/monitoring/api-logger.ts` - Added GameChangeDetail interface
2. `supabase/migrations/010_enhanced_ingestion_logs.sql` - Database schema
3. `src/app/monitoring/page.tsx` - Enhanced UI with expandable details
4. `ENHANCED_MONITORING.md` - This documentation

## SQL to Run in Supabase

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE data_ingestion_logs
ADD COLUMN IF NOT EXISTS game_details JSONB;

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_game_details 
ON data_ingestion_logs USING GIN (game_details);
```

## Testing

1. Deploy these changes
2. Wait for next auto-refresh (15 mins)
3. Go to Monitoring → Ingestion Logs tab
4. Click on a log entry to expand
5. You'll see "No detailed game data available" for old logs
6. New logs will show full game-by-game details

## Future Enhancements

- Add filtering by sport/bookmaker
- Export detailed logs to CSV
- Add trend analysis (odds volatility over time)
- Alert system for critical data quality issues
- Historical comparison view

