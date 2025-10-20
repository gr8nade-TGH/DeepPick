# SHIVA v1 - Phase 5 Check-In: Route Hardening

## ✅ Implementation Complete

### **1. Idempotency Enforcement**
- ✅ All POST routes use `withIdempotency` helper
- ✅ Responses cached by `(run_id, step, idempotency_key)`
- ✅ Replay with same key returns identical response/status
- ✅ Race condition handling (conflict → re-read stored response)

### **2. Consistent X-Dry-Run Header**
- ✅ Set automatically by `withIdempotency` helper based on `writeAllowed`
- ✅ `X-Dry-Run: 1` when `WRITE_ENABLED=false`
- ✅ `X-Dry-Run: 0` when `WRITE_ENABLED=true`
- ✅ Wizard UI reads header to determine dry-run status

### **3. Strict Zod Schemas**
- ✅ All schemas use `.strict()` - no extra keys allowed
- ✅ Step 3 meta uses `.passthrough()` - explicit comment added
- ✅ Validation errors return structured 400 responses with issues array

### **4. Single-Transaction Writes**
- ✅ All DB operations wrapped in `if (writeAllowed)` guards
- ✅ No partial writes possible in dry-run mode
- ✅ Error handling preserves atomicity (throw on error)

### **5. Step 5 Precondition**
- ✅ Returns 422 PRECONDITION_FAILED when no active snapshot exists
- ✅ Only enforced when `WRITE_ENABLED=true`
- ✅ Bypassed in dry-run for testing

### **6. Structured Logging**
- ✅ All routes log: `[SHIVA:StepName]` with inputs → outputs → latency → status
- ✅ Error logs include: error code, issues, latency
- ✅ Success logs include: key metrics, caps applied, writeAllowed flag

---

## 🧪 Postman Test Scenarios

### **Test 1: Idempotent Replay (Dry-Run)**

**Setup:**
- Env: `SHIVA_V1_WRITE_ENABLED=false`
- Idempotency-Key: `test-replay-001`

**Request 1 (POST /api/shiva/runs):**
```json
{
  "game_id": "nba_2025_10_21_okc_hou",
  "sport": "NBA",
  "capper": "SHIVA",
  "home_team": "Oklahoma City Thunder",
  "away_team": "Houston Rockets",
  "start_time_utc": "2025-10-21T01:30:00Z"
}
```

**Expected Response 1:**
- Status: `201 Created`
- Headers: `X-Dry-Run: 1`, `Idempotency-Skip: true`
- Body:
```json
{
  "run_id": "dryrun_run",
  "state": "IN-PROGRESS"
}
```

**Request 2 (Same Idempotency-Key):**
- Identical request with same `Idempotency-Key: test-replay-001`

**Expected Response 2:**
- Status: `201 Created` (same as original)
- Headers: `X-Dry-Run: 1`
- Body: **Identical to Response 1**
- Note: In dry-run, idempotency is skipped (not stored), so response is recomputed

---

### **Test 2: Idempotent Replay (Write Mode)**

**Setup:**
- Env: `SHIVA_V1_WRITE_ENABLED=true`
- Idempotency-Key: `test-write-replay-001`

**Request 1 (POST /api/shiva/runs):**
```json
{
  "game_id": "nba_2025_10_21_lal_gsw",
  "sport": "NBA",
  "capper": "SHIVA",
  "home_team": "Los Angeles Lakers",
  "away_team": "Golden State Warriors",
  "start_time_utc": "2025-10-21T02:00:00Z"
}
```

**Expected Response 1:**
- Status: `201 Created`
- Headers: `X-Dry-Run: 0`
- Body:
```json
{
  "run_id": "<UUID>",
  "state": "IN-PROGRESS"
}
```
- DB: New row in `runs` table
- DB: New row in `idempotency_keys` table with stored response

**Request 2 (Same Idempotency-Key):**
- Identical request with same `Idempotency-Key: test-write-replay-001`

**Expected Response 2:**
- Status: `201 Created` (mirrored from stored)
- Headers: `X-Dry-Run: 0`
- Body: **Identical to Response 1** (exact same `run_id`)
- DB: No new row created (idempotent)

**Verification:**
```sql
SELECT run_id, state FROM runs WHERE game_id = 'nba_2025_10_21_lal_gsw';
-- Should return exactly 1 row

SELECT * FROM idempotency_keys 
WHERE key = 'test-write-replay-001';
-- Should return 1 row with stored response_json matching Response 1
```

---

### **Test 3: Step 5 Precondition (422 When No Active Snapshot)**

**Setup:**
- Env: `SHIVA_V1_WRITE_ENABLED=true`
- Create a run but skip Step 2 (no odds snapshot)

**Request (POST /api/shiva/factors/step5):**
```json
{
  "run_id": "<run_without_snapshot>",
  "inputs": {
    "active_snapshot_id": "snap_missing",
    "spread_pred_points": 2.5,
    "total_pred_points": 225.0,
    "pick_side_team": "Lakers",
    "snapshot": {
      "spread": { "fav_team": "Lakers", "line": -3.5 },
      "total": { "line": 222.5 }
    },
    "conf7_score": 2.5
  },
  "results": {
    "market_edge": {
      "edge_side_points": -1.0,
      "edge_side_norm": -0.17,
      "edge_total_points": 2.5,
      "edge_total_norm": 0.21,
      "dominant": "total",
      "conf_market_adj": "1.2 * 0.21",
      "conf_market_adj_value": 0.25
    },
    "confidence": { "conf7": 2.5, "conf_final": 2.75 }
  }
}
```

**Expected Response:**
- Status: `422 Unprocessable Entity`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "error": {
    "code": "PRECONDITION_FAILED",
    "message": "No active odds snapshot for this run"
  }
}
```

**Console Log:**
```
[SHIVA:Step5] {
  error: 'PRECONDITION_FAILED',
  run_id: '<run_without_snapshot>',
  reason: 'No active odds snapshot',
  latencyMs: <ms>
}
```

---

### **Test 4: Full Pipeline with Structured Logs**

**Setup:**
- Env: `SHIVA_V1_WRITE_ENABLED=false` (dry-run)
- Run Steps 1-7 in sequence

**Expected Console Logs:**

```
[SHIVA:CreateRun] {
  game_id: 'nba_2025_10_21_okc_hou',
  run_id: 'dryrun_run',
  status: 'created',
  writeAllowed: false,
  latencyMs: 45
}

[SHIVA:Snapshot] {
  run_id: 'dryrun_run',
  snapshot_id: 'dryrun_snapshot',
  writeAllowed: false,
  latencyMs: 23,
  status: 200
}

[SHIVA:Step3] {
  run_id: 'dryrun_run',
  inputs: { ai_provider: 'perplexity' },
  outputs: { factor_count: 5, caps_applied: 0 },
  writeAllowed: false,
  latencyMs: 34,
  status: 200
}

[SHIVA:Step4] {
  run_id: 'dryrun_run',
  inputs: { ai_provider: 'openai' },
  outputs: {
    pace_exp: 99.07,
    spread_pred: 2.19,
    total_pred: 230.1,
    conf7: 2.46
  },
  writeAllowed: false,
  latencyMs: 28,
  status: 200
}

[SHIVA:Step5] {
  run_id: 'dryrun_run',
  inputs: { conf7: 2.46, edge_side_pts: -1.31, edge_total_pts: 2.6 },
  outputs: { conf_final: 2.72, dominant: 'total', market_adj: 0.26 },
  writeAllowed: false,
  latencyMs: 31,
  status: 200
}

[SHIVA:PickGenerate] {
  run_id: 'dryrun_run',
  inputs: { conf_final: 2.72, edge_dominant: 'total' },
  outputs: {
    decision: 'PICK',
    pick_type: 'TOTAL',
    selection: 'OVER 227.5',
    units: 1,
    confidence: 2.72
  },
  writeAllowed: false,
  latencyMs: 27,
  status: 200
}

[SHIVA:InsightCard] {
  run_id: 'dryrun_run',
  inputs: { pick_type: 'TOTAL', units: 1, conf_final: 2.72 },
  outputs: { insight_card_id: 'card_dryrun_run' },
  writeAllowed: false,
  latencyMs: 19,
  status: 200
}
```

---

## 🎯 Verification Checklist

- [x] All POST routes include `Idempotency-Key` header requirement
- [x] All POST routes use `withIdempotency` helper
- [x] All responses include `X-Dry-Run` header
- [x] All Zod schemas use `.strict()` (except explicit `.passthrough()` with comment)
- [x] All DB writes wrapped in `writeAllowed` guard
- [x] Step 5 returns 422 when no active snapshot (write mode only)
- [x] Structured logging on all routes with inputs/outputs/latency/status
- [x] Error logs include error code, issues, and latency

---

## 📊 DB Verification (Write Mode)

After running full pipeline with `WRITE_ENABLED=true`:

```sql
-- Should have exactly 1 run
SELECT run_id, state, conf7, conf_final 
FROM runs 
WHERE game_id = 'nba_2025_10_21_okc_hou' AND capper = 'SHIVA';

-- Should have exactly 1 active snapshot
SELECT snapshot_id, is_active, created_at 
FROM odds_snapshots 
WHERE run_id = '<run_id>' AND is_active = true;

-- Should have exactly 8 factor rows (1-5 from Step 3, 6-7 from Step 4, 8 from Step 5)
SELECT factor_no, normalized_value, caps_applied 
FROM factors 
WHERE run_id = '<run_id>' 
ORDER BY factor_no;

-- Should have exactly 1 pick
SELECT id, pick_type, selection, units, confidence, run_id 
FROM picks 
WHERE run_id = '<run_id>';

-- Should have exactly 1 insight card
SELECT run_id, created_at 
FROM insight_cards 
WHERE run_id = '<run_id>';

-- Should have idempotency keys for each step
SELECT step, key, status_code, created_at 
FROM idempotency_keys 
WHERE run_id = '<run_id>' 
ORDER BY created_at;
```

---

## 🚀 Next Phase

**Phase 6: Integration Tests & Schema Tests**
**Phase 7: Documentation (`/docs/SHIVA_v1_RUNTIME.md`)**

