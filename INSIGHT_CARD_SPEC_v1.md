
# Capper Pages & Insight Card — Product & Engineering Spec (v1)

**Owner:** Tucker (COO) — SHIVA first (NBA), MLB next  
**Audience:** Cursor AI agent & devs  
**Status:** Ready to build (Preview deploy not required)

---

## 0) Purpose

Provide a clear, config‑driven way to (a) choose a **Capper** and **Sport**, (b) select/tune **factors & weights**, (c) run the **7‑step pick pipeline** in **dry‑run** or **write** mode, and (d) review a **visual Insight Card** explaining why the pick was made. Add a **Results (Pick Grading) module** that grades the pick after the game and produces learning notes for future tuning.

This spec **extends** the SHIVA v1 pipeline without breaking it and prepares for **multi‑capper / multi‑sport** operation.

---

## 1) Capper Style — How uniqueness is expressed

A capper’s “style” is implemented via a **profile** per sport:

- **Factor selection** (toggle which factors are used)
- **Weights** per factor (sum to the factor block target, currently 0.70)
- **Provider choices** (Step 3/4 AI: Perplexity/OpenAI; search mode: quick/deep)
- **Caps & thresholds** (e.g., side/total caps, confidence → units mapping)
- **Market rule tweaks** (e.g., ML vs spread preference heuristics)

> **Extensibility:** Add new factors via the **Factor Registry** (plugin pattern). A factor has `key`, `description`, `fetch()`, `normalize()`, and emits a **per‑100 contribution**. Profiles decide whether to enable it and how much to weight it. This allows each capper to have bespoke factors over time while sharing the same pipeline.

**Initial styling power (with current 7 NBA factors):**
- Emphasize/de‑emphasize **Season Net**, **Recent Form**, **3PT environment**, **H2H PPG**, **NewsEdge**, **HomeEdge**, **ORtg/DRtg split**.
- Choose **AI providers** & **search depth** per step.
- Adjust **confidence → unit** thresholds (later up to 5u per capper).

---

## 2) Capper Management Page (unified)

Single page at `/cappers/shiva/management` (capper‑aware via query params).

### 2.1 Header (sticky)
- **Capper**: SHIVA (default), IFRIT, CERBERUS, NEXUS… (disabled if no profile)
- **Sport**: NBA (active), MLB/NFL (visible, disabled with tooltip)
- **Mode**: Dry‑Run | Write (Write = admin only)
- **AI overrides**: Step 3 / Step 4 (defaults from profile)
- **Game**: Game ID search + **default upcoming game** (odds snippet: ML/Spread/Total; Run Line when MLB)

### 2.2 Step 0 — Factor Controls
- **Toggle** each factor (from profile’s sport factor set)
- **Weight** slider + numeric input; running **sum badge** (target ~0.70; epsilon ±0.005)
- **ⓘ details** popover: what it means + where data comes from
- **Run with these settings** (disabled if invalid): builds `effectiveProfile` and starts Step 1

> The **wizard Steps 1–7** run using the **effectiveProfile** only (no persistent profile edits in dry‑run).

---

## 3) Insight Card (matches provided layout)

> The attached mock (“Hornets @ Lakers” example) is authoritative for structure.

### 3.1 Structure
- **Header line**: `AWAY +spread @ HOME -spread` & `O/U total`
- **Bet banner** (e.g., `2 UNITS on LA LAKERS -7`) with units & bet type (ML/Spread/Total or Run Line for MLB)
- **[AI PREDICTION WRITEUP]** — short natural‑language summary (Step 4 + news)
- **[AI GAME PREDICTION (SCORE AND VICTOR)]** — numerical scores, winner
- **[AI BOLD PREDICTION]** — optional one‑liner (e.g., “Suns hit 18 threes”)

### 3.2 Confidence Factors Grid
Two columns: **Away team** vs **Home team**. Each row = one enabled factor.

- **Left gutter icon**: factor icon (hover = tooltip explaining the factor)
- **Row content**:
  - **Label** (factor name or short code)
  - **Contribution** displayed under each team (per‑100 contribution after weight)
    - Positive contributions **green**, negative **red**, neutral gray
  - Optional small **bar** showing magnitude (absolute value)
- **Ordering**: sort by **absolute contribution** (highest impact first)
- **Footer**: `Confidence Score = X / 5` (ConfFinal)

**Icons:** a lightweight mapping (font icons or emoji fallback)  
`seasonNet → 📈`, `recentNet → 🔥`, `h2hPpg → 🤝`, `matchupORtgDRtg → 🎯`, `threePoint → 🎯`, `newsEdge → 🏥`, `homeEdge → 🏠` (can evolve).

### 3.3 Market Summary strip
- `Conf7`, `Market Adj`, `Conf Final`, `Dominant Edge` (Side/Total)
- Small bar indicating how much market moved the confidence (±0.3 scale = 30% weight)

### 3.4 State handling
- **Dry‑Run**: show a “Dry‑Run (no writes)” chip
- **Write**: if pick generated → push to **Current Picks** on dashboard

### 3.5 Mobile
- Stack columns vertically; icons remain; bars scale to width.

---

## 4) Results (Pick Grading) Module — v1

A separate module & route that runs **after the game** to grade picks and generate commentary.

### 4.1 Responsibilities
1) **Fetch final score** & confirm it matches our stored game snapshot
2) **Grade the pick**:
   - **Moneyline**: win if predicted team won
   - **Spread**: win if (predicted side) covers; **Push** if exactly equal
   - **Total**: win if predicted direction (over/under) matches final sum; push if equal to line
3) **Units accounting** (default model; profile‑tunable later):
   - **3‑unit** bets risk 3u; win returns +3u at even odds; losses −3u (we’ll extend for price‑aware staking later)
4) **Result write‑up** (AI): short paragraph comparing **Prediction Writeup** & **Game Outcome**, referencing major events (injury, ejection, OT)
5) **Learning hooks (future)**: compute suggested deltas per factor (e.g., “Recent Form underweighted by 0.3”) and store in a **capper memory** table for later review (no auto‑tuning yet in v1)

### 4.2 API & Storage
- `POST /api/picks/grade` with `{ pick_id }` (or schedule by cron: pick end + 12h)
- Writes to `pick_results` table:
  - `pick_id, result (win/loss/push), units_delta, final_score, notes_json, grading_version`
- Writes a `result_insight` JSON for the Insight Card’s **RESULTS** section.

### 4.3 Data sources
- Primary: the_odds_api scores (what we already use) or league feed
- Sanity web search (optional): confirm headline outcome & notable events

### 4.4 Output example
```json
{
  "pick_id": "123",
  "result": "loss",
  "units_delta": -2,
  "final_score": {"home": 128, "away": 98},
  "explanation": "We projected Lakers -7 (116-108). Lakers lost by 30. LeBron exited early (ankle). Marked as anomalous event; no model penalty.",
  "factors_review": [
    {"key":"newsEdge","suggested_weight_change": +0.2, "reason":"Injury was decisive"},
    {"key":"recentNet","suggested_weight_change": -0.1, "reason":"Recent form overstated"}
  ]
}
```

---

## 5) Engineering: Factor Registry & New Factors

### 5.1 Factor plugin interface
```ts
export type FactorPlugin = {
  key: string;                        // 'seasonNet', 'recentNet', etc.
  name: string;
  description: string;
  unit: 'per100'|'ppg'|'rate'|'percent';
  dataSource: 'StatMuse'|'News'|'Odds'|'Internal';
  fetch(ctx): Promise<RawInputs>;     // uses providers/queries
  normalize(raw, profile): Normalized // returns per-100 contribution
}
```
- **Registry**: array of plugins; capper profile references by `key`
- **NBA v1**: 7 plugins registered (today)
- **Future**: add MLB plugins (e.g., `sp_xERA_diff`, `bullpen_xFIP_7`, etc.)

### 5.2 Contribution calculation (display)
- Each factor outputs **per‑100 contribution** by team
- Display value = `weight * contribution` (rounded to 0.1)  
  Color rules: >0 → green; <0 → red; ≈0 → gray

---

## 6) Profile JSON (schema excerpt)

```jsonc
{
  "capper": "SHIVA",
  "sport": "NBA",
  "version": "v1",
  "providers": { "step3": "perplexity", "step4": "openai" },
  "searchMode": "quick",
  "factors": [
    {"key":"seasonNet","enabled":true,"weight":0.21},
    {"key":"recentNet","enabled":true,"weight":0.175},
    {"key":"matchupORtgDRtg","enabled":true,"weight":0.14},
    {"key":"h2hPpg","enabled":true,"weight":0.07},
    {"key":"newsEdge","enabled":true,"weight":0.07},
    {"key":"homeEdge","enabled":true,"weight":0.035},
    {"key":"threePoint","enabled":true,"weight":0.021}
  ],
  "caps": {"h2hPer100":6,"newsEdgePer100":3,"homePer100":1.5},
  "market": {"weight":0.30,"sideCap":6,"totalCap":12,"adjMax":1.2},
  "thresholds": {"passLt":2.5,"oneUnit":3.0,"twoUnits":4.0,"maxUnits":3}
}
```

---

## 7) Insight Card Component Checklist (dev)

- [ ] Header line, bet banner, writeups
- [ ] Team columns (Away/Home)
- [ ] Factor rows (enabled only), icon, label, value (weighted), bar
- [ ] Sorting by absolute contribution
- [ ] Market summary strip
- [ ] Confidence score (ConfFinal) footer
- [ ] Dry‑run chip
- [ ] Results sub‑section placeholder (awaits grading module)
- [ ] Copy‑Debug button (Step 8)

---

## 8) QA / Test Plan (UI)

1) Run with **all factors ON** (default weights) → record delta & ConfFinal  
2) Toggle **NewsEdge OFF**, tweak weights → delta & ConfFinal change  
3) Ensure Insight Card lists **only enabled** factors and bars sum visually  
4) Verify **X‑Dry‑Run: 1** on all POSTs in dry‑run  
5) (Write mode later) Pick hits **Current Picks** on dashboard

---

## 9) Check‑ins for Cursor

- **After Insight Card implementation**: screenshot + short video of hover tooltips and bar sort order
- **After Results module stub**: API shape + one fake grade example wired into the card
- **Before enabling Write mode linkage**: confirm dashboard insert and audit fields being stored

---

## 10) Open Questions (for Tucker)
1) Do you want the bet banner to support **price** display now (e.g., ML −135), or later?
2) Should we show a **risk vs reward** note when units > 2? (e.g., “High‑confidence play”)
3) Any brand/voice guidelines for the writeups (tone, emojis), or keep numeric/concise?

---

**End of Spec v1** — Ready for Cursor to implement.
