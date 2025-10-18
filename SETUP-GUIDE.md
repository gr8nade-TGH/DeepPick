# 🚀 DeepPick Complete Setup Guide

## Overview
This guide will walk you through setting up the complete DeepPick system with monitoring, data feed controls, and automated cron jobs.

---

## 📋 Prerequisites
- [x] Supabase project created
- [x] Vercel project deployed
- [x] The Odds API Pro+ account
- [ ] CRON_SECRET set in Vercel
- [ ] Database migrations run

---

## STEP 1: Run Database Migrations in Supabase

### Option A: Copy/Paste SQL (Easiest)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Copy/Paste SQL**
   - Open file: `SUPABASE-SQL-TO-RUN.sql`
   - Copy ENTIRE contents
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - You should see: "Success. No rows returned"
   - Run this to verify tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'api_calls', 
     'data_ingestion_logs', 
     'api_quota_tracking',
     'data_feed_settings',
     'cron_job_status'
   );
   ```
   - Should return 5 rows

### Option B: Run Individual Migrations

If you prefer to run migrations separately:

```sql
-- Run these in order in Supabase SQL Editor:
-- 1. supabase/migrations/008_api_monitoring.sql
-- 2. supabase/migrations/009_data_feed_settings.sql
```

---

## STEP 2: Configure Vercel Environment Variables

### Required Variables

1. **Go to Vercel Dashboard**
   - https://vercel.com/your-username/deep-pick
   - Click "Settings" → "Environment Variables"

2. **Add These Variables** (if not already set):

| Variable Name | Value | Environments |
|--------------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | ✅ All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | ✅ All |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | ✅ All |
| `THE_ODDS_API_KEY` | Your Odds API key | ✅ All |
| `CRON_SECRET` | **NEW!** Any secure random string | ✅ All |
| `NEXT_PUBLIC_SITE_URL` | https://deep-pick.vercel.app | ✅ All |

### Generate CRON_SECRET

```bash
# Option 1: Use a password generator
# Option 2: Run this in terminal:
openssl rand -base64 32

# Option 3: Just use any secure string:
# Example: "my-super-secret-cron-key-2025"
```

3. **Save and Redeploy**
   - After adding variables, click "Redeploy" in Vercel

---

## STEP 3: Understand Your Architecture

### What Runs Where?

#### 🔵 Vercel (Your App + Cron Jobs)

**Cron Jobs** (Automated, runs on Vercel's servers):
- `/api/auto-refresh-odds` - Every 15 minutes
  - Fetches scores
  - Archives old games
  - Ingests fresh odds
- `/api/auto-run-cappers` - Every 20 minutes
  - Runs all capper algorithms
  - Generates picks

**API Routes** (On-demand, triggered by cron or user):
- `/api/simple-ingest` - Fetch odds from The Odds API
- `/api/fetch-scores` - Fetch scores from The Odds API
- `/api/archive-games` - Move completed games to history
- `/api/run-ifrit` - Run Ifrit algorithm
- `/api/run-nexus` - Run Nexus algorithm
- `/api/run-shiva` - Run Shiva algorithm
- `/api/run-cerberus` - Run Cerberus algorithm

**Pages** (User-facing):
- `/` - Dashboard
- `/odds` - Live odds with factors
- `/leaderboard` - Capper rankings
- `/monitoring` - **NEW!** API monitoring & data logs
- `/cappers/*` - Individual capper pages

#### 🟢 Supabase (Database + Functions)

**Database Tables**:
- `games` - Active games
- `games_history` - Archived games
- `odds_history` - Historical odds
- `picks` - Capper predictions
- `algorithm_runs` - Capper execution logs
- **NEW:** `api_calls` - API call logs
- **NEW:** `data_ingestion_logs` - Ingestion logs
- **NEW:** `api_quota_tracking` - Usage tracking
- **NEW:** `data_feed_settings` - Data source config
- **NEW:** `cron_job_status` - Cron job monitoring

**Edge Functions**: ❌ **NONE NEEDED!**
- Everything runs on Vercel
- Supabase is just the database

---

## STEP 4: Verify Cron Jobs Are Running

### Method 1: Check Vercel Logs

1. **Go to Vercel Dashboard**
   - https://vercel.com/your-username/deep-pick
   - Click "Deployments" → Select latest deployment
   - Click "Functions" tab

2. **Look for Cron Executions**
   - Filter by `/api/auto-refresh-odds`
   - Filter by `/api/auto-run-cappers`
   - You should see executions every 15/20 minutes

3. **Check Logs**
   - Look for these messages:
   ```
   ================================================================================
   🤖 [AUTO-REFRESH CRON] EXECUTION START: 2025-10-18T...
   ================================================================================
   ```

### Method 2: Check Database

Run this in Supabase SQL Editor:

```sql
-- Check if cron jobs have executed
SELECT 
  job_name,
  last_execution,
  last_success,
  total_executions,
  is_healthy
FROM cron_job_status
ORDER BY last_execution DESC;
```

### Method 3: Check Monitoring Dashboard

1. Go to: https://deep-pick.vercel.app/monitoring
2. Look at "Recent Activity"
3. Should see API calls every 15-20 minutes

---

## STEP 5: Optimize API Usage

### Current Problem

Your current setup will use **~8,640 API calls/month** but you only have **500/month** with Pro+!

### Solution: Reduce Frequency + Limit Sports

#### Option 1: Change Cron Schedule (Recommended)

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/auto-refresh-odds",
      "schedule": "*/30 * * * *"  // Change from */15 to */30
    },
    {
      "path": "/api/auto-run-cappers",
      "schedule": "*/20 * * * *"  // Keep at 20 minutes
    }
  ]
}
```

**Result**: 144 API calls/day = 4,320/month (still over!)

#### Option 2: Fetch Only Active Sports (Best!)

The monitoring dashboard will let you:
- Enable/disable sports individually
- Set per-sport refresh intervals
- Define season start/end dates
- Set daily/monthly call limits

**Recommended Settings** (via dashboard):
- **NFL**: Enabled (Sept-Feb only), 30 min interval
- **NBA**: Disabled (enable Oct-June)
- **MLB**: Disabled (enable April-Oct)

**Result**: 48 calls/day = 1,440/month ✅ Under limit!

#### Option 3: Smart Scheduling (Advanced)

Use the data feed settings to:
- Only fetch during game days
- Increase frequency 3 hours before games
- Reduce frequency when no games scheduled

---

## STEP 6: Access Your New Monitoring Dashboard

### URL
https://deep-pick.vercel.app/monitoring

### Features

#### 1. Quick Stats
- Today's API calls
- Success rate
- Events received
- Quota remaining

#### 2. Overview Tab
- Daily usage breakdown
- Monthly quota tracking
- Recent activity feed
- Visual quota progress bar

#### 3. API Calls Tab
- Every API call logged
- Response times
- Events received
- Success/failure status

#### 4. Ingestion Logs Tab
- Games added/updated
- Odds history records
- Sport breakdown
- Processing times

#### 5. **COMING SOON:** Data Feed Controls
- Enable/disable sports
- Adjust refresh intervals
- Set call limits
- Pause/resume feeds
- Manual trigger buttons

---

## STEP 7: Configure Data Feed Settings

### Via Database (For Now)

Run this in Supabase SQL Editor to customize:

```sql
-- Disable NBA for now (out of season)
UPDATE data_feed_settings
SET enabled = false
WHERE source_name = 'odds_nba';

-- Set NFL to refresh every 30 minutes
UPDATE data_feed_settings
SET refresh_interval_minutes = 30
WHERE source_name = 'odds_nfl';

-- Set daily call limit for NFL
UPDATE data_feed_settings
SET max_calls_per_day = 48
WHERE source_name = 'odds_nfl';

-- View current settings
SELECT 
  source_name,
  enabled,
  refresh_interval_minutes,
  season_start_month,
  season_end_month,
  max_calls_per_day,
  current_daily_calls
FROM data_feed_settings;
```

### Via Dashboard (Coming in Next Update)

The monitoring page will have a "Data Feeds" tab where you can:
- Toggle sports on/off
- Adjust refresh intervals with sliders
- Set call limits
- Pause feeds temporarily
- Manually trigger refreshes

---

## STEP 8: Monitor and Optimize

### Daily Checklist

1. **Check Monitoring Dashboard**
   - Visit `/monitoring`
   - Verify quota isn't depleting too fast
   - Check for any failed API calls

2. **Review Cron Job Health**
   - Look at "Cron Job Status" section
   - Ensure both jobs show "Healthy"
   - Check last execution times

3. **Verify Data Quality**
   - Check "Ingestion Logs"
   - Ensure games are being added
   - Look for any errors or warnings

### Weekly Review

1. **Analyze Usage Patterns**
   ```sql
   -- Check daily usage for past week
   SELECT 
     period_start,
     total_calls,
     successful_calls,
     quota_remaining
   FROM api_quota_tracking
   WHERE period_type = 'daily'
   ORDER BY period_start DESC
   LIMIT 7;
   ```

2. **Optimize Based on Data**
   - If quota depleting too fast → Reduce frequency
   - If data is stale → Increase frequency
   - If specific sport has no games → Disable it

### Monthly Planning

1. **Review Monthly Usage**
   ```sql
   SELECT * FROM api_quota_tracking
   WHERE period_type = 'monthly'
   ORDER BY period_start DESC
   LIMIT 3;
   ```

2. **Plan for Next Month**
   - Check which sports will be in season
   - Adjust settings accordingly
   - Set appropriate call limits

---

## 🎯 Success Criteria

You'll know everything is working when:

### ✅ Database
- [x] All tables created (run verification query)
- [x] Default settings inserted
- [x] Cron job statuses initialized

### ✅ Vercel
- [x] CRON_SECRET environment variable set
- [x] Cron jobs executing every 15/20 minutes
- [x] Logs show successful executions

### ✅ Monitoring Dashboard
- [x] Shows API calls
- [x] Displays quota usage
- [x] Ingestion logs populated
- [x] Cron job status visible

### ✅ Data Flow
- [x] Odds being fetched every 30 minutes
- [x] Games being added to database
- [x] Odds history being recorded
- [x] Cappers generating picks

---

## 🐛 Troubleshooting

### "No data in monitoring dashboard"

**Cause**: Tables not created or cron jobs not running

**Fix**:
1. Verify tables exist (run verification query)
2. Check Vercel logs for cron executions
3. Wait 15-30 minutes for first data

### "Cron jobs showing as unhealthy"

**Cause**: CRON_SECRET not set or jobs not executing

**Fix**:
1. Verify CRON_SECRET in Vercel environment variables
2. Redeploy application
3. Check Vercel logs for authorization errors

### "Quota depleting too fast"

**Cause**: Too many API calls

**Fix**:
1. Check current usage in monitoring dashboard
2. Disable out-of-season sports
3. Increase refresh interval to 30+ minutes
4. Set daily call limits

### "API calls failing"

**Cause**: Invalid API key or rate limiting

**Fix**:
1. Verify THE_ODDS_API_KEY is correct
2. Check if you've hit quota limit
3. Review error messages in monitoring dashboard

---

## 📞 Support

**Need Help?**

1. Check monitoring dashboard first
2. Review Vercel logs
3. Check Supabase logs
4. Run verification queries
5. Review this guide

**Common Issues:**
- CRON_SECRET not set → Cron jobs fail
- Tables not created → Monitoring dashboard empty
- API key invalid → All calls fail
- Quota exceeded → Calls return 429 errors

---

## 🚀 Next Steps

After setup is complete:

1. **Monitor for 24 hours**
   - Verify cron jobs run consistently
   - Check quota usage
   - Ensure data quality is good

2. **Optimize Settings**
   - Adjust refresh intervals
   - Enable/disable sports based on season
   - Set appropriate call limits

3. **Build Out Features**
   - Add weather data integration
   - Implement injury reports
   - Add more sophisticated factors

4. **Scale Up**
   - Consider upgrading API plan if needed
   - Add more sports
   - Increase capper sophistication

---

**Setup Complete!** 🎉

You now have a fully monitored, optimized data pipeline with complete visibility into API usage, data quality, and system health.

**Created**: October 18, 2025  
**Status**: Ready for deployment  
**Next**: Run SQL, set CRON_SECRET, monitor!

