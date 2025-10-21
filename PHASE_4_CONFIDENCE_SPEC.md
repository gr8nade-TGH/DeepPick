# Phase 4: Confidence, Edge, and Calibration

## Overview
Transform the static confidence weighting system into a dynamic, bettor-friendly edge-percent model with auto-calibration capabilities.

## 4.1 Confidence Refactor

### Current Logic (Static)
```typescript
// Old: weighted |z|-sum scaled to 5
confidence = 5 * min(1, Σ w_i * |z_i| / 0.70)
```

### New Logic (Edge-Based)
```typescript
// New: sigmoid edge-percent model
edgeRaw = Σ(w_i × z_i)           // directional sum (can be negative)
edgePct = sigmoid(edgeRaw * 2.5) // 0–1 probability  
confScore = 5 * edgePct          // 0–5 visual scale
```

### Benefits
- ✅ **Clearer**: 0 = fade, 2.5 = neutral, 5 = hammer
- ✅ **Symmetric**: negative edge flips side (Under → Over)
- ✅ **Bettor-friendly**: maps to real probability expectations

### Implementation Files
- `src/lib/cappers/shiva-v1/math.ts` - Add sigmoid functions
- `src/lib/cappers/shiva-v1/factors/nba-totals.ts` - Update confidence calculation
- `src/app/api/shiva/factors/step4/route.ts` - Add edge fields to response
- `src/app/api/shiva/factors/step5/route.ts` - Add edge fields to response

### Response Schema Updates
```typescript
// Step 4/5 Response
{
  "edge_raw": 0.184,
  "edge_pct": 0.62,
  "conf_score": 3.1,
  "conf_source": "nba_totals_v1"
}
```

## 4.2 Model Calibration Job

### Purpose
Auto-tune the sigmoid scaling constant K based on historical performance.

### Implementation
- `src/lib/cappers/shiva-v1/calibration.ts` - Calibration logic
- `src/app/api/calibration/run/route.ts` - API endpoint
- `scripts/calibrate-model.js` - CLI script

### Process
1. Pull last N graded picks from `pick_results`
2. Bin by `conf_score` (0-1, 1-2, 2-3, 3-4, 4-5)
3. Compute hit rate vs expected `edge_pct`
4. Fit new scaling constant K for sigmoid (K ≈ 2–3)
5. Update model parameters

### Database Schema
```sql
-- Add to pick_results table
ALTER TABLE pick_results ADD COLUMN edge_raw DECIMAL(10,4);
ALTER TABLE pick_results ADD COLUMN edge_pct DECIMAL(10,4);
ALTER TABLE pick_results ADD COLUMN conf_score DECIMAL(10,4);

-- Calibration results table
CREATE TABLE calibration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_version VARCHAR(50) NOT NULL,
  scaling_constant DECIMAL(10,4) NOT NULL,
  sample_size INTEGER NOT NULL,
  hit_rate_by_bin JSONB NOT NULL,
  r_squared DECIMAL(10,4),
  notes TEXT
);
```

## 4.3 Insight Card Edge Display

### Visual Design
Add "Edge Bar" under Confidence section:

```
EDGE  +12.4%   |███████░░░| 62%
```

### Implementation
- `src/app/cappers/shiva/management/components/insight-card.tsx`
- Add edge visualization component
- Tooltip: "Model edge vs market implied probability"

### Edge Calculation
```typescript
// Market implied probability from odds
const marketProb = oddsToProbability(marketLine)
const modelProb = edgePct
const edgePercent = (modelProb - marketProb) * 100
```

## 4.4 Grading Integration

### Purpose
Wire actual game results to feed calibration loop automatically.

### Implementation
- `src/app/api/picks/grade/route.ts` - Update grading logic
- Fetch final totals from `games` table
- Compare predicted vs actual vs market
- Store edge metrics in `pick_results`

### Grading Logic
```typescript
const actualTotal = game.final_score_away + game.final_score_home
const predictedTotal = pick.predicted_total
const marketTotal = pick.market_line

const predictionError = Math.abs(actualTotal - predictedTotal)
const marketError = Math.abs(actualTotal - marketTotal)

// Win if our prediction was closer
const result = predictionError < marketError ? 'win' : 'loss'
```

## 4.5 Testing & Visualization

### Unit Tests
- `src/lib/cappers/shiva-v1/__tests__/math.test.ts` - Sigmoid functions
- `src/lib/cappers/shiva-v1/__tests__/calibration.test.ts` - Calibration logic
- `src/app/api/picks/grade/__tests__/grading.test.ts` - Updated grading

### Visualization
- Plot `conf_score` → hit rate scatter
- Edge distribution histograms
- Calibration curve validation

### Regression Testing
- Verify SPREAD/MONEYLINE paths unchanged
- Compare old vs new confidence distributions
- A/B test edge visualization

## File Structure
```
src/lib/cappers/shiva-v1/
├── math.ts                    # Sigmoid functions
├── calibration.ts            # Calibration logic
├── __tests__/
│   ├── math.test.ts
│   └── calibration.test.ts
src/app/api/
├── calibration/run/route.ts  # Calibration endpoint
├── picks/grade/route.ts      # Updated grading
scripts/
└── calibrate-model.js        # CLI calibration
```

## Success Metrics
- [ ] Sigmoid confidence mapping implemented
- [ ] Edge visualization on Insight Cards
- [ ] Calibration job running nightly
- [ ] Grading integration with actual scores
- [ ] Unit tests passing
- [ ] No regression in existing flows

## Next Steps
1. Implement sigmoid math functions
2. Update confidence calculation in NBA totals
3. Add edge fields to API responses
4. Create calibration job
5. Add Edge Bar to Insight Card
6. Wire grading integration
7. Add comprehensive tests
