# 🚀 Sharp Siege Development Agent - Onboarding

Welcome! You're joining as a development agent for **Sharp Siege** (formerly DeepPick), an NBA sports betting platform with battle visualizations.

---

## 📋 YOUR FIRST TASKS (Complete in Order)

### Task 1: Read Critical Documentation (30 min)
Read these files in the **BRAIN/** folder:

1. **BRAIN/CRITICAL_RULES.md** ⚠️ **READ FIRST**
2. **BRAIN/NEW_AGENT_PROMPT.md** 📖 Complete system overview
3. **BRAIN/GOTCHAS.md** 🐛 Common bugs and tricky areas
4. **BRAIN/GIT_DEPLOYMENT_GUIDE.md** 🔧 Git workflow
5. **BRAIN/EDGE_FACTORS_REFERENCE.md** 📊 All factors

### Task 2: Understand the Codebase (45 min)
Use `codebase-retrieval` to explore:

1. **Factor System**: "How does the factor system work? Show me factor-registry.ts, factor-config-registry.ts, orchestrators, and Configure Factors popup"
2. **Pick Generation**: "Show me the 3 pick creation methods: Manual, Generated (SHIVA), and Picksmith"
3. **Tier Grading**: "How does tier grading work for the 3 pick types? Show me confluence-scoring.ts files"
4. **Insight Cards**: "How are insight cards generated for each pick type?"

### Task 3: Test on Live Site (30 min)
**Ask user for live site URL**, then:

1. Open live site + Browser DevTools (F12) → Console tab
2. Navigate to **Factor Management page**
3. Click **"Configure Factors"** popup for a capper
4. Note their factor settings (weights, enabled/disabled)
5. Try to **generate a pick** for that capper
6. **Check Console logs** for factor data errors
7. **Check Network tab** for API responses

**Test all 3 pick types (if possible):**
- Manual pick creation
- Generated pick (SHIVA)
- Picksmith pick

**For each pick:**
- Does insight card spawn?
- Is tier grading correct?
- Do factors show properly?
- Any console errors?

### Task 4: Understand Current Issues (30 min)
**#1 CRITICAL ISSUE: Factor Data & Pick Generation**

Answer these questions:
- Are factors pulling correctly for all cappers?
- Do Run logs (console) show errors?
- Are Configure Factors settings respected?
- Which cappers work? Which don't?
- Do insight cards spawn for all 3 pick types?
- Is tier grading working for all 3 pick types?

### Task 5: Report Back (15 min)
After Tasks 1-4, report:

1. **Understanding Check:**
   - Explain the 3 pick creation methods
   - Explain how tier grading differs per type
   - Explain the factor debugging workflow

2. **Current State:**
   - What did you find testing live site?
   - Console errors?
   - Which pick types work? Which don't?
   - Which cappers have working factors?

3. **Questions:**
   - Any clarifications needed?

---

## 🎯 YOUR PRIORITIES (After Onboarding)

1. **Fix Factor Data & Pick Generation** ⚠️ CRITICAL
   - Factor data pulling correctly per capper
   - Configure Factors settings respected
   - Run logs clean

2. **Ensure Insight Cards Spawn** ⚠️ HIGH
   - All 3 pick types working
   - Tier grading displayed correctly

3. **Test & Verify** ⚠️ HIGH
   - Manual picks work
   - Generated picks (SHIVA) work
   - Picksmith picks work

---

## 🚨 CRITICAL RULES

**Always ask permission before:**
- Pushing to remote (`git push`)
- Deploying to production
- Modifying database schema
- Installing dependencies

**Always check before editing:**
- Configure Factors popup (factor settings)
- Run logs (browser console on live site)
- All 3 pick types (Manual, Generated, Picksmith)

**Always test on live site:**
- Both TOTAL and SPREAD picks
- All 3 pick creation methods
- Insight cards for each type
- Tier grading for each type
- Check browser console for errors

**Workflow:**
1. Make code changes
2. Commit locally (`git commit`)
3. **Ask permission to push**
4. Push to main (`git push`) → Auto-deploys to Vercel
5. Test on live site
6. Check browser console for errors

---

## 🧠 Key Concepts

- **3 Pick Types:** Manual (user), Generated (SHIVA AI), Picksmith (consensus)
- **Confluence Tier System:** Quality-based, 8-point scale, 5 tiers
- **Bet Type Specificity:** TOTAL and SPREAD tracked separately
- **Factor System:** Registry → Orchestrators → Configure Factors popup
- **Insight Cards:** Different structure per pick type
- **Testing:** All done on live Vercel deployment (browser console for logs)

---

## 🎓 Success Criteria

You're ready when you can:
- ✅ Explain the 3 pick creation methods
- ✅ Debug factor issues using Configure Factors + console
- ✅ Identify which tier grading file applies to which pick type
- ✅ Navigate the codebase confidently
- ✅ Test on live site and interpret console logs
- ✅ Understand git workflow (commit → ask → push → auto-deploy → test)

---

## 🚀 Let's Get Started!

**Step 1:** Read BRAIN/CRITICAL_RULES.md (use `view` tool)  
**Step 2:** Read BRAIN/NEW_AGENT_PROMPT.md  
**Step 3:** Ask user for live site URL  
**Step 4:** Complete Tasks 1-5 above  
**Step 5:** Report back with findings

Good luck! 🎯

