# Phase 4 Implementation Guide: Confidence, Edge, and Calibration

## 🎯 Overview
Transform the static confidence weighting system into a dynamic, bettor-friendly edge-percent model with auto-calibration capabilities.

## 📁 Files Created/Modified

### ✅ New Files Created
- `src/lib/cappers/shiva-v1/math.ts` - Sigmoid functions and edge calculations
- `src/lib/cappers/shiva-v1/calibration.ts` - Model calibration logic
- `src/app/api/calibration/run/route.ts` - Calibration API endpoint
- `src/lib/cappers/shiva-v1/__tests__/math.test.ts` - Math function tests
- `src/lib/cappers/shiva-v1/__tests__/calibration.test.ts` - Calibration tests
- `supabase/migrations/020_confidence_calibration.sql` - Database schema updates
- `scripts/calibrate-model.js` - CLI calibration script

### 🔄 Files to Modify
- `src/lib/cappers/shiva-v1/factors/nba-totals.ts` - Update confidence calculation
- `src/app/api/shiva/factors/step4/route.ts` - Add edge fields to response
- `src/app/api/shiva/factors/step5/route.ts` - Add edge fields to response
- `src/app/api/picks/grade/route.ts` - Wire actual scores for grading
- `src/app/cappers/shiva/management/components/insight-card.tsx` - Add Edge Bar (✅ Done)

## 🚀 Implementation Steps

### Step 1: Update NBA Totals Factors (Phase 4.1)
```typescript
// In src/lib/cappers/shiva-v1/factors/nba-totals.ts
import { calculateEdgeConfidence } from '../math'

// Replace legacy confidence calculation
const confidence = calculateEdgeConfidence(factors, scalingConstant)
```

### Step 2: Update API Responses (Phase 4.1)
```typescript
// In src/app/api/shiva/factors/step4/route.ts and step5/route.ts
const responseBody = {
  // ... existing fields
  edge_raw: confidence.edgeRaw,
  edge_pct: confidence.edgePct,
  conf_score: confidence.confScore,
  conf_source: 'nba_totals_v1'
}
```

### Step 3: Update Grading Integration (Phase 4.4)
```typescript
// In src/app/api/picks/grade/route.ts
const actualTotal = game.final_score_away + game.final_score_home
const predictionError = Math.abs(actualTotal - predictedTotal)
const marketError = Math.abs(actualTotal - marketTotal)
const result = predictionError < marketError ? 'win' : 'loss'

// Store edge data
await admin.from('pick_results').insert({
  // ... existing fields
  edge_raw: pick.edgeRaw,
  edge_pct: pick.edgePct,
  conf_score: pick.confScore,
  model_version: 'nba_totals_v1'
})
```

### Step 4: Run Database Migration
```bash
npm run db:migrate
```

### Step 5: Test the Implementation
```bash
# Run math tests
npm run test -- --testPathPattern="math.test"

# Run calibration tests  
npm run test -- --testPathPattern="calibration.test"

# Test calibration API
curl -X POST http://localhost:3000/api/calibration/run \
  -H "Content-Type: application/json" \
  -d '{"model_version": "nba_totals_v1", "sample_size": 50}'
```

### Step 6: Run Calibration
```bash
# Run calibration script
node scripts/calibrate-model.js run

# Check stats
node scripts/calibrate-model.js stats
```

## 🧮 Mathematical Model

### Edge Calculation
```typescript
// Raw edge (directional sum)
edgeRaw = Σ(w_i × z_i)

// Convert to probability using sigmoid
edgePct = sigmoid(edgeRaw * scalingConstant)

// Scale to 0-5 visual scale
confScore = 5 * edgePct
```

### Benefits
- ✅ **Clearer**: 0 = fade, 2.5 = neutral, 5 = hammer
- ✅ **Symmetric**: negative edge flips side (Under → Over)
- ✅ **Bettor-friendly**: maps to real probability expectations

## 📊 Edge Bar Visualization

The Edge Bar shows:
- **EDGE**: Raw edge percentage (+12.4%)
- **Bar**: Visual representation of edge magnitude
- **Probability**: Model probability (62%)
- **Tooltip**: "Model edge vs market implied probability"

## 🔄 Calibration Process

1. **Data Collection**: Pull last N graded picks from `pick_results`
2. **Binning**: Group by confidence score ranges (1-2, 2-3, 3-4, 4-5)
3. **Analysis**: Compare hit rate vs expected edge percentage
4. **Optimization**: Find optimal scaling constant using grid search
5. **Validation**: Calculate R-squared for calibration quality
6. **Storage**: Save results to `calibration_runs` table

## 🧪 Testing Strategy

### Unit Tests
- Sigmoid function accuracy
- Edge calculation correctness
- Calibration logic validation
- Odds conversion functions

### Integration Tests
- API endpoint functionality
- Database operations
- End-to-end confidence flow

### Regression Tests
- Verify SPREAD/MONEYLINE paths unchanged
- Compare old vs new confidence distributions
- A/B test edge visualization

## 📈 Success Metrics

- [ ] Sigmoid confidence mapping implemented
- [ ] Edge visualization on Insight Cards
- [ ] Calibration job running successfully
- [ ] Grading integration with actual scores
- [ ] Unit tests passing
- [ ] No regression in existing flows

## 🔧 Configuration

### Environment Variables
```bash
# Calibration settings
CALIBRATION_SAMPLE_SIZE=100
CALIBRATION_MIN_CONFIDENCE=1.0
CALIBRATION_SCALING_CONSTANT=2.5
```

### Database Configuration
- `pick_results` table updated with edge fields
- `calibration_runs` table for storing results
- Proper indexes for efficient queries

## 🚨 Error Handling

- Graceful fallback to legacy confidence if edge data missing
- Calibration failure handling with default scaling
- API error responses with proper status codes
- Database transaction rollback on failures

## 📝 Next Steps After Phase 4

1. **Phase 5**: Advanced Analytics Dashboard
2. **Phase 6**: Multi-Sport Factor Expansion
3. **Phase 7**: Real-time Market Integration
4. **Phase 8**: Machine Learning Enhancement

## 🎉 Expected Outcomes

After Phase 4 completion:
- Quantitative confidence scale mapping to real-world hit rates
- Auto-learning calibration for future seasons
- Bettor-style edge visualization on every Insight Card
- Robust model validation and improvement pipeline
