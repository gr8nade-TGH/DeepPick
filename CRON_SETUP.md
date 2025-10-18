# 🤖 Automated Cron Jobs Setup

## Overview

The application now has **fully automated** odds fetching, score updates, and pick grading!

---

## 🔄 Cron Jobs

### 1. **Score Fetching** (Every 10 minutes)
- **Path:** `/api/fetch-scores`
- **Schedule:** `*/10 * * * *` (every 10 minutes)
- **What it does:**
  - Fetches final scores from The Odds API
  - Updates games with `status='final'` and scores
  - **Triggers auto-grading** of all pending picks
  - Picks are automatically graded as won/lost/push

### 2. **Odds Refresh** (Every 5 minutes)
- **Path:** `/api/auto-refresh-odds`
- **Schedule:** `*/5 * * * *` (every 5 minutes)
- **What it does:**
  1. Fetches scores (triggers grading)
  2. Archives old completed games
  3. Ingests fresh odds from The Odds API
  4. Updates odds_history for charting

---

## 📋 Setup Instructions

### 1. Add Environment Variable to Vercel

Go to your Vercel project settings and add:

```
NEXT_PUBLIC_SITE_URL=https://deep-pick.vercel.app
```

This allows the cron jobs to call internal API routes.

### 2. Deploy

The `vercel.json` file is already configured. Just push to deploy:

```bash
git add -A
git commit -m "Add automated cron jobs"
git push origin main
```

### 3. Verify Cron Jobs

After deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. You should see:
   - ✅ `/api/fetch-scores` - Every 10 minutes
   - ✅ `/api/auto-refresh-odds` - Every 5 minutes

---

## 🎯 What Happens Automatically

### When a Game Finishes:

```
Every 10 minutes:
  ↓
Cron calls /api/fetch-scores
  ↓
Fetches completed games from The Odds API
  ↓
Updates game.status = 'final'
  ↓
Database trigger fires: grade_picks_for_game()
  ↓
All pending picks for that game are graded
  ↓
Pick status updated: won/lost/push
  ↓
Net units calculated and stored
  ↓
Dashboard shows results automatically!
```

### Every 5 Minutes:

```
Cron calls /api/auto-refresh-odds
  ↓
1. Fetch scores (grade picks)
  ↓
2. Archive old games (>2-5 hours old)
  ↓
3. Ingest fresh odds (update odds_history)
  ↓
Charts update with new odds data
  ↓
Live odds page shows latest odds
```

---

## 🧪 Testing

### Manual Test:
You can manually trigger the cron job:

```bash
curl -X POST https://deep-pick.vercel.app/api/auto-refresh-odds
```

Or visit in browser:
```
https://deep-pick.vercel.app/api/auto-refresh-odds
```

### Check Logs:
- Go to Vercel Dashboard → Your Project → Deployments
- Click on latest deployment → Functions
- View logs for `/api/auto-refresh-odds` and `/api/fetch-scores`

---

## ⚙️ Configuration

### Adjust Frequency:

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/fetch-scores",
      "schedule": "*/15 * * * *"  // Change to 15 minutes
    },
    {
      "path": "/api/auto-refresh-odds",
      "schedule": "0 * * * *"  // Change to hourly
    }
  ]
}
```

### Cron Schedule Format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0 and 7 = Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

Examples:
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours
- `0 0 * * *` - Daily at midnight

---

## 🚨 Important Notes

1. **Vercel Cron Limits:**
   - Hobby plan: Limited cron executions
   - Pro plan: More generous limits
   - Check your plan limits

2. **The Odds API Rate Limits:**
   - Free tier: 500 requests/month
   - With 3 sports × 12 calls/hour = ~2,160 requests/month
   - Monitor your usage at: https://the-odds-api.com/account/

3. **Cost Optimization:**
   - Reduce frequency if hitting limits
   - Consider upgrading API plan if needed
   - Monitor Vercel function execution time

---

## 📊 Monitoring

### Check if it's working:

1. **Dashboard** - See picks auto-grading after games finish
2. **Live Odds** - See odds updating every 5 minutes
3. **Vercel Logs** - Check function execution logs
4. **Database** - Query `odds_history` to see new records

### SQL to check last update:
```sql
SELECT MAX(captured_at) as last_update 
FROM odds_history;
```

---

## 🎉 Benefits

✅ **No manual clicking required**  
✅ **Picks grade automatically when games finish**  
✅ **Odds stay fresh every 5 minutes**  
✅ **Old games archived automatically**  
✅ **Charts update with new data**  
✅ **Fully hands-off operation**  

---

**You're now running a fully automated sports betting tracker!** 🚀

