# 🎯 Sharp Betting Architecture - Complete Redesign Plan

## 🚨 Current Problem:

**The test ran in 0.18 seconds because it reused cached AI runs.**

But more importantly, you're asking for a **fundamental architectural change** from abstract confidence scores to a **sharp betting approach**.

---

## 📊 What You're Asking For:

### **Current System (Abstract Confidence):**
- ❌ Factors scored 0-10 (arbitrary)
- ❌ Weighted sum = confidence score
- ❌ Pick if confidence ≥ 7.0
- ❌ No market-deviation measurement
- ❌ No EV calculation
- ❌ Double-counting market-priced info

### **Sharp Betting System (You Want):**
- ✅ Factors measured in **effect sizes** (points or log-odds)
- ✅ Market line as **baseline**
- ✅ Each factor = quantified deviation from market
- ✅ Three prediction heads (spread, total, moneyline)
- ✅ Reliability-weighted contributions
- ✅ Convert deviations → probabilities → EV
- ✅ Gate picks by **EV** (not confidence)
- ✅ Residualize features to avoid double-counting

---

## 🔧 Required Changes:

### **Phase 1: Immediate Fixes** (1-2 hours)
1. ✅ **Delete old AI runs** before test (DONE - just committed)
2. ⏳ **Enable sequential AI runs** (Run 1 → Run 2, not parallel)
3. ⏳ **Use sonar-pro** for deep search (update capper_settings)
4. ⏳ **Minimum 10 factors** - retry AI up to 5 times
5. ⏳ **No duplicates** - dedup factor list

### **Phase 2: Factor Engine Redesign** (4-6 hours)
Complete rewrite of `src/lib/cappers/factor-engine.ts`:

#### **New FactorEngine Architecture:**

```typescript
interface SharpFactor {
  name: string
  category: string
  
  // Effect size (NOT abstract score!)
  effectSize: number  // Points for spread/total, log-odds for ML
  unit: 'points' | 'log_odds'
  
  // Reliability components
  sampleSize: number
  recency: number  // 0-1, how fresh the data is
  dataQuality: number  // 0-1, confidence in data source
  reliability: number  // Computed: sqrt(n_eff / (n_eff + k))
  
  // Learned weight (from historical backtesting)
  learnedWeight: number  // Default 1.0, tuned via ridge regression
  
  // Soft cap (prevent any single factor from dominating)
  softCap: number  // Max absolute effect
  
  // Final contribution
  contribution: number  // = clip(weight * effect, ±cap) * reliability
  
  // Transparency
  reasoning: string
  rawData: any
  sources: string[]
}

interface PredictionHead {
  type: 'spread' | 'total' | 'moneyline'
  marketLine: number  // Current market number
  predictedDeviation: number  // Sum of factor contributions
  trueLine: number  // market + deviation
  
  // Probability calculation
  coverProbability: number  // Φ(Δ / σ) for spread/total
  winProbability: number  // sigmoid(logit) for ML
  
  // Expected value
  offeredOdds: number  // Actual odds available
  impliedProbability: number  // From offered odds (vig-removed)
  expectedValue: number  // EV = p * payout - (1-p) * stake
  
  // Gating
  meetsThreshold: boolean
  reason: string
}
```

#### **Key Functions:**

```typescript
// 1. Residualize feature against market
function residualizeFeature(rawFeature: number, marketLine: number): number {
  // Regress feature on market, return residual
  // Only keeps the part market hasn't priced in
}

// 2. Calculate reliability with shrinkage
function calculateReliability(
  sampleSize: number,
  k: number,  // Shrinkage parameter (e.g., 30 for recent form)
  recency: number,
  dataQuality: number
): number {
  const sampleReliability = Math.sqrt(sampleSize / (sampleSize + k))
  return sampleReliability * recency * dataQuality
}

// 3. Convert effect to probability
function effectToProbability(
  effectSize: number,
  unit: 'points' | 'log_odds',
  sigma: number  // League-specific stddev of margins/totals
): number {
  if (unit === 'points') {
    // Normal CDF: Φ(Δ / σ)
    return normalCDF(effectSize / sigma)
  } else {
    // Sigmoid for log-odds
    return 1 / (1 + Math.exp(-effectSize))
  }
}

// 4. Calculate EV
function calculateExpectedValue(
  probability: number,
  offeredOdds: number,
  stake: number = 1
): number {
  const payout = oddsToDecimal(offeredOdds) - 1
  return probability * payout * stake - (1 - probability) * stake
}

// 5. Gate by EV (different thresholds per bet type)
function meetsThreshold(
  betType: 'spread' | 'total' | 'moneyline',
  effectSize: number,
  ev: number,
  odds: number
): { meets: boolean; reason: string } {
  if (betType === 'spread') {
    if (Math.abs(effectSize) < 0.75) return { meets: false, reason: 'Δ < 0.75 points' }
    if (ev < 0.015) return { meets: false, reason: 'EV < +1.5%' }
  }
  // ... similar for total, moneyline
  return { meets: true, reason: 'Passed all gates' }
}
```

---

### **Phase 3: Three Prediction Heads** (2-3 hours)

Create separate prediction paths for each bet type:

```typescript
class ThreePredictionHeads {
  spreadHead: PredictionHead
  totalHead: PredictionHead
  moneylineHead: PredictionHead
  
  constructor(game: Game, factors: SharpFactor[]) {
    // Spread: sum factors measured in points
    const spreadFactors = factors.filter(f => f.unit === 'points' && f.category === 'spread')
    const spreadDeviation = sum(spreadFactors.map(f => f.contribution))
    this.spreadHead = {
      type: 'spread',
      marketLine: game.spread,
      predictedDeviation: spreadDeviation,
      trueLine: game.spread + spreadDeviation,
      coverProbability: effectToProbability(spreadDeviation, 'points', 12.5),  // NBA σ
      expectedValue: calculateEV(...),
      meetsThreshold: meetsThreshold('spread', spreadDeviation, ev, odds)
    }
    
    // Total: sum factors measured in total points
    // Moneyline: sum factors measured in log-odds
    // ... similar for each
  }
  
  getBestPick(): PredictionHead | null {
    const candidates = [this.spreadHead, this.totalHead, this.moneylineHead]
      .filter(h => h.meetsThreshold)
      .sort((a, b) => b.expectedValue - a.expectedValue)
    
    return candidates[0] || null
  }
}
```

---

### **Phase 4: AI Research Overhaul** (3-4 hours)

#### **Sequential Runs with Retry Logic:**

```typescript
class AIResearchPipeline {
  async runUntilMinFactors(minFactors: number = 10, maxRetries: number = 5): Promise<SharpFactor[]> {
    const allFactors: SharpFactor[] = []
    let retries = 0
    
    while (allFactors.length < minFactors && retries < maxRetries) {
      // Run 1: Perplexity sonar-pro + StatMuse
      const run1Factors = await this.runPerplexityDeepSearch()
      
      // Run 2: ChatGPT + StatMuse
      const run2Factors = await this.runChatGPTAnalysis(run1Factors)
      
      // Merge and deduplicate
      allFactors.push(...this.deduplicateFactors([...run1Factors, ...run2Factors]))
      
      retries++
      
      if (allFactors.length < minFactors) {
        console.log(`[RETRY ${retries}] Only ${allFactors.length} factors, need ${minFactors}`)
        await sleep(10000)  // Wait 10s between retries
      }
    }
    
    return allFactors
  }
  
  async runPerplexityDeepSearch(): Promise<SharpFactor[]> {
    // Use sonar-pro model for deep search
    const response = await perplexityClient.chat({
      model: 'sonar-pro',  // Deep search enabled!
      messages: [{
        role: 'user',
        content: `Analyze ${this.game.awayTeam} @ ${this.game.homeTeam}.
        
        For EACH factor you find:
        1. Quantify the effect in POINTS (spread/total) or LOG-ODDS (ML)
        2. Explain how it deviates from the current market line: ${this.game.spread}
        3. Provide sample size and data recency
        4. Ask StatMuse for specific numeric validation
        
        Market baseline:
        - Spread: ${this.game.spread}
        - Total: ${this.game.total}
        - ML odds: ${this.game.moneyline}
        
        Return factors in JSON format with effectSize (number), unit, sampleSize, recency, reasoning.`
      }],
      searchDomainFilter: ['espn.com', 'covers.com', 'actionnetwork.com'],
      searchRecencyFilter: 'week'  // Only recent data
    })
    
    // Parse and convert to SharpFactor format
    return this.parsePerplexityResponse(response)
  }
  
  deduplicateFactors(factors: SharpFactor[]): SharpFactor[] {
    // Group by semantic similarity
    // Keep the one with highest reliability
    // Merge reasoning if very similar
  }
}
```

---

### **Phase 5: Database Schema Updates** (1 hour)

Add new columns to `pick_factors`:

```sql
ALTER TABLE pick_factors ADD COLUMN effect_size DECIMAL(5,2);
ALTER TABLE pick_factors ADD COLUMN unit VARCHAR(20);
ALTER TABLE pick_factors ADD COLUMN sample_size INT;
ALTER TABLE pick_factors ADD COLUMN recency DECIMAL(3,2);
ALTER TABLE pick_factors ADD COLUMN data_quality DECIMAL(3,2);
ALTER TABLE pick_factors ADD COLUMN reliability DECIMAL(3,2);
ALTER TABLE pick_factors ADD COLUMN learned_weight DECIMAL(4,2) DEFAULT 1.0;
ALTER TABLE pick_factors ADD COLUMN soft_cap DECIMAL(4,2);
ALTER TABLE pick_factors ADD COLUMN contribution DECIMAL(5,2);

-- Add prediction heads table
CREATE TABLE prediction_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES picks(id) ON DELETE CASCADE,
  game_id UUID NOT NULL,
  bet_type VARCHAR(20) NOT NULL,  -- 'spread', 'total', 'moneyline'
  market_line DECIMAL(6,2),
  predicted_deviation DECIMAL(6,2),
  true_line DECIMAL(6,2),
  cover_probability DECIMAL(5,4),
  win_probability DECIMAL(5,4),
  offered_odds INT,
  implied_probability DECIMAL(5,4),
  expected_value DECIMAL(6,4),
  meets_threshold BOOLEAN,
  threshold_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ⏱️ **Estimated Timeline:**

| Phase | Time | Complexity |
|-------|------|------------|
| 1. Immediate fixes | 2 hours | Low |
| 2. Factor Engine redesign | 6 hours | High |
| 3. Three prediction heads | 3 hours | Medium |
| 4. AI research overhaul | 4 hours | High |
| 5. Database updates | 1 hour | Low |
| 6. Testing & debugging | 4 hours | Medium |
| **TOTAL** | **~20 hours** | **High** |

---

## 🎯 **Decision Point:**

### **Option A: Quick Fix (2 hours)**
- ✅ Delete old AI runs (DONE)
- ✅ Enable sequential runs
- ✅ Use sonar-pro
- ✅ Retry logic for 10+ factors
- ❌ Keep abstract confidence system
- ❌ No EV-based gating
- **Result:** System works but not sharp-level

### **Option B: Full Sharp Redesign (20 hours)**
- ✅ Everything in Option A
- ✅ Effect-size based factors
- ✅ Three prediction heads
- ✅ EV-based gating
- ✅ Reliability weighting
- ✅ Market-deviation approach
- **Result:** Professional sharp betting system

---

## 💭 **My Recommendation:**

1. **Start with Option A** (quick fix) to get the system working
2. **Test it with real games** for 1-2 weeks
3. **Collect data** on picks and outcomes
4. **Then build Option B** using real data to tune parameters

The sharp approach is theoretically superior, but we need historical data to:
- Tune shrinkage parameters (k values)
- Fit learned weights via ridge regression
- Estimate league-specific σ (margin stddev)
- Calibrate EV thresholds

**Without historical data, we're guessing at these values.**

---

## 🚀 **What I've Already Committed:**

✅ Delete old AI runs before test
✅ Automatic pre-push type checking
✅ Documentation on preventing errors

**Ready to push now.**

---

## ❓ **Your Call:**

**Option A** - Push this fix, get system working, test for 2 weeks?  
**Option B** - Full sharp redesign now (20 hours of work)?  
**Option C** - Something in between?

Let me know and I'll execute! 🎯

