# Battle Bets - Multi-Game Arena System

## Overview

Battle Bets is a gamified sports betting experience where cappers battle each other based on their opposing SPREAD picks. The system displays up to 4 simultaneous battles per page, with automatic progression through quarters as real NBA game stats become available.

## Architecture

### Database Schema

**Table: `battle_matchups`**
- Tracks all battle matchups between cappers
- Stores HP, scores, quarter stats, timing data
- 32 columns including JSONB fields for quarter stats
- 6 indexes for performance optimization

### API Endpoints

1. **`POST /api/battle-bets/create-matchups`**
   - Creates battle matchups from opposing SPREAD picks
   - Runs every 10 minutes via cron
   - Pairs cappers who picked opposite sides of the same game

2. **`GET /api/battle-bets/active`**
   - Returns active battles with pagination (default: 4 per page)
   - Enriches data with capper performance and defense dots
   - Auto-refreshes every 30 seconds on frontend

3. **`POST /api/battle-bets/sync-quarter-stats`**
   - Syncs quarter stats from MySportsFeeds DETAILED API
   - Runs every 10 minutes via cron
   - Estimates quarter end times (18 min/quarter + 5 min buffer)
   - Auto-triggers quarter simulation when stats available

4. **`POST /api/battle-bets/[battleId]/simulate-quarter`**
   - Simulates a quarter and calculates damage
   - Updates HP based on stat performance
   - Determines winner/knockout
   - Advances battle status

### Frontend Components

1. **`BattleArena`** (`src/components/battle-bets/BattleArena.tsx`)
   - Main arena component with 2x2 grid layout
   - Pagination controls for multiple pages
   - Auto-refresh every 30 seconds
   - Loading/error states

2. **`BattleCard`** (`src/components/battle-bets/BattleCard.tsx`)
   - Individual battle card component
   - Header: Capper info, VS badge, game info
   - Canvas: 400px height (ready for PixiJS integration)
   - Footer: HP bars, scores, defense dots
   - Status overlay integration

3. **`GameStatusOverlay`** (`src/components/battle-bets/GameStatusOverlay.tsx`)
   - Semi-transparent overlay for game states
   - Countdown timers for quarters
   - Status-specific messages and emojis
   - Winner announcements
   - Pulsing animations

### State Management

**`multiGameStore.ts`** (`src/battle-bets/store/multiGameStore.ts`)
- Zustand store with `Map<battleId, BattleState>` architecture
- Each battle has isolated state:
  - Game data
  - Capper HP
  - Defense dots
  - Projectiles
  - Current quarter
- Actions for HP updates, damage application, projectile management

### Utilities

**`BattleTimer.ts`** (`src/lib/battle-bets/BattleTimer.ts`)
- Calculates countdown timers for different battle states
- Formats time displays (MM:SS or HH:MM:SS)
- Provides status colors and emojis
- Handles 12 different battle statuses

**`defense-dots.ts`** (`src/lib/battle-bets/defense-dots.ts`)
- Calculates defense dots from capper net units
- Formula: +3 units = 1 defense dot (min 1, max 10)
- Distributes dots across 5 stat rows:
  - POINTS: 40%
  - REBOUNDS: 20%
  - ASSISTS: 20%
  - BLOCKS: 10%
  - 3-POINTERS: 10%

## Game Flow

### 1. Matchmaking (Every 10 minutes)
```
Scheduled NBA Games
  ↓
Find SPREAD picks
  ↓
Group by team (home vs away)
  ↓
Create matchups (1 home picker vs 1 away picker)
  ↓
Store in battle_matchups table
```

### 2. Quarter Stats Sync (Every 10 minutes)
```
Active battles
  ↓
Estimate quarter end times
  ↓
Check if quarter likely complete
  ↓
Fetch MySportsFeeds boxscore
  ↓
Extract quarter stats (PTS, REB, AST, BLK, 3PT)
  ↓
Update battle_matchups table
  ↓
Auto-trigger quarter simulation
```

### 3. Quarter Simulation (Auto-triggered)
```
Quarter stats available
  ↓
Calculate team totals for 5 stat categories
  ↓
Calculate stat differences
  ↓
Apply weights (40% PTS, 20% REB, 20% AST, 10% BLK, 10% 3PT)
  ↓
Calculate damage (0.1 damage per stat point difference)
  ↓
Update HP
  ↓
Check for knockout
  ↓
Advance battle status
```

### 4. Battle Status Progression
```
scheduled → q1_pending → q1_complete → q2_pending → q2_complete → halftime → q3_pending → q3_complete → q4_pending → q4_complete → final → complete
```

## Battle States

| Status | Description | Overlay Shown |
|--------|-------------|---------------|
| `scheduled` | Game not started yet | ✅ Countdown to game start |
| `q1_pending` | Q1 in progress | ✅ Countdown to Q1 end |
| `q1_complete` | Q1 stats received, simulating | ✅ "Q1 Complete - Simulating..." |
| `q2_pending` | Q2 in progress | ✅ Countdown to Q2 end |
| `q2_complete` | Q2 stats received, simulating | ✅ "Q2 Complete - Simulating..." |
| `halftime` | Halftime break | ✅ "Halftime - Q3 Starts In..." |
| `q3_pending` | Q3 in progress | ✅ Countdown to Q3 end |
| `q3_complete` | Q3 stats received, simulating | ✅ "Q3 Complete - Simulating..." |
| `q4_pending` | Q4 in progress | ✅ Countdown to Q4 end |
| `q4_complete` | Q4 stats received, final blow | ✅ "Q4 Complete - Final Blow!" |
| `final` | Game ended, calculating winner | ✅ "Game Final - Calculating Winner..." |
| `complete` | Battle finished | ✅ Winner announcement |

## Damage Calculation

### Formula
```
Damage = Σ (StatDifference × 0.1 × Weight)

Where:
- StatDifference = LeftTeamStat - RightTeamStat
- Weights:
  - POINTS: 0.4 (40%)
  - REBOUNDS: 0.2 (20%)
  - ASSISTS: 0.2 (20%)
  - BLOCKS: 0.1 (10%)
  - 3-POINTERS: 0.1 (10%)
```

### Example
```
Q1 Stats:
Left Team:  25 PTS, 10 REB, 5 AST, 2 BLK, 3 3PT
Right Team: 20 PTS, 12 REB, 6 AST, 1 BLK, 2 3PT

Differences:
PTS:  +5  → +5 × 0.1 × 0.4 = +0.2
REB:  -2  → -2 × 0.1 × 0.2 = -0.04
AST:  -1  → -1 × 0.1 × 0.2 = -0.02
BLK:  +1  → +1 × 0.1 × 0.1 = +0.01
3PT:  +1  → +1 × 0.1 × 0.1 = +0.01

Total Damage: +0.16 (rounded to 0)
→ Left deals 0 damage to Right
→ Right deals 0 damage to Left
```

## Defense Dots

### Calculation
```
Total Defense Dots = floor(NetUnits / 3)
Clamped to [1, 10]

Distribution:
- POINTS:      40% of total
- REBOUNDS:    20% of total
- ASSISTS:     20% of total
- BLOCKS:      10% of total
- 3-POINTERS:  10% of total
```

### Example
```
Capper has +13.56 net units on team
→ Total dots = floor(13.56 / 3) = 4 dots

Distribution:
- POINTS:      floor(4 × 0.4) = 1 dot
- REBOUNDS:    floor(4 × 0.2) = 0 dots
- ASSISTS:     floor(4 × 0.2) = 0 dots
- BLOCKS:      floor(4 × 0.1) = 0 dots
- 3-POINTERS:  floor(4 × 0.1) = 0 dots
- Remainder:   4 - 1 = 3 → added to POINTS

Final:
- POINTS:      4 dots
- REBOUNDS:    0 dots
- ASSISTS:     0 dots
- BLOCKS:      0 dots
- 3-POINTERS:  0 dots
```

## Cron Jobs

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/battle-bets/create-matchups` | Every 10 min | Create new battle matchups |
| `/api/battle-bets/sync-quarter-stats` | Every 10 min | Sync quarter stats and auto-simulate |

## Environment Variables

```env
MYSPORTSFEEDS_API_KEY=your_api_key_here
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

## Deployment Checklist

- [x] Database migration executed (`20250116_create_battle_matchups.sql`)
- [x] Cron jobs added to `vercel.json`
- [x] Environment variables set in Vercel
- [x] MySportsFeeds DETAILED API addon purchased
- [x] All TypeScript errors resolved
- [x] Battle Arena page created (`/battle-arena`)

## Future Enhancements

1. **PixiJS Canvas Integration**
   - 4 separate PixiJS canvases (one per battle card)
   - Projectile animations during quarter simulation
   - Defense dot visualization
   - HP bar animations

2. **Real-time Updates**
   - WebSocket integration for live battle updates
   - Instant quarter simulation animations
   - Live HP changes

3. **Battle History**
   - Archive completed battles
   - Replay system
   - Capper battle statistics

4. **Leaderboards**
   - Top cappers by battle wins
   - Most damage dealt
   - Best defense (least damage taken)

## Testing

### Manual Testing Steps

1. **Create Matchups**
   ```bash
   curl -X POST https://your-domain.vercel.app/api/battle-bets/create-matchups
   ```

2. **View Active Battles**
   - Navigate to `/battle-arena`
   - Should see battles with status overlays

3. **Sync Quarter Stats**
   ```bash
   curl -X POST https://your-domain.vercel.app/api/battle-bets/sync-quarter-stats
   ```

4. **Simulate Quarter (Manual)**
   ```bash
   curl -X POST https://your-domain.vercel.app/api/battle-bets/[battleId]/simulate-quarter \
     -H "Content-Type: application/json" \
     -d '{"quarter": 1}'
   ```

## Support

For issues or questions, contact the development team.

