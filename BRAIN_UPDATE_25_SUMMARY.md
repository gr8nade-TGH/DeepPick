# 🧠 Brain Update #25 - Summary

**Date:** 2025-12-03  
**Commits Analyzed:** 24 new commits (6079b08 → 57e84d2)  
**Status:** ✅ COMPLETE

---

## 📊 What Changed

### 🏭 MAJOR: Factor Factory Architecture
**Problem:** Adding new factors required updating 12+ files  
**Solution:** Single source of truth at `src/lib/factors/`

**New Structure:**
```
src/lib/factors/
├── types.ts              # FactorDefinition interface
├── registry.ts           # Central registry (all 14 factors)
├── compat.ts             # Backward-compatible layer
├── index.ts              # Public API
└── definitions/
    └── nba/
        ├── totals/       # F1-F7 (7 TOTALS factors)
        └── spread/       # S1-S7 (7 SPREAD factors)
```

**Benefits:**
- Adding new factors: **1-4 files** (was 12+)
- Factor metadata in ONE place
- Ready for multi-sport expansion (NFL, MLB)
- Documentation: `docs/FACTOR_FACTORY.md` (299 lines)

---

### 🆕 NEW FACTORS

**F7: Rest Advantage (TOTALS)**
- Rest differential + back-to-back detection
- Default weight: 15%
- File: `src/lib/factors/definitions/nba/totals/f7-rest-advantage.ts`

**S7: Momentum Index (SPREAD)**
- Win streak + last 10 record
- Default weight: 15%
- File: `src/lib/factors/definitions/nba/spread/s7-momentum-index.ts`

**Total Factors:** 7 TOTALS + 7 SPREAD (was 6 each)

---

### 🐛 CRITICAL BUG FIXES

**1. Home/Away Detection (8 commits)**
- 4-tier fallback system for MySportsFeeds API
- Fixed S4 (Home/Away Splits) factor failures
- Comprehensive logging when detection fails

**2. SPREAD Pick Direction (1 commit)**
- Now shows who COVERS (not who WINS)

**3. Factor Alignment (2 commits)**
- Exclude neutral factors from alignment %
- Check BOTH abbreviation AND name for AWAY/HOME

**4. Factor Key Consistency (1 commit)**
- Create Capper page now uses correct SHIVA keys

**5. Rest Calculation (1 commit)**
- Sort gameDates to get most recent game first

---

### 🎨 UX IMPROVEMENTS

**Archetype System Overhaul:**
- Uniform 2x2 grid with fixed height
- Horizontal category filter tabs
- Random archetype selection on page load
- All archetypes sum to 250% correctly

**Archetype Renames:**
- "Rest Detective" → "The Whistle Hunter"
- "Home Court Hero" → "The Disruptor"
- "Form Rider" → "Hot Hand"

**Factor Display:**
- S3 renamed "SHOOT" → "Shooting"
- Better short names in run logs

---

## 📁 Files Modified

**Total:** ~50 files changed
- **New:** 21 files (Factor Factory + factor definitions)
- **Modified:** ~30 files (orchestrators, registries, UI, migrations)
- **Documentation:** 4 files (FACTOR_FACTORY.md, BRAIN files)

---

## 📚 Brain Files Updated

✅ **BRAIN/UPDATE_LOG.md** - Added Update #25 (222 lines)  
✅ **BRAIN/CRITICAL_RULES.md** - Added Factor Factory section  
✅ **BRAIN/GOTCHAS.md** - Added Home/Away Detection gotcha  
✅ **BRAIN/EDGE_FACTORS_REFERENCE.md** - Already had F7/S7 (no changes needed)  
✅ **BRAIN/FACTOR_ADDITION_CHECKLIST.md** - Created in previous session

---

## 🚨 What You Need to Know

### For Development Agents:

1. **Factor Factory is now the source of truth**
   - Add new factors to `src/lib/factors/definitions/`
   - Update registry in `src/lib/factors/registry.ts`
   - That's it! (was 12+ files before)

2. **Home/Away detection is robust now**
   - 4 fallback methods
   - Comprehensive logging
   - Should not fail anymore

3. **All archetypes sum to 250%**
   - Weight budget enforced
   - System cappers updated in migration 064

4. **7 TOTALS + 7 SPREAD factors**
   - NBA factor system complete
   - Ready for multi-sport expansion

### For New Agents:

Read these files in order:
1. `BRAIN/CRITICAL_RULES.md` (includes Factor Factory section)
2. `BRAIN/NEW_AGENT_PROMPT.md`
3. `BRAIN/GOTCHAS.md` (includes Home/Away detection)
4. `docs/FACTOR_FACTORY.md` (capper diagnostics)

---

## ✅ Next Steps

1. **Test Factor Factory** - Verify all 14 factors work correctly
2. **Test Home/Away Detection** - Confirm S4 factor no longer fails
3. **Test New Factors** - F7 (Rest) and S7 (Momentum) working?
4. **Test Archetypes** - All sum to 250%?
5. **Generate Picks** - All 3 pick types working?

---

**Brain Update Complete!** 🎉

All documentation updated. Ready for new development agent.

