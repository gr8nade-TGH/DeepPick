# CRITICAL RULES - READ FIRST

**Last Updated:** 2025-12-02  
**Priority:** HIGHEST - Read before any work

---

## ?? TOP PRIORITY ISSUES

### #1 CRITICAL: Factor Data & Pick Generation
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

**This is the #1 issue - prioritize above all else!**

---

## ?? CURRENT PRIORITIES (In Order)

1. **Fix Factors & Pick Generation** ?? CRITICAL
   - Factor data pulling correctly per capper
   - Verify factor settings respected
   - Check Run logs for errors

2. **Ensure Insight Cards Spawn Correctly** ?? HIGH
   - All 3 pick types (Manual, Generated, Picksmith)
   - Correct tier grading displayed
   - Factor breakdown shown properly

3. **Confirm Tier Grading Works** ?? HIGH
   - Manual picks (confluence-based)
   - Generated picks (SHIVA - confluence-based)
   - Picksmith picks (meta-capper consensus)

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
- **Tier Grading:** `src/lib/confluence-scoring.ts`
- **Signals:** Edge Strength, Specialization Record, Win Streak, Factor Alignment
- **Insight Card:** Shows AI factors, edge breakdown, confidence score
- **API:** `/api/shiva/generate-pick/route.ts`

### 3. PICKSMITH GENERATED PICKS (Meta-Capper Consensus)
- **Created By:** PICKSMITH meta-capper (aggregates multiple cappers)
- **Tier Grading:** `src/lib/cappers/picksmith/tier-grading.ts`
- **Signals:** Consensus strength, contributing cappers, agreement level
- **Insight Card:** Shows contributing cappers, consensus reasoning
- **Special:** Requires full team data in game_snapshot

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
- [ ] Test PICKSMITH pick creation
- [ ] Verify insight cards spawn for all 3 types
- [ ] Confirm tier grading works for all 3 types
- [ ] Check Run logs for factor data errors
- [ ] Test with both TOTAL and SPREAD picks
- [ ] Verify Configure Factors popup settings respected

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

| Pick Type | Tier Grading File | Insight Card Type |
|-----------|------------------|-------------------|
| Manual | `manual-pick-confluence.ts` | Manual format |
| Generated (SHIVA) | `confluence-scoring.ts` | AI factors format |
| Picksmith | `picksmith/tier-grading.ts` | Consensus format |

---

##  Remember

1. **Factor data pulling is #1 priority** - Check Configure Factors popup vs Run logs
2. **3 pick types, 3 tier formulas** - Don't mix them up
3. **Insight cards differ per type** - Manual  Generated  Picksmith
4. **Not in production** - Can delete picks, test freely
5. **Deterministic battles = future** - Don't prioritize
6. **Always check Run logs** - Factor data errors show here

