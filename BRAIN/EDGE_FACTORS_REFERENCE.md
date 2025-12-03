# Sharp Siege - Edge Factors Reference

**Purpose:** Quick reference for SPREAD and TOTAL pick edge factors
**Last Updated:** 2025-12-03
**System:** SHIVA v1 Factor Engine

---

## 📊 SPREAD Picks (7 Factors)

### 1. 📈 Net Rating Differential (30% weight)
- **Max Points:** 5.0
- **Description:** Expected point margin based on offensive/defensive ratings vs spread
- **Calculation:**
  - Away Net Rating - Home Net Rating
  - Adjusted for pace: `netRatingDiff * (pace / 100)`
  - Edge: `expectedMargin - spreadLine`
- **File:** `src/lib/cappers/shiva-v1/factors/s1-net-rating-differential.ts`

### 2. 🏀 Turnover Differential (25% weight)
- **Max Points:** 5.0
- **Description:** Ball security and defensive pressure (turnovers forced vs committed)

### 3. 🏠 Home/Away Splits (20% weight)
- **Max Points:** 5.0
- **Description:** Home court impact on spread outcomes

### 4. 🎯 Shooting Efficiency + Momentum (15% weight)
- **Max Points:** 5.0
- **Description:** eFG%/FTr combined with recent performance trends

### 5. ⚖️ Four Factors Differential (10% weight)
- **Max Points:** 5.0
- **Description:** Dean Oliver's Four Factors efficiency differential

### 6. 📈 Momentum Index (15% weight) - **NEW**
- **Max Points:** 5.0
- **Description:** Team momentum based on win streak and last 10 record
- **Calculation:**
  - `momentum = (streak × 0.6) + (last10WinPct × 0.4)`
  - `signal = tanh(momentumDiff / 5)`
- **File:** `src/lib/cappers/shiva-v1/factors/s7-momentum-index.ts`

### 7. 📊 Edge vs Market - Spread (15% weight)
- **Max Points:** 5.0
- **Description:** Predicted margin vs market spread (final adjustment)
- **Calculation:** `edge = predictedMargin - marketSpread`

---

## 🏀 TOTAL Picks (7 Factors)

### 1. ⏱️ Pace Index (20% weight)
- **Max Points:** 5.0
- **Description:** Expected game pace vs league average

### 2. 🔥 Offensive Form (20% weight)
- **Max Points:** 5.0
- **Description:** Recent offensive efficiency vs opponent defense

### 3. 🛡️ Defensive Erosion (20% weight)
- **Max Points:** 5.0
- **Description:** Defensive vulnerability and recent trends

### 4. 🏹 Three-Point Environment (20% weight)
- **Max Points:** 5.0
- **Description:** 3-point attempt rate and shooting variance

### 5. ⛹️‍♂️ Whistle Environment (5% weight)
- **Max Points:** 5.0
- **Description:** Free throw rate and foul tendencies

### 6. 😴 Rest Advantage (15% weight) - **NEW**
- **Max Points:** 5.0
- **Description:** Rest differential between teams. Back-to-backs cause fatigue.
- **Calculation:**
  - `fatigueScore = (awayB2B ? -2 : 0) + (homeB2B ? -2 : 0)`
  - `signal = tanh((restDiff + fatigueScore) / 3)`
- **File:** `src/lib/cappers/shiva-v1/factors/f7-rest-advantage.ts`

### 7. 📊 Edge vs Market - Totals (15% weight)
- **Max Points:** 5.0
- **Description:** Predicted total vs market line (final adjustment)
- **Calculation:** `edge = predictedTotal - marketTotalLine`

---

##  Confidence Calculation

**Formula:** `finalConfidence = S(factor.score * factor.weight)`

**Units Mapping:**
- Confidence > 9.0: 5 units (max)
- Confidence > 8.0: 4 units
- Confidence > 7.0: 3 units
- Confidence > 6.0: 2 units
- Confidence > 5.0: 1 unit
- Confidence  5.0: PASS

---

##  Key Files

- `src/lib/cappers/shiva-v1/factor-registry.ts` - Factor metadata
- `src/lib/cappers/shiva-wizard-orchestrator.ts` - Main orchestrator
- `src/lib/cappers/shiva-v1/factors/` - Individual factor implementations
