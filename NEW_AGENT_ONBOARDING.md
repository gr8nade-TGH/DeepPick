# 🚀 Sharp Siege Development Agent - Onboarding

**Date:** 2025-12-04  
**Your Mission:** Fix baseline projection system to create pick diversity across cappers

---

## 🔥 CRITICAL: Read These Files FIRST (30 min)

Read in this exact order:

1. **BRAIN/CRITICAL_RULES.md** ⚠️ **START HERE**
   - Top priorities, 3 pick types, Factor Factory, DEEP meta-capper
   - Updated with Pick Power (1-100 scale) and DEEP (12-point scale)

2. **docs/BASELINE_PROJECTION_FIX.md** 🎯 **YOUR PRIMARY TASK**
   - The Problem: All cappers picking same side
   - Root Cause: Using Vegas as baseline instead of team stats
   - The Fix: Stats-based baseline + 3 universal core factors
   - Files to modify with exact paths

3. **BRAIN/UPDATE_LOG.md** (Update #26 section)
   - Recent changes: DEEP meta-capper, Pick Power system, S10-S12 factors
   - 12 SPREAD factors, 7 TOTALS factors

4. **BRAIN/EDGE_FACTORS_REFERENCE.md**
   - All 12 SPREAD factors (S1-S3, S5-S7, S10-S12)
   - All 7 TOTALS factors (F1-F7)

---

## 🎯 YOUR PRIMARY TASK

### The Problem:
All 7 cappers generating **identical picks** (e.g., all picking MEM +10). Zero diversity.

### Root Cause:
Current code uses **Vegas line as baseline** instead of building independent projection from team stats.

**File:** `src/lib/cappers/shiva-wizard-orchestrator.ts` (lines 613-615, 688-703)

### The Fix (3 Steps):

**Step 1: Stats-Based Baseline (NOT Vegas)**
```typescript
function calculateBaseline(homeTeam: Stats, awayTeam: Stats): number {
  const netRatingDiff = homeTeam.netRating - awayTeam.netRating
  const homeCourtAdj = 3.0 // NBA average HCA
  return netRatingDiff + homeCourtAdj
}
```

**Step 2: Apply 3 Core Factors (Universal for ALL cappers)**
- Home Court Advantage (confirmed)
- Pace Environment (decision needed)
- Scoring Environment (decision needed)

**Step 3: Apply Capper-Specific Factors**
- Each capper's archetype weights different factors
- Different magnitudes → different sides of Vegas → **DIVERSITY!**

### Files to Modify:

1. `src/lib/cappers/shiva-wizard-orchestrator.ts` - Change baseline logic
2. Create `src/lib/cappers/core-factors/` directory with 3 core factor files
3. `src/lib/cappers/shiva-v1/confidence-calculator.ts` - May need updates

### Decision Needed:

Confirm **2nd and 3rd core factors** (Home Court is confirmed):
- **Recommendation:** Pace Environment + Scoring Environment
- See `docs/BASELINE_PROJECTION_FIX.md` for full analysis

---

## 📚 System Overview

### 3 Pick Creation Methods:

| Type | Tier Grading | Scale | File |
|------|--------------|-------|------|
| Manual | 1-100 | Pick Power | `manual-pick-confluence.ts` |
| Generated (SHIVA) | 1-100 | Pick Power | `confluence-scoring.ts` |
| DEEP (Meta-Capper) | 12-point | 5 signals | `deep/tier-grading.ts` |

### Factor System:

- **TOTALS:** 7 factors (F1-F7)
- **SPREAD:** 12 factors (S1-S3, S5-S7, S10-S12) - S4 removed
- **Factor Factory:** `src/lib/factors/` - Single source of truth
- **Adding new factors:** 1-4 files (was 12+)

### Recent Changes (Update #26):

- **PICKSMITH renamed to DEEP** - Factor Confluence Intelligence
- **Pick Power:** 1-100 scale (was 0-8 Confluence Score)
- **S10-S12 added:** Clutch Shooting, Scoring Margin, Perimeter Defense
- **Factor Alignment weight:** Increased to 35% (was 25%)

---

## 🔧 Git Workflow

**ALWAYS ask permission before pushing!**

```bash
# 1. Make changes
# 2. Commit locally
git add .
git commit -m "fix: your change description"

# 3. ASK USER: "Ready to push to remote?"
# 4. After permission:
git push origin main

# 5. Auto-deploys to Vercel
# 6. Test on live site
```

**See:** `BRAIN/GIT_DEPLOYMENT_GUIDE.md` for complete workflow

---

## 🧪 Testing Workflow

**All testing done on LIVE Vercel deployment (NOT local dev server)**

1. Ask user for live site URL
2. Open browser DevTools (F12) → Console tab
3. Test all 3 pick types:
   - Manual pick creation
   - Generated pick (SHIVA)
   - DEEP pick (meta-capper)
4. Check console logs for errors
5. Verify insight cards spawn
6. Confirm tier grading works (1-100 for Manual/SHIVA, 12-point for DEEP)

---

## 📖 Additional Resources

- **BRAIN/GOTCHAS.md** - Common bugs, home/away detection, bet type specificity
- **BRAIN/FACTOR_ADDITION_CHECKLIST.md** - How to add new factors
- **docs/FACTOR_FACTORY.md** - Capper diagnostics, troubleshooting
- **BRAIN/NEW_AGENT_PROMPT.md** - Complete system architecture (41 KB)

---

## ✅ Your First Steps

1. **Read the 4 critical files above** (30 min)
2. **Ask user for live site URL**
3. **Review baseline projection fix** in `docs/BASELINE_PROJECTION_FIX.md`
4. **Confirm core factors decision** with user (Pace + Scoring?)
5. **Implement the fix** in 3 files
6. **Test on live site** - Verify pick diversity
7. **Report back** with results

---

## 🚨 Remember

- **Factor Factory is source of truth** - Add factors to `src/lib/factors/definitions/`
- **Pick Power = 1-100 scale** - More granular than old 0-8 system
- **DEEP uses 12-point scale** - Different from SHIVA's 100-point system
- **Always ask before pushing** - Git workflow requires permission
- **Test on live site** - Not local dev server
- **Check console logs** - Factor data errors show here

---

**Good luck! Your primary goal is to fix the baseline projection system and create pick diversity.** 🎯

