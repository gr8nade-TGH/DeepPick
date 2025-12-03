# Sharp Siege - New Agent Onboarding Prompt

**Last Updated:** 2025-11-25 (Brain Agent v1.0)  
**Copy-paste this entire section to new Augment agents**

---

You are working on **Sharp Siege** (formerly DeepPick), an AI-powered NBA sports betting platform with a real-time battle visualization game.


---


## ?? Recent Updates (Update #21 - 2025-11-29)

### PICKSMITH Meta-Capper
- **Consensus System**: Aggregates picks from multiple system cappers
- **Location**: System capper alongside SHIVA, SHARP, etc.
- **Badge Styling**: Professional dashboard integration
- **Insight Cards**: Handles JSONB team objects properly

### Factor Dashboard (Admin Tool)
- **Path**: Admin dropdown ? Factor Dashboard
- **Features**: 
  - Copy Debug button (stats, samples, health)
  - Factor performance monitoring
  - Merged paceMismatch ? homeAwaySplits
- **Purpose**: Troubleshooting and factor analysis

### Elite Picks Redesign
- **Layout**: Card grid (was list)
- **Capacity**: 20 picks (was 6)
- **UI**: Scrollable grid with better visual presentation

### SPREAD Pick Improvements
- **Display**: Team abbreviations (CHI +4.8) instead of AWAY/HOME
- **Logic**: Fixed spread sign, confidence cap at 10
- **AI Prompt**: Added team stats for better context

### Injury Data Pipeline
- **Endpoint**: Fresh player_injuries.json for real-time data
- **Factors**: Fixed key mismatch in injury factor
- **Transform**: Proper data structure for insight cards


##  Planned Architecture: Deterministic Battle System

**Status:** Planning complete, implementation not started yet
**Reference:** See `DETERMINISTIC_BATTLE_PLAN.md` for full implementation plan

### Problem
Current battles use `Math.random()`, making them non-deterministic:
- Different results every time (can't give fair rewards)
- No single source of truth for rewards
- Can't replay battles after page refresh
- Winner could change between views

### Solution: Seeded RNG for Deterministic Battles

**Architecture:**
1. Server runs battle once when quarter ends (Vercel cron job)
2. Uses `seedrandom` library instead of `Math.random()`
3. Stores result in database (~500 bytes per battle)
4. Client replays with same seed = exact same outcome

**Key Benefits:**
-  Fair rewards (guaranteed outcome)
-  Server-side battle execution
-  Battle replay anytime
-  Knight AI stays smart (still analyzes defense dots)
-  Shared codebase (server + client use same files)
-  Scalable (400 battles/day = 6.7 minutes compute)

**Implementation Phases:**
1. **Phase 1:** Install `seedrandom`, create `DeterministicBattleEngine` class
2. **Phase 2:** Replace all `Math.random()` calls with seeded RNG
3. **Phase 3:** Create server-side battle runner + database table
4. **Phase 4:** Client fetches and replays from database

**Files That Will Change:**
- `src/battle-bets/game/simulation/quarterSimulation.ts`
- `src/battle-bets/game/entities/KnightDefender.ts` (lines 634, 637, 647, 708)
- `src/battle-bets/game/entities/projectiles/BaseProjectile.ts`

**Database Schema (Planned):**
``sql
CREATE TABLE battle_results (
  id UUID PRIMARY KEY,
  game_id TEXT NOT NULL,
  quarter INTEGER NOT NULL,
  battle_seed TEXT NOT NULL,
  left_final_hp INTEGER NOT NULL,
  right_final_hp INTEGER NOT NULL,
  winner TEXT,
  UNIQUE(game_id, quarter)
);
``


##  Current Focus (as of 2025-11-25)

###  CHECKPOINT: v0.5.0-battle-bets-stable (STABLE RECOVERY POINT)

**Tag:** `v0.5.0-battle-bets-stable`  
**Commit:** `3c1ac85851894bca5dcfd829e9cfec9874ede52044`  
**Date:** 2025-11-28 13:14:31 -0600

**This checkpoint represents a STABLE, FULLY WORKING STATE:**
-  All 5 items working perfectly
-  Diablo-style inventory system complete
-  Training Grounds tab working
-  GSAP infinite repeat bug FIXED
-  Winner popup polished
-  Wizard's Watchtower glow working
-  BATTLE_START events firing on all quarters
-  All UI polish complete

** HOW TO RECOVER TO THIS CHECKPOINT:**

If future changes break the game, use these commands:

\\\ash
# RECOMMENDED: Create new branch from checkpoint (preserves current work)
git checkout -b recovery-from-stable v0.5.0-battle-bets-stable

# DESTRUCTIVE: Hard reset to checkpoint (loses uncommitted work)
git reset --hard v0.5.0-battle-bets-stable

# View checkpoint state without changing current branch
git checkout v0.5.0-battle-bets-stable

# Return to main after viewing
git checkout main
\\\

**Recovery Strategy:**
1. Create recovery branch from checkpoint
2. Test that everything works
3. Compare broken code vs checkpoint to find issue
4. Fix and merge back to main

---

###  Just Completed (Latest Session - Diablo-Style Inventory System!)

** NEW FEATURE: Diablo-Style Inventory System (12 commits)**

**Core Implementation:**
-  **Drag-and-drop inventory system** - Diablo-style item management
-  **Diablo 4 inspired item tooltips** - Rich tooltips with rollRanges, description, teamName
-  **Castle visual in equipment slots** - Visual representation of castle slot
-  **Quality-based colors** - Warped=gray, Balanced=blue, Honed=purple, Masterwork=gold
-  **Inventory bar item slots** - Match inventory styling with quality colors
-  **Unified ItemTooltip component** - Same tooltip in inventory and game sidebar

**Tooltip Improvements (6 commits):**
-  Fixed CSS class conflicts (renamed with d4- prefix)
-  Unified tooltips across inventory and battle views
-  Tooltips use portals to escape modal overflow
-  Right-side items show tooltip to the left (better UX)
-  Inventory tooltips match battle tooltips (same data)
-  Use canonical item definition for name/icon (consistency)
-  Made tooltips wider (300-340px) for better readability

**Visual Polish:**
-  Removed gold outline from empty item slots
-  Empty slots use neutral gray
-  Equipped slots use quality-based colors
-  Inventory bar matches inventory modal styling

** NEW FEATURE: Training Grounds Tab**
-  **Added TRAINING GROUNDS tab** - 2 dedicated test battle grids for trying items
-  **Fixed PixiJS destroy errors** - Use same battles to avoid destruction issues
-  **Purpose:** Safe environment to test item combinations without affecting real battles

**Why This Matters:**
- Players can now manage items Diablo-style (drag-and-drop)
- Tooltips are consistent across all views (inventory, battle, sidebar)
- Training Grounds provides safe testing environment
- Quality-based colors make item rarity immediately visible
- Professional, polished inventory experience

---

###  Previously Completed (Earlier - UI Polish + Bug Fixes)

** UI POLISH: Winner Popup Improvements (10 commits)**
-  Enhanced winner treasure chest design (ornate chest with gems and rivets)
-  Added dark background panel for better visibility
-  Centered winner popup positioning (final: x=600, y=85)
-  Aligned under Q2 BATTLE header
-  Fixed DEFEATED text visibility (y=-20 instead of -100)
-  Brought popup to front with zIndex
-  Clear ALL projectiles immediately before showing winner popup
-  Fully opaque background for better contrast

** BUG FIX: Wizard's Watchtower Glow Not Appearing**
-  **Problem:** Purple glow not appearing on last orbs in each row
-  **Root Cause:** Event handlers not being cleaned up on game deactivate, causing duplicates
-  **Fix:** Cleanup registeredHandlers on game deactivate
-  **Enhancement:** Added retry mechanism (up to 10 attempts) for glow application
-  **Enhancement:** Added delay for Wizard glow so sprites exist before applying effect
-  **Debug:** Added Wizard's Watchtower debug info to Copy Debug button

** BUG FIX: BATTLE_START Event Not Firing on All Quarters**
-  **Problem:** BATTLE_START only fired on Q1, not Q2/Q3/Q4
-  **Fix:** Emit BATTLE_START on all quarters (Q1_BATTLE, Q2_BATTLE, Q3_BATTLE, Q4_BATTLE)
-  **Enhancement:** Track activated battles to prevent duplicate activations
-  **CRITICAL:** This was breaking item effects that rely on BATTLE_START

** PERFORMANCE: Projectile Speed Increase**
-  Increased projectile base speed 2X (3  6 cells/sec)
-  Makes battles feel faster and more dynamic

---

###  Previously Completed (Earlier Today - CRITICAL BUG FIX!)

** CRITICAL BUG FIX: GSAP Infinite Repeat Corruption (22 debug commits!)**
-  **Problem:** Game completely froze when castle item equipped (projectiles, counters, everything stopped)
-  **Root Cause:** Infinite repeat GSAP animations (`repeat: -1`) on PixiJS objects corrupt GSAP's internal state
-  **Specifically:** `startIdleAnimation()` (knight bobbing) and `createShieldChargeOrbs()` (orb floating)
-  **Fix:** Commented out infinite repeat animations in KnightDefender.ts
-  **Pattern:** Use finite tweens with `onComplete` callbacks (like patrol does) OR use PixiJS Ticker
-  **NEVER use `repeat: -1` on PixiJS objects - it breaks EVERYTHING!**

**Debugging Journey:**
- 22 commits to isolate the issue
- Tried: GSAP ticker diagnostics, RAF experiments, sprite references, deferred creation
- Isolated by: Disabling ALL knight code  works, enabling patrol only  works, enabling idle  BREAKS
- Conclusion: Infinite repeat animations corrupt GSAP, finite tweens work fine

**Prevention Rules Added:**
-  Rule #11: "Never Use GSAP Infinite Repeat on PixiJS Objects"
-  Rule #12: "Test With All Item Combinations"

---

###  Previously Completed (Earlier Sessions)

** WORKSPACE RULES IMPROVEMENTS (CRITICAL)**
-  **Strengthened "Read the Brain First" rule:**
  - Changed title to "CRITICAL - DO THIS NOW!"
  - Added "STOP!" at the beginning
  - **Required confirmation template** - YOU MUST prove you read the brain by summarizing:
    `
    I've read the brain file. Here's what I learned:
    - Just Completed: [summarize recent changes]
    - Critical Gotchas: [list 2-3 most important]
    - Items Implemented: [current count and list]
    
    What would you like me to work on?
    `
  - Lists specific consequences of skipping (wrong naming, recreating systems, etc.)
-  **New Rule: "Remind User to Update Brain"**
  - Triggers after major features (new items, systems, bug fixes)
  - Provides exact template for reminder message

** CRITICAL BUG FIX: GSAP to RAF Migration (8 commits)**
-  **Problem:** GSAP callbacks not firing in bundled build (knight patrol broken in production)
-  **Root Cause:** GSAP ticker issues in Vite bundled build
-  **Solution:** Migrated ALL animations from GSAP to requestAnimationFrame (RAF)
-  **Files Converted:**
  - Knight patrol animations (KnightDefender.ts)
  - Projectile animations (Projectile.ts, BaseProjectile.ts)
  - Stat counter animations
  - Weapon animations
  - Floating text animations
  - Sparks and collision effects
  - Knight damage tint and shield burst animations

** CRITICAL GOTCHA: Use RAF, Not GSAP for Animations**
-  **DON'T:** Use gsap.to() for animations in PixiJS (callbacks don't fire in bundled build)
-  **DO:** Use equestAnimationFrame (RAF) for all animations
- **Why:** GSAP ticker has issues in Vite bundled builds, RAF is more reliable

---

###  Previously Completed (Earlier Today)

** AUGMENT WORKSPACE RULES CREATED**
-  Created .augment/rules.md with 9 comprehensive rules
-  **Rule #1 (MOST IMPORTANT):** Read the Brain First
  - Forces new agents to read brain before starting any task
  - Points to exact brain file path: C:\Users\Tucke\Documents\augment-projects\Optimize Projects\DeepPick_BRAIN\NEW_AGENT_PROMPT.md
-  **Rule #2:** Copy Debug Button Logging (not web console)
-  **Rule #3:** Emoji Logging Convention
-  **Rule #4:** Always Check for Existing Modules First
-  **Rule #5:** Follow Existing Architecture Patterns
-  **Rule #6:** Modular, Clean Code Practices
-  **Rule #7:** Always Update Existing Tests
-  **Rule #8:** Item Implementation Checklist (4-step registration)
-  **Rule #9:** Event Filtering is CRITICAL (gameId AND side)

** KNIGHT DEFENDER DEBUG IMPROVEMENTS**
-  Added knight patrol logging to Copy Debug button
-  Added detailed GSAP.to logging for knight patrol
-  Fixed knight HP property name, added position to debug report
-  Added knight/castle state to Copy Debug button
-  Unified debug bottom bar for all battle controls

**Why This Matters:**
- **ALL future agents** will automatically follow these 9 rules
- **"Read the Brain First"** ensures agents always have context
- **Copy Debug Button** rule ensures you can easily share feedback
- **No more repeating conventions** - rules enforce them automatically

---

###  Previously Completed (Earlier Today - 57 Commits!)

** CASTLE ITEM SYSTEM - NEW 4TH SLOT!**
-  **Castle Slot Added:** 4th item slot (DEFENSE, POWER, WEAPON, CASTLE)
-  **Castle Items:** Random names, HP 15-40, knight shield charges 1-3
-  **Castle Tooltip:** Detailed description with shield charges
-  **Castle HP Sync:** Visual Castle entity updates when castle item equipped
-  **Knight Deployment:** Castle items spawn Knight Defender units

** 3 NEW ITEMS IMPLEMENTED (Total: 5 items)**

1. **CHA Hornets' Nest** (POWER slot) -  COMPLETE
   - Fires 1-3 retaliatory projectiles when defense orb destroyed
   - +1-5 bonus projectiles if last orb in row destroyed
   - First POWER slot item implemented!

2. **WAS Wizard's Watchtower** (DEFENSE slot) -  COMPLETE
   - Buffs last orb in each row with +1-3 HP and purple glow
   - Creates castle shield (like Ironman Armor)
   - Purple glow visual effect on buffed orbs

3. **MED Knight Defender** (CASTLE slot) -  COMPLETE
   - Summons roaming knight in battlefield zone
   - **Smart Patrol:** Moves to weak lanes, blocks projectiles
   - **Shield Charges:** 1-3 orbs above knight HP bar, auto-recharge every 10s
   - **Defender Mode:** Activates at low HP (+5 HP boost)
   - **Death Animation:** Blood splatter, dramatic fall
   - **SVG Sprites:** Team color tinting

** CRITICAL BUG FIXES (20+ fixes)**
-  Knight spawning (8 commits): circular dependency, castle ID mismatch, PIXI render errors
-  Collision detection: projectiles skipping defense orbs at end of quarter
-  Game flow: Start Game  Q1_IN_PROGRESS (awaiting stats)  Force Q1  Q1_BATTLE
-  Game over detection when castle has shield
-  Units tooltip: React Portal to render above PixiJS canvas
-  Battle-arena-v2: client-side redirect to avoid layout conflict
-  Shortsword speed boost: correct store access (battles Map)
-  Copy Debug button: safety checks for undefined gameId
-  Wizard glow cleanup: proper key management
-  Double knight spawn + collision detection

** VISUAL POLISH (15+ commits)**
- Shield orbs at horse feet (knight)
- Bloody castle destruction animation
- Vary collision effect size by type
- Smaller, more subtle projectile explosions
- Refined knight death animation with blood splatter
- SVG knight sprites with team color tinting
- Awaiting Stats overlay positioning
- Horizontal inline layout for Q1 In Progress status

###  Previously Completed (Earlier This Week)

** CASTLE ITEM SYSTEM - NEW 4TH SLOT!**
-  **Castle Slot Added:** 4th item slot (DEFENSE, POWER, WEAPON, CASTLE)
-  **Castle Items:** Random names, HP 15-40, knight shield charges 1-3
-  **Castle Tooltip:** Detailed description with shield charges
-  **Castle HP Sync:** Visual Castle entity updates when castle item equipped
-  **Knight Deployment:** Castle items spawn Knight Defender units

** 3 NEW ITEMS IMPLEMENTED (Total: 5 items)**

1. **CHA Hornets' Nest** (POWER slot) -  COMPLETE
   - Fires 1-3 retaliatory projectiles when defense orb destroyed
   - +1-5 bonus projectiles if last orb in row destroyed
   - First POWER slot item implemented!

2. **WAS Wizard's Watchtower** (DEFENSE slot) -  COMPLETE
   - Buffs last orb in each row with +1-3 HP and purple glow
   - Creates castle shield (like Ironman Armor)
   - Purple glow visual effect on buffed orbs

3. **MED Knight Defender** (CASTLE slot) -  COMPLETE
   - Summons roaming knight in battlefield zone
   - **Smart Patrol:** Moves to weak lanes, blocks projectiles
   - **Shield Charges:** 1-3 orbs above knight HP bar, auto-recharge every 10s
   - **Defender Mode:** Activates at low HP (+5 HP boost)
   - **Death Animation:** Blood splatter, dramatic fall
   - **SVG Sprites:** Team color tinting

** CRITICAL BUG FIXES (20+ fixes)**
-  Knight spawning (8 commits): circular dependency, castle ID mismatch, PIXI render errors
-  Collision detection: projectiles skipping defense orbs at end of quarter
-  Game flow: Start Game  Q1_IN_PROGRESS (awaiting stats)  Force Q1  Q1_BATTLE
-  Game over detection when castle has shield
-  Units tooltip: React Portal to render above PixiJS canvas
-  Battle-arena-v2: client-side redirect to avoid layout conflict
-  Shortsword speed boost: correct store access (battles Map)
-  Copy Debug button: safety checks for undefined gameId
-  Wizard glow cleanup: proper key management
-  Double knight spawn + collision detection

** VISUAL POLISH (15+ commits)**
- Shield orbs at horse feet (knight)
- Bloody castle destruction animation
- Vary collision effect size by type
- Smaller, more subtle projectile explosions
- Refined knight death animation with blood splatter
- SVG knight sprites with team color tinting
- Awaiting Stats overlay positioning
- Horizontal inline layout for Q1 In Progress status

**Why This Matters:**
- **CASTLE SLOT** opens up new strategies (4th item slot!)
- **Knight Defender** is first "summon unit" item (new mechanic type)
- **5 items implemented** (5.6% of 90 total) - momentum building!
- **Smart Knight AI** shows advanced game mechanics
- **20+ bug fixes** = system maturing and stabilizing

###  Previously Completed (Earlier This Week)

** CRITICAL BUG FIXES - Projectile Collision**
-  **100ce69** - Fix projectiles skipping defense orbs at end of quarter
  - Projectiles were skipping defense orbs when quarter ended
  - Improved Copy Debug error handling
  - Critical fix for item effects to work properly

-  **86b2d50** - Increase projectile collision radius
  - Fast projectiles (from Shortsword speed boosts) were passing through each other
  - Increased collision radius to prevent phase-through
  - Ensures proper collision detection for all projectile speeds

**Why These Fixes Matter:**
- Shortsword speed boosts (+10-25%) made projectiles too fast for old collision detection
- Defense orbs were being skipped at end of quarter (breaking item effects)
- These bugs would have broken the entire item system

###  Previously Completed (Earlier Today)

** NEXT.JS ROUTE ADDED - Battle Arena V2**
-  **6b2b821** - Add Next.js page for battle-arena-v2 route
  - Battle Arena V2 now accessible via Next.js routing (not just standalone HTML)
  - Serves Vite bundle through Next.js
  - Better integration with main app

** DEBUG ENHANCEMENTS**
-  **e452eff** - Enhanced Copy Debug button
  - Now captures ItemEffectRegistry logs
  - Includes bundle version
  - More keywords for better debugging
  - Easier to share debug info with team

** UI POLISH - Final Touches**
-  **e0cf90c** - Remove VS, style countdown timer, fix tooltip z-index
  - Removed VS indicator (cleaner look)
  - Styled countdown timer
  - Fixed tooltip z-index issues
  - Right-align right capper name

-  **2088ff8** - Fix units tooltip z-index
  - Use position:fixed with dynamic JS positioning
  - Tooltip now appears above grid (not behind)
  - Proper layering for all tooltips

###  Previously Completed (Earlier Today)

** SHORTSWORD ENHANCED - Speed Boosts Added!**
-  **Projectile Speed Boosts** (d477101)
  - PTS (Points) stat: +10-25% speed boost
  - Random stat: +10-25% speed boost
  - Speed boosts apply to projectiles fired from support rows
  - Proper timing delay for speed boost application

** GAMEINFO BAR POLISH - 5 More Iterations!**
1. **42c964d** - Redesign to match exact layout: [Rank][Name][Team Spread][Q#][Record]
2. **e334dc1** - Combine pick, units, and record into single box
3. **4a395ab** - Remove Q# indicator, separate units box, fix speed boost % display
4. **6d5272b** - Improve visibility: brighter text, better tooltip styling
5. **663072a** - Fix units tooltip format

** ITEM TOOLTIP IMPROVEMENTS**
-  **Store bonusStat in item rolls** (5017526)
  - Item rolls now store which stat gets the bonus
  - Tooltips display actual stat values (not just generic "bonus")
  - Example: "PTS +15%" instead of "Bonus Stat +15%"
  
-  **Fix tooltip labels** (ad91624)
  - Correct percentage display for speed boosts
  - Proper timing for speed boost application

-  **Detailed logging** (663072a)
  - Added emoji logging for item activation debugging
  - Easier to track item effects in console

** BUG FIXES**
-  Fix PreGameItemSelector props in AppV2 (d03414b)
-  Rebuild battle-arena-v2 with all latest fixes (bcfc6d4)

###  Previously Completed (Earlier Today)

** MAJOR UI/UX POLISH - 13 Commits!**

**Defense Orb Visual Redesign (6 iterations):**
1.  Figma SVG integration (professional sprites) - Reverted
2.  Restore original 3-segment shield Graphics
3.  Simple vertical fill (3 HP segments as fill levels)
4.  Solid shield with brightness/opacity based on HP
5.  Visual cracks (brighter at full HP, subtle crack at 2/3, severe at 1/3)
6.  **FINAL:** Much brighter shields with increased glow - HIGHLY VISIBLE

**Game Info Bar Redesign (5 iterations):**
-  Clean compact single-line layout
-  Fixed widths, smaller rank badges, centered VS
-  Glowing countdown animation
-  Optimized spacing, countdown without prefix text
-  Right capper positioning fixed

**Battle State Management:**
-  Battles start as UPCOMING (scheduled)
-  Auto-switch to LIVE when "Force Q1" is clicked
-  Tabs always visible (ALL/LIVE/UPCOMING/FINAL)

**Attack Node Experiment:**
-  Tried Figma SVG hexagon sprites - Reverted to original weapon balls
-  Original design works better

###  Previously Completed (Earlier Today)

** SECOND ITEM IMPLEMENTED!**
-  **Shortsword (WEAPON slot)** - Fires bonus projectiles from support rows
  - File: `src/battle-bets/game/items/effects/Shortsword.ts`
  - Registered in all 4 required places
  - Uses attack queue system for staggered projectile firing
  - **Items Completed:** 2 of 90 (LAL Ironman Armor, Shortsword)

** BATTLE ARENA V2**
-  **New Tabbed Interface** - ALL/LIVE/UPCOMING/FINAL tabs
  - File: `src/battle-bets/AppV2.tsx`
  - Better organization for viewing multiple battles
  - Correct API endpoint: `/api/battle-bets/active`

** ATTACK QUEUE SYSTEM**
-  **Projectile Firing Improvements**
  - Attack nodes now fire projectiles with 0.5s interval (not all at once)
  - Fixed closure variable capture bug
  - Smoother visual experience

** BUG FIXES**
-  Disabled autoStart - battles only start when "Force Q1" is clicked
-  Fixed initialization errors in Battle Arena V2
-  Corrected API endpoint routing

###  Previously Completed
- **CRITICAL: Item Slot Naming Convention Change** 
  - **OLD:** DEFENSE, ATTACK, SPECIAL/UNIQUE
  - **NEW:** DEFENSE, POWER, WEAPON
  - Slot 1 = DEFENSE ()
  - Slot 2 = POWER () - formerly ATTACK
  - Slot 3 = WEAPON () - formerly SPECIAL/UNIQUE
  - Updated all UI components, icons, and item definitions
  
- **Animation Fixes** 
  - +HP animation stays over castle (doesn't float into game bar)
  - Blue orb animation now visible and appears in correct battle
  - Green orb animation uses global coordinates
  - Screen shake targets correct battle
  - Animations use local coordinates for multi-battle support

- **Shield Visual Redesign** - Professional game design! 
  - 10 commits iterating on shield appearance
  - Final design: 3 triangular sections radiating from bottom center
  - Matches reference image perfectly
  - Smooth curves, 3D depth, glossy gradient
  - Vertical HP segments that follow shield contour
  
- **Shield Healing System Fixes** 
  - Shield heals up to max HP (not infinite growth)
  - Much more visible heal animation (bigger, brighter, slower)
  - Heal animation renders in front of UI
  - Brighter defense dots for better visibility
  
- **Event System Fixes** 
  - Prevent duplicate item activation
  - Check actual shield state before healing
  - Use actual orb HP after damage for DEFENSE_ORB_DESTROYED event
  - Event emission tracking with emoji markers
  
- **Debug Tools Enhanced** 
  - Separate debug button for each battle (not hardcoded to battle 1)
  - Event emission tracking emoji markers
  - Capture emoji marker console logs in debug report

###  Previously Completed
- **Test Mode Infrastructure** - ?testMode=1 URL parameter 
- **Projectile Enhancements** - 3x count, faster speed 
- **Ironman Armor Shield System** - FULLY WORKING! 
- **Diablo-Style Item Tooltips** - Professional game design! 
- **VS/Quarter Display Redesign** 

###  Active Work (RIGHT NOW)
- Testing animations in multi-battle mode
- Preparing to implement more NBA team items
- No uncommitted changes (clean working directory)

###  Next Up
- Implement items for other NBA teams (BOS, GSW, MIA, etc.)
- Each team gets 3 items: DEFENSE, POWER, WEAPON
- Balance item effects and rarity
- Item drop mechanics integration

---

##  Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, TailwindCSS
- **Game Engine:** PixiJS (Battle Bets is separate Vite app)
- **State:** Zustand (multi-game store for up to 4 simultaneous battles)
- **Database:** Supabase (PostgreSQL with RLS)
- **APIs:** MySportsFeeds, OpenAI, Perplexity, The Odds API
- **Deployment:** Vercel (with cron jobs)

---

##  Key Code Locations

### Battle Bets (PixiJS Game)
- **Main Entry:** src/battle-bets/App.tsx
- **Item System:** src/battle-bets/game/items/  RECENTLY COMPLETED
  - items/core/EventBus.ts - Event dispatcher (now using battleEventBus)
  - items/core/EffectRegistry.ts - Item effect registry
  - items/ItemRollSystem.ts - Item stat rolling with quality tiers
  - items/definitions/ - Item definitions (LAL Ironman Armor WORKING!)
  - items/effects/ - Item effect implementations
- **Game Logic:** src/battle-bets/game/
  - entities/Castle.ts - Shield system, HP management, 3 item slots
  - entities/DefenseDot.ts - Defense orbs
  - entities/Projectile.ts
  - managers/ - GridManager, CollisionManager, PixiManager, CastleManager
  - systems/ - BattleStateManager, CastleHealthSystem (healShield method)
  - endering/ - Grid, overlays, effects, green/blue orb animations, shield rendering
  - logic/quarterSimulation.ts - Simultaneous stat row firing
- **Components:**
  - components/game/GameInfoBar.tsx - VS/Quarter display
  - components/game/InventoryBar.tsx - 3 item slots (DEFENSE, POWER, WEAPON)
  - components/ui/PreGameItemSelector.tsx - Item selection with extensive logging
  - components/debug/CopyDebugButton.tsx - Enhanced debug reporting (per-battle)
  - components/debug/ItemTooltip.tsx - Diablo-style tooltips
- **Types:**
  - 	ypes/inventory.ts - Item type definitions
  - 	ypes/game.ts - Game state, stats, defense dots
  - 	ypes/projectileTypes.ts - Projectile configurations
- **State:** src/battle-bets/store/multiGameStore.ts
- **Build:** ite.battle-bets.config.ts

### SHIVA Prediction System
- **7-Step Wizard:** src/app/api/shiva/ (step1-scanner through step7-finalize)
- **Orchestrator:** src/lib/cappers/shiva-wizard-orchestrator.ts
- **Factors:** src/lib/cappers/shiva-v1/factors/
  - TOTALS: F1-F6 (Pace, Offensive Form, Defensive Erosion, etc.)
  - SPREAD: S1-S6 (Net Rating, Turnover Diff, Shooting Efficiency, etc.)
- **Confidence:** src/lib/cappers/shiva-v1/confidence-calculator.ts

### Database
- **Migrations:** supabase/migrations/ (50+ files)
- **Key Tables:** games, picks, cappers, profiles, battle_matchups, user_cappers

### APIs
- **MySportsFeeds:** src/lib/data-sources/mysportsfeeds-api.ts
- **AI Clients:** src/lib/ai/ (perplexity-client, ai-capper-orchestrator)

---

##  CRITICAL: Item Slot Naming Convention

###  CURRENT (Use These!)
- **Slot 1:** DEFENSE () - slot: 'defense'
- **Slot 2:** POWER () - slot: 'power'
- **Slot 3:** WEAPON () - slot: 'weapon'

###  OLD (Don't Use!)
- ~~ATTACK~~  Now called POWER
- ~~SPECIAL~~  Now called WEAPON
- ~~UNIQUE~~  Now called WEAPON

### Code Examples
`	ypescript
// ItemDefinition interface
export interface ItemDefinition {
  id: string;
  team: string;
  teamName: string;
  slot: 'defense' | 'power' | 'weapon'; //  CORRECT
  name: string;
  description: string;
  icon?: string;
  rollRanges: Record<string, StatRollRange>;
}

// InventoryBar.tsx - Slot configuration
const slots = [
  { num: 1, type: 'DEFENSE', icon: '', slotKey: 'slot1' as const },
  { num: 2, type: 'POWER', icon: '', slotKey: 'slot2' as const },
  { num: 3, type: 'WEAPON', icon: '', slotKey: 'slot3' as const }
];
`

---

##  Known Issues (Don't Waste Time On These)

###  Ironman Armor Shield - RESOLVED! 
- **Status:** WORKING as of 2025-11-24 16:30
- **Solution:** Switched to battleEventBus, added green orb animation, fixed event listeners

###  Shield Visual Design - RESOLVED! 
- **Status:** COMPLETE as of 2025-11-25
- **Solution:** 3 triangular sections radiating from bottom center

###  Animation Positioning - RESOLVED! 
- **Status:** COMPLETE as of 2025-11-25
- **Solution:** Use local coordinates for multi-battle support

###  Quarter Debug Controls Overlap (2025-11-24)
- **Status:** 9+ fix attempts, still not perfect
- **Tried:** Inline styles, z-index, absolute positioning, LEFT/RIGHT layout
- **Current:** Using index-based spacing with string position values
- **Note:** Works for 1-2 battles, breaks with 3-4 battles

###  MySportsFeeds Rate Limits (Ongoing)
- **Status:** 30-second backoff implemented
- **Note:** Even with Live tier, occasionally hit 429s
- **Workaround:** Retry logic with exponential backoff

---

##  What NOT to Do

###  Don't Use Old Naming Conventions
1. **Don't use ATTACK** - It's now called POWER
2. **Don't use SPECIAL or UNIQUE** - It's now called WEAPON
3. **Always use lowercase in code:** 'defense' | 'power' | 'weapon'
4. **Always use UPPERCASE in UI:** 'DEFENSE' | 'POWER' | 'WEAPON'

###  Don't Suggest These (Already Decided Against)
1. **Using BLK (blocks) instead of STL (steals)**
   - Migrated on 2025-11-15 because blocks are too rare (1-2 per game)
   - STL provides more dynamic gameplay (3-5 per game)
   
2. **Merging Battle Bets into Next.js**
   - PixiJS conflicts with Next.js SSR
   - Intentionally separate Vite app, embedded in Next.js
   
3. **Referencing players not on roster**
   - AI was hallucinating player stats
   - Now have roster validation in place

4. **Citing ATS/H2H records without data**
   - AI was hallucinating "7-3 ATS" records
   - Now restricted to only use provided data

5. **Using global EventBus for battle events**
   - Use battleEventBus instead (scoped to specific battle)
   - Prevents cross-battle event interference

6. **Circular defense orbs**
   - Tried pixel-art shields with HP bars, reverted to original design

###  Don't Do Without Permission
- Push to GitHub (always ask first)
- Install dependencies (ask first)
- Deploy to production (ask first)
- Change database schema (ask first)

---

##  What TO Do

1. **Use codebase-retrieval** to understand current code before editing
2. **Check recent commits:** git log --oneline -10
3. **Check git status** before editing files: git status --short
4. **Ask what to work on** if unclear from context
5. **Test changes** before committing (write tests if needed)
6. **Read existing docs** in repo (ITEM_SYSTEM_*.md, BATTLE_BETS_HANDOFF.md, etc.)
7. **Use battleEventBus** for battle-scoped events (not global EventBus)
8. **Use ?testMode=1** URL parameter to test items with 2 fake battles
9. **Use correct naming:** DEFENSE, POWER, WEAPON (not ATTACK or SPECIAL)

---

##  Battle Bets Item System (Recently Completed!)

### Architecture
- **Event-Driven:** Items respond to game events (BATTLE_START, DEFENSE_ORB_DESTROYED, etc.)
- **Effect Registry:** Centralized registry for item effects
- **Subsystems:** CastleHealthSystem, ProjectileSystem, DefenseSystem
- **Event Bus:** battleEventBus for battle-scoped events (prevents cross-battle interference)
- **Item Rolling:** Diablo-style stat rolling with quality tiers (Warped, Balanced, Honed, Masterwork)

### Item Slots (3 per Capper)
- **Slot 1 - DEFENSE ():** Shield items, defensive buffs
- **Slot 2 - POWER ():** Attack items, offensive buffs (formerly ATTACK)
- **Slot 3 - WEAPON ():** Special/unique items (formerly SPECIAL/UNIQUE)

### First Item: LAL Ironman Armor  WORKING!
- **ID:** LAL_def_ironman_armor
- **Team:** LAL (Los Angeles Lakers)
- **Slot:** DEFENSE
- **Name:** AC "Ironman" Armor
- **Rarity:** LEGENDARY
- **Effect:** Creates shield on battle start, heals shield when defense orbs destroyed
- **Status:**  **FULLY FUNCTIONAL** (as of 2025-11-24 16:30)
- **Features:**
  - Shield healing on DEFENSE_ORB_DESTROYED event
  - Flying green orb animation from destroyed defense orb to shield
  - Shield max HP increases on heal (capped at max HP)
  - Diablo-style tooltip with rolled stats (5-15 HP range)
  - Item effects activate when APPLY ITEMS clicked
  - Professional shield design with 3 triangular sections
- **Roll Ranges:**
  - startShieldHp: 5-15 HP
  - hpPerDestroyedOrb: 1-3 HP

### Shield Visual Design
- **Final Design:** 3 triangular sections radiating from bottom center
- **Features:** Smooth curves, 3D depth, glossy gradient
- **HP Display:** Vertical segments that follow shield contour
- **Iterations:** 10 commits to perfect the design

### Test Mode for Items
- **URL:** ?testMode=1
- **Creates:** 2 fake battles for testing items
- **Preserves:** Equipped items across game resets
- **Debug:** Extensive logging for item save/activation flow

### Next Steps
- Implement items for 29 other NBA teams
- Each team gets 3 items: DEFENSE, POWER, WEAPON
- Balance rarity and effects
- Item drop mechanics

---

##  Recent Major Changes (Last 24 Hours)

### 2025-11-25 (Last 6 Hours) - Naming Convention + Animation Fixes
-  **CRITICAL: Item Slot Naming Convention Change** (2 commits)
  - e2e7c89: RENAME: Change ATTACK to POWER + update icons
  - e67c189: RENAME: Change SPECIAL/UNIQUE to WEAPON
  
-  **Animation Fixes** (5 commits)
  - 23e89ac: +HP animation stays over castle
  - 4fbe8dc: Animation appears in correct battle + smaller +HP text
  - 9d72910: Blue orb animation visible (use castle.container position)
  - 215f409: Blue orb animation in correct battle (local coordinates)
  - 822a2b4: Green orb animation uses global coordinates + screen shake fix

### 2025-11-25 (Earlier) - Shield Visual Redesign 
-  **Shield Visual Redesign** (10 commits)
  - b556804: 3 triangular sections radiating from bottom center (FINAL)
  - e2354ca: Corrected section boundary math
  - 5b96b59: Shield sections span entire height
  - 64cd3c0: Shield-shaped pie chart
  - f1cf817: Shield segments follow contour with curved edges
  - 90620a0: BEZIER CURVES to follow shield contour
  - 1f1a4f0: Medieval shield with curved/tapered segments
  - 1568695: Professional shield with smooth curves, 3D depth
  - eb7389d: 3 VERTICAL segments with gradient
  - 36d238e: Defense orbs as pixel-art shields (later reverted)
  
-  **Shield Healing System Fixes** (4 commits)
-  **Event System Fixes** (2 commits)
-  **Debug Tools Enhanced** (1 commit)

### 2025-11-24 - MAJOR MILESTONES! 
-  **Test Mode Infrastructure** (11 commits)
-  **Projectile Enhancements** (5 commits)
-  **Ironman Armor FULLY WORKING** (14 commits)
-  **Diablo-Style Tooltips** (4 commits)
-  **VS/Quarter Display Redesign** (5 commits)

---

##  Testing & Debug Workflow

### URL Parameters
``bash
?debug=1              # Shows debug controls
?testMode=1           # Uses fake data (2 battles)
?testItems=ITEM_ID    # Auto-equips item (future feature)
``

### Testing Checklist
1. **Build the game:** `npm run build:battle-game`
2. **Start dev server:** `npm run dev`
3. **Open test mode:** `http://localhost:3000/battle-bets-game?testMode=1`
4. **Equip your item** in Pre-Game Item Selector
5. **Click APPLY ITEMS** to activate
6. **Watch console logs** for emoji markers (, , , , )
7. **Test with 2+ battles** to ensure gameId filtering works
8. **Hard refresh** (Ctrl+Shift+R) after any code changes

### Quality Tier Testing
``typescript
import { rollItemWithTier } from './ItemRollSystem';

// Force specific tier for testing
const warped = rollItemWithTier(ITEM_DEFINITION, 'Warped');
const balanced = rollItemWithTier(ITEM_DEFINITION, 'Balanced');
const honed = rollItemWithTier(ITEM_DEFINITION, 'Honed');
const masterwork = rollItemWithTier(ITEM_DEFINITION, 'Masterwork');
``

### Multi-Battle Testing
- **CRITICAL:** Test with 2+ battles to ensure items only affect their own battle
- Items should filter by `gameId` AND `side`
- Animations should appear in correct battle only

---

##  Quick Start Commands

`ash
# See recent commits
git log --oneline -10

# Check for uncommitted changes
git status --short

# Run dev server
npm run dev

# Build Battle Bets game
npm run build:battle-game

# Test items with fake battles
# Open: http://localhost:3000/battle-bets-game?testMode=1

# Run database migrations
npm run db:migrate
`

---

##  Recent Achievements

### Item Slot Naming Convention (COMPLETE!)
- Changed ATTACK  POWER
- Changed SPECIAL/UNIQUE  WEAPON
- Updated all UI components and icons
- **CRITICAL for new agents to know!**

### Animation Fixes (COMPLETE!)
- 5 commits to fix multi-battle animation positioning
- +HP animation stays over castle
- Blue/green orb animations appear in correct battle
- Use local coordinates for multi-battle support

### Shield Visual Redesign (COMPLETE!)
- 10 commits over 3 hours
- 3 triangular sections radiating from bottom center
- Matches reference image perfectly
- Professional game design aesthetic

### Shield Healing System (COMPLETE!)
- Shield heals up to max HP (not infinite growth)
- Much more visible heal animation
- Prevent duplicate item activation

### Test Mode Infrastructure (COMPLETE!)
- ?testMode=1 creates 2 fake battles
- Preserves equipped items across resets
- Extensive debug logging

### Ironman Armor Shield System (COMPLETE!)
- 14 commits over 2.5 hours
- Shield healing works perfectly
- Green orb animation looks amazing
- **First NBA team item COMPLETE!**

### Key Learnings
- Use **battleEventBus** for battle-scoped events (not global EventBus)
- Use **local coordinates** for multi-battle animations
- Flying animations add polish and visual feedback
- Diablo-style tooltips enhance game feel
- Debug tools are essential for complex systems
- Test mode with fake battles speeds up development
- Iterate on visual design until it matches reference perfectly
- Shield heals should cap at max HP (not grow infinitely)
- **Naming conventions matter** - DEFENSE, POWER, WEAPON (not ATTACK or SPECIAL)

---

**Now ask me: "What should I work on?"**



















---

## ?? Recent Updates (Update #22 - 2025-11-29)

### Pick Grid Page (/pick-grid)
- **Layout**: Table-based (rows=games, columns=SPREAD/TOTAL)
- **Features**:
  - Consensus heat map view with capper badges
  - Hover cards showing team-specific capper records
  - LOCK badges for 4+ consensus picks
  - Filter tabs: All/Locks/Hot/Splits
  - Split decisions shown side-by-side
  - Urgency indicators for game times
  - LIVE games sorted to bottom
- **Access**: Glowing grid icon link from dashboard

### Tier Grading System
- **Tiers**: Legendary/Epic/Rare/Uncommon/Common
- **Bonuses**: Units, team record, 7-day hot streak
- **Calculation**: Confidence-based with adjusted thresholds

### Diablo-Style Rarity System
- **Visual**: Insight cards with rarity borders and glows
- **Tiers**: Confidence-based (Legendary > Epic > Rare > Uncommon > Common)
- **Colors**: Dynamic border colors matching Diablo loot system

### Accomplishments Banner
- **Location**: Leaderboard page
- **Shows**: Hot streaks, territory kings, milestones
- **UI**: Loading state with glows, refined styling

### PICKSMITH Enhancements
- **Custom Card**: Beautiful consensus display
- **Features**: Contributing cappers grid, stats, "Why This Pick" section
- **Integration**: Added to all capper config maps

### UI Refinements
- Compact horizontal filter bar on leaderboard
- SYSTEM/MANUAL insight cards match PICKSMITH style
- Direct DB queries for territories (faster)

---

## ?? Recent Updates (Update #23 - 2025-11-30)

### ?? CONFLUENCE TIER SYSTEM (Major Architectural Change)
**Replaced old tier grading system entirely**

**Old System:** Edge + Team Record + Recent Form + Streak  
**New System:** Confluence-based quality signals (max 8 points)

**Signals:**
1. **Edge Strength** (0-3 pts) - How strong is the edge score?
2. **Specialization Record** (0-2 pts) - Win rate for this bet type
3. **Win Streak** (0-1 pt) - Current consecutive wins
4. **Factor Alignment** (0-2 pts) - % of factors agreeing with pick

**Tiers:**
- Legendary: =7.0 (exceptional, <5% of picks)
- Elite: 6.0-6.9 (strong confluence)
- Rare: 5.0-5.9 (solid confluence)
- Uncommon: 4.0-4.9 (showing promise)
- Common: <4.0 (40-60% of picks by design)

**Files:**
- \src/lib/confluence-scoring.ts\ - SHIVA/PICKSMITH picks
- \src/lib/manual-pick-confluence.ts\ - Manual picks

### Pick History Grid
- Compact grid on main dashboard
- Timeframe filters (Today/Week/Month/All)
- Tier filters (Legendary/Elite/Rare/Uncommon/Common)
- Tier-styled cubes with checkmarks/X marks
- Tooltips show full tier breakdown formula
- Distinguish LIVE vs SCHEDULED vs STALE picks

### Factor Maker System
- AI Factor Strategist feature
- Stat Browser with verified MySportsFeeds stats
- Pending Factors panel for semi-automated workflow
- ChatGPT prompt integration

### Become a Capper Redesign
- MMO character creation style
- Editable capper name with uniqueness validation
- Separate archetypes for TOTAL vs SPREAD
- Mandatory archetype selection
- Compact Stats tab with sticky left panel

### Tier Grading Enhancements
- Store tier_grade in pick metadata at generation time
- One-time backfill endpoint for existing picks
- Tier calculation info popup in Pick History
- Auto-grade as Common when missing team record/form
- Bet-type specificity (TOTAL vs SPREAD separate)
- Insufficient History capped at Uncommon tier

### Critical Bug Fixes
- Include homeAwaySplits in SPREAD bundle check (was causing null errors)
- Add bet_type filter to all tier grading queries
- Team abbreviation normalization (DENVER?DEN, U?Under, O?Over)
- Force disable ALL caching on leaderboard API
- Fix tier grading to handle 0-10 confidence scale (not 0-100)
- PICKSMITH game_snapshot stores full team data

