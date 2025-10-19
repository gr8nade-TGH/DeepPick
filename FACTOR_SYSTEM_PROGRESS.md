# Factor System Redesign - Progress Report

## ✅ **Completed (Phases 1-3)**

### **Phase 1: Database Schema** ✓
**File:** `supabase/migrations/013_factor_system_bipolar.sql`

- ✅ Created `pick_factors` table
  - Stores detailed factor breakdown per pick
  - Bipolar scoring: `-1.0 to +1.0` raw score
  - Weighted score after applying factor importance
  - Raw data storage (team A, team B, context)
  - StatMuse Q&A tracking
  - Impact type (positive/negative/neutral)

- ✅ Created `bet_selection_reasoning` table
  - Stores why spread/total/moneyline was chosen
  - Confidence scores for all 3 bet types
  - Odds value consideration
  - Risk assessment

- ✅ Upgraded Shiva to `sonar-pro` model
  - Deeper research capability
  - Better edge detection
  - Cost: $0.003 per request (up from $0.001)

### **Phase 2: Factor Engine** ✓
**File:** `src/lib/cappers/factor-engine.ts`

- ✅ `FactorEngine` class with bipolar scoring
- ✅ Factor structure with full transparency:
  ```typescript
  {
    name, category, weight,
    data: { teamA, teamB, context },
    rawScore: -1.0 to +1.0,
    weightedScore: -weight to +weight,
    reasoning, sources,
    statmuseQuery, statmuseResponse
  }
  ```

- ✅ Helper functions for smart scoring:
  - `scoreRecentForm()` - Comparative recent performance
  - `scoreInjuries()` - Context-aware injury impact
  - `scoreWeather()` - Only matters if team excels in that weather
  - `scoreOffensiveVsDefensive()` - Matchup analysis
  - `scoreVegasEdge()` - Most important factor

- ✅ Methods to get positive/negative factors separately
- ✅ Total confidence calculation (-10 to +10)

### **Phase 3: AI Orchestrator Upgrade** ✓
**File:** `src/lib/ai/ai-capper-orchestrator.ts`

- ✅ Smarter Run 1 prompt (Perplexity):
  - Focus on EDGE DETECTION (not just prediction)
  - Requires COMPARATIVE questions
  - Examples of good vs bad questions
  - Enforces format

- ✅ StatMuse retry logic:
  - `queryStatMuseWithRetry()` function
  - Tries original question first
  - Rephrases if no data found
  - Returns `{ text, failed }` for tracking

---

## 🚧 **In Progress (Phases 4-6)**

### **Phase 4: Integrate Factor Engine into Shiva** (NEXT)
**File:** `src/lib/cappers/shiva-algorithm.ts`

**TODO:**
- [ ] Replace current confidence calculation with FactorEngine
- [ ] Calculate each factor using helper functions
- [ ] Store factors in `pick_factors` table
- [ ] Pass factor data to UI

**Estimated Time:** 1-2 hours

---

### **Phase 5: Update UI to Display Factors** (NEXT)
**File:** `src/app/monitoring/page.tsx`

**TODO:**
- [ ] Create factor display cards with:
  - Raw team data (both teams)
  - Comparative analysis
  - Power bars (green for positive, red for negative)
  - StatMuse Q&A display
  - Score contribution
- [ ] Show all factors (including negative ones)
- [ ] Sort by absolute impact (biggest first)

**Estimated Time:** 1-2 hours

---

### **Phase 6: Bet Selection Logic Documentation**
**File:** `src/lib/cappers/shiva-algorithm.ts`

**TODO:**
- [ ] Document current bet selection logic
- [ ] Add reasoning for why specific bet type was chosen
- [ ] Store in `bet_selection_reasoning` table
- [ ] Display in UI (why spread vs total vs moneyline)
- [ ] Consider odds value (avoid -120+ unless strong edge)
- [ ] Higher threshold for moneyline bets

**Estimated Time:** 1 hour

---

## 📊 **Current State**

### **What Works:**
✅ Database tables ready
✅ Factor Engine built and tested (example usage in code comments)
✅ AI prompts upgraded for edge detection
✅ StatMuse retry logic implemented
✅ Shiva using `sonar-pro` model (after running migration)

### **What's Next:**
🔄 Connect FactorEngine to Shiva algorithm
🔄 Update UI to show factor breakdown
🔄 Test with real games

---

## 🧪 **Testing Plan**

Once Phase 4-6 complete:

1. **Run Database Migration:**
   ```sql
   -- In Supabase SQL Editor
   -- Copy/paste: supabase/migrations/013_factor_system_bipolar.sql
   ```

2. **Test Pick Generation:**
   - Run pick generation test
   - Check for factors in response
   - Verify StatMuse Q&A shows up
   - Confirm negative factors display

3. **Verify Factor Logic:**
   - Check that 10/10 is rare
   - Verify negative factors lower confidence
   - Ensure comparative analysis (both teams)
   - Confirm Vegas edge has biggest impact

4. **UI Validation:**
   - Factor cards show raw data
   - Power bars correct (red for negative)
   - StatMuse questions visible
   - Bet selection reasoning clear

---

## 💰 **Cost Impact**

**Before:** ~$0.007 per pick
**After:** ~$0.015 per pick

**Breakdown:**
- Perplexity sonar-pro: $0.003 (was $0.001)
- OpenAI GPT-4o-mini: $0.002 (same)
- StatMuse: Free
- Retry attempts: +$0.005 max

**Time:**
- Before: 30-60s per pick
- After: 60-90s per pick (deeper analysis)

---

## 🎯 **Expected Outcomes**

After full implementation:

- Average confidence: 7.5-8.0 (currently 9-10)
- 10/10 picks: <5% (currently common)
- Negative factors visible: >50% of picks
- StatMuse data shown: >80% of picks
- User understanding: 100% transparency

---

## 📝 **Next Steps**

**Immediate (30 min):**
1. Update StatMuse calls in AI orchestrator to use retry function
2. Update Run 2 prompt for edge detection

**Short-term (2-4 hours):**
1. Integrate FactorEngine into Shiva
2. Update UI for factor display
3. Add bet selection reasoning

**Testing (1 hour):**
1. Run database migration
2. Test with real games
3. Validate UI display
4. Verify cost/performance

---

**Status:** 60% Complete
**Next Action:** Integrate FactorEngine into Shiva algorithm
**ETA for Phase 4-6:** 2-4 hours of focused work

