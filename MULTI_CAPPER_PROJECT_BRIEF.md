# Multi-Capper System Implementation Project

## ⚠️ CRITICAL: System Status

**THIS SYSTEM IS EXTREMELY FRAGILE AND SENSITIVE**

- The current SHIVA implementation is working but brittle
- Previous attempt to add multi-capper support completely broke pick generation for several hours
- Any changes must be incremental, tested, and reversible
- SHIVA is our production system - it MUST keep working throughout this process

---

## 📍 Current State (November 7, 2025)

### What's Working ✅
- **SHIVA TOTAL picks**: Generating every 6 minutes via `/api/cron/shiva-auto-picks`
- **SHIVA SPREAD picks**: Generating every 8 minutes via `/api/cron/shiva-auto-picks-spread`
- **Odds sync**: MySportsFeeds API syncing odds every 5 minutes
- **Direct cron jobs**: Simple, proven architecture in `vercel.json`

### Git Checkpoint 🏷️
- **Tag**: `checkpoint-shiva-working-nov7`
- **Commit**: `c456a6b`
- **Purpose**: Safe restore point if anything breaks
- **How to revert**: `git checkout checkpoint-shiva-working-nov7`

### Database State 🗄️
- `user_cappers` table exists with SHIVA and IFRIT cappers configured
- `capper_execution_schedules` table exists but is NOT currently used
- SHIVA picks, runs, and cooldowns are being created successfully
- IFRIT has zero picks/runs/cooldowns (not yet implemented)

---

## 🎯 Project Goal

**Make the system scalable to support multiple cappers without breaking SHIVA**

### Success Criteria:
1. ✅ SHIVA continues generating picks throughout the implementation
2. ✅ IFRIT can generate picks independently (different factor weights, same pipeline)
3. ✅ System can easily add new cappers in the future (just add cron jobs)
4. ✅ Management page shows correct data for each capper
5. ✅ No race conditions or lock conflicts between cappers

---

## ❌ What We Tried (and Failed)

### Failed Approach: Orchestrator System
**What we did:**
- Created `/api/cron/pick-orchestrator` that reads from `capper_execution_schedules` table
- Created unified `/api/cappers/generate-pick` endpoint for all cappers
- Replaced direct SHIVA cron jobs with orchestrator in `vercel.json`

**Why it failed:**
- Over-engineered solution added unnecessary complexity
- Unified endpoint had bugs (scanner HTTP method, missing endpoints, hardcoded capper IDs)
- Pick generation completely stopped for several hours
- Lost sight of the working system while trying to "improve" it

**Lesson learned:**
- Don't fix what isn't broken
- Keep SHIVA's working code intact while building new features
- Test incrementally, never replace working system all at once

---

## 🏗️ Recommended Approach

### Strategy: Copy SHIVA's Pattern for IFRIT

**Phase 1: Create IFRIT Cron Endpoints**
1. Copy `/api/cron/shiva-auto-picks/route.ts` → `/api/cron/ifrit-auto-picks/route.ts`
2. Copy `/api/cron/shiva-auto-picks-spread/route.ts` → `/api/cron/ifrit-auto-picks-spread/route.ts`
3. Update lock keys: `ifrit_nba_total_lock`, `ifrit_nba_spread_lock`
4. Update capper ID references from 'shiva' to 'ifrit'
5. Add IFRIT cron jobs to `vercel.json`

**Phase 2: Make Scanner Capper-Aware**
1. Update `/api/shiva/step1-scanner/route.ts` to accept `capper` parameter
2. Filter existing picks by capper (currently hardcoded to 'shiva')
3. Test with both SHIVA and IFRIT

**Phase 3: Make Generate-Pick Use Custom Factor Weights**
1. Update `/api/shiva/generate-pick/route.ts` to accept `capperId` and `factorConfig`
2. Load factor weights from `user_cappers` table
3. Apply custom weights in factor calculation steps
4. Test that IFRIT uses different weights than SHIVA

**Phase 4: Gradual Refactoring (Optional)**
1. Extract shared code into utility functions
2. Keep endpoints separate but reduce duplication
3. Consider unified endpoint ONLY after everything works

---

## 📁 Key Files and Their Purpose

### Cron Endpoints (Working - Don't Break These!)
- `/api/cron/shiva-auto-picks/route.ts` - SHIVA TOTAL picks (every 6 min)
- `/api/cron/shiva-auto-picks-spread/route.ts` - SHIVA SPREAD picks (every 8 min)
- `/api/cron/sync-mysportsfeeds-odds/route.ts` - Odds sync (every 5 min)

### SHIVA Pipeline (Working - Reference These!)
- `/api/shiva/step1-scanner/route.ts` - Finds eligible games, checks cooldowns
- `/api/shiva/generate-pick/route.ts` - Runs 7-step wizard pipeline
- `/api/shiva/step2-odds-snapshot/route.ts` - Captures market odds
- `/api/shiva/step3-factor-analysis/route.ts` - Calculates factor adjustments
- `/api/shiva/step4-score-predictions/route.ts` - Predicts final scores
- `/api/shiva/step5-pick-generation/route.ts` - Generates pick with edge calculation
- `/api/shiva/step6-bold-predictions/route.ts` - AI player predictions
- `/api/shiva/step7-finalize/route.ts` - Saves pick to database

### Configuration
- `vercel.json` - Cron job schedules (CRITICAL - changes here trigger deployments)

### Management UI
- `/app/cappers/shiva/management/page.tsx` - Management dashboard
- `/app/cappers/shiva/management/components/inbox.tsx` - Generated picks table

---

## 🗄️ Database Schema

### `user_cappers` Table
Stores capper configurations (SHIVA and IFRIT already exist):
```sql
- id (uuid)
- capper_id (text) - 'shiva', 'ifrit', etc.
- display_name (text)
- sport (text) - 'NBA'
- bet_types (text[]) - ['TOTAL', 'SPREAD']
- factor_config (jsonb) - Custom factor weights
- execution_interval_minutes (int)
- execution_priority (int)
- is_active (boolean)
```

### `picks` Table
Stores generated picks:
```sql
- id (uuid)
- game_id (uuid)
- run_id (text)
- capper (text) - 'shiva', 'ifrit', etc.
- pick_type (text) - 'total', 'spread'
- selection (text) - 'OVER', 'UNDER', 'HOME', 'AWAY'
- confidence (decimal)
- units (decimal)
- status (text) - 'pending', 'won', 'lost', 'push'
```

### `pick_generation_cooldowns` Table
Prevents duplicate picks:
```sql
- id (uuid)
- game_id (uuid)
- capper (text) - 'shiva', 'ifrit', etc.
- bet_type (text) - 'TOTAL', 'SPREAD'
- cooldown_until (timestamptz)
- result (text) - 'PASS', 'PICK_GENERATED', 'ERROR'
```

### `system_locks` Table
Prevents concurrent execution:
```sql
- lock_key (text) - 'shiva_nba_total_lock', 'ifrit_nba_spread_lock', etc.
- locked_by (text)
- locked_at (timestamptz)
- expires_at (timestamptz)
```

---

## 🔒 Lock Key Strategy

**Current Format**: `{capper_id}_{sport}_{bet_type}_lock`

**Examples**:
- `shiva_nba_total_lock`
- `shiva_nba_spread_lock`
- `ifrit_nba_total_lock`
- `ifrit_nba_spread_lock`

**Why this works**:
- Each capper/sport/bet_type combination has its own lock
- SHIVA TOTAL and IFRIT TOTAL can run simultaneously (different locks)
- Prevents race conditions within same capper/bet_type

---

## 🎨 Factor Configuration

### SHIVA's Current Weights (Default 1.0 for all):
```json
{
  "TOTAL": {
    "enabled_factors": ["F1", "F2", "F3", "F4", "F5"],
    "weights": {
      "F1": 1.0,  // Offensive Efficiency Differential
      "F2": 1.0,  // Defensive Efficiency Differential
      "F3": 1.0,  // Pace Differential
      "F4": 1.0,  // Recent Form Differential
      "F5": 1.0   // Home Court Advantage
    }
  },
  "SPREAD": {
    "enabled_factors": ["S1", "S2", "S3", "S4", "S5"],
    "weights": {
      "S1": 1.0,  // Net Rating Differential
      "S2": 1.0,  // Turnover Differential
      "S3": 1.0,  // Rebounding Differential
      "S4": 1.0,  // Pace Mismatch
      "S5": 1.0   // Four Factors Composite
    }
  }
}
```

### IFRIT's Custom Weights (Example):
```json
{
  "TOTAL": {
    "enabled_factors": ["F1", "F3", "F5"],
    "weights": {
      "F1": 1.5,  // Emphasize offensive efficiency
      "F3": 1.2,  // Emphasize pace
      "F5": 0.8   // De-emphasize home court
    }
  }
}
```

---

## ⚠️ Critical Constraints

### 1. SHIVA Must Keep Working
- **Never** modify SHIVA's cron endpoints without testing
- **Never** change `vercel.json` without a rollback plan
- **Always** verify SHIVA picks are still generating after changes

### 2. Incremental Changes Only
- Make ONE change at a time
- Test after each change
- Commit working states frequently
- Create git tags at major milestones

### 3. Database Backward Compatibility
- Don't change existing column names
- Don't delete data SHIVA depends on
- Add new columns/tables, don't modify existing ones

### 4. Lock Management
- Each capper/sport/bet_type needs unique lock key
- Never share locks between cappers
- Always release locks in finally blocks

---

## 🧪 Testing Checklist

After each change, verify:
- [ ] SHIVA TOTAL picks still generating (check management page)
- [ ] SHIVA SPREAD picks still generating (check management page)
- [ ] No errors in Vercel logs
- [ ] Cooldowns being created correctly
- [ ] Run logs appearing in database
- [ ] No stale locks in `system_locks` table

---

## 🚨 Emergency Rollback Procedure

If anything breaks:

1. **Immediate**: Revert `vercel.json` to restore SHIVA cron jobs
2. **Git revert**: `git checkout checkpoint-shiva-working-nov7`
3. **Push**: `git push origin main --force` (if needed)
4. **Verify**: Check management page for new picks within 10 minutes
5. **Database cleanup** (if needed): Clear bad data from failed attempts

---

## 📊 Success Metrics

### Phase 1 Success:
- ✅ IFRIT cron endpoints created
- ✅ IFRIT generating picks with default weights
- ✅ SHIVA still working
- ✅ No lock conflicts

### Phase 2 Success:
- ✅ IFRIT using custom factor weights from database
- ✅ Different picks than SHIVA for same games
- ✅ Management page shows correct data for each capper

### Final Success:
- ✅ Both cappers running independently
- ✅ Easy to add new cappers (copy pattern)
- ✅ System stable for 24+ hours
- ✅ No manual intervention needed

---

## 🎯 Next Steps

1. **Analyze** current SHIVA cron endpoints in detail
2. **Design** IFRIT endpoints based on SHIVA pattern
3. **Implement** IFRIT TOTAL endpoint first (test thoroughly)
4. **Add** IFRIT SPREAD endpoint second
5. **Refactor** shared code (optional, only if stable)

---

**Remember: Slow and steady wins the race. SHIVA must keep working!**

