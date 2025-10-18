# ⚡ Vercel vs Supabase: What Goes Where?

## Quick Answer

**Vercel**: Your app, API routes, and cron jobs  
**Supabase**: Your database (PostgreSQL)  
**Supabase Edge Functions**: ❌ **NOT USED** (everything runs on Vercel)

---

## 🔵 VERCEL (Your Application Platform)

### What Runs on Vercel?

#### 1. **Next.js Application**
- All your pages (`/`, `/odds`, `/monitoring`, etc.)
- All React components
- Client-side JavaScript
- Static assets

#### 2. **API Routes** (Serverless Functions)
Located in `src/app/api/`:

**Odds Management:**
- `/api/odds` - Fetch games for display
- `/api/ingest-odds` - Manual odds ingestion
- `/api/simple-ingest` - Simplified odds ingestion ⭐ **Main ingestion endpoint**
- `/api/odds-history` - Historical odds for charts
- `/api/game-factors` - Betting factors analysis

**Game Lifecycle:**
- `/api/fetch-scores` - Get scores from Odds API
- `/api/archive-games` - Move completed games to history
- `/api/auto-refresh-odds` - ⭐ **Cron job orchestrator**

**Picks System:**
- `/api/picks` - Fetch picks with filters
- `/api/place-pick` - Create new pick
- `/api/performance` - Calculate capper stats

**Capper Algorithms:**
- `/api/run-ifrit` - Execute Ifrit algorithm
- `/api/run-nexus` - Execute Nexus algorithm
- `/api/run-shiva` - Execute Shiva algorithm
- `/api/run-cerberus` - Execute Cerberus algorithm
- `/api/auto-run-cappers` - ⭐ **Cron job orchestrator**
- `/api/algorithm-logs` - Fetch execution logs

**Monitoring:**
- `/api/monitoring/api-calls` - Fetch API call logs
- `/api/monitoring/quota` - Get usage summary
- `/api/monitoring/ingestion-logs` - Get ingestion history

#### 3. **Cron Jobs** (Automated Tasks)

Defined in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/auto-refresh-odds",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/auto-run-cappers",
      "schedule": "*/20 * * * *"
    }
  ]
}
```

**How Vercel Cron Works:**
1. Vercel's servers call your API route on schedule
2. Sends `Authorization: Bearer ${CRON_SECRET}` header
3. Your API route verifies the secret
4. Executes the logic
5. Returns response

**Security:**
- Cron jobs send `CRON_SECRET` in Authorization header
- Your API routes verify this secret
- Prevents unauthorized access

---

## 🟢 SUPABASE (Your Database)

### What's on Supabase?

#### 1. **PostgreSQL Database**

**Tables:**
- `games` - Active games
- `games_history` - Archived games
- `odds_history` - Historical odds data
- `picks` - Capper predictions
- `algorithm_runs` - Capper execution logs
- `api_calls` - API call logs
- `data_ingestion_logs` - Ingestion logs
- `api_quota_tracking` - Usage tracking
- `data_feed_settings` - Data source configuration
- `cron_job_status` - Cron job monitoring
- `manual_triggers` - Manual trigger logs
- `data_quality_metrics` - Data quality tracking

**Functions:**
- `update_api_quota()` - Auto-updates quota tracking
- `check_cron_health()` - Checks if cron jobs are healthy
- `update_cron_execution()` - Updates cron job stats
- `should_data_source_run()` - Checks if data source should fetch

**Triggers:**
- `trigger_update_api_quota` - Fires when new API call logged

#### 2. **Row Level Security (RLS)**
- Public read access to all tables
- Service role full access (for API routes)

#### 3. **Supabase Edge Functions**

**Status**: ❌ **NOT USED**

**Why?**
- Everything runs on Vercel (simpler architecture)
- Vercel has built-in cron jobs
- No need for separate Edge Functions
- All logic in Next.js API routes

**If you wanted to use them** (not recommended):
- Would need to deploy functions to Supabase
- Would need to configure secrets in Supabase dashboard
- Would add complexity
- Current setup is better!

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  CRON JOB (Every 15 min)                             │  │
│  │  /api/auto-refresh-odds                              │  │
│  │                                                       │  │
│  │  1. Calls /api/fetch-scores                          │  │
│  │     ↓ Fetches from The Odds API                      │  │
│  │     ↓ Updates games table in Supabase                │  │
│  │                                                       │  │
│  │  2. Calls /api/archive-games                         │  │
│  │     ↓ Moves completed games to games_history         │  │
│  │                                                       │  │
│  │  3. Calls /api/simple-ingest                         │  │
│  │     ↓ Fetches from The Odds API                      │  │
│  │     ↓ Inserts into games table                       │  │
│  │     ↓ Inserts into odds_history table                │  │
│  │     ↓ Logs to api_calls table                        │  │
│  │     ↓ Logs to data_ingestion_logs table              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  CRON JOB (Every 20 min)                             │  │
│  │  /api/auto-run-cappers                               │  │
│  │                                                       │  │
│  │  1. Calls /api/run-ifrit                             │  │
│  │  2. Calls /api/run-nexus                             │  │
│  │  3. Calls /api/run-shiva                             │  │
│  │  4. Calls /api/run-cerberus                          │  │
│  │     ↓ Each fetches games from Supabase               │  │
│  │     ↓ Generates picks                                │  │
│  │     ↓ Inserts into picks table                       │  │
│  │     ↓ Logs to algorithm_runs table                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  USER VISITS /monitoring                             │  │
│  │                                                       │  │
│  │  1. Calls /api/monitoring/api-calls                  │  │
│  │     ↓ Fetches from api_calls table                   │  │
│  │                                                       │  │
│  │  2. Calls /api/monitoring/quota                      │  │
│  │     ↓ Fetches from api_quota_tracking table          │  │
│  │                                                       │  │
│  │  3. Calls /api/monitoring/ingestion-logs             │  │
│  │     ↓ Fetches from data_ingestion_logs table         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
                    (Database Queries)
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                  │  │
│  │                                                       │  │
│  │  • games                                              │  │
│  │  • games_history                                      │  │
│  │  • odds_history                                       │  │
│  │  • picks                                              │  │
│  │  • algorithm_runs                                     │  │
│  │  • api_calls                                          │  │
│  │  • data_ingestion_logs                                │  │
│  │  • api_quota_tracking                                 │  │
│  │  • data_feed_settings                                 │  │
│  │  • cron_job_status                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Environment Variables

### Vercel Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Purpose | Where Used |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client & Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Client & Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Server only |
| `THE_ODDS_API_KEY` | The Odds API key | Server only |
| `CRON_SECRET` | Security for cron jobs | Server only |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL | Server only |

### Supabase Environment Variables

**Status**: ❌ **NOT NEEDED**

Since we're not using Supabase Edge Functions, you don't need to set any environment variables in Supabase.

---

## 🎯 Why This Architecture?

### Advantages

1. **Simplicity**
   - Everything in one place (Vercel)
   - No need to manage two serverless platforms
   - Easier to debug

2. **Cost**
   - Vercel's free tier includes cron jobs
   - No extra cost for Edge Functions
   - Supabase free tier for database

3. **Performance**
   - Direct database access from API routes
   - No extra network hops
   - Faster response times

4. **Developer Experience**
   - All code in one repo
   - Single deployment process
   - Unified logging

### When You Might Use Supabase Edge Functions

- If you need to run code closer to your database
- If you want database-triggered functions
- If you need real-time subscriptions with server-side logic
- If you're hitting Vercel's function limits

**For DeepPick**: Current architecture is optimal! ✅

---

## 📊 Deployment Checklist

### Vercel Setup

- [x] Project deployed
- [ ] Environment variables set:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `THE_ODDS_API_KEY`
  - [ ] `CRON_SECRET` ⭐ **Important!**
  - [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] `vercel.json` includes cron jobs
- [ ] Cron jobs executing (check logs)

### Supabase Setup

- [x] Project created
- [ ] SQL migrations run:
  - [ ] `SUPABASE-SQL-TO-RUN.sql` executed
  - [ ] Tables created (verify with query)
  - [ ] Default data inserted
- [ ] RLS policies enabled
- [ ] Connection string working

### Verification

- [ ] Visit `/monitoring` - should show data
- [ ] Check Vercel logs - cron jobs executing
- [ ] Check Supabase logs - queries running
- [ ] Run verification queries - data flowing

---

## 🚀 Summary

**What You Need to Do:**

1. **In Supabase:**
   - Run `SUPABASE-SQL-TO-RUN.sql`
   - Verify tables created
   - ✅ Done! Nothing else needed

2. **In Vercel:**
   - Set all environment variables
   - Especially `CRON_SECRET`!
   - Redeploy
   - Verify cron jobs running

3. **Monitor:**
   - Visit `/monitoring` dashboard
   - Check API usage
   - Verify data flowing
   - Optimize settings

**That's it!** 🎉

No Edge Functions to deploy, no complex configuration, just database + app + cron jobs!

---

**Created**: October 18, 2025  
**Architecture**: Vercel (App + Cron) + Supabase (Database)  
**Status**: Production-ready ✅

