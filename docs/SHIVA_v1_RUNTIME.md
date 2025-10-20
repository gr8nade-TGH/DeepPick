# SHIVA v1 Runtime Documentation

## Overview

SHIVA v1 is a 7-step NBA pick generation system with idempotent API routes, profile-based configuration, and comprehensive dry-run support.

---

## Feature Flag Matrix

| Flag | Scope | Default | Effect |
|------|-------|---------|--------|
| `SHIVA_V1_API_ENABLED` | Server | `false` | Gates all `/api/shiva/*` routes (403 if false) |
| `SHIVA_V1_UI_ENABLED` | Server | `false` | Gates Capper Management UI visibility |
| `SHIVA_V1_WRITE_ENABLED` | Server | `false` | Controls DB writes (dry-run when false) |
| `NEXT_PUBLIC_SHIVA_V1_API_ENABLED` | Client | `false` | Exposed to browser for UI gating |
| `NEXT_PUBLIC_SHIVA_V1_UI_ENABLED` | Client | `false` | Shows/hides management page |
| `NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED` | Client | `false` | Displays dry-run banner |

### Behavior Matrix

| API | UI | WRITE | Result |
|-----|----|----|--------|
| ❌ | ❌ | ❌ | All SHIVA features disabled |
| ✅ | ❌ | ❌ | API works (dry-run), UI hidden |
| ✅ | ✅ | ❌ | **Dry-Run Mode** - Full UI + API, no DB writes |
| ✅ | ✅ | ✅ | **Production Mode** - Full functionality |

---

## API Routes

### Base Path: `/api/shiva`

All routes require `Idempotency-Key` header on POST requests.

| Endpoint | Method | Purpose | Write? |
|----------|--------|---------|--------|
| `/runs` | POST | Create or reuse run | Yes |
| `/runs/:run_id` | GET | Fetch run details | No |
| `/runs/:run_id/state` | PATCH | Update run state | Yes |
| `/odds/snapshot` | POST | Capture odds snapshot | Yes |
| `/factors/step3` | POST | Store Factors 1-5 | Yes |
| `/factors/step4` | POST | Store Factors 6-7, predictions | Yes |
| `/factors/step5` | POST | Store Factor 8, market mismatch | Yes |
| `/pick/generate` | POST | Generate or pass on pick | Yes |
| `/insight-card` | POST | Persist insight card JSON | Yes |

---

## Request/Response Shapes

### 1. Create Run

**POST `/api/shiva/runs`**

Request:
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

Response (201/200):
```json
{
  "run_id": "uuid-or-dryrun_run",
  "state": "IN-PROGRESS"
}
```

Headers: `X-Dry-Run: 1` (if WRITE=false)

---

### 2. Odds Snapshot

**POST `/api/shiva/odds/snapshot`**

Request: (See `fixtures/shiva-v1/step2-odds-snapshot.json`)

Response (200):
```json
{
  "snapshot_id": "uuid-or-dryrun_snapshot",
  "is_active": true
}
```

---

### 3-7. Factor Steps

See `fixtures/shiva-v1/step3-factors.json` through `step7-insight-card.json` for exact shapes.

---

## Idempotency Rules

### Header Requirement
All POST routes require:
```
Idempotency-Key: <unique-string>
```

Missing key → `400 IDEMPOTENCY_KEY_REQUIRED`

### Replay Behavior

| Mode | Behavior |
|------|----------|
| **Dry-Run** (`WRITE=false`) | Recomputes response (not cached to DB), returns `Idempotency-Skip: true` |
| **Write** (`WRITE=true`) | First request writes to `idempotency_keys`, replays return cached response |

### Replay Guarantee

Same `(run_id, step, idempotency_key)` → identical `(status, body)`.

Example:
```bash
# First request
POST /api/shiva/runs
Idempotency-Key: test-001
→ 201 { "run_id": "abc123", "state": "IN-PROGRESS" }

# Replay (same key)
POST /api/shiva/runs
Idempotency-Key: test-001
→ 201 { "run_id": "abc123", "state": "IN-PROGRESS" }  # Exact same
```

---

## Error Codes

| Code | Status | Meaning | How to Fix |
|------|--------|---------|------------|
| `INVALID_BODY` | 400 | Request body failed Zod validation | Check `details.issues` for schema violations |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Missing `Idempotency-Key` header | Add header to request |
| `PRECONDITION_FAILED` | 422 | Step 5: no active odds snapshot | Run Step 2 first to create snapshot |
| `DB_ERROR` | 500 | Database operation failed | Check Supabase connection/schema |
| `FEATURE_DISABLED` | 403 | `SHIVA_V1_API_ENABLED=false` | Enable feature flag |

---

## Dry-Run vs Write Mode

### Dry-Run Mode (`WRITE_ENABLED=false`)

- ✅ All routes compute and return responses
- ✅ No DB writes occur
- ✅ Simulated IDs returned (`dryrun_run`, `dryrun_snapshot`)
- ✅ `X-Dry-Run: 1` header on all responses
- ✅ `Idempotency-Skip: true` (responses not cached to DB)
- ✅ Step 5 precondition bypassed (no snapshot check)

### Write Mode (`WRITE_ENABLED=true`)

- ✅ All DB writes persist
- ✅ Real UUIDs generated
- ✅ `X-Dry-Run: 0` header on all responses
- ✅ Idempotency responses cached to `idempotency_keys` table
- ✅ Step 5 enforces active snapshot precondition (422 if missing)

### Per-Step Behavior

| Step | Dry-Run | Write Mode |
|------|---------|------------|
| 1 | Returns `dryrun_run` | Inserts into `runs`, returns UUID |
| 2 | Returns `dryrun_snapshot` | Deactivates old, inserts new into `odds_snapshots` |
| 3 | Computes 5 factors, no DB | Inserts 5 rows into `factors` |
| 4 | Computes predictions, no DB | Inserts 2 rows (F6, F7), updates `runs.conf7` |
| 5 | Computes market adj, no DB | Inserts F8, updates `runs.conf_final` |
| 6 | Returns simulated pick | Inserts into `picks` with `run_id` FK |
| 7 | Returns simulated card ID | Inserts into `insight_cards` |

---

## Capper Profile System

SHIVA v1 uses an in-memory profile (`shivaProfileV1`) defining:

- **Weights:** Factor weights (f1: 21%, f2: 17.5%, etc.)
- **Caps:** H2H ±6, Side ±6, Total ±12, News ±3.0, Market Adj ≤1.2
- **Constants:** Home edge 1.5, League ORtg 114.0
- **Units:** Pass <2.5, 1u = 2.5-3.0, 2u = 3.01-4.0, 3u >4.0
- **Providers:** Step 3 (Perplexity), Step 4 (OpenAI)
- **News:** Window 48h (72h if game ≤12h away)

**Future:** Profiles will be stored in `capper_settings` table and loaded per capper.

---

## How to Demo

### Postman (API-Only)

1. Import `SHIVA_v1.postman_collection.json`
2. Set environment vars:
   - `baseUrl`: `http://localhost:3000` or Preview URL
3. Run collection top-to-bottom:
   - Create Run → auto-sets `run_id`
   - Snapshot → auto-sets `snapshot_id`
   - Steps 3-7 → use propagated IDs
4. Check response headers for `X-Dry-Run`
5. Replay any request with same `Idempotency-Key` → verify identical response

### Wizard UI

1. Visit `/cappers/shiva/management`
2. Click "Next" through Steps 1-8
3. Step 8 generates debug report
4. Click "📋 Copy Debug Report" button
5. Verify:
   - Dry-run banner visible (if WRITE=false)
   - All steps return 200/201
   - Step responses table shows status/dry-run/response

---

## Testing Checklist

### Dry-Run E2E
- [ ] Steps 1-7 all return 200/201
- [ ] All responses have `X-Dry-Run: 1`
- [ ] No rows added to Supabase
- [ ] Wizard shows "Dry-Run (no writes)" banner

### Write Mode E2E
- [ ] Steps 1-7 all return 200/201
- [ ] All responses have `X-Dry-Run: 0`
- [ ] DB has 1 run, 1 snapshot, 8 factors, 1 pick, 1 card
- [ ] Idempotency keys stored and replays work

### Precondition (422)
- [ ] Step 5 without snapshot → 422 PRECONDITION_FAILED
- [ ] Error includes clear message

### Idempotency
- [ ] Same key → same response/status
- [ ] Replays don't create duplicate DB rows

---

## Structured Logging

All routes log in this format:

```javascript
console.log('[SHIVA:StepName]', {
  run_id: '<uuid>',
  inputs: { /* key input values */ },
  outputs: { /* key output values */ },
  writeAllowed: true|false,
  latencyMs: <number>,
  status: <number>
})
```

Errors:
```javascript
console.error('[SHIVA:StepName]', {
  error: '<CODE>',
  issues: [/* zod issues */],
  latencyMs: <number>
})
```

---

## Database Schema

### Tables Created by Migration 015

- `runs`: Run state machine
- `odds_snapshots`: Immutable odds snapshots
- `factors`: Factor values per run
- `insight_cards`: Rendered insight JSON
- `idempotency_keys`: Response cache (updated by migration 016)

### Key Constraints

- `runs(game_id, capper)` unique where `state <> 'VOIDED'`
- `odds_snapshots(run_id)` partial unique where `is_active = true`
- `picks.run_id` FK → `runs.run_id` ON DELETE RESTRICT

### View: `shiva_picks_view`

Joins `picks ← runs ← odds_snapshots ← factors` showing:
- Only active snapshot
- Latest factor row per `(run_id, factor_no)`

---

## Troubleshooting

### "SHIVA v1 UI is disabled"
- Check `NEXT_PUBLIC_SHIVA_V1_UI_ENABLED=true` in Preview env
- Redeploy with "Ignore Build Cache"

### Step 5 returns 422
- Run Step 2 (odds snapshot) first
- Verify `odds_snapshots` has active row for run_id

### Dry-run shows dryRun: false
- Verify `SHIVA_V1_WRITE_ENABLED=false` in env
- Check response header `X-Dry-Run: 1`
- Wizard reads header (not JSON boolean)

### Idempotency not working
- Ensure `Idempotency-Key` header present
- Check `idempotency_keys` table exists (migration 016)
- Verify WRITE=true (dry-run skips caching)

---

## Next Steps

After SHIVA v1 passes E2E:
1. Add `capper_settings` table for DB-driven profiles
2. Add "Profile Summary" panel in management UI
3. Multi-capper support (ORACLE, NEXUS, etc.)
4. Real-time StatMuse/News API integration
5. Advanced analytics and performance tracking

