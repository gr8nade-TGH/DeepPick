# 🔍 SHIVA Diagnostics Guide

## Problem Statement

The SHIVA management dashboard at `https://deep-pick.vercel.app/cappers/shiva/management` shows empty tables:
- **Run Log Table** - Should show all pick generation attempts
- **Cooldown Table** - Should show active/expired cooldowns

This guide will help you identify and fix the root cause.

---

## 🛠️ Diagnostic Tools Created

I've created 4 powerful diagnostic tools to help identify the issue:

### 1. **Diagnostic Dashboard** (Visual Interface)
**URL:** `https://deep-pick.vercel.app/debug/shiva`

**What it does:**
- Runs comprehensive system health checks
- Shows database state (games, runs, cooldowns, locks)
- Allows manual cron triggering
- Displays all issues in an easy-to-read format

**How to use:**
1. Visit the URL
2. Click "Run Full Diagnostics" to check system health
3. Click "Check Database State" to see table counts
4. Click "Trigger Cron Manually" to test pick generation

---

### 2. **System Diagnostics API**
**Endpoint:** `https://deep-pick.vercel.app/api/debug/shiva-diagnostics`

**What it checks:**
- ✅ Environment variables (DISABLE_SHIVA_CRON, SHIVA_V1_WRITE_ENABLED, etc.)
- ✅ Database connectivity
- ✅ Active NBA games
- ✅ Recent runs (last 10)
- ✅ Cooldown records
- ✅ System locks (stale lock detection)
- ✅ Database functions (acquire_shiva_lock)

**Returns:**
```json
{
  "health": "critical|warning|healthy",
  "health_message": "Description of overall health",
  "summary": {
    "critical_issues": ["🚨 Issue 1", "🚨 Issue 2"],
    "warnings": ["⚠️ Warning 1"],
    "info": []
  },
  "checks": {
    "environment": { ... },
    "database": { ... },
    "games": { ... },
    "runs": { ... },
    "cooldowns": { ... },
    "locks": { ... },
    "functions": { ... }
  }
}
```

---

### 3. **Database State API**
**Endpoint:** `https://deep-pick.vercel.app/api/debug/database-state`

**What it shows:**
- Total NBA games (all statuses)
- Active games (scheduled, pre-game, in-progress)
- Total runs and runs in last 24h
- Total picks and picks in last 24h
- Active vs expired cooldowns
- System locks and their age
- Latest run details

**Returns:**
```json
{
  "tables": {
    "games": {
      "total_nba_games": 10,
      "active_games": 5,
      "recent_active": [...]
    },
    "runs": {
      "total_runs": 50,
      "runs_last_24h": 0,
      "latest_run": { ... }
    },
    "cooldowns": {
      "total_cooldowns": 20,
      "active_cooldowns": 3,
      "recent_cooldowns": [...]
    }
  },
  "diagnosis": [
    "🚨 NO ACTIVE NBA GAMES - This is the primary reason no picks are being generated"
  ]
}
```

---

### 4. **Manual Cron Trigger API**
**Endpoint:** `https://deep-pick.vercel.app/api/debug/trigger-shiva`

**What it does:**
- Manually triggers the SHIVA auto-picks cron job
- Bypasses Vercel's cron scheduler
- Returns detailed execution log

**Returns:**
```json
{
  "result": "success|failed|error",
  "outcome": "PICK_GENERATED|PASS|NO_ELIGIBLE_GAMES",
  "cronResponse": {
    "status": 200,
    "data": { ... }
  },
  "steps": [
    { "step": "init", "message": "...", "timestamp": "..." },
    { "step": "calling_cron", "message": "...", "timestamp": "..." },
    { "step": "cron_response", "status": 200, "duration_ms": 1234 }
  ]
}
```

---

## 🔍 Common Issues & Solutions

### Issue 1: No Active NBA Games
**Symptom:** Diagnostics shows "🚨 NO ACTIVE NBA GAMES"

**Cause:** The `games` table has no upcoming NBA games

**Solution:**
1. Check if the odds ingestion cron is running: `/api/cron/sync-mysportsfeeds-odds`
2. Verify MySportsFeeds API key is set in Vercel
3. Manually trigger odds sync to populate games

---

### Issue 2: Cron Not Executing
**Symptom:** No runs in last 24 hours

**Possible Causes:**
- `DISABLE_SHIVA_CRON=true` in Vercel (check diagnostics)
- Vercel cron not configured properly
- Stale lock blocking execution

**Solution:**
1. Check environment variable: `DISABLE_SHIVA_CRON` should be `false` or not set
2. Verify `vercel.json` has the cron configured
3. Check Vercel dashboard → Cron Jobs to see execution history
4. Clear stale locks: `DELETE FROM system_locks WHERE lock_key = 'shiva_auto_picks_lock'`

---

### Issue 3: All Games in Cooldown
**Symptom:** Diagnostics shows "⚠️ ALL GAMES ARE IN COOLDOWN"

**Cause:** Every eligible game has an active 2-hour cooldown

**Solution:**
- Wait for cooldowns to expire (2 hours from last attempt)
- OR manually clear cooldowns for testing:
  ```sql
  DELETE FROM pick_generation_cooldowns WHERE capper = 'shiva';
  ```

---

### Issue 4: Stale Lock
**Symptom:** Diagnostics shows "🚨 STALE LOCK DETECTED"

**Cause:** A previous cron execution crashed without releasing the lock

**Solution:**
Run in Supabase SQL Editor:
```sql
DELETE FROM system_locks WHERE lock_key = 'shiva_auto_picks_lock';
```

---

### Issue 5: Missing Database Function
**Symptom:** Diagnostics shows "🚨 acquire_shiva_lock FUNCTION MISSING"

**Cause:** The `acquire_shiva_lock` RPC function doesn't exist

**Solution:**
Run `FIX_LOCK_SYSTEM.sql` in Supabase SQL Editor

---

### Issue 6: Write Disabled
**Symptom:** Picks generate but don't save to database

**Cause:** `SHIVA_V1_WRITE_ENABLED` is not set to `true`

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Set `SHIVA_V1_WRITE_ENABLED=true`
3. Set `NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED=true`
4. Redeploy

---

## 📋 Step-by-Step Troubleshooting

### Step 1: Run Diagnostics
```bash
# Visit the diagnostic dashboard
https://deep-pick.vercel.app/debug/shiva

# OR call the API directly
curl https://deep-pick.vercel.app/api/debug/shiva-diagnostics
```

### Step 2: Identify Critical Issues
Look for any items marked with 🚨 in the summary

### Step 3: Fix Critical Issues First
- No games? → Check odds ingestion cron
- Cron disabled? → Remove `DISABLE_SHIVA_CRON` env var
- Stale lock? → Clear it in Supabase
- Missing function? → Run `FIX_LOCK_SYSTEM.sql`

### Step 4: Check Database State
```bash
curl https://deep-pick.vercel.app/api/debug/database-state
```

### Step 5: Manually Trigger Cron
```bash
curl https://deep-pick.vercel.app/api/debug/trigger-shiva
```

### Step 6: Verify Fix
- Check the Run Log table in the management dashboard
- Check the Cooldown table
- Both should now show data

---

## 🗄️ Database Verification

Run `VERIFY_DATABASE_SETUP.sql` in Supabase SQL Editor to check:
- ✅ All required tables exist
- ✅ All required functions exist
- ✅ Active games count
- ✅ Recent runs count
- ✅ Active cooldowns count
- ✅ Stale locks

---

## 🔗 Quick Links

- **Diagnostic Dashboard:** `https://deep-pick.vercel.app/debug/shiva`
- **Management Dashboard:** `https://deep-pick.vercel.app/cappers/shiva/management`
- **Vercel Dashboard:** `https://vercel.com/dashboard`
- **Supabase Dashboard:** `https://supabase.com/dashboard`

---

## 📊 Expected Behavior After Fix

Once the issue is resolved, you should see:

1. **Run Log Table:**
   - New entries every 10 minutes (when cron runs)
   - Shows run_id, game info, confidence scores, timestamps
   - Shows both PICK_GENERATED and PASS decisions

2. **Cooldown Table:**
   - Shows active cooldowns with countdown timers
   - Shows expired cooldowns (grayed out)
   - Updates in real-time

3. **Cron Execution:**
   - Runs every 10 minutes automatically
   - Selects one eligible game per run
   - Records result (PICK or PASS) with 2-hour cooldown

---

## 🆘 Still Having Issues?

If the diagnostic tools don't identify the issue:

1. Check Vercel function logs:
   - Go to Vercel Dashboard → Deployments
   - Click latest deployment → Functions
   - Look for `/api/cron/shiva-auto-picks` logs

2. Check Supabase logs:
   - Go to Supabase Dashboard → Logs
   - Filter by "shiva" or "pick_generation"

3. Enable verbose logging:
   - The cron already has extensive console.log statements
   - Check Vercel logs for detailed execution trace

---

## 📝 Notes

- The diagnostic tools are safe to run in production
- They don't modify data (except the manual trigger)
- All checks are read-only except for the test lock cleanup
- The manual trigger follows the same logic as the automated cron

---

**Created:** 2024-10-31  
**Last Updated:** 2024-10-31  
**Status:** ✅ Ready to use

