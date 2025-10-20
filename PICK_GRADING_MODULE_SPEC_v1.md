
# Pick Grading Module — Spec (v1)

**Goal:** Grade completed picks, compute units won/lost, produce a short AI post‑mortem, and store result artifacts for the Insight Card “RESULTS” section. Future: suggest factor weight nudges into a learning memory.

---

## 1) Trigger

- Scheduled job: every hour; for each pick where `game_end_time + 12h <= now` and `graded=false`
- Or manual POST: `/api/picks/grade` with `{ pick_id }`

---

## 2) Inputs

- `pick` row (contains run_id, capper, sport, bet type, line, units, predicted winner/score, timestamp)
- `odds_snapshot` (line at time of pick)
- `run` + `factors` (for context in write‑up)
- **Final score** (via scores API)

---

## 3) Logic

### 3.1 Resolve outcome
- **Moneyline**: win if predicted team won
- **Spread**: win if (predicted side) covers; **Push** if margin == spread
- **Total**: win if (predicted direction) matches final total vs line; **Push** if equal
- Handle **Run Line** for MLB (same as spread but RL ±1.5 typical)

### 3.2 Units accounting (simple v1)
- Use the pick’s **units** as risk; flat return (ignore price for now)
- win → `+units`; loss → `−units`; push → `0`
- (Later: price‑aware staking with book odds)

### 3.3 AI result note
- Compose a short paragraph:
  - Compare predicted score/winner vs final
  - Mention major events (injury, ejection, OT) from news scan
  - Label as anomaly if clear exogenous event
  - Keep 2–3 lines, neutral tone

### 3.4 Suggested learnings (future)
- Heuristics to propose weight tweaks (e.g., if actual total >> predicted and 3PT factor had high variance, suggest +weight)

---

## 4) Outputs

Write `pick_results` row:
```json
{
  "pick_id": "abc",
  "result": "win|loss|push",
  "units_delta": 2,
  "final_score": {"home":118,"away":110},
  "explanation": "Projected 116-108; ended 98-128. Star injury swung game.",
  "factors_review": [{"key":"newsEdge","suggested_weight_change":0.2}],
  "grading_version": "v1",
  "created_at": "2025-01-01T12:00:00Z"
}
```

Expose via `GET /api/picks/{pick_id}/result` and include in **Insight Card** “RESULTS” section.

---

## 5) Tests

- Unit: outcome logic for ML/Spread/Total/Run Line
- Integration: grade pick with mocked final score; write result row
- Snapshot: render Insight Card with RESULTS section populated

---

## 6) Open Questions

- Add book price handling in v1.1?
- Cache/refresh window for final scores?
- Where to store “learning memory” (proposed `capper_learning` table)?
