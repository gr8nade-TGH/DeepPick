# DeepPick Locking System Documentation

## Overview

The DeepPick application uses a **distributed locking system** to prevent race conditions and ensure that only one pick generation process runs at a time for each capper/sport/bet_type combination.

## Lock Key Format

```
{capper_id}_{sport}_{bet_type}_lock
```

### Examples:
- `shiva_nba_total_lock`
- `ifrit_nba_spread_lock`
- `gr8nade_nba_total_lock`

## How It Works

### 1. Lock Acquisition

When a pick generation request is made (either via cron orchestrator or manual "Run Now" button):

1. **Generate Lock Key**: `{capper_id}_{sport}_{bet_type}_lock`
2. **Generate Lock ID**: `cron_{capper_id}_{sport}_{bet_type}_{timestamp}_{random}`
3. **Try to Acquire Lock**: Call `acquire_shiva_lock()` RPC function
4. **Check Existing Lock**: If lock exists and is not expired, return "Another instance is already running"
5. **Proceed**: If lock acquired successfully, proceed with pick generation

### 2. Lock Release

Locks are released in **three scenarios**:

1. **Success**: After pick is generated successfully
2. **No Games**: After scanner determines no eligible games
3. **Error**: In the catch block if any error occurs

### 3. Lock Timeout

- **Default Timeout**: 5 minutes (300 seconds)
- **Purpose**: Prevents deadlocks if a process crashes without releasing the lock
- **Auto-Cleanup**: Expired locks are automatically ignored by the `acquire_shiva_lock()` function

## Why Manual "Run Now" Won't Clash with Orchestrator

### Independent Lock Keys

Each capper/sport/bet_type combination has its own lock:

```
SHIVA + NBA + TOTAL    → shiva_nba_total_lock
SHIVA + NBA + SPREAD   → shiva_nba_spread_lock
IFRIT + NBA + TOTAL    → ifrit_nba_total_lock
GR8NADE + NBA + TOTAL  → gr8nade_nba_total_lock
```

**Result**: Different cappers can run simultaneously without blocking each other.

### Lock Prevents Concurrent Execution

If orchestrator is running `gr8nade_nba_total_lock` and user clicks "Run Now":

1. **Manual Request**: Tries to acquire `gr8nade_nba_total_lock`
2. **Lock Check**: Finds lock is already held by orchestrator
3. **Response**: Returns `{ success: false, message: "Another instance is already running" }`
4. **User Feedback**: Toast notification: "⏳ Already Running - Another pick generation is in progress"

**Result**: No clash, no duplicate picks, user is informed.

### Lock Expiration Handles Crashes

If orchestrator crashes without releasing lock:

1. **Lock Age**: 5 minutes
2. **Next Request**: Checks lock age
3. **Expired Lock**: Ignored and overwritten
4. **New Lock**: Acquired successfully

**Result**: System self-heals from crashes.

## Code Locations

### Lock Acquisition
- **File**: `src/app/api/cappers/generate-pick/route.ts`
- **Lines**: 76-136
- **Function**: `acquire_shiva_lock()` RPC call with fallback to manual lock

### Lock Release
- **Success Path**: Line 209
- **No Games Path**: Line 224
- **Error Path**: Lines 241-248

### Lock Check in UI
- **File**: `src/components/capper-dashboard/execution-schedule.tsx`
- **Lines**: 104-110
- **Feedback**: Toast notification for "Already Running" state

## Database Table

### `system_locks`

```sql
CREATE TABLE system_locks (
  lock_key TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RPC Function

```sql
CREATE OR REPLACE FUNCTION acquire_shiva_lock(
  p_lock_key TEXT,
  p_locked_by TEXT,
  p_timeout_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_existing_lock RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Check for existing lock
  SELECT * INTO v_existing_lock
  FROM system_locks
  WHERE lock_key = p_lock_key;

  -- If lock exists and is not expired, return false
  IF FOUND AND v_existing_lock.expires_at > v_now THEN
    RETURN FALSE;
  END IF;

  -- Acquire or update lock
  INSERT INTO system_locks (lock_key, locked_at, locked_by, expires_at)
  VALUES (p_lock_key, v_now, p_locked_by, v_now + (p_timeout_seconds || ' seconds')::INTERVAL)
  ON CONFLICT (lock_key) DO UPDATE
  SET locked_at = v_now,
      locked_by = p_locked_by,
      expires_at = v_now + (p_timeout_seconds || ' seconds')::INTERVAL,
      updated_at = v_now;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

## Testing Scenarios

### Scenario 1: Manual Trigger During Orchestrator Run

1. **Orchestrator**: Starts at 6:00:00 PM, acquires `gr8nade_nba_total_lock`
2. **User**: Clicks "Run Now" at 6:00:05 PM
3. **Result**: User sees "⏳ Already Running" toast
4. **Orchestrator**: Completes at 6:00:30 PM, releases lock
5. **User**: Clicks "Run Now" again at 6:00:35 PM
6. **Result**: Lock acquired, pick generation proceeds

### Scenario 2: Multiple Manual Triggers

1. **User**: Clicks "Run Now" at 6:00:00 PM
2. **System**: Acquires `gr8nade_nba_total_lock`, starts generation
3. **User**: Clicks "Run Now" again at 6:00:02 PM (impatient)
4. **Result**: Second request sees "Already Running", returns immediately
5. **First Request**: Completes at 6:00:15 PM, releases lock
6. **User**: Can now trigger again successfully

### Scenario 3: Orchestrator Crash

1. **Orchestrator**: Starts at 6:00:00 PM, acquires lock
2. **Crash**: Process crashes at 6:00:10 PM without releasing lock
3. **Lock State**: Held until 6:05:00 PM (5 minute timeout)
4. **User**: Clicks "Run Now" at 6:02:00 PM
5. **Result**: Lock still valid, sees "Already Running"
6. **User**: Clicks "Run Now" at 6:06:00 PM
7. **Result**: Lock expired, new lock acquired, generation proceeds

## Best Practices

### ✅ DO

- Always release locks in success, error, and no-games paths
- Use try-catch-finally to ensure lock release
- Set reasonable timeout (5 minutes is good for pick generation)
- Provide clear user feedback when lock is held
- Use unique lock IDs for debugging

### ❌ DON'T

- Don't use the same lock key for different operations
- Don't set timeout too short (< 1 minute) - may cause premature expiration
- Don't set timeout too long (> 10 minutes) - may cause long deadlocks
- Don't forget to release locks in error paths
- Don't assume lock will always be acquired

## Monitoring

### Check Active Locks

```sql
SELECT 
  lock_key,
  locked_by,
  locked_at,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
FROM system_locks
WHERE expires_at > NOW()
ORDER BY locked_at DESC;
```

### Check Lock History

```sql
SELECT 
  lock_key,
  locked_by,
  locked_at,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN 'ACTIVE'
    ELSE 'EXPIRED'
  END as status
FROM system_locks
ORDER BY locked_at DESC
LIMIT 20;
```

### Clear Stuck Locks (Emergency)

```sql
-- Clear all expired locks
DELETE FROM system_locks WHERE expires_at < NOW();

-- Clear specific lock (use with caution!)
DELETE FROM system_locks WHERE lock_key = 'gr8nade_nba_total_lock';
```

## Conclusion

The locking system ensures:

1. ✅ **No duplicate picks** - Only one process can generate picks at a time
2. ✅ **No orchestrator clash** - Manual triggers respect orchestrator locks
3. ✅ **Self-healing** - Expired locks are automatically cleaned up
4. ✅ **Clear feedback** - Users know when system is busy
5. ✅ **Independent cappers** - Different cappers don't block each other

**The "Run Now" button is safe to use and will never clash with the orchestrator!**

