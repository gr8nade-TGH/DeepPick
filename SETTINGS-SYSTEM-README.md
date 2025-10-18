# ⚙️ DeepPick Settings & Monitoring System

## 🎯 What's New

I've added a comprehensive **Settings tab** to your Monitoring page that gives you full control over your data feeds, plus enhanced debug reporting to validate everything is working correctly.

---

## 📋 Setup Instructions

### Step 1: Run SQL in Supabase

1. Go to your Supabase dashboard
2. Click **SQL Editor** in the left sidebar
3. Open the file `SUPABASE-SQL-TO-RUN.sql` in this repo
4. Copy ALL the SQL and paste it into Supabase SQL Editor
5. Click **Run** (or press Ctrl+Enter)

This creates 3 new tables:
- `data_feed_settings` - Control fetch intervals per sport
- `cron_job_status` - Monitor automated job health
- `manual_triggers` - Log manual button clicks

### Step 2: Deploy to Vercel

The code is already pushed! Vercel should be deploying automatically.

### Step 3: Test the Settings Tab

1. Go to your Monitoring page: `https://deep-pick.vercel.app/monitoring`
2. Click the **Settings** tab (4th tab)
3. You should see controls for NFL, NBA, MLB

---

## 🎮 Features

### Data Feed Settings

For each sport, you can control:

1. **Enable/Disable Toggle** 
   - Click the toggle to turn data fetching on/off for that sport
   - Disabled sports won't make API calls (saves quota!)

2. **Fetch Interval** (dropdown)
   - 5 min (High API usage)
   - 10 min
   - **15 min (Recommended)** ← Default
   - 20 min
   - 30 min
   - 60 min (Low API usage)

3. **Active Hours** (time pickers)
   - Set start/end times for when to fetch data
   - Example: Only fetch NBA data from 6 PM to 11 PM on game days

4. **Season Info** (read-only)
   - Shows the typical season months for each sport
   - NFL: September - February
   - NBA: October - June
   - MLB: March - October

### Cron Job Status

Monitor all your automated background jobs:
- **odds_ingestion** - The main data fetcher
- **score_fetching** - Updates final scores
- **archive_games** - Cleans up old games
- **nexus_algorithm**, **shiva_algorithm**, etc. - Your betting bots

For each job, see:
- Last run time
- Success/failed status
- Total runs and success rate
- Duration in milliseconds

### Enhanced Debug Report

The "Debug Report" button now includes 2 new sections:

#### ⚙️ Settings Validation
- Shows which sports are enabled/disabled
- Lists fetch intervals for each sport
- Warns if all sports are disabled
- Alerts if intervals are too aggressive (<10 min)

#### 🤖 Cron Job Health
- Total jobs configured
- How many are healthy vs failed
- Jobs that have never run
- Success rate per job

---

## 🔧 How It Works

### 1. Settings Control Data Fetching

When you change a setting (e.g., disable MLB or change NFL to 30 min):
- The setting is saved to the `data_feed_settings` table
- The next time `/api/simple-ingest` runs, it checks these settings
- Only enabled sports are fetched
- Vercel cron jobs should respect the intervals (you'll need to update `vercel.json` manually for different intervals)

### 2. Cron Job Tracking

When a cron job runs:
- It should update the `cron_job_status` table (we'll need to add this logging to each job)
- The Settings tab displays this status
- You can see if jobs are failing or never running

### 3. Debug Report Validation

When you click "Debug Report":
- It fetches your current settings
- Validates that at least one sport is enabled
- Checks if fetch intervals are reasonable
- Analyzes cron job success rates
- Provides actionable warnings

---

## 🚀 Next Steps

### Immediate (Do Now)
1. **Run the SQL** in Supabase (`SUPABASE-SQL-TO-RUN.sql`)
2. **Test the Settings tab** - toggle a sport off, change an interval
3. **Generate a Debug Report** - see the new validation sections

### Future Enhancements

Based on The Odds API capabilities, we can add:

1. **Player Props Data**
   - Individual player statistics (points, rebounds, assists)
   - Player prop betting markets

2. **Live In-Game Odds**
   - Real-time odds updates during games
   - Track line movements as games progress

3. **Historical Odds Archive**
   - Store past odds for trend analysis
   - Improve predictive models with historical data

4. **Team Performance Metrics**
   - Last 5 games W/L records
   - Recent scoring trends
   - Home/away splits

5. **Injury Reports**
   - Player injury status
   - Expected return dates
   - Impact on odds

6. **Weather Data** (for outdoor sports)
   - Game location weather forecasts
   - Impact on totals (O/U)

---

## 📊 Current Data Sources

From The Odds API, we're currently fetching:
- **Moneyline odds** (who wins)
- **Spread odds** (point spread)
- **Totals** (over/under)
- **Bookmakers**: DraftKings, FanDuel, BetMGM, Caesars

We track:
- Odds changes over time (odds_history table)
- Bookmaker presence per game
- Large odds swings (anomaly detection)

---

## ⚠️ Important Notes

### API Quota Management
- The Odds API has daily/monthly limits
- Default: 500 requests/month on free tier
- Each sport fetch = 1 API call
- With 3 sports at 15-min intervals = ~8,640 calls/month
- **You'll need a paid plan or reduce intervals**

### Recommended Settings for Free Tier
If you're on the free tier (500 requests/month):
- **Disable 2 sports** (keep only NFL or NBA)
- Set interval to **60 minutes**
- This gives you ~720 calls/month (within limit)

### Vercel Cron Jobs
Currently, your `vercel.json` has a fixed 15-min cron:
```json
{
  "crons": [{
    "path": "/api/simple-ingest",
    "schedule": "*/15 * * * *"
  }]
}
```

To respect per-sport intervals, you'd need:
- Separate cron jobs per sport, OR
- A smarter cron that checks settings and decides what to fetch

---

## 🐛 Troubleshooting

### Settings tab is empty
- **Cause**: SQL tables not created
- **Fix**: Run `SUPABASE-SQL-TO-RUN.sql` in Supabase

### Settings changes don't affect data fetching
- **Cause**: Vercel cron is hardcoded to 15 min
- **Fix**: The simple-ingest will skip disabled sports, but intervals need manual cron updates

### Debug report shows "No settings found"
- **Cause**: `data_feed_settings` table doesn't exist
- **Fix**: Run the SQL migration

### Cron jobs show "Never Run"
- **Cause**: Jobs haven't been updated to log their status yet
- **Fix**: We'll need to add logging calls to each cron job endpoint

---

## 📝 Summary

You now have:
- ✅ **Settings Tab** - Control data feeds per sport
- ✅ **Cron Job Monitor** - See automated job health
- ✅ **Enhanced Debug Report** - Validate settings are working
- ✅ **Sport Enable/Disable** - Save API quota
- ✅ **Fetch Interval Control** - Adjust API call frequency
- ✅ **Active Hours** - Time-based data fetching (UI ready, logic pending)

Next debug report will show if your settings are configured correctly! 🎉


