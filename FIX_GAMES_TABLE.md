# 🚨 CRITICAL FIX: Add Missing Columns to Games Table

## Problem Identified

The diagnostic dashboard revealed:
```json
"games": {
  "status": "error",
  "error": "column games.total_line does not exist"
}
```

**Root Cause:** The `games` table is missing the `total_line`, `spread_line`, `home_ml`, and `away_ml` columns that SHIVA v1 expects.

**Impact:** 
- ❌ SHIVA cron can't query games
- ❌ No runs are created
- ❌ No cooldowns are recorded
- ❌ Management dashboard tables stay empty

---

## ✅ Solution: Run Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk/sql
   ```

2. **Copy and paste this SQL:**
   ```sql
   -- Add missing odds columns to games table
   ALTER TABLE games 
   ADD COLUMN IF NOT EXISTS total_line DECIMAL(5, 2);

   ALTER TABLE games
   ADD COLUMN IF NOT EXISTS spread_line DECIMAL(5, 2);

   ALTER TABLE games
   ADD COLUMN IF NOT EXISTS home_ml INTEGER;

   ALTER TABLE games
   ADD COLUMN IF NOT EXISTS away_ml INTEGER;

   -- Add comments
   COMMENT ON COLUMN games.total_line IS 'Current total line (over/under) for the game';
   COMMENT ON COLUMN games.spread_line IS 'Current spread line for the game (absolute value)';
   COMMENT ON COLUMN games.home_ml IS 'Current moneyline odds for home team (American format)';
   COMMENT ON COLUMN games.away_ml IS 'Current moneyline odds for away team (American format)';

   -- Create indexes
   CREATE INDEX IF NOT EXISTS idx_games_total_line ON games(total_line) WHERE total_line IS NOT NULL;
   CREATE INDEX IF NOT EXISTS idx_games_spread_line ON games(spread_line) WHERE spread_line IS NOT NULL;

   -- Migrate existing data from odds JSONB column
   UPDATE games
   SET 
     total_line = COALESCE(
       (odds->>'total_line')::DECIMAL(5,2),
       (odds->'total'->>'line')::DECIMAL(5,2)
     ),
     spread_line = COALESCE(
       (odds->>'spread_line')::DECIMAL(5,2),
       (odds->'spread'->>'line')::DECIMAL(5,2),
       ABS((odds->'spread'->>'line')::DECIMAL(5,2))
     ),
     home_ml = COALESCE(
       (odds->>'home_ml')::INTEGER,
       (odds->'moneyline'->>'home')::INTEGER
     ),
     away_ml = COALESCE(
       (odds->>'away_ml')::INTEGER,
       (odds->'moneyline'->>'away')::INTEGER
     )
   WHERE odds IS NOT NULL
     AND (total_line IS NULL OR spread_line IS NULL OR home_ml IS NULL OR away_ml IS NULL);
   ```

3. **Click "Run"**

4. **Verify success:**
   ```sql
   -- Check that columns exist
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'games' 
   AND column_name IN ('total_line', 'spread_line', 'home_ml', 'away_ml');
   ```

---

### Option 2: Supabase CLI

```bash
# Apply the migration
supabase db push

# Or apply specific migration
supabase migration up 043_add_odds_columns_to_games
```

---

## 🔍 Verify the Fix

### 1. Check Columns Exist
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'games' 
AND column_name IN ('total_line', 'spread_line', 'home_ml', 'away_ml');
```

**Expected output:**
```
column_name  | data_type
-------------+-----------
total_line   | numeric
spread_line  | numeric
home_ml      | integer
away_ml      | integer
```

### 2. Check Data Migration
```sql
SELECT 
  id,
  home_team->>'name' as home,
  away_team->>'name' as away,
  total_line,
  spread_line,
  home_ml,
  away_ml
FROM games
LIMIT 5;
```

### 3. Re-run Diagnostics
Go to: `https://deep-pick.vercel.app/debug/shiva`

Click "Run Full Diagnostics"

**Expected result:**
```json
"games": {
  "status": "complete",
  "total_count": X,
  "active_count": Y,
  "issues": []
}
```

---

## 📊 What This Migration Does

1. **Adds 4 new columns to `games` table:**
   - `total_line` - Current over/under line (e.g., 225.5)
   - `spread_line` - Current spread line (e.g., 7.5)
   - `home_ml` - Home team moneyline (e.g., -150)
   - `away_ml` - Away team moneyline (e.g., +130)

2. **Migrates existing data:**
   - Extracts values from the `odds` JSONB column
   - Populates the new columns with current data
   - Handles multiple JSONB formats (MySportsFeeds and The Odds API)

3. **Creates indexes:**
   - Speeds up queries filtering by total_line or spread_line
   - Only indexes non-null values

4. **Adds documentation:**
   - Column comments explain what each field stores

---

## 🎯 Expected Outcome

After running this migration:

✅ **Diagnostic dashboard shows:**
- Games table: ✅ Complete
- No more "column does not exist" errors

✅ **SHIVA cron will:**
- Successfully query eligible games
- Create runs every 10 minutes
- Record cooldowns
- Generate picks or PASS decisions

✅ **Management dashboard will:**
- Show Run Log entries
- Show Cooldown entries
- Display real-time data

---

## ⏱️ Timeline

- **Migration execution:** 5 seconds
- **Data migration:** 10 seconds (depends on number of games)
- **Next cron run:** Within 10 minutes
- **First run log entry:** Within 10 minutes
- **Verification:** Immediate

---

## 🚨 If Migration Fails

### Error: "column already exists"
**Solution:** The columns already exist. Check if they have data:
```sql
SELECT COUNT(*) FROM games WHERE total_line IS NOT NULL;
```

### Error: "permission denied"
**Solution:** Make sure you're using the Supabase dashboard or have proper credentials.

### Error: "invalid input syntax for type numeric"
**Solution:** Some odds data may be malformed. Run this to find bad data:
```sql
SELECT id, odds FROM games 
WHERE odds IS NOT NULL 
AND (odds->>'total_line') !~ '^[0-9.]+$';
```

---

## 📝 Next Steps After Migration

1. **Wait 10 minutes** for next cron run
2. **Check diagnostic dashboard** - Should show runs and cooldowns
3. **Check management dashboard** - Tables should populate
4. **Monitor Vercel logs** - Should see successful pick generation attempts

---

## 🔗 Quick Links

- **Supabase SQL Editor:** https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk/sql
- **Diagnostic Dashboard:** https://deep-pick.vercel.app/debug/shiva
- **Management Dashboard:** https://deep-pick.vercel.app/cappers/shiva/management
- **Vercel Logs:** https://vercel.com/dashboard

---

**Status:** ✅ Migration ready to run  
**Priority:** 🚨 CRITICAL - Blocks all SHIVA functionality  
**Time to fix:** ~1 minute

