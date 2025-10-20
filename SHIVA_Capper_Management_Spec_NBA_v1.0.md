# SHIVA Capper Management Page — NBA Pick Generation Spec (v1.0)
**Date:** 2025-10-20  
**Owner:** Capper Engineering (Cursor implementation)  
**Scope:** NBA-first (NFL/MLB toggles visible but disabled). No code included—this is a product + data/UX + math spec for Cursor to implement.

---

## 0) Purpose & Overview
We need a **repeatable, auditable pick generation workflow** that converts public stats + recent news into a **score + victor prediction** and then compares that to **Vegas odds** to quantify value and decide whether to generate a pick. This system will be hosted in a **Capper Management Page** for the capper **SHIVA** (first capper).

Key constraints:
- **No market inputs** influence the model until Step 5. Steps 1–4 produce the **capper-only** prediction. Step 5 introduces the **market comparison** as Factor 8.
- **Dedup by game_id**: Only process an incoming matchup the first time its game_id is seen.
- **NBA is active**; NFL/MLB tabs are visible (filters) but disabled.
- **Two AIs** selectable per step: default **Perplexity** for Step 3; default **OpenAI** for Step 4. (Dropdown selectors in the UI.)

---

## 1) Page Structure (Capper Management)
### 1.1 Top Bar Filters
- **Sport filter:** Pills: NBA (active), NFL (disabled), MLB (disabled).  
- **Capper selector:** Dropdown (default: **SHIVA**).  
- **Date filter:** Today / Tomorrow / Custom range.  
- **Search:** Team names, game_id.

### 1.2 Left Pane — *Game Inbox*
- **Source:** Odds API feed.  
- **Rows:** `game_id`, start time (local), **Away @ Home**, moneyline avg, spread, total.  
- **State badges:** `NEW`, `IN‑PROGRESS`, `COMPLETE`, `SKIPPED` (already seen), `VOIDED` (canceled).  
- **Clicking** a row opens the **Pick Generator Wizard** on the right.

### 1.3 Right Pane — *Pick Generator Wizard* (7 steps + finalize)
A linear wizard with **Next / Back** and **Save Draft**. Each step persists to DB and can be reloaded.  
At the top of the wizard: **AI provider dropdowns**  
- **Step 3 AI:** default **Perplexity**  
- **Step 4 AI:** default **OpenAI**

**Step 1: Intake & Dedup**  
**Step 2: Odds snapshot**  
**Step 3: Factors 1–4 + Injury/News (Factor 5)**  
**Step 4: Factors 6–7 + Prediction math**  
**Step 5: Market Mismatch (Factor 8)**  
**Step 6: Pick Generator (Units)**  
**Step 7: Insight Card**

---

## 2) State Machine
- On new `game_id` from Odds API:
  - If **first time** seen: set state `NEW` → allow **Start Pick Generation**.
  - If seen before: flag `SKIPPED` and block new run (show **View Existing**).
- Wizard transitions: `NEW` → `IN‑PROGRESS` → `COMPLETE` (after Step 7 save).  
- Admin override: `VOIDED` (e.g., postponed).

---

## 3) Data Sources
### 3.1 Odds API (internal)
- **Endpoint:** internal Odds API (UI example page: odds dashboard).  
- **Fields expected:**  
  - `game_id` (unique), `sport` (NBA), `home_team`, `away_team`, `start_time`  
  - `ml_avg_home`, `ml_avg_away` (averages across books)  
  - `spread_team` (team favored in API’s convention), `spread_line` (e.g., -5.5), `spread_odds`  
  - `total_line` (e.g., 228.5), `total_over_odds`, `total_under_odds`  
  - `books` (optional array for audit)

### 3.2 StatMuse (read-only)
- **Usage:** Quick natural‑language Q&A for basketball team stats.  
- **Important:** Use **short, specific** queries (templates below). Avoid custom lineups (not supported).

### 3.3 Web Search (Injury/News)
- **Goal:** Fetch **recent** and **matchup‑specific** news (48h window default) for both teams: injuries, rest, minutes limits, travel, coach quotes.  
- **Filters:**  
  - Time: last **72 hours** (configurable, default 48–72h).  
  - Terms: `"[Away Team] vs [Home Team]" OR "[Team] injury report" OR "[Team] probable questionable out"`  
  - Trusted sources priority (league/teams/beat writers); de‑dup retweets/blogs.

---

## 4) The 8 Factors (NBA)
We compute 7 intrinsic factors (capper‑only), then add the 8th factor (market mismatch) to build final **confidence** and **pick**.

> **Weights:** The first 7 factors sum to **70%**, and Factor 8 (market) contributes **30%**.  
> The 7‑factor weights below are the **NBA defaults** for SHIVA and can be made editable in the UI (advanced).

### Factor 1 — Season Net Rating (21% of total)
- **What:** `NR = ORtg − DRtg` (per 100). Stable baseline for team quality.
- **StatMuse queries:**  
  - `[[TEAM]] net rating this season`  
  - `[[TEAM]] offensive rating this season`  
  - `[[TEAM]] defensive rating this season`
- **Normalization:** `NR_diff = NR_A − NR_B` (per 100).

### Factor 2 — Recent Net Rating (last 10) (17.5%)
- **What:** Captures form, health, rotation tweaks.  
- **Queries:** `[[TEAM]] net rating last 10 games`  
- **Normalization:** `NR10_diff = NR10_A − NR10_B` (per 100).

### Factor 3 — Offense vs Opponent Defense (14%)
- **What:** How A’s offense meets B’s defense and vice versa.  
- **Queries:**  
  - `[[TEAM]] offensive rating this season`  
  - `[[OPPONENT]] defensive rating this season`  
- **Normalization:** `Matchup_diff = (ORtg_A − DRtg_B) − (ORtg_B − DRtg_A)` (per 100).

### Factor 4 — Head‑to‑Head Scoring (7%)
- **What:** PPG vs this opponent (this season). Captures scheme quirks (capped for noise).  
- **Queries:** `[[TEAM]] points per game vs [[OPPONENT]] this season`  
- **Normalization:**  
  - Convert to per‑100 using expected pace (see §6).  
  - Cap contribution at **±6 per 100**.

### Factor 5 — Injury/News (10% of the **first 7** before rescale → equals 7% of total)  
*(Operationally gathered in Step 3 via web search)*  
- **What:** Material adjustments from recent injuries/suspensions/minutes limits.  
- **Process:**  
  1) Search both teams with time filter (48–72h).  
  2) Extract **status**: out / doubtful / questionable / probable; minutes limits.  
  3) Convert to a **per‑100** nudge (default ranges):  
     - Star out: **−2.0** per 100; key starter: **−1.0**; key bench: **−0.5**.  
     - If returning star (minutes limit ≤ 20): **+0.5** (cautious).  
- **Normalization:** `NewsEdge_100 ∈ [−3.0, +3.0]` (cap).

### Factor 6 — Home‑Court Edge (3.5%)
- **What:** Persistent but small.  
- **Value:** `HomeEdge_100 = +1.5` per 100 to home team (−1.5 to road).

### Factor 7 — 3‑Point Environment (2.1%)
- **What:** “Math” advantage when a 3‑heavy offense meets a defense allowing high 3PA.  
- **Queries:**  
  - `[[TEAM]] 3 point attempts per game this season`  
  - `[[TEAM]] 3 point percentage this season`  
  - `[[TEAM]] opponent 3 point attempts per game this season`  
- **Value:** Binary by default: +1.0 per 100 if (Team 3PA **high** AND Opp OPP_3PA **high**), else 0. (Define **high** as above‑league‑avg or top‑10 rate.)

> **Rescaling Note:** Internally, compute the seven factors using the weights listed (21, 17.5, 14, 7, 7, 3.5, 2.1 as **percent of total**). For clarity, the raw model treats Factors 1–7 as a 70% block; each percentage above is already **scaled to total** so the block sums to 70% by design.

---

## 5) Prediction Math (Spread, Total, Scores)
Let (per 100) *positive favors Team A*.

### 5.1 Expected Pace
Use **harmonic mean** to stabilize extremes:
```
PACE_exp = 2 / (1/pace_A + 1/pace_B)
```
_Query:_ `[[TEAM]] pace this season`

### 5.2 Seven-Factor Delta (per 100)
```
Delta_100 =
  0.21*(NR_A - NR_B) +
  0.175*(NR10_A - NR10_B) +
  0.14*((ORtg_A - DRtg_B) - (ORtg_B - DRtg_A)) +
  0.07*(H2H_pp100_capped) +
  0.07*(NewsEdge_100) +
  0.035*(HomeEdge_100) +
  0.021*(ThreePointEdge_100)
```
- `H2H_pp100_capped` = head‑to‑head PPG gap converted to per‑100 and clamped to ±6.

### 5.3 Predicted Spread (points)
```
Spread_pred = Delta_100 * (PACE_exp / 100)
```
- If `Spread_pred > 0`, pick **Team A** by that many points; if `< 0`, pick **Team B** by `abs()`.

### 5.4 Predicted Total (points)
Let **L** = league average ORtg (use 114 if not pulled).
```
ORtgA_hat = ORtg_A - (DRtg_B - L) + Adj_A
ORtgB_hat = ORtg_B - (DRtg_A - L) + Adj_B
TOTAL_pred = (ORtgA_hat + ORtgB_hat) * (PACE_exp / 100)
```
**Adj terms (per 100):**
- H2H nudge: ±1.0 if PPG_vs_opp meaningfully deviates from season PPG.
- 3PT nudge: +1.0 to side with 3PT environment edge (0 to other).
- News/rest: −1.0 to team materially shorthanded; 0 otherwise.

### 5.5 Turn spread + total into scores
```
Pts_A = round((TOTAL_pred + Spread_pred) / 2)
Pts_B = TOTAL_pred - Pts_A
```

### 5.6 Base Confidence from Seven Factors (1–5 scale)
Use the **magnitude** of predicted spread:
```
Conf7_raw = min(abs(Spread_pred) / 6.0, 1.0)        # cap at 6 pts edge
Conf7_score = 1 + 4 * Conf7_raw                      # maps 0..1 to 1..5
```
(You can also show an implied win prob: `Phi(abs(Spread_pred)/12)` for audit.)

---

## 6) Factor 8 — Market Mismatch (30% of total)
Introduced **only in Step 5**.

### 6.1 Compute side mismatch (points)
1) Determine **pick side** from `Spread_pred` (Team A if >0 else Team B).  
2) Convert **Vegas spread** to the **pick’s perspective**: the number of points Vegas expects the **pick team** to win by (can be negative if Vegas has them as a dog).  
3) `Edge_side = S_capper_on_pick - S_vegas_on_pick` (positive = our edge stronger than market).  
4) Normalize: `Edge_side_norm = clamp(Edge_side / 6.0, -1, 1)`.

### 6.2 Compute total mismatch (points)
1) `Edge_total = TOTAL_pred - total_line` (positive = we’re higher than market).  
2) Normalize: `Edge_total_norm = clamp(Edge_total / 12.0, -1, 1)`  
   *(Use 12 as total cap ≈ 2× spread cap.)*

### 6.3 Choose the dominant market signal
Use the **larger absolute** of side vs total (to avoid double‑counting):
```
Market_norm = argmax_abs(Edge_side_norm, Edge_total_norm)
```

### 6.4 Convert to a 1–5 adjustment
The market factor can swing **±30%** of the total confidence scale.  
Let `Conf7_score ∈ [1,5]`. The full span is 4 points. 30% of 4 = **1.2 points**.
```
Conf_market_adj = 1.2 * Market_norm    # ∈ [-1.2, +1.2]
```
Examples:  
- **4-point** side value (capper +10 vs Vegas +6): `Edge_side_norm = 4/6 ≈ 0.67` → `+0.8` to confidence.  
- **≥6-point** side value: full `+1.2`.  
- If market opposes our pick strongly (negative norm), we **subtract** up to 1.2.

### 6.5 Final Confidence (1–5)
```
Conf_final = clamp(Conf7_score + Conf_market_adj, 1, 5)
```

---

## 7) Units & Pick Decision (Step 6)
Map **Conf_final** to Units; allow thresholds to be editable in UI.

**Default mapping (NBA):**
- **< 2.5** → **Pass** (no pick)
- **2.5–3.0** → **1 Unit**
- **3.01–4.0** → **2 Units**
- **> 4.0** → **3 Units**

Also store **Pick Type** chosen by the dominant edge logic in Step 5:
- If |Edge_side_norm| ≥ |Edge_total_norm| → **Spread/Moneyline pick**:  
  - If favorite and spread small, prefer **Spread**; if dog and we project outright, consider **Moneyline** (config).
- Else → **Totals pick** (Over/Under).

**Persistence:** Save `Conf7_score`, `Conf_market_adj`, `Conf_final`, chosen Units, and which edge (side/total) drove the decision.

---

## 8) Step-by-Step Wizard Details (with UI fields)
### Step 1 — Intake & Dedup
- **Inputs:** `game_id`, `home_team`, `away_team`, `start_time`, `sport` (from Odds API).  
- **Action:** If `game_id` already exists with state not `VOIDED`, block and show link to existing record.  
- **Output:** Create run entry (`state=IN‑PROGRESS`).

### Step 2 — Odds Snapshot
- **Fetch:** `ml_avg_home`, `ml_avg_away`, `spread_team`, `spread_line`, `total_line` (+ odds).  
- **Display:** Snapshot panel with book averages; store a **timestamped snapshot** (immutable).  
- **Output:** Persist odds snapshot to the run.

### Step 3 — Factors 1–4 + Injury/News (Factor 5)  **[AI 1: default Perplexity]**
- **UI:** AI provider dropdown (Perplexity/OpenAI).  
- **Actions:**  
  1) **StatMuse pulls for Factors 1–4** (for **both teams**):  
     - **F1/F3:** `[[TEAM]] offensive rating this season`, `[[TEAM]] defensive rating this season`, `[[TEAM]] net rating this season`  
     - **F2:** `[[TEAM]] net rating last 10 games`  
     - **F4:** `[[TEAM]] points per game vs [[OPPONENT]] this season`  
  2) **Web search** for **injury/news** (last 48–72h) for each team; auto‑summarize entries with **status** and likely **minutes impact**.  
- **Output:** Render factor cards F1–F5 with raw values, per‑100 conversions, and any caps/notes.

### Step 4 — Factors 6–7 + Prediction Math  **[AI 2: default OpenAI]**
- **StatMuse pulls:**  
  - **F6 (Home)**: derive from game context (no query).  
  - **F7 (3PT environment):**  
    - `[[TEAM]] 3 point attempts per game this season`  
    - `[[TEAM]] 3 point percentage this season`  
    - `[[TEAM]] opponent 3 point attempts per game this season`  
  - **Pace for conversion:** `[[TEAM]] pace this season` (both teams).  
- **Computation:**  
  - Calculate `PACE_exp`, `Delta_100`, `Spread_pred`, `TOTAL_pred`, **Pts_A**, **Pts_B**, and **Conf7_score**.  
- **Output:** Show **Predicted Winner**, **Spread_pred**, **TOTAL_pred**, **Pts_A–Pts_B**, **Conf7_score** (1–5).

### Step 5 — Market Mismatch (Factor 8)
- **Inputs:** Step 2 odds snapshot.  
- **Compute:** `Edge_side_norm`, `Edge_total_norm`, `Conf_market_adj` (±1.2), `Conf_final`.  
- **UI:** Visual diff bars: **Capper vs Market** for spread and total; highlight which one drives Factor 8.  
- **Output:** Display **Conf_final (1–5)**.

### Step 6 — Pick Generator (Units)
- **Logic:** Use **Conf_final** to assign Units (defaults above).  
- **UI:** Radio to force **Spread / ML / Total** (advanced); otherwise auto‑select best edge.  
- **Output:** Save **Pick** record with Units or **Pass**.

### Step 7 — Insight Card
- **CTA:** “Generate Insight Card” (under **CURRENT PICKS**).  
- **Card layout:**  
  - **Header:** *SHIVA – NBA* • Matchup • Game time • Units.  
  - **Prediction:** Winner & margin OR Total (Over/Under) with **Pts_A–Pts_B**.  
  - **Why (Factors):** 8 badges with mini‑bars showing each factor’s contribution and a one‑line note.  
  - **Audit trail:** Link to factor panel & odds snapshot timestamp.

---

## 9) UX/Design Notes
- NBA tab: bold, blue; NFL/MLB greyed out with tooltip “Coming soon”.  
- Factor cards: show **raw stat**, **normalized per‑100 impact**, **weight**.  
- All math: show a small “ⓘ details” popover with formula and substitutions for transparency.  
- Error states: If StatMuse/timeouts, show fallback input fields to paste numbers manually (audit flag “manual”).

---

## 10) Data Model (sketch)
**tables:**  
- `games` (`game_id`, `sport`, teams, start_time, state)  
- `runs` (`run_id`, `game_id`, capper, created_at, ai_step3`, `ai_step4`, `conf7`, `conf_market_adj`, `conf_final`, `units`, `pick_type`)  
- `odds_snapshots` (`run_id`, payload_json, created_at)  
- `factors` (`run_id`, factor_no, raw_values_json, normalized_value, weight_applied, notes)  
- `insight_cards` (`run_id`, rendered_json, created_at)

---

## 11) StatMuse Query Templates (REQUIRED Formats)
Use exactly these patterns (swap `[TEAM]` and `[OPPONENT]`):
- `[TEAM] net rating this season`
- `[TEAM] offensive rating this season`
- `[TEAM] defensive rating this season`
- `[TEAM] net rating last 10 games`
- `[TEAM] points per game vs [OPPONENT] this season`
- `[TEAM] pace this season`
- `[TEAM] 3 point attempts per game this season`
- `[TEAM] 3 point percentage this season`
- `[TEAM] opponent 3 point attempts per game this season`

**Notes:**  
- Use `in 2024-25` instead of `this season` if you must pin a season.  
- If StatMuse rejects a phrasing, try the variant: `average points per game` for PPG; `DRtg/ORtg` abbreviations are acceptable.

---

## 12) Injury/News Search Protocol
- **Window:** Last **48–72h**.  
- **Team terms:** Include both teams and matchup (“[TeamA] vs [TeamB]”).  
- **Key words:** `injury`, `probable`, `questionable`, `doubtful`, `out`, `minutes restriction`, `back-to-back`, `rest`.  
- **Outputs:** Structured list with `player`, `status`, `expected minutes impact`, source link; aggregate to `NewsEdge_100` with caps per §4 Factor 5.

---

## 13) QA Checklist
- Dedup by `game_id` verified.  
- Factor cards show both raw inputs and normalized impacts.  
- All calculations persisted and reproducible from logs.  
- Market comparison uses **the odds snapshot from Step 2** (no live drift).  
- Insight Card renders the same numbers as Steps 4–6.

---

## 14) Extensibility
- **NFL/MLB:** Keep page scaffolding; plug sport‑specific factors later.  
- **Multi‑capper:** Add capper‑level presets for weights and thresholds.  
- **A/B testing:** Toggle different weight sets; log outcomes against closing lines.

---

## 15) Example (abbreviated, fictitious numbers for shape only)
- Teams: **Rockets @ Thunder**; Home: **Thunder**.  
- F1: NR diff +2.5 A→B; F2: +1.8; F3: +1.2; F4: +0.5 (capped); F5: −1.0 (A star out); F6: −1.5 (A away); F7: +1.0.  
- `Delta_100` → +1.3; `PACE_exp` 99 → `Spread_pred` +1.29 (pick A by ~1.3).  
- `TOTAL_pred` 230.  
- **Conf7_score**: |1.29|/6 = 0.215 → 1 + 4·0.215 ≈ **1.86**.  
- Vegas snapshot: Spread on pick side +0.5, Total 226.  
  - Edge_side = 1.29 − 0.5 = 0.79 → 0.79/6 = 0.13.  
  - Edge_total = 230 − 226 = 4 → 4/12 = 0.33 → dominates.  
  - `Conf_market_adj` = 1.2 * 0.33 ≈ **+0.40**.  
- **Conf_final** ≈ 2.26 → **Pass** by defaults (<2.5).

---

## 16) Deliverables for Cursor
- Implement Capper Management Page per layout above.  
- Build 7‑factor pipeline (Steps 1–4) using StatMuse templates + news protocol.  
- Add Step 5 market mismatch computation; show diffs vs snapshot odds.  
- Map **Conf_final** to units and render Insight Card (Step 7).  
- Persist everything; ensure reproducibility.

