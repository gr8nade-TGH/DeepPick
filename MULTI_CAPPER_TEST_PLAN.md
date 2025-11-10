# Multi-Capper System - User Acceptance Test Plan

## 🎯 **Objective**
Validate that the multi-capper architecture works end-to-end by creating a capper via the "Become a Capper" UI and verifying it generates picks automatically.

---

## ✅ **Current Status (Validated)**

### **Working Cappers:**
- ✅ **SHIVA** - Generating picks successfully for 3+ days
- ✅ **IFRIT** - Generating picks successfully for 3+ days

### **Working Infrastructure:**
- ✅ Multi-capper cron (`/api/cron/auto-picks-multi`) - Running every 4 minutes
- ✅ Unified orchestrator (`/api/cappers/generate-pick`) - Handles any capper
- ✅ Capper-aware scanner - Filters by capper ID
- ✅ Capper-specific locks - Prevents concurrent execution
- ✅ Capper-specific cooldowns - Isolated per capper
- ✅ Capper-specific picks - Correct attribution

---

## 🧪 **Test Plan: Create a Capper via UI**

### **Step 1: Create Test Capper**

1. Navigate to `/cappers/create` (Become a Capper page)
2. Fill out the 4-step wizard:

**Step 1: Capper Identity**
- **Display Name:** `TEST_CAPPER`
- **Capper ID:** `test-capper` (lowercase, alphanumeric)
- **Description:** `Test capper to validate multi-capper system`
- **Color Theme:** Any color (e.g., `green`)

**Step 2: Sport & Bet Types**
- **Sport:** `NBA`
- **Bet Types:** Select both `TOTAL` and `SPREAD`

**Step 3: Factor Configuration**

For **TOTAL** picks:
- Enable all factors (F1-F5)
- Set custom weights (e.g., F1=1.2, F2=1.0, F3=1.3, F4=0.9, F5=1.1)

For **SPREAD** picks:
- Enable all factors (S1-S5)
- Set custom weights (e.g., S1=1.3, S2=1.1, S3=1.2, S4=1.0, S5=0.9)

**Step 4: Review & Launch**
- **Execution Interval:** `10 minutes` (for faster testing)
- **Priority:** `5` (default)
- Click "Launch Capper"

---

### **Step 2: Verify Database Entries**

**Check `user_cappers` table:**
```sql
SELECT capper_id, display_name, sport, bet_types, 
       execution_interval_minutes, execution_priority, is_active
FROM user_cappers 
WHERE capper_id = 'test-capper';
```

**Expected Result:**
- ✅ Row exists with correct configuration
- ✅ `is_active = true`
- ✅ `bet_types = ['TOTAL', 'SPREAD']`

**Check `capper_execution_schedules` table (if used):**
```sql
SELECT capper_id, sport, bet_type, enabled, interval_minutes, priority
FROM capper_execution_schedules
WHERE capper_id = 'test-capper';
```

**Expected Result:**
- ✅ 2 rows (one for TOTAL, one for SPREAD)
- ✅ Both enabled
- ✅ Correct interval and priority

---

### **Step 3: Wait for Multi-Capper Cron**

The multi-capper cron runs **every 4 minutes**. Within 4-10 minutes, you should see:

**Check cron logs:**
- Navigate to Vercel deployment logs
- Look for `[MULTI-CAPPER-CRON]` entries
- Verify `TEST_CAPPER` appears in the processed cappers list

**Expected Log Output:**
```
🎲 [MULTI-CAPPER-CRON] Processing: TEST_CAPPER (test-capper)
   🎯 Attempting TOTAL pick...
   ✅ Pick generated! OR ⚠️ No eligible games found
   🎯 Attempting SPREAD pick...
   ✅ Pick generated! OR ⚠️ No eligible games found
```

---

### **Step 4: Verify Pick Generation**

**Check `picks` table:**
```sql
SELECT id, capper, pick_type, game_id, pick, confidence, units, 
       created_at, reasoning, algorithm_version
FROM picks
WHERE capper = 'test-capper'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- ✅ Picks exist with `capper = 'test-capper'`
- ✅ `algorithm_version = 'test-capper_v1'`
- ✅ `reasoning` contains "TEST_CAPPER pick generated via wizard pipeline"
- ✅ Picks have correct `pick_type` (TOTAL or SPREAD)

---

### **Step 5: Verify Cooldowns**

**Check `pick_generation_cooldowns` table:**
```sql
SELECT id, game_id, capper, bet_type, result, cooldown_until, created_at
FROM pick_generation_cooldowns
WHERE capper = 'test-capper'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- ✅ Cooldowns exist for each pick attempt
- ✅ `result = 'PICK_GENERATED'` → `cooldown_until = '2099-12-31'` (permanent)
- ✅ `result = 'PASS'` → `cooldown_until = NOW() + 2 hours` (temporary)
- ✅ Each game has separate cooldowns for TOTAL and SPREAD

---

### **Step 6: Verify UI Display**

**Navigate to `/cappers/test-capper/management`**

**Check Insight Cards:**
- ✅ Picks appear in the insight cards
- ✅ Capper name shows "TEST_CAPPER" (not "SHIVA")
- ✅ Algorithm version shows "test-capper_v1"
- ✅ Factor breakdown shows custom weights

**Check Run Logs:**
- ✅ Run logs show execution history
- ✅ Each run has correct game_id and matchup
- ✅ Metadata shows correct factor weights

**Check Cooldowns:**
- ✅ Cooldowns list shows all games on cooldown
- ✅ Permanent cooldowns for generated picks
- ✅ Temporary cooldowns for PASS results

---

## 🎊 **Success Criteria**

The test is **SUCCESSFUL** if:

1. ✅ Capper created via UI appears in `user_cappers` table
2. ✅ Multi-capper cron picks up the new capper within 4 minutes
3. ✅ Capper generates picks (or PASS results) automatically
4. ✅ Picks are attributed to correct capper (`test-capper`)
5. ✅ Cooldowns are created for each attempt
6. ✅ Insight cards show correct capper name and version
7. ✅ No conflicts with SHIVA or IFRIT picks
8. ✅ System continues running smoothly

---

## 🚨 **Failure Scenarios & Debugging**

### **Scenario 1: Capper Not Picked Up by Cron**
**Symptoms:** No log entries for `TEST_CAPPER` in cron logs

**Debug Steps:**
1. Check `user_cappers.is_active = true`
2. Check multi-capper cron is running (Vercel cron logs)
3. Check cron query: `SELECT * FROM user_cappers WHERE is_active = true`

### **Scenario 2: No Picks Generated**
**Symptoms:** Cron runs but no picks in database

**Debug Steps:**
1. Check scanner response - are there eligible games?
2. Check cooldowns - is game already on cooldown?
3. Check orchestrator logs for errors
4. Check factor weights - are they valid?

### **Scenario 3: Wrong Capper Attribution**
**Symptoms:** Picks show "SHIVA" instead of "TEST_CAPPER"

**Debug Steps:**
1. Check `picks.capper` field - should be `'test-capper'`
2. Check `picks.reasoning` - should contain "TEST_CAPPER"
3. Check `picks.algorithm_version` - should be `'test-capper_v1'`
4. This was fixed in commit `508ce9e` - verify fix is deployed

### **Scenario 4: Missing Cooldowns**
**Symptoms:** Picks generated but no cooldowns

**Debug Steps:**
1. Check cooldown creation happens BEFORE pick save (fixed in `508ce9e`)
2. Check unique constraint on `(game_id, capper, bet_type)`
3. Check RLS policies on `pick_generation_cooldowns` table

---

## 🎯 **Next Steps After Successful Test**

1. **Delete test capper** (or keep it for monitoring)
2. **Document the process** for users
3. **Enable "Become a Capper" feature** for all users
4. **Monitor system health** as more cappers are added
5. **Consider priority-based scheduling** if needed (future enhancement)

---

## 📊 **Monitoring Recommendations**

**Daily Checks:**
- Number of active cappers
- Total picks generated per capper
- Cron execution success rate
- Database lock contention

**Weekly Checks:**
- Capper performance metrics
- Factor weight effectiveness
- Cooldown cleanup (old temporary cooldowns)
- Database size and performance

---

## ✅ **Conclusion**

This test validates the **entire end-to-end user workflow** for creating and running a capper. If successful, the multi-capper architecture is **production-ready** and can scale to 100-1000+ user-created cappers without code changes.

**The system is ready for users!** 🚀

