# CRITICAL RULES - READ FIRST

**Last Updated:** 2025-12-06 (Update #29)
**Priority:** HIGHEST - Read before any work
**Production URL:** https://deep-pick.vercel.app

---

## 🚨 TOP PRIORITY ISSUES

### #1 NEW: AI Insights System (IMPLEMENTED!)
**Status:** ✅ SHIPPED - Grok-powered sentiment analysis live
**What:** 5 AI archetypes using Grok (xAI) for real-time X/Twitter sentiment
**Admin UI:** `/admin/ai-manager` - Test and manage insights
**Files:**
- `src/lib/ai-insights/grok-client.ts` - Grok integration (1616 lines)
- `src/app/admin/ai-manager/page.tsx` - Admin UI (1858 lines)
- `src/app/api/admin/ai-insights/route.ts` - API endpoints

**5 Archetypes:**
1. THE PULSE - Public sentiment (0-5 points)
2. THE INFLUENCER - Betting influencer sentiment
3. THE INTERPRETER - Independent research
4. THE DEVIL'S ADVOCATE - Contrarian check
5. THE MATHEMATICIAN - Pure math (TOTALS only)

**Next Steps:**
1. Integrate Pulse Score into pick generation as factor
2. Add cache warming cron (30min before games)
3. Monitor Grok API costs and reliability

### #2 ONGOING: Factor Data & Pick Generation
**Problem:** Factors and pick generation partially working, some cappers work, others don't
**Root Cause:** Factor data not pulling properly per capper based on their factor settings

**Debugging Process (MANDATORY):**
1. **Reference Configure Factors Popup** - Check factor management page
2. **Compare Run Logs** - Check pick generation logs
3. **Verify Factor Data** - Confirm factor data pulling correctly per capper
4. **Check Factor Settings** - Each capper has custom factor weights/settings

**Files to Check:**
- Factor management page with Configure Factors popup
- Pick generation API routes (`/api/shiva/generate-pick/route.ts`)
- Run logs (check console/API responses)
- Factor orchestrators (`src/lib/cappers/shiva-v1/`)

---

## 🏭 FACTOR FACTORY (Update #25)

**IMPORTANT:** Factor system has been refactored to use a single source of truth!

**Old Way (DEPRECATED):** Adding a factor required updating 12+ files
**New Way:** Add factor to `src/lib/factors/definitions/` (1-4 files total)

**Factor Factory Location:** `src/lib/factors/`
- `types.ts` - FactorDefinition interface
- `registry.ts` - Central registry
- `compat.ts` - Backward-compatible layer
- `definitions/nba/totals/` - F1-F9 factor files
- `definitions/nba/spread/` - S1-S13 factor files

**Current Factors (Update #27):**
- **TOTALS (9):** F1-Pace, F2-OffForm, F3-DefErosion, F4-ThreeEnv, F5-WhistleEnv, F6-Injury, F7-RestAdvantage, F8-TrendMomentum, F9-MarketEdge
- **SPREAD (13):** S1-NetRating, S2-Turnover, S3-Shooting, S4-HomeAway (broken), S5-FourFactors, S6-Injury, S7-MomentumIndex, S10-Rebounding, S11-ClutchPerf, S12-DefensiveImpact, S13-HomeAwaySplits

**AI Insights (Update #29):**
- **F10 (planned):** AI Archetype Insight for TOTALS
- **S14 (planned):** AI Archetype Insight for SPREAD
- **Current:** 5 Grok-powered insights (Pulse, Influencer, Interpreter, Devil's Advocate, Mathematician)

**Documentation:** `docs/FACTOR_FACTORY.md` (capper diagnostics, troubleshooting, how to add factors)

**When Adding New Factors:**
1. Create factor file in `src/lib/factors/definitions/nba/[totals|spread]/`
2. Add to registry in `src/lib/factors/registry.ts`
3. Update migration to assign to system cappers
4. Update BRAIN documentation

**That's it! No need to update 12+ files anymore.**

---

## ?? CURRENT PRIORITIES (In Order)

1. **Fix SPREAD Pick Diversity & Confidence** ?? CRITICAL - UPDATED!
   - SPREAD picks generating but most marked as PASS (low confidence)
   - When picks do generate, all cappers pick same side
   - Stats-based baseline IMPLEMENTED but diversity still low
   - See `docs/AGENT_HANDOFF_2025-12-05.md` for investigation plan

2. **Fix Factors & Pick Generation** ?? HIGH
   - Factor data pulling correctly per capper
   - Verify factor settings respected
   - Check Run logs for errors

3. **Ensure Insight Cards Spawn Correctly** ?? HIGH
   - All 3 pick types (Manual, Generated, DEEP)
   - Correct tier grading displayed
   - Factor breakdown shown properly

4. **Confirm Tier Grading Works** ?? HIGH
   - Manual picks (1-100 scale)
   - Generated picks (SHIVA - 1-100 Pick Power)
   - DEEP picks (12-point meta-capper)

4. **Test All 3 Pick Creation Methods** ?? MEDIUM
   - Manual picks (user-created)
   - Generated picks (SHIVA AI)
   - Picksmith picks (meta-capper consensus)

---

## ?? 3 PICK CREATION METHODS

### 1. MANUAL PICKS (User-Created)
- **Created By:** Users manually
- **Tier Grading:** `src/lib/manual-pick-confluence.ts`
- **Signals:** Bet Conviction (units), Specialization Record, Win Streak, Quality Signal
- **Insight Card:** Manual pick format (no AI factors)

### 2. GENERATED PICKS (SHIVA AI)
- **Created By:** SHIVA AI system
- **Tier Grading:** `src/lib/confluence-scoring.ts` (1-100 scale - "Pick Power")
- **Signals:** Edge Strength (35%), Specialization Record (20%), Win Streak (10%), Factor Alignment (35%)
- **Tier Thresholds:** Legendary 90+, Elite 75-89, Rare 60-74, Uncommon 45-59, Common 0-44
- **Insight Card:** Shows AI factors, edge breakdown, Pick Power score
- **API:** `/api/shiva/generate-pick/route.ts`

### 3. DEEP GENERATED PICKS (Meta-Capper Consensus) - FORMERLY PICKSMITH
- **Created By:** DEEP meta-capper (Factor Confluence Intelligence)
- **Tier Grading:** `src/lib/cappers/deep/tier-grading.ts` (12-point scale)
- **Signals:** Consensus Strength (0-3), Tier Quality (0-3), Factor Alignment (0-3), Counter-Thesis (0-2), DEEP's Record (0-1)
- **Tier Thresholds:** Legendary 10+, Elite 8-9.9, Rare 6-7.9, Uncommon 4-5.9, Common <4
- **Insight Card:** Shows contributing cappers, factor confluence, counter-thesis
- **Special:** Tier-weighted voting (Legendary=5x, Elite=4x, Rare=3x, Uncommon=2x, Common=1x)
- **API:** `/api/deep/generate/route.ts`

**IMPORTANT:** Each pick type has:
- Different tier grading formula
- Different insight card structure
- Different data requirements

---

## ?? WHAT NOT TO WORRY ABOUT (Low Priority)

1. **Deterministic Battle System** - Future feature, not urgent
2. **Backfilling Tier Grades** - Not needed, picks will be deleted (not in prod)
3. **Production Deployment** - Not in production yet, testing phase

---

## ? TESTING CHECKLIST (Before Pushing)

Before any major changes:

- [ ] Test MANUAL pick creation
- [ ] Test GENERATED pick creation (SHIVA)
- [ ] Test DEEP pick creation (meta-capper)
- [ ] Verify insight cards spawn for all 3 types
- [ ] Confirm tier grading works for all 3 types (1-100 for Manual/SHIVA, 12-point for DEEP)
- [ ] Check Run logs for factor data errors
- [ ] Test with both TOTAL and SPREAD picks
- [ ] Verify Configure Factors popup settings respected
- [ ] Test Pick Power display (1-100 scale with tier bar)

---

## ?? Factor Debugging Workflow

```
1. Open Factor Management Page
   ?
2. Click Configure Factors popup for a capper
   ?
3. Note their factor settings (weights, enabled/disabled)
   ?
4. Generate a pick for that capper
   ?
5. Check Run logs in console/API response
   ?
6. Verify factor data matches their settings
   
7. If mismatch  CRITICAL BUG, fix immediately
```

---

##  Quick Reference

| Pick Type | Tier Grading File | Scale | Insight Card Type |
|-----------|------------------|-------|-------------------|
| Manual | `manual-pick-confluence.ts` | 1-100 | Manual format |
| Generated (SHIVA) | `confluence-scoring.ts` | 1-100 (Pick Power) | AI factors format |
| DEEP (Meta-Capper) | `deep/tier-grading.ts` | 12-point | Consensus format |

**Tier Thresholds:**
- **Manual/SHIVA (1-100):** Legendary 90+, Elite 75-89, Rare 60-74, Uncommon 45-59, Common 0-44
- **DEEP (12-point):** Legendary 10+, Elite 8-9.9, Rare 6-7.9, Uncommon 4-5.9, Common <4

---

##  Remember

1. **Factor data pulling is #1 priority** - Check Configure Factors popup vs Run logs
2. **3 pick types, 3 tier formulas, 2 scales** - Don't mix them up
3. **Pick Power = 1-100 scale** - Renamed from Confluence Score (was 0-8)
4. **DEEP uses 12-point scale** - Different from SHIVA's 100-point system
5. **Insight cards differ per type** - Manual  Generated  DEEP
6. **Not in production** - Can delete picks, test freely
7. **Deterministic battles = future** - Don't prioritize
8. **Always check Run logs** - Factor data errors show here
9. **PICKSMITH is now DEEP** - Same capper ID, new name and algorithm

