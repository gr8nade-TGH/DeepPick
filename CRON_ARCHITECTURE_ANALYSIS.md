# Cron Architecture & Auto-Generation Timing Analysis

## 🚨 CRITICAL ISSUE IDENTIFIED

**Problem**: The `auto_generate_hours_before` setting is **NOT currently used** in the pick generation logic!

---

## Current Architecture

### **Cron Jobs** (from `vercel.json`)
```json
{
  "path": "/api/cron/sync-mysportsfeeds-odds",
  "schedule": "*/5 * * * *"  // Every 5 minutes - fetches fresh odds
},
{
  "path": "/api/cron/auto-picks-multi",
  "schedule": "*/4 * * * *"  // Every 4 minutes - processes ALL cappers
},
{
  "path": "/api/cron/shiva-auto-picks",
  "schedule": "*/6 * * * *"  // Every 6 minutes - SHIVA TOTAL
},
{
  "path": "/api/cron/shiva-auto-picks-spread",
  "schedule": "*/8 * * * *"  // Every 8 minutes - SHIVA SPREAD
}
```

### **Current Flow**
```
Every 4 minutes:
  ↓
/api/cron/auto-picks-multi runs
  ↓
Queries ALL active cappers from user_cappers
  ↓
For each capper:
  ↓
Calls /api/cappers/generate-pick?capperId={id}&betType={type}
  ↓
/api/cappers/generate-pick:
  1. Acquires lock
  2. Fetches capper config (including auto_generate_hours_before)
  3. Calls /api/shiva/step1-scanner to find eligible games
  4. Calls /api/shiva/generate-pick to create pick
  5. Releases lock
```

### **Game Filtering Logic** (from `get_available_games_for_pick_generation`)
```sql
WHERE g.status IN ('scheduled', 'pre-game')
  AND g.start_time > NOW() + INTERVAL '1 hour'   -- At least 1 hour before game
  AND g.start_time < NOW() + INTERVAL '24 hours' -- Within next 24 hours
  AND can_generate_pick(g.id::TEXT, p_capper, p_bet_type, p_cooldown_hours)
```

**🚨 PROBLEM**: This hardcoded `1 hour` and `24 hours` window does NOT respect `auto_generate_hours_before`!

---

## The Issue

### **What Users Expect**
- User sets `auto_generate_hours_before = 4`
- System generates picks for games starting in 4 hours
- User sets `auto_generate_hours_before = 12`
- System generates picks for games starting in 12 hours

### **What Actually Happens**
- ALL cappers use the same hardcoded window: **1-24 hours before game**
- `auto_generate_hours_before` is stored in database but **never used**
- If 100 cappers all set `auto_generate_hours_before = 4`, they all run every 4 minutes and all try to generate picks for the same games at the same time

---

## Proposed Solution

### **Option 1: Time-Window Filtering (RECOMMENDED)**

**Change the database function to accept time window parameters**:

```sql
CREATE OR REPLACE FUNCTION get_available_games_for_pick_generation(
  p_capper capper_type,
  p_bet_type TEXT DEFAULT 'TOTAL',
  p_cooldown_hours INTEGER DEFAULT 2,
  p_min_hours_before INTEGER DEFAULT 1,   -- NEW: minimum hours before game
  p_max_hours_before INTEGER DEFAULT 24,  -- NEW: maximum hours before game
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM games g
  WHERE g.status IN ('scheduled', 'pre-game')
    AND g.start_time > NOW() + INTERVAL '1 hour' * p_min_hours_before
    AND g.start_time < NOW() + INTERVAL '1 hour' * p_max_hours_before
    AND can_generate_pick(g.id::TEXT, p_capper, p_bet_type, p_cooldown_hours)
  ORDER BY g.start_time ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

**Update `/api/cappers/generate-pick` to pass capper's time window**:

```typescript
// Fetch capper config
const { data: capper } = await supabase
  .from('user_cappers')
  .select('*')
  .eq('capper_id', capperId)
  .single()

// Use capper's auto_generate_hours_before setting
const hoursBeforeGame = capper.auto_generate_hours_before || 4

// Call scanner with time window
const { games } = await pickService.getAvailableGames(
  capperId,
  betType,
  2, // cooldown hours
  10, // limit
  1, // min hours before (always 1 hour minimum buffer)
  hoursBeforeGame // max hours before (user's setting)
)
```

**Benefits**:
- ✅ Respects user's `auto_generate_hours_before` setting
- ✅ Different cappers can target different time windows
- ✅ Spreads out pick generation naturally
- ✅ User who sets 12 hours gets picks earlier than user who sets 4 hours

**Example**:
```
Capper A: auto_generate_hours_before = 4
  → Generates picks for games 1-4 hours away

Capper B: auto_generate_hours_before = 12
  → Generates picks for games 1-12 hours away

Game at 8:00 PM (it's now 12:00 PM):
  → Capper B generates pick at 12:00 PM (8 hours before)
  → Capper A generates pick at 4:00 PM (4 hours before)
```

---

### **Option 2: Time-Range Buckets (ALTERNATIVE)**

**Change UI to offer time ranges instead of exact hours**:

```typescript
const TIME_RANGES = [
  { value: '1-3', label: '1-3 hours before game', min: 1, max: 3 },
  { value: '3-6', label: '3-6 hours before game', min: 3, max: 6 },
  { value: '6-12', label: '6-12 hours before game', min: 6, max: 12 },
  { value: '12-24', label: '12-24 hours before game', min: 12, max: 24 }
]
```

**Store as two fields**:
```sql
ALTER TABLE user_cappers
  ADD COLUMN auto_generate_min_hours_before INTEGER DEFAULT 1,
  ADD COLUMN auto_generate_max_hours_before INTEGER DEFAULT 4;
```

**Benefits**:
- ✅ Naturally spreads out cron executions
- ✅ Users understand they're choosing a window, not exact time
- ✅ Prevents all cappers from targeting same games at same time

**Drawbacks**:
- ❌ Less precise control
- ❌ Requires database migration
- ❌ More complex UI

---

### **Option 3: Randomized Execution Offset (SIMPLE FIX)**

**Keep current time window (1-24 hours) but add randomized delay**:

```typescript
// In /api/cron/auto-picks-multi
for (const capper of cappers) {
  // Add random delay 0-120 seconds to spread out executions
  const randomDelay = Math.floor(Math.random() * 120000)
  
  await new Promise(resolve => setTimeout(resolve, randomDelay))
  
  // Then call generate-pick
  await fetch(`/api/cappers/generate-pick?capperId=${capper.capper_id}&betType=${betType}`)
}
```

**Benefits**:
- ✅ Simple to implement
- ✅ Spreads out API calls
- ✅ No database changes needed

**Drawbacks**:
- ❌ Doesn't actually respect `auto_generate_hours_before` setting
- ❌ Only spreads out within same cron execution
- ❌ Doesn't solve the fundamental issue

---

## Recommended Implementation

### **Phase 1: Fix Time Window Filtering (CRITICAL)**

1. **Update database function** to accept `p_min_hours_before` and `p_max_hours_before`
2. **Update `/api/cappers/generate-pick`** to pass capper's `auto_generate_hours_before`
3. **Update `PickGenerationService.getAvailableGames()`** to accept time window params
4. **Test** with multiple cappers using different time windows

### **Phase 2: Improve UI (RECOMMENDED)**

**Change from exact hours to time ranges**:

```typescript
// In src/app/cappers/create/page.tsx
<Label>When should picks be generated?</Label>
<Select
  value={config.auto_generate_time_range}
  onValueChange={(value) => updateConfig({ auto_generate_time_range: value })}
>
  <SelectContent>
    <SelectItem value="1-3">1-3 hours before game (Last Minute)</SelectItem>
    <SelectItem value="3-6">3-6 hours before game (Recommended)</SelectItem>
    <SelectItem value="6-12">6-12 hours before game (Early Bird)</SelectItem>
    <SelectItem value="12-24">12-24 hours before game (Day Before)</SelectItem>
  </SelectContent>
</Select>
```

**Benefits**:
- ✅ Naturally distributes cron load
- ✅ Clearer user expectations
- ✅ Prevents "everyone picks 4 hours" problem
- ✅ Different strategies (early vs late picks)

---

## Load Distribution Analysis

### **Current State (BROKEN)**
```
100 cappers, all set auto_generate_hours_before = 4
  ↓
Every 4 minutes, cron runs
  ↓
All 100 cappers try to generate picks for same games
  ↓
100 API calls in rapid succession
  ↓
Potential rate limiting, timeouts, database load
```

### **With Time Ranges (FIXED)**
```
25 cappers: 1-3 hours range
25 cappers: 3-6 hours range
25 cappers: 6-12 hours range
25 cappers: 12-24 hours range
  ↓
Every 4 minutes, cron runs
  ↓
Each capper targets different time window
  ↓
Natural distribution of picks across time
  ↓
Reduced API load, better performance
```

---

## Migration Path

### **Step 1: Database Migration**
```sql
-- Add new columns for time range
ALTER TABLE user_cappers
  ADD COLUMN auto_generate_min_hours_before INTEGER DEFAULT 1,
  ADD COLUMN auto_generate_max_hours_before INTEGER DEFAULT 4;

-- Migrate existing data
UPDATE user_cappers
SET 
  auto_generate_min_hours_before = 1,
  auto_generate_max_hours_before = auto_generate_hours_before
WHERE auto_generate_hours_before IS NOT NULL;

-- Keep old column for backward compatibility (can remove later)
```

### **Step 2: Update Database Function**
```sql
-- Update get_available_games_for_pick_generation to accept time window
-- (See Option 1 above for full SQL)
```

### **Step 3: Update API**
```typescript
// Update /api/cappers/generate-pick to use time window
// Update PickGenerationService to pass time window params
```

### **Step 4: Update UI**
```typescript
// Change from single hour dropdown to time range dropdown
// Update form validation
// Update review step display
```

---

## Conclusion

**CRITICAL FIX NEEDED**: `auto_generate_hours_before` is currently not used in game filtering logic.

**RECOMMENDED SOLUTION**: Implement time-range buckets (Option 2) to:
1. Actually respect user's timing preferences
2. Naturally distribute cron load
3. Prevent all cappers from targeting same games
4. Provide clearer user expectations

**IMMEDIATE ACTION**: Update database function and API to use capper's time window settings.

---

## ✅ FINAL DECISION: SIMPLE SOLUTION IMPLEMENTED

After discussion, we decided to **NOT over-engineer this**. The orchestrator works well as-is.

### **What We Did**
**Removed the `auto_generate_hours_before` setting from the UI entirely.**

**Rationale**:
1. ✅ Cron already runs every 4 minutes for ALL cappers regardless
2. ✅ The hardcoded 1-24 hour window is actually perfect (catches all upcoming games)
3. ✅ Users don't really need to control exact timing - they just want picks generated
4. ✅ No code changes needed to orchestrator
5. ✅ No database migrations needed
6. ✅ One less thing for users to configure

### **Changes Made**
**File**: `src/app/cappers/create/page.tsx`

1. **Removed timing dropdown** (lines 630-654)
   - Replaced with simple info message: "Picks are automatically generated throughout the day as games approach"

2. **Updated review step** (lines 880-898)
   - Removed "X hours before game" display
   - Only shows excluded teams if any are selected

3. **Updated confirmation message** (lines 932-937)
   - Changed from: "start auto-generating picks 4 hours before each game"
   - Changed to: "start auto-generating picks throughout the day as games approach"

### **What Stays the Same**
- `auto_generate_hours_before` column remains in database (defaults to 4)
- Orchestrator continues to work exactly as before
- Game filtering uses hardcoded 1-24 hour window (which is fine)
- No performance issues since cron already processes all cappers every 4 minutes

### **Result**
- ✅ Simpler user experience
- ✅ No orchestrator changes needed
- ✅ No risk of breaking existing functionality
- ✅ Users get picks automatically without worrying about timing details

