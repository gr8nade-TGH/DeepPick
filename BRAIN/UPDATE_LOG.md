# Sharp Siege - Brain Update Log

**Purpose:** Track when the brain was last updated and what changed
**Maintained by:** Brain Agent

---

## 📋 Update History

### 2025-12-03 (Update #24) - NEW FACTORS: Rest Advantage (F7) + Momentum Index (S7)
**Brain Agent:** v1.0
**Trigger:** User requested new factors for capper diversity

**New Factors Added:**

1. **F7: Rest Advantage (TOTALS)**
   - **Key:** `restAdvantage`
   - **Description:** Rest differential between teams. Back-to-backs cause fatigue and lower scoring.
   - **Data:** `restDays`, `isBackToBack` from MySportsFeeds team_gamelogs
   - **Calculation:** `signal = tanh((restDiff + fatigueScore) / 3)`
   - **File:** `src/lib/cappers/shiva-v1/factors/f7-rest-advantage.ts`

2. **S7: Momentum Index (SPREAD)**
   - **Key:** `momentumIndex`
   - **Description:** Team momentum based on win streak and last 10 record. Hot teams cover spreads.
   - **Data:** `winStreak`, `last10Record` from MySportsFeeds team_gamelogs
   - **Calculation:** `momentum = (streak × 0.6) + (last10WinPct × 0.4)`, `signal = tanh(momentumDiff / 5)`
   - **File:** `src/lib/cappers/shiva-v1/factors/s7-momentum-index.ts`

**Files Modified:**
- Factor computation: `f7-rest-advantage.ts`, `s7-momentum-index.ts` (NEW)
- Orchestrators: `nba-totals-orchestrator.ts`, `nba-spread-orchestrator.ts`
- Types: `types.ts` (NBAStatsBundle interface)
- Data fetching: `mysportsfeeds-stats.ts`, `data-fetcher.ts`
- Registries: `factor-registry.ts`, `factor-config-registry.ts`
- Create Capper: `page.tsx` (FACTOR_DETAILS, AVAILABLE_FACTORS, FACTOR_GROUPS)
- SHIVA Management: `factor-config-modal.tsx`, `wizard.tsx`
- Admin Factors: `factor-strategist.tsx`, `stat-browser.tsx`
- Migration: `065_add_f7_s7_factors.sql`
- Documentation: `EDGE_FACTORS_REFERENCE.md`

**Capper Factor Assignments:**
- NEXUS: restAdvantage at 30% (Rest Detective archetype)
- IFRIT/BLITZ: momentumIndex at 25% (Form Rider archetype)
- SHIVA/TITAN: Both factors at 15% (balanced approach)
- SENTINEL: restAdvantage at 20%
- THIEF: momentumIndex at 25%

**Technical Notes:**
- Total factors now: 7 TOTALS + 7 SPREAD (was 6 each)
- Weight budget remains 250% per bet type
- New factors default to 15% weight
- Data fetched from MySportsFeeds team_gamelogs (already fetched, just extracted new fields)

---

### 2025-12-02 18:49 (Update #23) - CONFLUENCE TIER SYSTEM + Pick History Grid + Factor Maker
**Brain Agent:** v1.0
**Trigger:** User requested "brain update" before agent handoff

**Commits Analyzed:** 63 new commits (da2e516 ? 6079b08)
**Date Range:** 2025-11-29 to 2025-11-30
**Current HEAD:** 6079b08

**?? MAJOR ARCHITECTURAL CHANGE:**

**CONFLUENCE TIER SYSTEM** - Complete replacement of old tier grading
- **Old System:** Edge + Team Record + Recent Form + Streak
- **New System:** Confluence-based quality signals (max 8 points)
  - Signal 1: Edge Strength (0-3 pts)
  - Signal 2: Specialization Record (0-2 pts)
  - Signal 3: Win Streak (0-1 pt)
  - Signal 4: Factor Alignment (0-2 pts)
- **Files:** 
  - \src/lib/confluence-scoring.ts\ - SHIVA/PICKSMITH picks
  - \src/lib/manual-pick-confluence.ts\ - Manual picks
- **Tiers:** Legendary (=7.0), Elite (6.0-6.9), Rare (5.0-5.9), Uncommon (4.0-4.9), Common (<4.0)
- **Design Goal:** Common tier = 40-60% of picks (natural distribution)

**MAJOR FEATURES:**

1. **Pick History Grid** (10 commits)
   - Compact grid on main dashboard
   - Timeframe filters (Today/Week/Month/All)
   - Tier filters (Legendary/Elite/Rare/Uncommon/Common)
   - Tier-styled cubes with checkmarks/X marks
   - Tooltips show tier breakdown formula
   - Distinguish LIVE vs SCHEDULED vs STALE picks
   - Won picks in brighter green

2. **Factor Maker System** (8 commits)
   - AI Factor Strategist feature
   - Stat Browser with verified MySportsFeeds stats
   - Pending Factors panel for semi-automated workflow
   - ChatGPT prompt integration for factor recommendations
   - Live factor info with copy button

3. **Become a Capper Redesign** (5 commits)
   - MMO character creation style
   - Editable capper name with uniqueness validation
   - Compact Stats tab with sticky left panel
   - Separate archetypes for TOTAL vs SPREAD
   - Mandatory archetype selection
   - Dynamic title + factor tooltips
   - Merged Stats into Archetype tab

4. **Tier Grading Enhancements** (12 commits)
   - Store tier_grade in pick metadata at generation time
   - One-time backfill endpoint for existing picks
   - Tier calculation info popup in Pick History
   - Enhanced tooltips with full formula breakdown
   - Auto-grade as Common when missing team record/form
   - Bet-type specificity (TOTAL vs SPREAD records separate)
   - Insufficient History capped at Uncommon tier

5. **Pick Testing & Lifecycle** (4 commits)
   - Test lifecycle endpoint for pick testing
   - Margin calculation (Won by X / Lost by X)
   - Handle orphaned picks + cancelled status
   - Enhanced grade-stale-picks with MySportsFeeds scores
   - Optimize sync-game-scores to prevent timeout

6. **Team Abbreviation Normalization** (3 commits)
   - Normalize team abbreviations across the app
   - Fix PICKSMITH game_snapshot to store full team data
   - Format all pick selections with team abbreviations

7. **Insight Card Improvements** (5 commits)
   - Fix insight cards not showing graded results
   - Tooltip clipping fixed using React Portal
   - Enhanced factor tooltip with proper positioning
   - Insight card API maps tier breakdown from new/legacy formats
   - Add computedTier to all API response paths

8. **Capper Stats & Leaderboard** (4 commits)
   - Fix capper stats sync issues (DELETE trigger)
   - Force disable ALL caching on leaderboard API
   - Include all cappers in stats sync
   - Rename 'Today's Elite Picks' to 'Today's Top Featured Picks'

9. **Bug Fixes** (12 commits)
   - Include homeAwaySplits in SPREAD bundle check (null bundle errors)
   - Add bet_type filter to backfill-tiers recent form query
   - Use Vegas market line as baseline (not calculated stats)
   - Fix tier grading to handle 0-10 confidence scale
   - Time filters and sorting for pick history grid
   - Allow any stats for new factors (avoid duplicates)

**FILES MODIFIED:**
- Tier system: \src/lib/confluence-scoring.ts\ (NEW)
- Manual picks: \src/lib/manual-pick-confluence.ts\ (NEW)
- Pick History Grid components
- Factor Maker UI
- Become a Capper page
- Insight card APIs
- Tier grading backfill endpoint

**TECHNICAL NOTES:**
- **Confluence System:** Quality-based, units don't affect tier
- **Bet Type Specificity:** TOTAL and SPREAD records tracked separately
- **Backfill:** One-time endpoint to grade existing picks (check if run)
- **Team Abbreviations:** Normalized across app (DENVERDEN, UUnder, OOver)
- **Caching:** Leaderboard API has persistent caching issues (force disable)
- **Factor Alignment:** New signal in confluence (% of factors agreeing with pick)


### 2025-11-30 16:30 (Update #22) - Pick Grid + Tier System + Diablo-Style Rarity
**Brain Agent:** v1.0
**Trigger:** User requested "brain update"

**Commits Analyzed:** 24 new commits (0c0eba0 ? da2e516)
**Date Range:** 2025-11-29
**Current HEAD:** da2e516

**MAJOR FEATURES:**

1. **Pick Grid Page** (13 commits)
   - New /pick-grid page with consensus heat map view
   - Table layout: rows=games, columns=SPREAD/TOTAL
   - Capper badges with dynamic colors
   - Hover cards showing team-specific capper records
   - LOCK badges for 4+ consensus picks
   - Filter tabs: All/Locks/Hot/Splits
   - Split decisions shown side-by-side with Split indicator
   - Urgency indicators for game times
   - LIVE games sorted to bottom
   - Glowing grid icon link from dashboard

2. **Tier Grading System** (2 commits)
   - Comprehensive tier system with units, team record, 7-day hot streak bonuses
   - Adjusted tier thresholds for better distribution
   - Confidence-based tier assignment

3. **Diablo-Style Rarity System** (2 commits)
   - Insight cards with rarity borders (Legendary/Epic/Rare/Uncommon/Common)
   - Confidence-based tiers with dynamic border colors and glows
   - Visual polish matching Diablo loot system

4. **Accomplishments Banner** (2 commits)
   - Leaderboard accomplishments banner
   - Shows hot streaks, territory kings, milestones
   - Loading state with glows
   - Refined styling

5. **PICKSMITH Enhancements** (3 commits)
   - Custom PICKSMITH insight card with consensus display
   - Contributing cappers grid with stats
   - "Why This Pick" section
   - Added to all capper config maps (dashboard, leaderboard, pick-grid, insight-card)

6. **UI Refinements** (2 commits)
   - Compact horizontal filter bar on leaderboard (no vertical stacking)
   - Match SYSTEM/MANUAL insight cards to PICKSMITH style (grid layouts, larger stat blocks)
   - Direct DB query for territories (removed internal API call)

**FILES MODIFIED:**
- New page: /pick-grid
- Pick grid components (table layout, hover cards, filters)
- Tier grading system
- Insight card rarity system
- Accomplishments banner
- PICKSMITH insight card
- Leaderboard UI

**TECHNICAL NOTES:**
- Pick grid uses table-based layout for better alignment
- LOCK badges appear when 4+ cappers agree
- Split decisions show opposing picks side-by-side
- Diablo-style rarity uses confidence thresholds for tier assignment
- Cache-busting headers added to leaderboard API
- Team name normalization (DENVERDEN, UUnder, OOver)


### 2025-11-29 16:52 (Update #21) - PICKSMITH Meta-Capper + Factor Dashboard + Elite Picks Redesign
**Brain Agent:** v1.0
**Trigger:** User requested "brain update"

**Commits Analyzed:** 21 new commits (baef233 ? 0c0eba0)
**Date Range:** 2025-11-29
**Current HEAD:** 0c0eba0

**MAJOR FEATURES:**

1. **PICKSMITH Meta-Capper System** (6 commits)
   - New consensus meta-capper aggregating picks from multiple system cappers
   - PICKSMITH badge styling for professional dashboard
   - Fixed JSONB team object handling in insight cards
   - Added to dashboard CAPPERS list

2. **Factor Dashboard** (4 commits)
   - New admin page under Admin dropdown
   - Copy Debug button for troubleshooting (stats, samples, health)
   - Merged paceMismatch into homeAwaySplits (renamed factor)
   - Fixed duplicate NavBar issue

3. **Elite Picks Redesign** (3 commits)
   - Card grid layout for Today's Elite Picks
   - Scrollable grid showing 20 elite picks (increased from 6)
   - Better visual presentation

4. **SPREAD Pick Improvements** (2 commits)
   - Team abbreviations (CHI +4.8) instead of AWAY/HOME in insight cards
   - Fixed spread sign, confidence cap at 10, edge calculation
   - Added team stats to AI prompt

5. **Injury Data Fixes** (3 commits)
   - Fresh player_injuries.json endpoint for factor data
   - Fixed injury factor key mismatch
   - Transform injury data for insight cards

6. **Factor Improvements** (3 commits)
   - Replaced S4 Pace Mismatch with Home/Away Performance Splits
   - Updated prediction calculation (1.0x multiplier + factor adjustment)
   - Show Over/Under labels for TOTALS factors (not Away/Home)
   - Extract team names from correct metadata path

**FILES MODIFIED:**
- Factor Dashboard components
- PICKSMITH capper implementation
- Elite Picks grid layout
- Injury data handling
- SPREAD pick generation logic

**TECHNICAL NOTES:**
- PICKSMITH is a consensus meta-capper (aggregates multiple system cappers)
- Factor Dashboard provides admin debugging tools
- Elite Picks now shows 20 picks in scrollable grid
- SPREAD picks now show team abbreviations for better UX


### 2025-11-29 (Update #20) - Major Platform Improvements + Backup System
**Brain Agent:** v1.0
**Trigger:** User requested "brain update" before agent handoff

**Commits Analyzed:** 44 new commits (69e5f4f ? baef233)
**Date Range:** 2025-11-28 to 2025-11-29
**Current HEAD:** baef233

**MAJOR FEATURES:**

1. **Battle Arena V2 Enhancements** (12 commits)
   - Pick selector with horizontal scrolling chips
   - User-specific battles
   - Game countdown timer
   - Fixed projectile visibility bug

2. **Make Picks Page Overhaul** (10 commits)
   - 2-column compact layout
   - Manual pick insight generator
   - Toast fixes and auto-refresh

3. **Capper Profiles** (8 commits)
   - Clickable capper names
   - Public profile pages
   - Null safety fixes

4. **Territory Map/API Fixes** (14 commits)
   - Fixed game_snapshot parsing
   - Supabase query limits
   - Debug logging

5. **System Capper Registry** (1 commit - MAJOR)
   - Centralized in database
   - src/lib/cappers/system-cappers.ts
   - Cached lookups

6. **NEW: Full Backup System**
   - BACKUP_STRATEGY.md created
   - scripts/create-backup.ps1
   - scripts/list-backups.ps1
   - npm run backup commands

**Files Created:**
- BACKUP_STRATEGY.md
- scripts/create-backup.ps1
- scripts/list-backups.ps1
- DETERMINISTIC_BATTLE_PLAN.md

**Current State:**
- Working tree clean
- Ready for deterministic battle implementation
- Backup system in place

---

### 2025-11-29 (Update #19) - Deterministic Battle System Planning
**Brain Agent:** v1.0
**Trigger:** User requested "brain update"

**New Files Created:**
- DETERMINISTIC_BATTLE_PLAN.md - Implementation plan

**Key Decision:**
- Problem: Battles use Math.random() (non-deterministic)
- Solution: Seeded RNG with server-side execution
- 4-phase implementation plan created

---

## 📊 Brain Statistics

**Total Updates:** 24
**Last Updated:** 2025-12-03
**Brain Version:** v1.0
**Total Brain Size:** ~85 KB

**Update Frequency:**
- 2025-12-03: 1 update (New Factors F7 + S7)
- 2025-12-02: 1 update (Confluence Tier System)
- 2025-11-30: 1 update (Pick Grid + Tier System)
- 2025-11-29: 3 updates (PICKSMITH + Major Platform + Deterministic Planning)
- 2025-11-28: 1 update (Checkpoint Tag)
- 2025-11-27: 4 updates (Item System Polish)
- 2025-11-26: 7 updates (Item Implementation)
- 2025-11-25: 6 updates (Naming Convention + Shield Polish)

**Key Milestones:**
- Update #24: New Factors (Rest Advantage + Momentum Index)
- Update #23: Confluence Tier System
- Update #21: PICKSMITH Meta-Capper
- Update #20: Major Platform Improvements (44 commits) + Backup System
- Update #19: Deterministic Battle System Planning
- Update #18: Checkpoint Tag v0.5.0-battle-bets-stable
- Update #17: Diablo-Style Inventory System
