# 📋 COMPLETE CHECKLIST: Adding New NBA Factors

## 🎯 Task: Add F7 (Rest Advantage - TOTALS) & S7 (Momentum Index - SPREAD)

---

## ✅ PHASE 1: Factor Computation Files

### 1.1 Create Factor Implementation Files
**Location:** `src/lib/cappers/shiva-v1/factors/`

- [ ] **Create `f7-rest-advantage.ts`**
  - Export `computeRestAdvantage(bundle: NBAStatsBundle, ctx: RunCtx)`
  - Return `{ overScore, underScore, signal, meta }`
  - Use back-to-back detection from game schedule
  - Formula: Detect rest days differential → signal = tanh(restDiff / SCALE)

- [ ] **Create `s7-momentum-index.ts`**
  - Export `computeMomentumIndex(bundle: NBAStatsBundle, ctx: RunCtx)`
  - Return `{ awayScore, homeScore, signal, meta }`
  - Use team streak + last 10 record
  - Formula: Combine win streak + recent record → signal = tanh(momentumDiff / SCALE)

---

## ✅ PHASE 2: Orchestrators

### 2.1 Update TOTALS Orchestrator
**File:** `src/lib/cappers/shiva-v1/factors/nba-totals-orchestrator.ts`

- [ ] Import computeRestAdvantage at top
- [ ] Add to enabled factors check:
  ```typescript
  if (factorWeights.restAdvantage?.enabled) {
    try {
      const result = await computeRestAdvantage(bundle, ctx);
      factors.push({
        key: 'restAdvantage',
        name: 'Rest Advantage',
        overScore: result.overScore,
        underScore: result.underScore,
        signal: result.signal,
        weight: factorWeights.restAdvantage.weight,
        meta: result.meta
      });
    } catch (error) {
      console.error('Error computing restAdvantage:', error);
    }
  }
  ```

### 2.2 Update SPREAD Orchestrator
**File:** `src/lib/cappers/shiva-v1/factors/nba-spread-orchestrator.ts`

- [ ] Import computeMomentumIndex at top
- [ ] Add to enabled factors check (similar structure, use awayScore/homeScore)

### 2.3 Update Run Logs Display
**File:** `src/app/cappers/shiva/management/components/run-log.tsx`

- [ ] Add to factorKeys array (line ~626):
  ```typescript
  const factorKeys = [
    'paceIndex',
    'offForm',
    'defErosion',
    'threeEnv',
    'whistleEnv',
    'injuryAvailability',
    'restAdvantage', // NEW
    // ... spread factors
    'momentumIndex' // NEW
  ];
  ```

---

## ✅ PHASE 3: Type Definitions

### 3.1 Update NBAStatsBundle Interface
**File:** `src/lib/cappers/shiva-v1/factors/types.ts`

- [ ] Add rest advantage fields:
  ```typescript
  // Rest advantage data (F7)
  awayRestDays?: number;
  homeRestDays?: number;
  awayIsBackToBack?: boolean;
  homeIsBackToBack?: boolean;
  ```

- [ ] Add momentum fields:
  ```typescript
  // Momentum data (S7)
  awayWinStreak?: number;
  homeWinStreak?: number;
  awayLast10Record?: { wins: number; losses: number };
  homeLast10Record?: { wins: number; losses: number };
  ```

---

## ✅ PHASE 4: Data Fetching

### 4.1 Update TeamFormData Interface
**File:** `src/lib/data-sources/mysportsfeeds-stats.ts`

- [ ] Add to TeamFormData interface:
  ```typescript
  restDays?: number;
  isBackToBack?: boolean;
  winStreak?: number;
  last10Record?: { wins: number; losses: number };
  ```

### 4.2 Update getTeamFormData Function
**File:** `src/lib/data-sources/mysportsfeeds-stats.ts`

- [ ] Calculate rest days from game schedule
- [ ] Detect back-to-back games
- [ ] Calculate win streak from recent games
- [ ] Calculate last 10 record

### 4.3 Update fetchNBAStatsBundle
**File:** `src/lib/cappers/shiva-v1/factors/data-fetcher.ts`

- [ ] Include new fields in bundle:
  ```typescript
  awayRestDays: awayData.restDays,
  homeRestDays: homeData.restDays,
  awayIsBackToBack: awayData.isBackToBack,
  homeIsBackToBack: homeData.isBackToBack,
  awayWinStreak: awayData.winStreak,
  homeWinStreak: homeData.winStreak,
  awayLast10Record: awayData.last10Record,
  homeLast10Record: homeData.last10Record,
  ```

---

## ✅ PHASE 5: Factor Registries

### 5.1 Update Main Factor Registry
**File:** `src/lib/cappers/shiva-v1/factor-registry.ts`

- [ ] Add to NBA_TOTALS_FACTORS array:
  ```typescript
  {
    key: 'restAdvantage',
    name: 'Rest Advantage',
    shortName: 'Rest',
    icon: '😴',
    description: 'Back-to-back and rest days differential',
    appliesTo: { sports: ['NBA'], betTypes: ['TOTAL'], scope: 'LEAGUE' },
    maxPoints: 5.0,
    defaultWeight: 0.15,
    defaultDataSource: 'mysportsfeeds'
  }
  ```

- [ ] Add to NBA_SPREAD_FACTORS array:
  ```typescript
  {
    key: 'momentumIndex',
    name: 'Momentum Index',
    shortName: 'Momentum',
    icon: '📈',
    description: 'Team streak and recent performance',
    appliesTo: { sports: ['NBA'], betTypes: ['SPREAD'], scope: 'LEAGUE' },
    maxPoints: 5.0,
    defaultWeight: 0.15,
    defaultDataSource: 'mysportsfeeds'
  }
  ```

### 5.2 Update Config Registry
**File:** `src/lib/cappers/shiva-v1/factor-config-registry.ts`

- [ ] Add restAdvantage entry (same structure as above)
- [ ] Add momentumIndex entry (same structure as above)

---

## ✅ PHASE 6: Create Your Capper Page

**File:** `src/app/cappers/create/page.tsx`

### 6.1 Update FACTOR_DETAILS (line ~58)
- [ ] Add restAdvantage details
- [ ] Add momentumIndex details

### 6.2 Update AVAILABLE_FACTORS (line ~163)
- [ ] Add 'restAdvantage' to TOTAL array
- [ ] Add 'momentumIndex' to SPREAD array

### 6.3 Update FACTOR_GROUPS (line ~169)
- [ ] Add to appropriate display groups

### 6.4 Update Archetypes (line ~268)
- [ ] Add factors to relevant archetype presets with appropriate weights

---

## ✅ PHASE 7: SHIVA Management Page

### 7.1 Configure Factors Modal
**File:** `src/app/cappers/shiva/management/components/factor-config-modal.tsx`

- [ ] Update getFactorDetails() function (line ~89):
  - Add restAdvantage case with features, examples, registry info
  - Add momentumIndex case with features, examples, registry info

### 7.2 Wizard Validation
**File:** `src/app/cappers/shiva/management/components/wizard.tsx`

- [ ] Update expectedFactorKeys (line ~820):
  - Add 'restAdvantage' to TOTAL expected keys
  - Add 'momentumIndex' to SPREAD expected keys

---

## ✅ PHASE 8: Admin Factors Page

### 8.1 Factor Strategist
**File:** `src/app/admin/factors/components/factor-strategist.tsx`

- [ ] Update FACTOR_INFO object (line ~32, ~42):
  - Add restAdvantage to TOTALS section
  - Add momentumIndex to SPREAD section

### 8.2 Stat Browser
**File:** `src/app/admin/factors/components/stat-browser.tsx`

- [ ] Add new stat categories if needed:
  - Rest/Schedule category
  - Momentum/Streaks category

---

## ✅ PHASE 9: Database

### 9.1 Create Migration
**File:** `supabase/migrations/XXX_add_f7_s7_factors.sql`

- [ ] Update all system cappers in capper_profiles:
  - SHIVA (id: 1)
  - IFRIT (id: 2)
  - NEXUS (id: 3)
  - BLITZ (id: 4)
  - TITAN (id: 5)
  - THIEF (id: 6)
  - PICKSMITH (id: 7)

- [ ] Add factors to JSONB `factors` column:
  ```sql
  UPDATE capper_profiles
  SET factors = factors || '[{"key":"restAdvantage","weight":15,"enabled":true,"dataSource":"mysportsfeeds"}]'::jsonb
  WHERE capper_id = 1 AND bet_type = 'TOTAL';
  ```

---

## ✅ PHASE 10: API Routes

**No changes needed** - API routes dynamically read from registries

---

## ✅ PHASE 11: Tests (Optional)

- [ ] Create `src/lib/cappers/shiva-v1/factors/__tests__/f7-rest-advantage.test.ts`
- [ ] Create `src/lib/cappers/shiva-v1/factors/__tests__/s7-momentum-index.test.ts`

---

## ✅ PHASE 12: Documentation

- [ ] Update `BRAIN/EDGE_FACTORS_REFERENCE.md`
- [ ] Update `BRAIN/UPDATE_LOG.md` with new update entry

---

## 🚨 CRITICAL NOTES

1. **Factor Keys Must Match Everywhere:**
   - `restAdvantage` (TOTALS)
   - `momentumIndex` (SPREAD)
   - Use exact same key in ALL files

2. **Data Flow:**
   - MySportsFeeds → TeamFormData → NBAStatsBundle → Factor Computation → Orchestrator

3. **Testing Workflow:**
   - Reference Configure Factors popup
   - Check Run logs for factor data
   - Verify factor shows in insight cards

4. **Weight Budget:**
   - Total weights can sum to 250% (not 100%)
   - Default weight: 15% for both factors

---

## 📊 SUMMARY

| Phase | Description | Files |
|-------|-------------|-------|
| **1. Computation** | Factor implementation files | 2 new files |
| **2. Orchestrators** | Import and call factors | 3 files |
| **3. Types** | NBAStatsBundle interface | 1 file |
| **4. Data Fetching** | MySportsFeeds stats | 2 files |
| **5. Registries** | Factor metadata | 2 files |
| **6. Create Capper** | UI for capper creation | 1 file |
| **7. SHIVA Mgmt** | Configure Factors, Wizard | 2 files |
| **8. Admin Factors** | Factor Strategist, Stat Browser | 2 files |
| **9. Database** | Migration to add factors | 1 new file |
| **10. API Routes** | No changes needed | 0 files |
| **11. Tests** | Optional unit tests | 2 new files |
| **12. Documentation** | BRAIN files | 2 files |

**Total Files to Modify:** ~20 files  
**New Files to Create:** 2-4 files (factor implementations + optional tests + migration)  
**Estimated Time:** 3-4 hours for complete implementation

