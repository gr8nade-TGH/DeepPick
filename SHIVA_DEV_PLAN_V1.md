# SHIVA Capper Management – Development Plan (v1)

Date: 2025-10-20
Owner: Capper Engineering (Cursor implementation)
Scope: NBA-first. Implements 7-step SHIVA pipeline with immutable odds snapshot and full audit trail.

## 1) Guiding Principles
- Capper-only prediction through Steps 1–4; introduce market only at Step 5.
- Hybrid "greenfield-in-namespace": build new SHIVA v1 under isolated namespace; keep legacy cappers intact until cut-over.
- Each step is a self-contained module with typed I/O; everything persisted.
- Idempotent endpoints; deterministic math; reproducible from stored inputs.
- Immutable odds snapshots (with explicit re-snapshot activation policy).

## 2) High-Level Architecture
- UI (Capper Management)
  - `src/app/cappers/shiva/management/page.tsx` – page shell
  - `src/app/cappers/shiva/management/components/` – filters, inbox, wizard steps (1–7), advanced drawer
- API (Next.js routes)
  - `src/app/api/shiva/runs/*` – run lifecycle (create, get, state transitions, recompute)
  - `src/app/api/shiva/odds/*` – odds snapshot CRUD (immutable rows, active pointer)
  - `src/app/api/shiva/factors/*` – step-specific computations & persistence
  - `src/app/api/shiva/pick/*` – pick decision & persistence to `picks`
  - `src/app/api/shiva/ai/*` – provider proxies (Perplexity for Step 3, OpenAI for Step 4)
- Core Logic (new namespace)
  - `src/lib/cappers/shiva-v1/steps/`
    - `step1-intake.ts`
    - `step2-odds-snapshot.ts`
    - `step3-factors-1-5.ts`
    - `step4-factors-6-7-and-prediction.ts`
    - `step5-market-mismatch.ts`
    - `step6-pick-generator.ts`
    - `step7-insight-card.ts`
  - `src/lib/cappers/shiva-v1/orchestrator.ts`
  - `src/lib/cappers/shiva-v1/statmuse.ts` (strict templates)
  - `src/lib/cappers/shiva-v1/news.ts` (server-side proxy + caching)
  - `src/lib/cappers/shiva-v1/math.ts` (deterministic constants/functions)
  - `src/lib/cappers/shiva-v1/types.ts` (run, factor entries, snapshots, confidence, step payloads)
- Shared/Telemetry
  - `src/lib/monitoring/pipeline-logger.ts` – structured logs per step (duration, retries, cache hits)
  - Feature flag for gradual rollout

## 3) Data Model & Persistence
Tables (new):
- `runs`:
  - `run_id UUID PK`, `parent_run_id UUID NULL`, `game_id UUID`, `sport TEXT`, `capper TEXT`, `state TEXT` (NEW/IN-PROGRESS/COMPLETE/VOIDED),
    `ai_step3 TEXT`, `ai_step4 TEXT`, `conf7 NUMERIC`, `conf_market_adj NUMERIC`, `conf_final NUMERIC`, `units NUMERIC`, `pick_type TEXT`,
    `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ`.
  - Unique: `(game_id, capper)` active constraint; allow recompute via clone (new `run_id`) with `parent_run_id`.
- `odds_snapshots`:
  - `snapshot_id UUID PK`, `run_id UUID FK`, `payload_json JSONB NOT NULL`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ DEFAULT now()`.
  - Policy: creating a new snapshot sets previous `is_active=false` and new `is_active=true`; Step 5 always references active snapshot.
- `factors`:
  - `run_id UUID FK`, `factor_no SMALLINT` (1..8), `raw_values_json JSONB` (includes raw StatMuse/news and parsed numerics),
    `normalized_value NUMERIC`, `weight_applied NUMERIC`, `caps_applied BOOLEAN`, `cap_reason TEXT`, `notes TEXT`,
    `created_at TIMESTAMPTZ DEFAULT now()`.
  - PK: `(run_id, factor_no, created_at)` to allow versioned entries; latest used for compute.
- `insight_cards`:
  - `run_id UUID FK`, `rendered_json JSONB`, `created_at TIMESTAMPTZ DEFAULT now()`.

Existing table (augment):
- `picks`: add nullable `run_id UUID FK` for audit lineage.

Read-only view:
- `shiva_picks_view` joining `picks ← runs ← odds_snapshots(active) ← factors(latest-per-factor)` for analytics and UI.

RLS: mirror current policies; `service_role` full access; public SELECT where appropriate for read views.

## 4) API Contracts (Sketch)
All endpoints idempotent; validate `run_id`, state transitions, and dedup policy (by `(game_id, capper)`).

- Runs
  - `POST /api/shiva/runs` → body: `{ game_id, sport: 'NBA', capper: 'SHIVA' }` → creates run (state=IN-PROGRESS) or returns existing if in-progress/complete.
  - `GET /api/shiva/runs/:run_id` → load full run, latest factors, active snapshot, state.
  - `POST /api/shiva/runs/:run_id/recompute` → clones run with `parent_run_id`.
  - `PATCH /api/shiva/runs/:run_id/state` → transitions with guards.
- Odds Snapshot
  - `POST /api/shiva/odds/snapshot` → `{ run_id }` → fetch from internal Odds API, store `payload_json`, set active.
  - `POST /api/shiva/odds/resnapshot` → `{ run_id }` → create new snapshot row, mark it active.
- Factors
  - Step 3: `POST /api/shiva/factors/step3` → `{ run_id, ai_provider? }` → StatMuse pulls F1–F4 for both teams, news aggregation F5; persist raw + parsed; compute normalized per-100 (with caps) and weights.
  - Step 4: `POST /api/shiva/factors/step4` → `{ run_id, ai_provider? }` → compute F6–F7; pace, delta, spread/total, scores; Conf7; persist.
  - Step 5: `POST /api/shiva/factors/step5` → `{ run_id }` → market mismatch using active snapshot; Conf_market_adj; Conf_final; persist F8.
- Pick
  - `POST /api/shiva/pick/generate` → `{ run_id }` → apply gating thresholds; select bet type (spread vs ML vs total) per heuristic; persist to `picks` with `run_id` if not Pass.
- AI Provider Proxies
  - `POST /api/shiva/ai/statmuse` → server-side template queries with caching, rate-limit/backoff.
  - `POST /api/shiva/ai/news` → prioritized domains, 48h default window; auto-expand to 72h if game starts ≤12h; dedupe.

## 5) Deterministic Math & Weights
Implement in `math.ts` with constants:
- Weights (scaled to total, sum of F1..F7 = 70% of total):
  - F1 21%, F2 17.5%, F3 14%, F4 7%, F5 7%, F6 3.5%, F7 2.1%.
- Pace: `PACE_exp = 2 / (1/pace_A + 1/pace_B)`.
- Delta (per 100): as spec; H2H clamped ±6 per 100; NewsEdge_100 ∈ [−3,+3].
- Spread_pred: `Delta_100 * (PACE_exp / 100)`.
- Total_pred: per spec with league ORtg baseline (use 114 fallback) and adj terms.
- Scores: `Pts_A = round((TOTAL_pred + Spread_pred)/2)`, `Pts_B = TOTAL_pred - Pts_A`.
- Confidence:
  - `Conf7_raw = min(|Spread_pred|/6, 1)`; `Conf7_score = 1 + 4 * Conf7_raw`.
  - Market: `Edge_side_norm = clamp((S_capper_on_pick − S_vegas_on_pick)/6, -1, 1)`; `Edge_total_norm = clamp((TOTAL_pred − total_line)/12, -1, 1)`; `Market_norm = argmax_abs`.
  - `Conf_market_adj = 1.2 * Market_norm`; `Conf_final = clamp(Conf7 + Conf_market_adj, 1, 5)`.

Advanced Drawer (weights override): defaults hard-coded; optional per-capper overrides persisted to `capper_settings`.

## 6) Bet-Type Heuristics & Units
- Units mapping (NBA default):
  - `< 2.5` → Pass; `2.5–3.0` → 1u; `3.01–4.0` → 2u; `> 4.0` → 3u.
- Side pick type:
  - Favorites: if model spread edge ≤ 2.5, consider ML only if implied price ≤ −250; else take spread.
  - Underdogs: if win prob ≥ 40% and ML ≥ +150, allow ML; else take spread.
  - If total edge dominates, choose totals (Over/Under) accordingly.

## 7) Step Modules: Inputs / Outputs
- Step 1: Intake & Dedup
  - In: `game_id, sport, capper=SHIVA`
  - Out: `run_id`, `state=IN-PROGRESS`
  - Dedup: block duplicates by `(game_id, capper)`; allow Recompute (clone) with `parent_run_id`.
- Step 2: Odds Snapshot
  - In: `run_id`
  - Out: `odds_snapshots` row (active)
  - Re-snapshot: creates new active row; F8 always references active snapshot id.
- Step 3: Factors 1–5
  - In: `run_id`, AI provider
  - Out: factor rows for F1..F5 with raw StatMuse/news and parsed numerics; normalized per-100; caps flags.
- Step 4: Factors 6–7 + Prediction
  - In: `run_id`, AI provider (optional)
  - Out: F6/F7 rows; computed PACE_exp, Delta_100, Spread_pred, TOTAL_pred, Pts_A/Pts_B; Conf7 stored on `runs`.
- Step 5: Market Mismatch
  - In: `run_id`
  - Out: F8 row; Conf_market_adj; Conf_final stored on `runs`.
- Step 6: Pick Generator
  - In: `run_id`
  - Out: pick persisted to `picks` with `run_id` if not Pass; else store decision on `runs`.
- Step 7: Insight Card
  - In: `run_id`
  - Out: `insight_cards` JSON; tone: numeric, concise, no emojis; badges + mini bars.

## 8) Providers, Caching, and Rate Limits
- All external calls from server routes; never from client.
- StatMuse (strict templates) & news search:
  - Cache TTLs per endpoint; include backoff & retry policy; mark manual inputs when used.
  - Prioritize sources: nba.com, team sites, ESPN, The Athletic, Rotowire, Underdog NBA News, FantasyLabs News, AP; de-dupe aggregators.
  - News window default 48h; auto-expand to 72h if game starts ≤12h.

## 9) State Machine & Idempotency
- Game Inbox: NEW → IN-PROGRESS → COMPLETE; admin can set VOIDED.
- Each step endpoint is idempotent: re-running writes a new factor row (versioned) but does not duplicate run/pick.
- Recompute clones the run with lineage (`parent_run_id`).

## 10) Telemetry & Logging
- Per-step: duration (ms), cache hits, provider retries, StatMuse HTTP codes (4xx/5xx), inputs hashed for privacy, output hashes for reproducibility.
- Attach structured logs to run; expose in UI debug drawer.

## 11) UI Details
- Top filters: Sport pills (NBA active; NFL/MLB disabled with tooltip), Capper selector (SHIVA), Date range, Search.
- Left pane: Game Inbox table (state badges NEW/IN‑PROGRESS/COMPLETE/SKIPPED/VOIDED).
- Right pane: 7-step wizard with Next/Back, Save Draft; provider dropdowns at top.
- Step UIs show raw values, normalized per-100, weights, and a math "ⓘ details" popover with formula + substitutions.
- Step 5: side/total diff bars vs active snapshot; highlight dominant signal.
- Step 6: units mapping view with thresholds; allow advanced override.
- Step 7: Insight Card preview; persist rendered JSON.

## 12) Testing Strategy
- Unit tests: math.ts (pace, deltas, clamps, confidence, market mismatch selection); heuristics.
- Integration: Steps 1–6 over fixed fixtures and frozen snapshots; ensure idempotency.
- API: input validation, dedup by (game_id, capper), state transitions, recompute.
- UI: wizard navigation & persistence; error and manual fallback paths.
- Data QA: factors sum/weights, caps flags, view correctness (`shiva_picks_view`).

## 13) Migration & Rollout Plan
1. Add new tables + `run_id` FK to `picks` + create `shiva_picks_view`.
2. Scaffold API routes & types; land orchestrator + math core.
3. Implement Steps 1–2 (intake + snapshot) → wire UI.
4. Implement Step 3 (F1–F5) with provider proxy + caching.
5. Implement Step 4 (F6–F7 + prediction) and Conf7.
6. Implement Step 5 (market mismatch) and Conf_final.
7. Implement Step 6 (pick generator) → write to `picks`.
8. Implement Step 7 (insight card) + view.
9. Feature-flag rollout; run in parallel with legacy; compare for a week.
10. Cut-over, then deprecate legacy shiva flow.

## 14) Risks & Mitigations
- External provider rate limits → caching + backoff, manual entry fallback.
- Data drift between snapshot and bet time → explicit active snapshot ID, re-snapshot flow.
- Non-determinism → all constants in `math.ts`; no RNG; caps/clamps recorded.
- Code sprawl → strict namespace + typed I/O contracts per step.

## 15) Next Steps (Implementation Checklist)
- Migrations: `runs`, `odds_snapshots`, `factors`, `insight_cards`, `picks.run_id`, `shiva_picks_view`.
- Scaffolding: routes, types, orchestrator, math constants.
- UI shell: inbox + wizard skeleton; provider dropdowns.
- Telemetry hooks: pipeline logger per endpoint.


