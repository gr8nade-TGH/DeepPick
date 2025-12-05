# 🚀 Sharp Siege Development Agent - Onboarding

**Date:** 2025-12-05
**Production URL:** https://deep-pick.vercel.app
**Your Mission:** Fix SPREAD pick diversity and confidence issues

---

## 🔥 CRITICAL: Read These Files FIRST (30 min)

Read in this exact order:

1. **BRAIN/CRITICAL_RULES.md** ⚠️ **START HERE**
   - Top priorities, 3 pick types, Factor Factory, DEEP meta-capper
   - Updated with Pick Power (1-100 scale) and DEEP (12-point scale)
   - Production URL: https://deep-pick.vercel.app

2. **docs/AGENT_HANDOFF_2025-12-05.md** 🎯 **YOUR PRIMARY TASK**
   - The Problem: SPREAD picks mostly PASS, same-side when they generate
   - Recent fixes: REST DAYS bug, OVER bias, UI bugs
   - Investigation plan: Confidence thresholds, factor weights, S13 factor
   - Testing commands provided

3. **BRAIN/UPDATE_LOG.md** (Update #27 section)
   - Stats-based baseline IMPLEMENTED (6 models)
   - S13 Home/Away Splits added
   - F8/F9 UNDER-biased factors added
   - 13 SPREAD factors, 9 TOTALS factors

4. **BRAIN/EDGE_FACTORS_REFERENCE.md**
   - All 13 SPREAD factors (S1-S3, S5-S7, S10-S13)
   - All 9 TOTALS factors (F1-F9)

---

## 🎯 YOUR PRIMARY TASK

### The Problem:
**SPREAD picks generating but most marked as PASS (low confidence). When picks do generate, all cappers pick same side.**

### What's Already Fixed:
✅ **Stats-based baseline IMPLEMENTED** - 6 baseline models available
✅ **REST DAYS bug fixed** - Now using daily endpoints
✅ **OVER bias fixed** - Updated league averages, adjusted scale factors
✅ **S13 Home/Away Splits added** - Working replacement for broken S4
✅ **F8/F9 UNDER factors added** - Defensive Strength, Cold Shooting

### Current Issue:
Despite baseline diversity, SPREAD picks still have:
1. **Low confidence** - Most picks marked as PASS after recalibration
2. **Same-side picks** - When picks do generate, all cappers agree

### Investigation Plan:

**Step 1: Test SPREAD Pick Generation**
```powershell
# Test IFRIT SPREAD
Invoke-WebRequest -Uri "https://deep-pick.vercel.app/api/cappers/generate-pick?capperId=ifrit&sport=NBA&betType=SPREAD" -Method GET -UseBasicParsing -TimeoutSec 180

# Test NEXUS SPREAD
Invoke-WebRequest -Uri "https://deep-pick.vercel.app/api/cappers/generate-pick?capperId=nexus&sport=NBA&betType=SPREAD" -Method GET -UseBasicParsing -TimeoutSec 180
```

**Step 2: Check Confidence Recalibration**
- File: `src/lib/cappers/shiva-wizard-orchestrator.ts`
- Look for confidence thresholds (currently PASS if < 5.0)
- SPREAD may need lower threshold than TOTALS

**Step 3: Verify SPREAD Factor Weights**
- File: `src/app/cappers/settings/page.tsx`
- Check if all cappers have similar SPREAD archetypes
- Ensure weights sum to 250% for each capper

**Step 4: Test S13 Factor Computation**
- File: `src/lib/cappers/shiva-v1/factors/s13-home-away-splits.ts`
- Verify it's computing correctly
- Check if it's contributing to diversity

**Step 5: Compare Baseline Model Outputs**
- File: `src/lib/cappers/baseline-models/`
- Test if different models produce different SPREAD projections
- May need to adjust model weights for SPREAD vs TOTALS

---

## 📚 System Overview

### 3 Pick Creation Methods:

| Type | Tier Grading | Scale | File |
|------|--------------|-------|------|
| Manual | 1-100 | Pick Power | `manual-pick-confluence.ts` |
| Generated (SHIVA) | 1-100 | Pick Power | `confluence-scoring.ts` |
| DEEP (Meta-Capper) | 12-point | 5 signals | `deep/tier-grading.ts` |

### Factor System:

- **TOTALS:** 9 factors (F1-F9) - Added F8 Defensive Strength, F9 Cold Shooting
- **SPREAD:** 13 factors (S1-S3, S5-S7, S10-S13) - S4 removed, S13 added
- **Factor Factory:** `src/lib/factors/` - Single source of truth
- **Adding new factors:** 1-4 files (was 12+)

### Recent Changes (Update #27):

- **Stats-based baseline IMPLEMENTED** - 6 baseline models for diversity
- **S13 Home/Away Splits** - Working replacement for broken S4
- **F8/F9 UNDER factors** - Defensive Strength, Cold Shooting
- **REST DAYS bug fixed** - Daily endpoints instead of seasonal
- **OVER bias fixed** - Updated league averages, adjusted scale factors
- **OpenAI models updated** - All using gpt-4.1 now

### Previous Changes (Update #26):

- **PICKSMITH renamed to DEEP** - Factor Confluence Intelligence
- **Pick Power:** 1-100 scale (was 0-8 Confluence Score)
- **S10-S12 added:** Clutch Shooting, Scoring Margin, Perimeter Defense

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
2. **Test SPREAD pick generation** using PowerShell commands in handoff doc
3. **Analyze API responses** - Check confidence scores, factor contributions
4. **Investigate confidence thresholds** - Why are picks marked as PASS?
5. **Check capper SPREAD archetypes** - Are they too similar?
6. **Test S13 factor** - Is it computing correctly?
7. **Compare baseline models** - Do they produce different SPREAD projections?
8. **Report findings** with specific recommendations

---

## 🚨 Remember

- **Factor Factory is source of truth** - Add factors to `src/lib/factors/definitions/`
- **Pick Power = 1-100 scale** - More granular than old 0-8 system
- **DEEP uses 12-point scale** - Different from SHIVA's 100-point system
- **Always ask before pushing** - Git workflow requires permission
- **Test on live site** - Not local dev server
- **Check console logs** - Factor data errors show here

---

## 🔑 Key Files for Investigation

- `src/lib/cappers/shiva-wizard-orchestrator.ts` - Confidence recalibration logic
- `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts` - SPREAD factor orchestration
- `src/app/cappers/settings/page.tsx` - Capper archetypes and factor weights
- `src/lib/cappers/shiva-v1/factors/s13-home-away-splits.ts` - New S13 factor
- `src/lib/cappers/baseline-models/` - 6 baseline prediction models
- `src/app/api/cappers/generate-pick/route.ts` - Pick generation API

---

**Good luck! Your primary goal is to fix SPREAD pick diversity and confidence issues.** 🎯

