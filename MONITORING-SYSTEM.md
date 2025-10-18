# 📊 API Monitoring & Data Logging System

## Overview

The DeepPick monitoring system tracks every API call, data ingestion, and usage quota in real-time. This helps you:
- **Track API usage** against your Pro+ quota
- **Monitor data quality** and completeness
- **Debug issues** with detailed logs
- **Optimize costs** by understanding usage patterns
- **Ensure reliability** by tracking success rates

---

## 🗄️ Database Tables

### 1. `api_calls`
Logs every external API call (The Odds API, future APIs)

**Key Fields:**
- `api_provider` - Which API ('the_odds_api', 'weather_api', etc.)
- `endpoint` - Specific endpoint called
- `response_status` - HTTP status code (200, 404, 429, etc.)
- `response_time_ms` - How long the call took
- `events_received` - Number of games/events returned
- `bookmakers_received` - List of bookmakers in response
- `api_calls_remaining` - From API response headers
- `success` - Boolean success/failure
- `triggered_by` - 'cron', 'manual', 'user_action'

**Automatically tracks:**
- API quota usage
- Response times
- Error rates
- Data received per call

### 2. `data_ingestion_logs`
Tracks what data was stored from each API call

**Key Fields:**
- `games_added` - New games inserted
- `games_updated` - Existing games updated
- `games_skipped` - Games not processed
- `odds_history_records_created` - Historical data points
- `games_missing_odds` - Data quality metric
- `sport_breakdown` - Games per sport (JSON)
- `bookmaker_breakdown` - Coverage per bookmaker (JSON)

### 3. `api_quota_tracking`
Daily and monthly usage summaries

**Key Fields:**
- `period_type` - 'daily' or 'monthly'
- `total_calls` - Total API calls in period
- `successful_calls` / `failed_calls` - Success rate
- `quota_remaining` - Calls left in quota
- `quota_used_percentage` - % of quota used

**Auto-updates via trigger** when new API calls are logged

### 4. `data_quality_metrics`
Track data completeness and freshness over time

**Key Fields:**
- `games_with_complete_odds` - Quality metric
- `average_bookmakers_per_game` - Coverage metric
- `average_odds_age_minutes` - Freshness metric
- `api_success_rate` - Reliability metric

---

## 📱 Monitoring Dashboard

**URL:** `/monitoring`

### Features:
1. **Quick Stats Cards**
   - Today's API calls
   - Success rate
   - Events received
   - Quota remaining

2. **Overview Tab**
   - Daily usage breakdown
   - Monthly quota tracking
   - Recent activity feed
   - Visual quota progress bar

3. **API Calls Tab**
   - Detailed table of all API calls
   - Filter by provider, status
   - Response times and event counts
   - Triggered by (cron vs manual)

4. **Ingestion Logs Tab**
   - Games added/updated per run
   - Odds history records created
   - Sport and bookmaker breakdown
   - Processing times

---

## 🔧 How It Works

### Automatic Logging

Every time `simple-ingest` runs:

1. **Before API Call:**
   - Records timestamp
   - Prepares logging

2. **During API Call:**
   - Measures response time
   - Captures response headers (quota info)
   - Extracts bookmakers and sports

3. **After API Call:**
   - Logs to `api_calls` table
   - Stores first event as sample
   - Records success/failure

4. **After Data Processing:**
   - Logs to `data_ingestion_logs`
   - Tracks games added/updated
   - Records data quality metrics

5. **Automatic Quota Update:**
   - Trigger updates `api_quota_tracking`
   - Calculates daily and monthly totals
   - Updates remaining quota

### Manual Logging

You can also log custom API calls:

```typescript
import { logApiCall, logIngestion } from '@/lib/monitoring/api-logger'

// Log an API call
const apiCallId = await logApiCall({
  apiProvider: 'the_odds_api',
  endpoint: '/v4/sports/nfl/odds',
  responseStatus: 200,
  responseTimeMs: 1250,
  eventsReceived: 15,
  bookmakersReceived: ['draftkings', 'fanduel'],
  sportsReceived: ['nfl'],
  success: true,
  triggeredBy: 'manual'
})

// Log ingestion results
await logIngestion({
  apiCallId,
  gamesAdded: 5,
  gamesUpdated: 10,
  oddsHistoryRecordsCreated: 15,
  success: true
})
```

---

## 📈 Understanding Your Usage

### The Odds API Pro+ Limits

**Pro+ Plan:**
- **500 requests/month**
- Resets on 1st of each month
- Overage charges apply

**Current Strategy:**
- Cron runs every 15 minutes = **96 calls/day**
- 3 sports per run = **288 API calls/day**
- **~8,640 calls/month** ⚠️ **WAY OVER LIMIT!**

### ⚠️ CRITICAL: Optimize API Usage

**Problem:** Current setup will exhaust quota in ~1.7 days!

**Solutions:**

1. **Reduce Sports** (Easiest)
   - Only fetch 1 sport per cron cycle
   - Rotate: NFL → NBA → MLB → NFL
   - Reduces to **96 calls/day** = **2,880/month** (still over!)

2. **Increase Cron Interval** (Recommended)
   - Change from 15 min → 30 min
   - Reduces to **48 calls/day** per sport
   - 3 sports = **144 calls/day** = **4,320/month** (still over!)

3. **Fetch Only Active Sports** (Best)
   - Check which sports are in season
   - NFL: Sept-Feb
   - NBA: Oct-June
   - MLB: April-Oct
   - Only fetch 1-2 active sports
   - **48-96 calls/day** = **1,440-2,880/month**

4. **Smart Caching** (Advanced)
   - Don't fetch if no games in next 7 days
   - Reduce frequency for games >24 hours away
   - Increase frequency for games <3 hours away

### Recommended Configuration

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/auto-refresh-odds",
      "schedule": "*/30 * * * *"  // Every 30 minutes (was 15)
    }
  ]
}

// simple-ingest.ts
// Only fetch sports currently in season
const sports = getCurrentSeasonSports() // Returns 1-2 sports
```

**Result:**
- 48 calls/day × 30 days = **1,440 calls/month**
- Well under 500 limit ✅
- Still updates every 30 minutes
- Focuses on active sports

---

## 🎯 Monitoring Best Practices

### 1. Check Dashboard Daily
- Monitor quota usage
- Watch for error spikes
- Verify data completeness

### 2. Set Up Alerts (Future)
- Email when quota >80%
- Alert on API failures
- Notify on data quality issues

### 3. Review Weekly
- Analyze usage patterns
- Optimize API calls
- Check data coverage

### 4. Monthly Review
- Compare to previous month
- Adjust strategy if needed
- Plan for next month

---

## 🔍 Troubleshooting

### "No data in monitoring dashboard"

**Cause:** Tables not created yet

**Fix:**
```sql
-- Run in Supabase SQL Editor
-- Execute: supabase/migrations/008_api_monitoring.sql
```

### "Quota remaining shows null"

**Cause:** The Odds API doesn't return quota headers

**Fix:** The Odds API Pro+ should return `x-requests-remaining` header. Check API documentation or contact support.

### "Too many API calls"

**Cause:** Cron running too frequently or fetching too many sports

**Fix:**
1. Check `api_quota_tracking` table
2. Reduce cron frequency
3. Limit sports fetched
4. Implement smart caching

### "Data quality score low"

**Cause:** Incomplete data from API or processing errors

**Fix:**
1. Check `data_ingestion_logs` for errors
2. Review `games_missing_odds` count
3. Verify bookmaker availability
4. Check API response samples

---

## 📊 SQL Queries for Analysis

### Check Daily Usage
```sql
SELECT 
  period_start,
  total_calls,
  successful_calls,
  failed_calls,
  quota_remaining
FROM api_quota_tracking
WHERE period_type = 'daily'
ORDER BY period_start DESC
LIMIT 7;
```

### Find Slowest API Calls
```sql
SELECT 
  endpoint,
  AVG(response_time_ms) as avg_time,
  MAX(response_time_ms) as max_time,
  COUNT(*) as call_count
FROM api_calls
WHERE request_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY avg_time DESC;
```

### Data Quality Report
```sql
SELECT 
  created_at::date as date,
  SUM(games_added) as total_added,
  SUM(games_updated) as total_updated,
  SUM(games_missing_odds) as missing_odds,
  AVG(processing_time_ms) as avg_processing_time
FROM data_ingestion_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY created_at::date
ORDER BY date DESC;
```

### API Success Rate
```sql
SELECT 
  api_provider,
  COUNT(*) as total_calls,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM api_calls
WHERE request_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY api_provider;
```

---

## 🚀 Future Enhancements

### Phase 2
- [ ] Email alerts for quota thresholds
- [ ] Slack/Discord notifications
- [ ] Cost tracking and projections
- [ ] Automated optimization recommendations

### Phase 3
- [ ] ML-based usage prediction
- [ ] Dynamic cron scheduling
- [ ] Multi-API provider support
- [ ] Advanced data quality scoring

### Phase 4
- [ ] Real-time dashboard updates (WebSocket)
- [ ] Historical trend analysis
- [ ] Comparative analysis (month-over-month)
- [ ] Export reports (PDF/CSV)

---

## 📞 Support

**Questions?** Check:
1. This documentation
2. `CLEANUP-SUMMARY.md` for system overview
3. `CHECKPOINT-2025-10-18.md` for current state
4. Supabase logs for errors
5. Vercel logs for cron execution

**Need Help?**
- Check monitoring dashboard first
- Review recent API calls
- Analyze ingestion logs
- Check quota usage

---

**Created:** October 18, 2025  
**Status:** Ready for deployment  
**Next Step:** Run migration 008 in Supabase

