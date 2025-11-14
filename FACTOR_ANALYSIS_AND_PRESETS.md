# Factor Analysis & Strategic Capper Presets

## Current Factor Inventory

### TOTAL Factors (5)
1. **Pace Index** (30% default) - Expected game pace vs league average
   - Data: Team pace (last 10 games, season), league pace
   - Signal: Fast pace → Over, Slow pace → Under
   - Max Impact: ±1.0 signal (±5.0 points)

2. **Net Rating** (30% default) - Offensive/Defensive efficiency differential
   - Data: ORtg, DRtg for both teams
   - Signal: Elite offense vs weak defense → Over
   - Max Impact: ±1.0 signal (±5.0 points)

3. **Shooting Performance** (25% default) - 3PT% and FG% trends (last 5 games)
   - Data: 3P%, FG%, eFG%, 3PAR
   - Signal: Hot shooting → Over, Cold shooting → Under
   - Max Impact: ±1.0 signal (±5.0 points)

4. **Home/Away Split** (20% default) - Home vs away scoring differential
   - Data: Home PPG vs Away PPG
   - Signal: Home team advantage → Slight Over lean
   - Max Impact: ±1.0 signal (±5.0 points)

5. **Rest & Fatigue** (20% default) - Days of rest and back-to-back impact
   - Data: Days since last game, back-to-back status
   - Signal: Fatigued teams → Under (fewer points)
   - Max Impact: ±1.0 signal (±5.0 points)

### SPREAD Factors (5)
1. **Recent Form (ATS)** (30% default) - Against-the-spread performance (last 3, 10 games)
   - Data: ATS record, cover margin
   - Signal: Hot ATS streak → Continue covering
   - Max Impact: ±1.0 signal (±5.0 points)

2. **Pace Mismatch** (20% default) - Fast vs slow tempo differential
   - Data: Team pace differential
   - Signal: Slower team gets ATS edge (~0.3 pts per possession diff)
   - Max Impact: ±1.0 signal (±5.0 points)

3. **Offensive/Defensive Balance** (25% default) - Four Factors differential
   - Data: eFG%, TOV%, ORB%, FTr for both teams
   - Signal: Efficiency advantage → Spread edge
   - Max Impact: ±1.0 signal (±5.0 points)

4. **Home Court Advantage** (15% default) - Home vs away point differential
   - Data: Home PPG differential, home win rate
   - Signal: Strong home team → Home spread advantage
   - Max Impact: ±1.0 signal (±5.0 points)

5. **Clutch Performance** (15% default) - Performance in close games (within 5 pts in 4th Q)
   - Data: Record in clutch situations, clutch ORtg
   - Signal: Clutch team → Spread cover in tight games
   - Max Impact: ±1.0 signal (±5.0 points)

---

## MySportsFeeds Data Available (Not Currently Used)

### Team-Level Data
- **Turnovers**: TOV per game, TOV% (already used in S2 for SPREAD)
- **Rebounding**: ORB%, DRB%, TRB per game
- **Free Throws**: FTA, FT%, FTr (free throw rate)
- **Assists**: AST per game, AST/TO ratio
- **Steals/Blocks**: STL, BLK per game
- **Plus/Minus**: Team +/- differential
- **Bench Production**: Bench points, bench minutes
- **Streak Data**: Win/loss streaks, home/away streaks

### Player-Level Data (via player_stats_totals)
- **Injury Status**: Current injury, games missed
- **Usage Rate**: Minutes played, shot attempts
- **Individual Stats**: PPG, RPG, APG, SPG, BPG, TOV
- **Shooting Splits**: FG%, 3P%, FT%, eFG%
- **Advanced Metrics**: PER, TS%, USG%

### Game-Level Data (via gamelogs)
- **Recent Trends**: Last 3, 5, 10 game performance
- **Opponent-Specific**: Performance vs specific teams
- **Situational**: Home/away splits, rest splits
- **Momentum**: Scoring trends, defensive trends

---

## Existing Injury Factor (TOTALS Only)

### **F6: Key Injuries & Availability - Totals** ✅ ALREADY EXISTS
**Current Implementation**: AI-powered analysis using Perplexity/OpenAI

**Data Sources**:
- MySportsFeeds `player_injuries` endpoint (official injury status)
- Web search via Perplexity (recent injury news)
- Player stats (PPG, MPG from MySportsFeeds)

**Calculation Logic** (from `f6-injury-availability.ts`):
1. **Merge Data**: Combine MySportsFeeds official data + web search results
2. **AI Analysis**: Send to Perplexity/OpenAI with scoring guidelines:
   - Star player (25+ PPG) OUT: -7 to -8 impact
   - All-star (20-25 PPG) OUT: -5 to -6 impact
   - Key contributor (15-20 PPG) OUT: -3 to -4 impact
   - Role player (10-15 PPG) OUT: -2 to -3 impact
   - Bench player (<10 PPG) OUT: -1 to -2 impact
3. **Status Adjustments**:
   - OUT: 100% of impact
   - DOUBTFUL: 75% of impact
   - QUESTIONABLE: 50% of impact
   - PROBABLE: 25% of impact
4. **Multiple Injuries**: 2+ key players = 1.3x multiplier, 3+ = 1.5x multiplier
5. **Return**: Impact score from -10 to +10, converted to signal -1 to +1

**Max Impact**: ±1.0 signal (±5.0 points)
**Current Weight**: Not in default config (needs to be added)
**Icon**: `UserX` (user with X)
**Color**: `red`

---

## Proposed New Factors (2 High-Value Additions)

### NEW FACTOR 1: **S6: Key Injuries & Availability - Spread** (SPREAD ONLY)
**Rationale**: Missing key players shifts spread advantage - different logic than TOTALS

**Key Difference from TOTALS**:
- TOTALS: Injuries reduce scoring → Under
- SPREAD: Injuries shift competitive balance → Underdog gets edge

**Data Sources**: Same as F6 (MySportsFeeds + web search)

**Calculation Logic** (NEW - adapted for SPREAD):
1. **Calculate Net Injury Impact Differential**:
   ```
   Away Impact = Sum of away injured players' impact
   Home Impact = Sum of home injured players' impact
   Net Differential = Away Impact - Home Impact
   ```

2. **Injury Impact Formula** (per player):
   ```
   Base Impact = (PPG / 10) + (MPG / 48) × 2

   Examples:
   - 30 PPG, 36 MPG player: (30/10) + (36/48)×2 = 3.0 + 1.5 = 4.5 points
   - 20 PPG, 32 MPG player: (20/10) + (32/48)×2 = 2.0 + 1.33 = 3.33 points
   - 15 PPG, 28 MPG player: (15/10) + (28/48)×2 = 1.5 + 1.17 = 2.67 points
   - 10 PPG, 20 MPG player: (10/10) + (20/48)×2 = 1.0 + 0.83 = 1.83 points
   ```

3. **Status Adjustments** (same as TOTALS):
   - OUT: 100% of impact
   - DOUBTFUL: 75% of impact
   - QUESTIONABLE: 50% of impact
   - PROBABLE: 25% of impact

4. **Spread-Specific Logic**:
   - If Away has more injuries → Home gets ATS edge (negative signal)
   - If Home has more injuries → Away gets ATS edge (positive signal)
   - Net Differential > 5 points = strong signal
   - Net Differential 2-5 points = moderate signal
   - Net Differential < 2 points = weak signal

5. **Signal Calculation**:
   ```
   signal = tanh(Net Differential / 5.0)
   Positive signal → Away ATS advantage
   Negative signal → Home ATS advantage
   ```

**Max Impact**: ±1.0 signal (±5.0 points)
**Default Weight**: 25% (SPREAD)
**Icon**: `UserX` (user with X)
**Color**: `red`

---

### NEW FACTOR 2: **Bench Depth & Second Unit Production** (BOTH TOTAL & SPREAD)
**Rationale**: Deep benches maintain pace and scoring when starters rest

**Data Sources**:
- MySportsFeeds team stats (bench points, bench minutes)
- Player stats filtered by starters vs bench
- Recent bench performance (last 5-10 games)

**Calculation Logic**:
1. Calculate bench PPG differential: `(Team A Bench PPG - Team B Bench PPG)`
2. Calculate bench efficiency: `Bench Points / Bench Minutes`
3. Weight recent trends (last 5 games) higher than season average
4. Signal: Deep bench → Over (TOTAL), Depth advantage → Spread edge

**Max Impact**: ±1.0 signal (±5.0 points)
**Default Weight**: 15% (TOTAL), 15% (SPREAD)
**Icon**: `Users` (multiple users)
**Color**: `violet`

---

### NEW FACTOR 3: **Rebounding Dominance** (SPREAD ONLY)
**Rationale**: Rebounding creates extra possessions and controls pace

**Data Sources**:
- MySportsFeeds team stats (ORB%, DRB%, TRB)
- Opponent rebounding allowed
- Recent rebounding trends

**Calculation Logic**:
1. Calculate rebounding differential: `(Team A ORB% - Team B DRB%) + (Team A DRB% - Team B ORB%)`
2. Convert to expected possession advantage
3. Multiply by points per possession (~1.1 pts)
4. Signal: Rebounding edge → Spread advantage

**Max Impact**: ±1.0 signal (±5.0 points)
**Default Weight**: 20% (SPREAD)
**Icon**: `Repeat` (circular arrows)
**Color**: `teal`

---

## 5 Strategic Capper Configurations

### 1. **"The Conservative"** - Low-Risk, High-Confidence Plays
**Philosophy**: Focus on proven, stable factors with strong historical accuracy. Avoid volatile factors.

**TOTAL Factors** (250% total):
- Pace Index: 40% (stable, predictable)
- Net Rating: 50% (efficiency is king)
- Shooting Performance: 30% (recent form matters)
- Home/Away Split: 30% (consistent edge)
- Rest & Fatigue: 50% (fatigue is real)
- Injury Impact: 50% (missing stars = major impact)

**SPREAD Factors** (250% total):
- Recent Form (ATS): 40% (momentum is real)
- Offensive/Defensive Balance: 60% (efficiency wins)
- Home Court Advantage: 40% (home edge is proven)
- Clutch Performance: 30% (close games matter)
- Injury Impact: 40% (missing players = spread shift)
- Bench Depth: 40% (depth wins games)

**Target User**: Risk-averse bettors, beginners, bankroll builders
**Expected Pick Volume**: Low (only high-confidence plays)
**Expected Win Rate**: 58-62%

---

### 2. **"The Balanced Sharp"** - Well-Rounded, Data-Driven
**Philosophy**: Equal weight to all major factors. Trust the model, not gut feelings.

**TOTAL Factors** (250% total):
- Pace Index: 30% (baseline)
- Net Rating: 30% (baseline)
- Shooting Performance: 25% (baseline)
- Home/Away Split: 20% (baseline)
- Rest & Fatigue: 20% (baseline)
- Injury Impact: 25% (baseline)
- Bench Depth: 25% (new factor)
- **Remove 2 factors to hit 250%**: Remove Home/Away Split, reduce others

**SPREAD Factors** (250% total):
- Recent Form (ATS): 30% (baseline)
- Pace Mismatch: 20% (baseline)
- Offensive/Defensive Balance: 25% (baseline)
- Home Court Advantage: 15% (baseline)
- Clutch Performance: 15% (baseline)
- Injury Impact: 20% (baseline)
- Bench Depth: 15% (baseline)
- Rebounding Dominance: 20% (new factor)
- **Remove 2 factors to hit 250%**: Remove Clutch, reduce others

**Target User**: Experienced bettors, model-trusters
**Expected Pick Volume**: Medium
**Expected Win Rate**: 55-58%

---

### 3. **"The Pace Demon"** - High-Scoring, Fast-Paced Games
**Philosophy**: Target high-scoring games with fast pace and elite offenses. Overs specialist.

**TOTAL Factors** (250% total):
- Pace Index: 80% (MAXIMUM - this is the key)
- Net Rating: 60% (elite offenses)
- Shooting Performance: 40% (hot shooting = points)
- Home/Away Split: 10% (minimal weight)
- Rest & Fatigue: 30% (rested teams run)
- Injury Impact: 30% (missing defenders = more points)

**SPREAD Factors** (250% total):
- Recent Form (ATS): 30%
- Pace Mismatch: 60% (MAXIMUM - pace is everything)
- Offensive/Defensive Balance: 50%
- Home Court Advantage: 20%
- Clutch Performance: 10%
- Injury Impact: 30%
- Bench Depth: 50% (deep benches maintain pace)

**Target User**: Over bettors, high-scoring game enthusiasts
**Expected Pick Volume**: Medium-High (lots of Overs)
**Expected Win Rate**: 53-56% (more variance)

---

### 4. **"The Grind-It-Out"** - Defense Wins Championships
**Philosophy**: Target low-scoring, defensive battles. Unders and home favorites.

**TOTAL Factors** (250% total):
- Pace Index: 20% (slow pace preferred)
- Net Rating: 70% (defensive efficiency key)
- Shooting Performance: 40% (cold shooting = under)
- Home/Away Split: 30%
- Rest & Fatigue: 60% (fatigue = fewer points)
- Injury Impact: 30% (missing scorers = under)

**SPREAD Factors** (250% total):
- Recent Form (ATS): 40%
- Pace Mismatch: 30%
- Offensive/Defensive Balance: 70% (defense wins)
- Home Court Advantage: 50% (home defense is real)
- Clutch Performance: 30%
- Injury Impact: 30%

**Target User**: Under bettors, defensive-minded bettors
**Expected Pick Volume**: Low-Medium (selective)
**Expected Win Rate**: 56-59%

---

### 5. **"The Contrarian"** - Fade the Public, Find Value
**Philosophy**: Weight factors that find value against public perception. Injury overreactions, rest advantages.

**TOTAL Factors** (250% total):
- Pace Index: 25%
- Net Rating: 30%
- Shooting Performance: 20% (fade hot/cold streaks)
- Home/Away Split: 25%
- Rest & Fatigue: 70% (MAXIMUM - public undervalues rest)
- Injury Impact: 50% (public overreacts to injuries)
- Bench Depth: 30% (public ignores bench)

**SPREAD Factors** (250% total):
- Recent Form (ATS): 20% (fade recent trends)
- Pace Mismatch: 40%
- Offensive/Defensive Balance: 40%
- Home Court Advantage: 30%
- Clutch Performance: 40%
- Injury Impact: 50% (public overreacts)
- Bench Depth: 30% (public ignores depth)

**Target User**: Contrarian bettors, value hunters
**Expected Pick Volume**: Medium
**Expected Win Rate**: 54-57% (higher variance, higher upside)

---

## Implementation Plan

### Phase 1: Add New Factors to Codebase
1. Create factor calculation files:
   - `f6-injury-impact.ts` (TOTAL)
   - `f7-bench-depth.ts` (TOTAL)
   - `s6-injury-impact.ts` (SPREAD)
   - `s7-bench-depth.ts` (SPREAD)
   - `s8-rebounding-dominance.ts` (SPREAD)

2. Update orchestrators:
   - `nba-total-orchestrator.ts` - add F6, F7
   - `nba-spread-orchestrator.ts` - add S6, S7, S8

3. Update UI components:
   - `src/app/cappers/create/page.tsx` - add new factors to FACTOR_DETAILS and AVAILABLE_FACTORS
   - Add icons: `UserX`, `Users`, `Repeat`

### Phase 2: Add Preset Configuration System
1. Create preset configuration object with 5 presets
2. Add preset selection UI (cards with icons, descriptions)
3. Auto-populate factor selections and weights when preset is clicked
4. Allow users to customize after selecting preset

### Phase 3: Testing & Validation
1. Test each preset configuration generates different picks
2. Validate factor calculations with real game data
3. Monitor pick diversity across cappers
4. Adjust weights based on backtesting results

