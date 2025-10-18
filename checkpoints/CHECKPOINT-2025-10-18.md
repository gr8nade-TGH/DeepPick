# 🎯 DeepPick Checkpoint - October 18, 2025

## 📸 System Snapshot

**Created:** October 18, 2025  
**Status:** Functional with known issues  
**Last Deploy:** Vercel production

---

## ✅ COMPLETED FEATURES

### 1. **Core Infrastructure**
- ✅ Next.js 14 application with TypeScript
- ✅ Supabase backend (PostgreSQL + Edge Functions)
- ✅ Vercel deployment with cron jobs
- ✅ The Odds API integration (API key configured)

### 2. **Database Schema**
- ✅ `games` table - stores upcoming/live games
- ✅ `games_history` table - archived completed games
- ✅ `odds_history` table - tracks odds changes over time
- ✅ `picks` table - stores capper predictions
- ✅ `algorithm_runs` table - logs capper execution attempts
- ✅ Row Level Security (RLS) policies configured

### 3. **Pages & UI**
- ✅ **Dashboard** (`/`) - Main hub with capper selector, performance metrics, current picks, pick history
- ✅ **Odds & Factors** (`/odds`) - Live odds display with factors analysis modal
- ✅ **Leaderboard** (`/leaderboard`) - Capper rankings by units won
- ✅ **History** (`/history`) - Archived games (page exists, needs testing)
- ✅ **Capper Algorithm Pages**:
  - `/cappers/deeppick` - Meta-algorithm (UI only, not functional)
  - `/cappers/ifrit` - High-scoring/fast-pace focus (FUNCTIONAL)
  - `/cappers/nexus` - Balanced approach (FUNCTIONAL)
  - `/cappers/shiva` - Defensive/value focus (FUNCTIONAL)
  - `/cappers/cerberus` - Multi-model consensus (FUNCTIONAL)

### 4. **API Endpoints**
#### Odds Management
- ✅ `/api/odds` - Fetch games for display
- ✅ `/api/ingest-odds` - Manual odds ingestion
- ✅ `/api/simple-ingest` - Simplified odds ingestion
- ✅ `/api/odds-history` - Historical odds for charts
- ✅ `/api/game-factors` - Betting factors analysis

#### Game Lifecycle
- ✅ `/api/fetch-scores` - Get final/live scores from Odds API
- ✅ `/api/archive-games` - Move completed games to history
- ✅ `/api/auto-refresh-odds` - Orchestrates full refresh cycle

#### Picks System
- ✅ `/api/picks` - Fetch picks with filters
- ✅ `/api/place-pick` - Create new pick
- ✅ `/api/performance` - Calculate capper stats and chart data

#### Capper Algorithms
- ✅ `/api/run-ifrit` - Execute Ifrit algorithm
- ✅ `/api/run-nexus` - Execute Nexus algorithm
- ✅ `/api/run-shiva` - Execute Shiva algorithm
- ✅ `/api/run-cerberus` - Execute Cerberus algorithm
- ✅ `/api/auto-run-cappers` - Orchestrates all capper runs
- ✅ `/api/algorithm-logs` - Fetch execution logs

### 5. **Capper Algorithm System**
- ✅ **Prediction-First Approach**: Cappers predict scores, then compare to Vegas odds
- ✅ **Confidence Calculation**: Weighted system based on prediction vs. market
- ✅ **Duplicate Prevention**: Won't bet same game/bet type twice
- ✅ **Global Rules**: No favorites over -250 unless 9/10+ confidence
- ✅ **Sport-Specific Logic**: Different factors for NFL/NBA/MLB
- ✅ **Detailed Logging**: Algorithm run logs with step-by-step analysis

### 6. **Automation (Vercel Cron)**
- ✅ `/api/auto-refresh-odds` - Every 15 minutes
- ✅ `/api/auto-run-cappers` - Every 20 minutes

### 7. **UI Features**
- ✅ Multi-capper selector on dashboard
- ✅ Live game status with scores
- ✅ Profit tracking (green/red coloring)
- ✅ Odds movement charts per game
- ✅ Countdown timers (red if <3 hours)
- ✅ Pick breakdown modal with detailed analysis
- ✅ Algorithm debug logs on capper pages
- ✅ Factors modal with betting insights
- ✅ Leaderboard with rankings

---

## ⚠️ KNOWN ISSUES

### 🔴 CRITICAL

1. **Inconsistent Odds Data Collection**
   - **Issue**: Some games have more odds history data points than others
   - **Cause**: Odds are only captured when `simple-ingest` or `ingest-odds` is called
   - **Impact**: Charts show inconsistent data, factors analysis may be incomplete
   - **Fix Needed**: Ensure cron job is running reliably every 15 minutes

2. **Cron Jobs Not Verified**
   - **Issue**: Uncertain if Vercel cron jobs are executing
   - **Cause**: No monitoring/logging for cron execution
   - **Impact**: Odds may not refresh, cappers may not run automatically
   - **Fix Needed**: Add logging to cron endpoints, verify in Vercel dashboard

3. **CRON_SECRET Not Verified**
   - **Issue**: Environment variable may not be set in Vercel
   - **Status**: User needs to check Vercel dashboard
   - **Impact**: Cron jobs may be blocked if secret doesn't match

### 🟡 MODERATE

4. **Odds History Gaps**
   - **Issue**: If a game is added late, it has less historical data
   - **Cause**: Games only tracked from first ingestion
   - **Impact**: Line movement analysis incomplete for late-added games
   - **Workaround**: Manual "Ingest Fresh Odds" button works

5. **DeepPick Meta-Algorithm Not Functional**
   - **Issue**: DeepPick capper page is UI only
   - **Status**: Intentionally deferred
   - **Impact**: DeepPick doesn't generate picks yet

6. **Algorithm Runs Table May Not Exist**
   - **Issue**: `algorithm_runs` table creation SQL not confirmed executed
   - **Status**: Logging made optional to prevent crashes
   - **Impact**: Algorithm debug logs may not save

7. **Score Fetching API Limits**
   - **Issue**: The Odds API limits `daysFrom` parameter to 3 days max
   - **Impact**: Can only fetch scores for games within last 3 days
   - **Workaround**: Fetch-scores runs every 15 minutes

### 🟢 MINOR

8. **Chart Display for Single Data Point**
   - **Issue**: Chart rendering logic handles 0, 1, or multiple points
   - **Status**: Fixed with conditional rendering
   - **Impact**: None currently

9. **Browser Caching**
   - **Issue**: Users need hard refresh to see updates
   - **Workaround**: Ctrl+Shift+R or incognito mode

---

## 📁 FILE ORGANIZATION

### ✅ WELL ORGANIZED

```
src/
├── app/
│   ├── api/                    # All API routes
│   │   ├── odds/              # Odds fetching
│   │   ├── ingest-odds/       # Manual ingestion
│   │   ├── simple-ingest/     # Simplified ingestion
│   │   ├── odds-history/      # Historical data
│   │   ├── game-factors/      # NEW: Factors analysis
│   │   ├── fetch-scores/      # Score fetching
│   │   ├── archive-games/     # Game archival
│   │   ├── picks/             # Pick CRUD
│   │   ├── place-pick/        # Create pick
│   │   ├── performance/       # Stats calculation
│   │   ├── run-ifrit/         # Ifrit execution
│   │   ├── run-nexus/         # Nexus execution
│   │   ├── run-shiva/         # Shiva execution
│   │   ├── run-cerberus/      # Cerberus execution
│   │   ├── auto-refresh-odds/ # Cron: odds refresh
│   │   ├── auto-run-cappers/  # Cron: capper execution
│   │   └── algorithm-logs/    # Fetch logs
│   ├── cappers/               # Capper algorithm pages
│   │   ├── deeppick/
│   │   ├── ifrit/
│   │   ├── nexus/
│   │   ├── shiva/
│   │   └── cerberus/
│   ├── odds/                  # Odds & Factors page
│   ├── leaderboard/           # NEW: Leaderboard page
│   ├── history/               # History page
│   └── page.tsx               # Dashboard
├── components/
│   ├── dashboard/
│   │   └── real-dashboard.tsx # Main dashboard component
│   ├── odds/
│   │   ├── odds-chart.tsx     # Odds movement chart
│   │   └── countdown-timer.tsx # Game countdown
│   ├── cappers/
│   │   └── algorithm-debug-logs.tsx # NEW: Debug logs component
│   └── ui/                    # Shadcn components
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Client-side Supabase
│   │   └── server.ts          # Server-side Supabase
│   └── cappers/
│       ├── shared-logic.ts    # Common capper utilities
│       ├── duplicate-checker.ts # Prevent duplicate picks
│       ├── run-logger.ts      # Algorithm run logging
│       ├── ifrit-algorithm.ts # Ifrit logic
│       ├── nexus-algorithm.ts # Nexus logic
│       ├── shiva-algorithm.ts # Shiva logic
│       └── cerberus-algorithm.ts # Cerberus logic
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_odds_history.sql
        ├── 003_games_history.sql
        ├── 004_picks_system_clean.sql
        ├── 005_fix_picks_cascade.sql
        ├── 006_add_capper_system.sql
        └── 007_algorithm_run_logs.sql
```

### 🗑️ CLEANUP NEEDED

**Test/Debug Files (Can be removed):**
- `/api/test-odds-api/` - Old test endpoint
- `/api/test-db/` - Old test endpoint
- `/api/test-supabase/` - Old test endpoint
- `/api/test-score-fetch/` - Debug endpoint (keep for now?)
- `/api/test-capper-column/` - Debug endpoint (can remove)
- `/api/seed-data/` - Old seeding (can remove if not used)

**Documentation Files:**
- `PREDICTION_SYSTEM.md` - Good, keep
- `AUTOMATED_CAPPERS.md` - Good, keep
- `Cursor Odds API instructions.docx` - User's reference, keep

---

## 🔄 CRON JOB LOGIC

### Current Setup (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/auto-refresh-odds",
      "schedule": "*/15 * * * *"  // Every 15 minutes
    },
    {
      "path": "/api/auto-run-cappers",
      "schedule": "*/20 * * * *"  // Every 20 minutes
    }
  ]
}
```

### Flow Diagram

```
Every 15 minutes:
┌─────────────────────────────┐
│ /api/auto-refresh-odds      │
└──────────┬──────────────────┘
           │
           ├─> 1. /api/fetch-scores (POST)
           │      └─> Updates game.status and final_score
           │
           ├─> 2. /api/archive-games (POST)
           │      └─> Moves completed games to games_history
           │
           └─> 3. /api/simple-ingest (GET)
                  └─> Fetches fresh odds from The Odds API
                      └─> Inserts into games table
                      └─> Inserts into odds_history table

Every 20 minutes:
┌─────────────────────────────┐
│ /api/auto-run-cappers       │
└──────────┬──────────────────┘
           │
           ├─> /api/run-ifrit?trigger=cron
           ├─> /api/run-nexus?trigger=cron
           ├─> /api/run-shiva?trigger=cron
           └─> /api/run-cerberus?trigger=cron
                Each:
                1. Fetches scheduled games
                2. Fetches existing picks (duplicate check)
                3. Runs algorithm (predict → compare → confidence)
                4. Generates picks (if confidence high enough)
                5. Stores picks in database
                6. Logs run to algorithm_runs table
```

### ⚠️ ISSUES WITH CRON

1. **No Verification**: We don't know if crons are running
2. **No Error Logging**: If a cron fails, we don't see it
3. **CRON_SECRET**: Vercel requires this for security, may not be set
4. **Timing Overlap**: 15 and 20 minutes can overlap (minor issue)

### 🔧 FIXES NEEDED

1. **Add Cron Logging**:
   ```typescript
   // At start of each cron endpoint
   console.log(`[CRON] ${new Date().toISOString()} - Starting...`)
   // At end
   console.log(`[CRON] ${new Date().toISOString()} - Completed`)
   ```

2. **Verify CRON_SECRET**:
   - Check Vercel dashboard → Settings → Environment Variables
   - Should have `CRON_SECRET` set to any value
   - Update `vercel.json` if needed

3. **Add Monitoring Endpoint**:
   - Create `/api/cron-status` to check last run times
   - Store last run timestamp in database or cache

---

## 🔍 ODDS DATA RELIABILITY ISSUES

### Root Cause Analysis

**Why some games have more data points:**

1. **Game Added Late**: If a game is added to the database after several cron cycles, it misses early odds captures
2. **Cron Not Running**: If cron jobs aren't executing, no new odds_history records are created
3. **API Failures**: If The Odds API call fails, that cycle's data is lost
4. **Game Deletion**: If games are deleted/re-added, history is lost

### Current Data Flow

```
The Odds API
     ↓
/api/simple-ingest (every 15 min)
     ↓
games table (upsert)
     ↓
odds_history table (insert new record)
     ↓
/api/odds-history (fetches for chart)
     ↓
OddsChart component displays
```

### 🔧 FIXES NEEDED

1. **Verify Cron Execution**:
   - Check Vercel logs for cron activity
   - Add explicit logging to cron endpoints

2. **Add Error Handling**:
   - Catch and log API failures
   - Retry logic for failed requests

3. **Ensure Consistent Ingestion**:
   - Make sure `simple-ingest` always captures ALL games
   - Don't delete games prematurely

4. **Database Cleanup**:
   - Check for orphaned odds_history records
   - Verify game_id foreign keys are valid

---

## 🧹 DUPLICATE CODE AUDIT

### ✅ NO MAJOR DUPLICATES

- Each capper algorithm is intentionally separate (different strategies)
- Shared logic extracted to `/lib/cappers/shared-logic.ts`
- API routes are specific to their purpose

### Minor Duplication (Acceptable)

- Odds fetching logic in multiple places (but serves different purposes)
- Chart rendering (each chart is slightly different)
- Badge/Card components (Shadcn pattern)

---

## 📊 DATABASE VERIFICATION CHECKLIST

### Tables to Verify in Supabase

- [ ] `games` - Check row count, recent records
- [ ] `games_history` - Check if completed games are here
- [ ] `odds_history` - **CRITICAL**: Check row count per game_id
- [ ] `picks` - Check if cappers are generating picks
- [ ] `algorithm_runs` - Check if logs are being created

### SQL Queries to Run

```sql
-- Check odds_history distribution
SELECT game_id, COUNT(*) as data_points
FROM odds_history
GROUP BY game_id
ORDER BY data_points DESC;

-- Check recent algorithm runs
SELECT * FROM algorithm_runs
ORDER BY started_at DESC
LIMIT 10;

-- Check active games
SELECT id, sport, home_team, away_team, status, created_at
FROM games
WHERE status = 'scheduled'
ORDER BY game_date;

-- Check picks by capper
SELECT capper, status, COUNT(*) as count
FROM picks
GROUP BY capper, status;
```

---

## 🚀 IMMEDIATE ACTION ITEMS

### Priority 1 (Critical)
1. [ ] **Verify CRON_SECRET in Vercel**
   - Go to Vercel → Settings → Environment Variables
   - Add `CRON_SECRET` if missing

2. [ ] **Check Vercel Cron Logs**
   - Vercel Dashboard → Deployments → Functions
   - Look for `/api/auto-refresh-odds` and `/api/auto-run-cappers`

3. [ ] **Add Cron Logging**
   - Update both cron endpoints with detailed console.log
   - Deploy and monitor logs

4. [ ] **Verify odds_history Data**
   - Run SQL query in Supabase to check data distribution
   - Identify games with insufficient data

### Priority 2 (Important)
5. [ ] **Test Manual Odds Ingestion**
   - Click "Ingest Fresh Odds" button
   - Verify odds_history records are created

6. [ ] **Remove Test Endpoints**
   - Delete unused test API routes
   - Clean up codebase

7. [ ] **Create Cron Status Endpoint**
   - `/api/cron-status` to show last run times
   - Add to dashboard for monitoring

### Priority 3 (Nice to Have)
8. [ ] **Implement DeepPick Algorithm**
   - Meta-algorithm combining all cappers
   - Weighted voting system

9. [ ] **Add Real-Time Score Updates**
   - WebSocket or polling for live games
   - Update dashboard automatically

10. [ ] **Enhanced Factors**
    - Integrate weather API
    - Add injury data
    - Team stats from external source

---

## 💾 RESTORE INSTRUCTIONS

**If you need to revert to this checkpoint:**

1. **Code Restore**: This checkpoint documents the state, code is in git
   ```bash
   git log --oneline  # Find commit hash
   git checkout <commit-hash>
   ```

2. **Database**: Migrations are in `supabase/migrations/`
   - Re-run migrations in order if needed
   - Data will be lost (picks, odds_history)

3. **Environment Variables**: Ensure these are set in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ODDS_API_KEY`
   - `CRON_SECRET`

**Features Lost if Restored:**
- Any picks generated after this checkpoint
- Odds history data after this checkpoint
- Algorithm run logs after this checkpoint

---

## 📈 NEXT STEPS

1. Fix cron job reliability
2. Verify odds data collection
3. Clean up test endpoints
4. Implement monitoring dashboard
5. Add more sophisticated factors
6. Build out DeepPick meta-algorithm

---

**Checkpoint Created By:** AI Assistant  
**Last Updated:** October 18, 2025  
**Git Commit:** (current HEAD)

