# Automated Capper System

## Overview

The DeepPick capper system now runs automatically every **20 minutes**, generating new picks while preventing duplicates.

---

## How It Works

### **1. Vercel Cron Job**
Every 20 minutes, Vercel calls `/api/auto-run-cappers`

### **2. Duplicate Prevention**
Before generating a pick, the system checks:
- ✅ **Same game + different bet type** = ALLOWED
  - Example: HOU -3 (spread) AND Over 48 (total) on same game
- ❌ **Same game + same bet type** = BLOCKED
  - Example: HOU -3 then HOU -4 (both spread bets)

### **3. Bet Type Rules**
Each game can have up to **3 picks per capper**:
- 1x **Total** (over or under)
- 1x **Spread** (either team)
- 1x **Moneyline** (either team)

### **4. Line Movement Handling**
If a line changes (e.g., spread moves from -3 to -4):
- System **will NOT** create a new pick
- Original pick stays active
- Prevents betting both sides or chasing lines

---

## Duplicate Prevention Logic

### **Base Pick Types**
```typescript
'total_over'  → 'total'
'total_under' → 'total'
'spread'      → 'spread'
'moneyline'   → 'moneyline'
```

### **Examples**

#### ✅ **ALLOWED**
```
Game: Broncos @ Chiefs

Pick 1: Over 48.5 (total)
Pick 2: Chiefs -7 (spread)
Pick 3: Chiefs ML (moneyline)

Result: All 3 allowed (different bet types)
```

#### ❌ **BLOCKED**
```
Game: Broncos @ Chiefs

Pick 1: Over 48.5 (total)
[Line moves to 49.5]
Pick 2: Over 49.5 (total)

Result: Pick 2 BLOCKED (duplicate total bet)
```

#### ✅ **ALLOWED (Different Games)**
```
Game 1: Broncos @ Chiefs
Pick 1: Chiefs -7

Game 2: Texans @ Colts
Pick 2: Texans -7

Result: Both allowed (different games)
```

---

## Implementation Details

### **Duplicate Checker** (`src/lib/cappers/duplicate-checker.ts`)

#### `isDuplicatePick(gameId, pickType, capper)`
Checks if a specific pick would be a duplicate.

```typescript
const result = await isDuplicatePick(
  'game-uuid-123',
  'total_over',
  'ifrit'
)

if (result.isDuplicate) {
  console.log(`Blocked: ${result.reason}`)
  // "Already have total pick on this game: Over 48.5"
}
```

#### `getExistingPicksByGame(capper)`
Returns a map of all existing picks by game.

```typescript
const existingPicks = await getExistingPicksByGame('ifrit')
// Map {
//   'game-uuid-123' => ['total', 'spread'],
//   'game-uuid-456' => ['moneyline']
// }
```

#### `getAvailablePickTypes(gameId, capper)`
Checks which bet types are still available for a game.

```typescript
const available = await getAvailablePickTypes('game-uuid-123', 'ifrit')
// {
//   canBetTotal: false,     // Already have total pick
//   canBetSpread: false,    // Already have spread pick
//   canBetMoneyline: true,  // Can still bet moneyline
//   existingTypes: ['total', 'spread']
// }
```

---

## Automated Runner

### **Endpoint**: `/api/auto-run-cappers`

#### **Security**
Protected by `CRON_SECRET` environment variable:
```typescript
Authorization: Bearer YOUR_CRON_SECRET
```

#### **Process**
1. Verify cron authorization
2. Run each active capper:
   - Ifrit (implemented)
   - Nexus (coming soon)
   - Shiva (coming soon)
   - Cerberus (coming soon)
   - DeepPick (coming soon)
3. Return summary of results

#### **Response**
```json
{
  "success": true,
  "message": "Auto-run complete: 1/1 cappers succeeded",
  "totalPicks": 3,
  "duration": 2456,
  "timestamp": "2025-10-18T12:34:56.789Z",
  "results": {
    "ifrit": {
      "success": true,
      "picks": 3,
      "error": null
    },
    "nexus": {
      "success": false,
      "picks": 0,
      "error": "Not implemented yet"
    }
  }
}
```

---

## Cron Schedule

### **Current Jobs**

| Job | Endpoint | Schedule | Frequency |
|-----|----------|----------|-----------|
| Odds Refresh | `/api/auto-refresh-odds` | `*/15 * * * *` | Every 15 minutes |
| Run Cappers | `/api/auto-run-cappers` | `*/20 * * * *` | Every 20 minutes |

### **Why 20 Minutes?**
- Gives odds time to update (15 min refresh)
- Prevents excessive API usage
- Allows time for games to be analyzed
- Balances freshness with efficiency

---

## Setup Instructions

### **1. Set Environment Variables**

In Vercel dashboard, add:

```bash
CRON_SECRET=your_random_secret_string
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### **2. Deploy**

The cron jobs will automatically activate on deployment.

### **3. Monitor**

Check Vercel logs to see cron executions:
- Go to Vercel dashboard
- Select your project
- Click "Logs"
- Filter by "Cron"

---

## Algorithm Updates

### **Ifrit** (`/api/run-ifrit`)

Updated to:
1. Fetch existing picks via `getExistingPicksByGame('ifrit')`
2. Pass existing picks to `analyzeBatch(games, 5, existingPicks)`
3. Skip games that already have the same bet type
4. Log duplicate prevention in prediction log

### **Adding New Cappers**

To add a new capper to automation:

1. **Create algorithm file**: `src/lib/cappers/[capper]-algorithm.ts`
2. **Create API endpoint**: `src/app/api/run-[capper]/route.ts`
3. **Add duplicate checking**:
   ```typescript
   const existingPicks = await getExistingPicksByGame('capper-name')
   const results = analyzeBatch(games, 5, existingPicks)
   ```
4. **Update auto-runner**: Add to `cappers` array in `/api/auto-run-cappers`

---

## Testing

### **Manual Test**

Test the automated runner manually:

```bash
curl -X GET https://deep-pick.vercel.app/api/auto-run-cappers \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### **Test Duplicate Prevention**

1. Run Ifrit algorithm twice
2. Check that second run doesn't create duplicate picks
3. Verify prediction log shows "DUPLICATE CHECK: SKIP"

### **Test Multiple Bet Types**

1. Manually create a total pick on a game
2. Run Ifrit algorithm
3. Verify it can still create spread/moneyline picks on same game

---

## Monitoring & Debugging

### **Check Cron Execution**
```
Vercel Dashboard → Project → Logs → Filter: "Auto-running all cappers"
```

### **Check Duplicate Prevention**
```
Vercel Dashboard → Project → Logs → Filter: "already have"
```

### **Check Pick Generation**
```
Vercel Dashboard → Project → Logs → Filter: "picks generated"
```

### **Common Issues**

#### **No Picks Generated**
- Check if games are scheduled
- Verify odds data is fresh
- Check confidence thresholds
- Look for duplicate prevention logs

#### **Duplicate Picks Created**
- Verify `existingPicks` is being passed to `analyzeBatch`
- Check `getExistingPicksByGame` is working
- Ensure `capper` field is set correctly

#### **Cron Not Running**
- Verify `CRON_SECRET` is set in Vercel
- Check cron schedule syntax in `vercel.json`
- Ensure deployment succeeded
- Check Vercel logs for errors

---

## Future Enhancements

- [ ] Add rate limiting per capper
- [ ] Track pick generation metrics
- [ ] Alert on repeated failures
- [ ] Dynamic scheduling based on game times
- [ ] Pause/resume individual cappers
- [ ] Historical analysis of duplicate prevention
- [ ] Optimize for games starting soon
- [ ] Multi-region cron for redundancy

---

## API Usage Optimization

### **Current Strategy**
- Odds refresh: Every 15 minutes
- Capper runs: Every 20 minutes
- Duplicate prevention: Reduces redundant picks

### **Estimated API Calls**
- **Odds API**: ~96 calls/day (4 per hour × 24 hours)
- **Capper runs**: ~72 runs/day (3 per hour × 24 hours)
- **Duplicate checks**: Minimal (database queries only)

### **Cost Savings**
By preventing duplicates:
- Fewer picks = fewer score fetches
- No line-chasing = no wasted picks
- Clean data = better analysis

