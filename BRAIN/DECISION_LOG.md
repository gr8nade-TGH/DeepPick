# Sharp Siege - Decision Log

**Purpose:** Historical record of major architectural and design decisions  
**Last Updated:** 2025-11-24 (Brain Agent v1.0)

---

##  Architectural Decisions

### 2025-11-15: BLK  STL Migration
**Problem:** Blocks (BLK) are too rare in NBA games (1-2 per game)  
**Decision:** Migrate to Steals (STL) for defense orb allocation  
**Rationale:**
- STL occurs 3-5 times per game (more dynamic gameplay)
- Better distribution across defense grid
- More engaging battle visualization

**Impact:**
- 15+ files changed
- Defense orb allocation logic rewritten
- All type definitions updated
- GridManager stats array changed

**Lesson Learned:** Always guarantee non-zero stat counts (range [1,4] not [0,3])

**Files Changed:**
- src/battle-bets/game/managers/GridManager.ts
- src/battle-bets/store/multiGameStore.ts
- src/battle-bets/game/logic/defenseAllocation.ts
- All projectile classes

---

### 2025-11-10: Battle Bets as Separate Vite App
**Problem:** PixiJS conflicts with Next.js Server-Side Rendering (SSR)  
**Decision:** Build Battle Bets separately using Vite, embed in Next.js  
**Rationale:**
- PixiJS requires browser APIs (window, canvas, WebGL)
- Next.js SSR runs on server (no browser APIs)
- Attempting to merge causes hydration errors

**Impact:**
- Dual build process (
pm run build + 
pm run build:battle-game)
- Battle Bets built to public/battle-bets-game/
- Clean separation of concerns
- Easier to debug and develop

**Lesson Learned:** Don't fight the framework. Embrace separation when tools conflict.

**Build Config:** ite.battle-bets.config.ts

---

### 2025-11-08: Multi-Game State Management (Zustand)
**Problem:** Need to support 4 simultaneous battles on one page  
**Decision:** Use Zustand with Map-based storage for battle-scoped state  
**Rationale:**
- Redux too heavy for this use case
- React Context causes unnecessary re-renders
- Zustand is lightweight and performant
- Map allows O(1) lookup by battleId

**Impact:**
- multiGameStore.ts created
- Each battle has isolated state
- No cross-battle interference
- Supports dynamic battle creation/removal

**Architecture:**
`	ypescript
interface MultiGameStore {
  battles: Map<battleId, BattleState>;
  addBattle: (battleId, game) => void;
  updateBattle: (battleId, updates) => void;
  removeBattle: (battleId) => void;
}
`

**Files:**
- src/battle-bets/store/multiGameStore.ts

---

### 2025-11-01: Event-Driven Item System
**Problem:** Need flexible, extensible item system for 30 NBA teams  
**Decision:** Event-driven architecture with effect registry  
**Rationale:**
- Items respond to game events (BATTLE_START, DEFENSE_ORB_DESTROYED, etc.)
- Centralized effect registry for reusability
- Subsystems (health, projectiles, defense) are decoupled
- Easy to add new items without modifying core game logic

**Impact:**
- EventBus created for pub/sub pattern
- EffectRegistry for modular effects
- Items defined declaratively (JSON-like)
- First item (LAL Ironman Armor) implemented

**Architecture:**
`	ypescript
EventBus.emit('BATTLE_START', { battleId, capper });
// Item listens and activates effect
EffectRegistry.execute('CREATE_SHIELD', { battleId, capper });
`

**Files:**
- src/battle-bets/game/items/core/EventBus.ts
- src/battle-bets/game/items/core/EffectRegistry.ts
- src/battle-bets/game/items/definitions/

---

##  AI & Prediction Decisions

### 2025-11-23: AI Hallucination Prevention
**Problem:** AI was inventing statistics and player references  
**Decision:** Add strict validation and data-only restrictions  
**Rationale:**
- AI cited "7-3 ATS" records without data
- AI referenced players not on roster (Jimmy Butler on Heat)
- AI invented recent scoring trends ("120+ in 3 of last 5")

**Solutions Implemented:**
1. **Roster Validation** - Only mention players in injury report or stats
2. **ATS/H2H Restrictions** - Don't cite unless provided
3. **Travel/Rest Restrictions** - Don't cite unless provided
4. **Recent Trends Restrictions** - Don't cite without game logs

**Impact:**
- More accurate AI analysis
- Fewer hallucinated facts
- Better user trust

**Files:**
- src/app/api/shiva/step6-bold-predictions/route.ts
- src/app/api/shiva/step7-finalize/route.ts

---

### 2025-11-23: Confidence Recalibration System
**Problem:** Picks had high confidence despite data quality issues  
**Decision:** Add 4-penalty recalibration system  
**Rationale:**
- Large market disagreement indicates stale/soft odds
- Missing team stats means AI will hallucinate
- Missing injury data makes S6 factor inaccurate
- Total edge discrepancy for SPREAD picks is red flag

**Penalties:**
1. **Market Disagreement** - Edge >5pts (SPREAD) or >10pts (TOTAL)
2. **Total Edge Discrepancy** - >10pts for SPREAD picks
3. **Missing Team Stats** - AI will hallucinate
4. **Missing Injury Data** - S6 factor inaccurate

**Impact:**
- Confidence drops if data quality is poor
- Converts to PASS if confidence <6.5
- All penalties logged in metadata

**Files:**
- src/app/api/shiva/step7-finalize/route.ts

---

### 2025-11-23: Injury Gating Removed
**Problem:** Injury gating was blocking too many picks  
**Decision:** Remove gating, use S6 injury factor instead  
**Rationale:**
- Injuries should affect confidence, not block picks
- S6 factor calculates injury differential (away - home)
- More nuanced than binary gate

**Impact:**
- More picks generated
- Injuries still factored into confidence
- Spread validation remains (prevents favorite/dog errors)

**Files:**
- src/app/api/shiva/step7-finalize/route.ts
- src/lib/cappers/shiva-v1/factors/s6-injury-availability.ts

---

##  Database Decisions

### 2025-11-22: Materialized View for Capper Stats
**Problem:** Leaderboard queries were slow (joining picks, games, cappers)  
**Decision:** Create capper_stats materialized view  
**Rationale:**
- Pre-computed stats (total picks, win rate, net units)
- Refreshed every 15 minutes
- O(1) lookup instead of complex joins

**Impact:**
- Leaderboard loads 10x faster
- Single source of truth for capper stats
- Easier to maintain

**Files:**
- supabase/migrations/065_create_capper_stats_view.sql

---

##  UI/UX Decisions

### 2025-11-24: Item Popup Workflow
**Problem:** Item selection was confusing (auto-close, no save button)  
**Decision:** Two-view popup (main overview + item picker)  
**Rationale:**
- Main view shows all 6 slots (3 left, 3 right)
- Click slot to open item picker
- Back button returns to main view (popup stays open)
- Save & Close button saves and closes entire popup

**Impact:**
- Better UX (no accidental closes)
- Clear save workflow
- Item persistence in battle state

**Files:**
- src/battle-bets/components/ui/PreGameItemSelector.tsx
- src/battle-bets/App.tsx

---

##  Technical Decisions

### 2025-11-23: MySportsFeeds Rate Limiting
**Problem:** Hitting 429 rate limits even with Live tier  
**Decision:** 30-second backoff with exponential retry  
**Rationale:**
- MySportsFeeds has aggressive rate limits
- 30-second backoff prevents cascading failures
- Exponential retry handles transient errors

**Impact:**
- Fewer 429 errors
- More reliable data fetching
- Better error handling

**Files:**
- src/lib/data-sources/mysportsfeeds-api.ts

---

### 2025-11-23: Grid-Based Collision Detection
**Problem:** Distance-based collision was unreliable (ghost projectiles)  
**Decision:** Use grid cell lookup instead of distance calculations  
**Rationale:**
- Grid cells are discrete (no floating-point errors)
- O(1) lookup by cellId
- More predictable behavior

**Impact:**
- Collision detection is 100% reliable
- No more ghost projectiles
- Simpler debugging

**Files:**
- src/battle-bets/game/managers/CollisionManager.ts

---

##  Notes for Future Decisions

### Patterns to Follow
- **Event-driven** for extensibility
- **Data validation** to prevent AI hallucination
- **Separation of concerns** when tools conflict
- **Materialized views** for performance
- **Grid-based** for deterministic behavior

### Patterns to Avoid
- **Distance-based** collision (floating-point errors)
- **Tight coupling** between systems
- **Blocking gates** (use confidence penalties instead)
- **Auto-close popups** (bad UX)

---

**Brain Agent Notes:**
- This log captures "why" decisions were made
- New agents should read this to avoid repeating past mistakes
- Update this log when major decisions are made

---

### 2025-11-24: Battle-Scoped Event Bus (battleEventBus)
**Problem:** Global EventBus caused cross-battle event interference in multi-battle mode  
**Decision:** Use battle-scoped eventBus instance instead of global EventBus  
**Rationale:**
- Multi-battle mode supports 4 simultaneous battles
- Global EventBus would trigger item effects in ALL battles
- Each battle needs isolated event system
- Prevents shield healing in wrong battle

**Impact:**
- Ironman Armor shield healing now works correctly
- DEFENSE_ORB_DESTROYED events scoped to specific battle
- Item effects only trigger in correct battle
- 14 commits to debug and fix event flow

**Solution:**
``typescript
// OLD (global - caused cross-battle interference)
EventBus.emit('DEFENSE_ORB_DESTROYED', { battleId, capper });

// NEW (battle-scoped - works correctly)
battleEventBus.emit('DEFENSE_ORB_DESTROYED', { battleId, capper });
``

**Lesson Learned:** Always use battle-scoped instances in multi-battle mode. Global singletons cause interference.

**Files:**
- `src/battle-bets/game/items/effects/ironman-armor-effect.ts`
- `src/battle-bets/App.tsx`

---

### 2025-11-24: Diablo-Style Item Tooltips
**Problem:** Bland browser tooltips didn't convey item quality or rolled stats  
**Decision:** Implement Diablo-style tooltips with quality tiers and roll ranges  
**Rationale:**
- Players need to see actual rolled stats (e.g., "4 Shield Strength (3-8)")
- Quality tiers (Common, Rare, Legendary) need visual distinction
- Max rolls should glow to feel rewarding
- Authentic game feel increases engagement

**Impact:**
- Professional game design aesthetic
- Players can see exact rolled values
- Max rolls glow with visual hierarchy
- Creative stat descriptions enhance flavor

**Design:**
- Gold text for Legendary items
- Glowing effect for max rolls
- Bullet points for clean layout
- Roll ranges shown in parentheses (e.g., "4 (3-8)")

**Files:**
- `src/battle-bets/components/ui/InventoryBar.tsx`
- `src/battle-bets/game/items/definitions/`


---

### 2025-11-25: Item Slot Naming Convention Change
**Problem:** Original naming (DEFENSE, ATTACK, SPECIAL/UNIQUE) was inconsistent and confusing  
**Decision:** Rename to DEFENSE, POWER, WEAPON for clarity and consistency  
**Rationale:**
- "ATTACK" was too generic and didn't convey the slot's purpose
- "SPECIAL" and "UNIQUE" were used interchangeably, causing confusion
- "POWER" better represents offensive/attack items
- "WEAPON" is more intuitive for special/unique items
- Consistent 3-slot system: DEFENSE (), POWER (), WEAPON ()

**Impact:**
- Updated all UI components (InventoryBar, PreGameItemSelector, ItemTooltip)
- Updated item definitions (ItemDefinition interface)
- Updated icons: DEFENSE (), POWER (), WEAPON ()
- All future items must use new naming convention

**Migration:**
``typescript
// OLD (don't use)
slot: 'attack' | 'special' | 'unique'

// NEW (use this)
slot: 'defense' | 'power' | 'weapon'
``

**Files Changed:**
- `src/battle-bets/components/game/InventoryBar.tsx`
- `src/battle-bets/components/debug/PreGameItemSelector.tsx`
- `src/battle-bets/game/items/ItemRollSystem.ts`
- All item definition files

**Lesson Learned:** Establish naming conventions early and stick to them. Renaming later requires updating many files.

