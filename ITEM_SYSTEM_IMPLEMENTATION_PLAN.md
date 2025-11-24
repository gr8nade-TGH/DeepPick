# 🎮 Battle Bets Item System - Complete Implementation Plan

## 📊 EXECUTIVE SUMMARY

**Current State:**
- ✅ 2 items fully functional (Blue Orb Shield, Fire Orb)
- ✅ Basic item equipping system working
- ✅ Shield system operational
- ✅ Event system partially implemented
- ❌ 60 NBA team items designed but not implemented
- ❌ Item roll system not implemented
- ❌ Generic item engine not implemented

**Goal:** Build a scalable item engine that supports all 60 NBA team items without hardcoding each one.

**Timeline:** 2-3 weeks for full implementation

---

## 🏗️ ARCHITECTURE ASSESSMENT

### What We Have ✅

**1. Item Infrastructure (Partial)**
- `src/battle-bets/types/inventory.ts` - Item type definitions
- `src/battle-bets/game/entities/Castle.ts` - Item equipping logic (3 slots)
- `src/battle-bets/game/systems/CastleHealthSystem.ts` - Shield management
- `src/battle-bets/components/game/InventoryBar.tsx` - Visual item slots
- `src/battle-bets/components/game/InventoryPopup.tsx` - Item selection UI

**2. Working Examples**
- **Blue Orb Shield:** Hardcoded shield activation at HP < 3
- **Fire Orb:** Hardcoded projectile firing when stat row loses all defense orbs

**3. Event System (Partial)**
- `src/battle-bets/game/events/types.ts` - Event type definitions
- Events defined: BATTLE_START, QUARTER_START, PROJECTILE_FIRED, etc.
- ❌ Event emitter/listener system NOT implemented

### What We Need ❌

**1. Generic Item Engine**
- Event emitter/listener system
- Item roll system (generate random stats when won from chest)
- Item effect registration system
- Counter tracking per item instance

**2. Core Subsystems**
- Defense orb manipulation API
- Shield creation/management API (expand current system)
- Projectile injection API
- Stat tracking API (quarter stats, score differential)

**3. Database Schema**
- Store rolled item stats per capper
- Track item ownership and quality tiers
- Battle matchup item loadouts

---

## 🎯 RECOMMENDED APPROACH

### Phase 1: Foundation (Week 1) ⭐ START HERE

**Goal:** Build the generic item engine infrastructure

**Tasks:**
1. **Event System** (2 days)
   - Create EventEmitter class
   - Integrate with existing game loop
   - Emit events at key moments (QUARTER_START, PROJECTILE_FIRED, etc.)
   - Test event firing with console logs

2. **Item Roll System** (1 day)
   - Create `ItemRollSystem` class
   - Implement roll generation (min/max ranges)
   - Calculate quality tiers (Warped, Balanced, Honed, Masterwork)
   - Store rolled stats in database

3. **Item Effect Registration** (2 days)
   - Create `ItemEffectRegistry` class
   - Allow items to register event listeners
   - Implement counter tracking per item instance
   - Create helper functions (getItemCounter, incrementItemCounter, etc.)

**Deliverables:**
- ✅ Event system firing all required events
- ✅ Item roll system generating random stats
- ✅ Items can register effects and listen to events
- ✅ Counter tracking working

---

### Phase 2: Core Subsystems (Week 2)

**Goal:** Build the APIs items need to interact with the game

**Tasks:**
1. **Defense Orb API** (2 days)
   - `addDefenseOrb(side, lane, hp)` - Add single orb
   - `addDefenseOrbs(side, lane, count, hp)` - Add multiple orbs
   - `buffRandomOrbs(side, count, hpDelta)` - Energize random orbs
   - `getWeakestLane(side)` - Find lane with fewest orbs
   - Emit DEFENSE_ORB_DESTROYED events

2. **Shield API Expansion** (1 day)
   - Support multiple shield types (STATIC, REFRESH_EACH_QUARTER, REGENERATING, etc.)
   - `createShield(side, kind, hp, options)` - Create shield with metadata
   - `healShield(shieldId, hpDelta)` - Refill shield HP
   - `updateShieldMeta(shieldId, patch)` - Update shield metadata

3. **Projectile Injection API** (2 days)
   - `fireProjectiles(side, lane, count, options)` - Fire extra projectiles from items
   - Support projectile HP (for Magic Missiles)
   - Tag projectiles with source (BASE vs ITEM)
   - Emit PROJECTILE_FIRED events

4. **Stat Tracking API** (1 day)
   - `getQuarterStats(side, quarter)` - Get stats for specific quarter
   - `getPreviousQuarterStats(side, currentQuarter)` - Get last quarter's stats
   - `getScore(side)` - Get current score
   - Track 3PT makes, assists, rebounds, etc.

**Deliverables:**
- ✅ All subsystem APIs functional
- ✅ Items can manipulate defense orbs, shields, projectiles
- ✅ Stat tracking available for conditional items

---

### Phase 3: Implement First 12 Items (Week 2-3)

**Goal:** Implement the 12 approved items using the generic engine

**Priority Order:**
1. **LAL - AC "Ironman" Armor** (Defense) - Shield with orb-based HP gain
2. **LAL - Black Mamba Ring** (Attack) - Extra PTS/3PT projectiles
3. **GSW - Golden Shield** (Defense) - Quarter-refresh shield based on 3PT makes
4. **GSW - Curry-fire Gauntlets** (Attack) - Extra 3PT projectiles, Q4 multiplier
5. **PHX - Steve Nash Tower** (Defense) - Second HP bar from assists
6. **PHX - Sun Ring** (Attack) - PTS conversion + Final Blow bonus
7. **LAC - Clippers' Greaves** (Defense) - Redistribute destroyed orbs
8. **LAC - Lob City Amulet** (Attack) - AST/REB → PTS conversion
9. **SAC - Keep of Kings** (Defense) - Emergency shield at low HP
10. **SAC - Kings' Greatsword** (Attack) - Retaliation projectiles
11. **CHA - Hornets' Nest** (Defense) - Retaliatory projectiles on orb destruction
12. **WAS - Wizards' Watchtower** (Defense) - Conditional shield when losing

**Implementation Pattern:**
```typescript
// Example: LAL AC "Ironman" Armor
export function registerIronmanArmor(context: ItemRuntimeContext) {
  const { side, rolls } = context;
  const { startShieldHp, hpPerDestroyedOrb } = rolls;

  // BATTLE_START: Create shield
  on('BATTLE_START', (payload) => {
    if (payload.side !== side) return;
    const shieldId = createShield(side, 'STATIC', startShieldHp, {
      maxHp: startShieldHp,
      canRefill: true,
      meta: { hpPerDestroyedOrb }
    });
    setItemCounter(context.itemInstanceId, 'shieldId', shieldId);
  });

  // DEFENSE_ORB_DESTROYED: Add HP to shield
  on('DEFENSE_ORB_DESTROYED', (payload) => {
    if (payload.side !== side) return;
    const shield = getShield(side);
    if (!shield) return;
    healShield(shield.id, hpPerDestroyedOrb);
  });
}
```

**Deliverables:**
- ✅ 12 items fully functional
- ✅ Items use generic engine (no hardcoding)
- ✅ Quality tiers working
- ✅ Visual effects for each item

---

## 📁 FILE STRUCTURE

```
src/battle-bets/
├── game/
│   ├── items/
│   │   ├── ItemEngine.ts              # NEW - Main item engine
│   │   ├── EventEmitter.ts            # NEW - Event system
│   │   ├── ItemRollSystem.ts          # NEW - Roll generation
│   │   ├── ItemEffectRegistry.ts      # NEW - Effect registration
│   │   ├── effects/                   # NEW - Individual item effects
│   │   │   ├── LAL_IronmanArmor.ts
│   │   │   ├── LAL_BlackMambaRing.ts
│   │   │   ├── GSW_GoldenShield.ts
│   │   │   └── ... (60 total)
│   │   ├── FireOrb.ts                 # EXISTING - Refactor to use engine
│   │   └── ITEM_ENGINE_SPEC.md        # EXISTING - Reference spec
│   ├── systems/
│   │   ├── DefenseOrbSystem.ts        # NEW - Defense orb API
│   │   ├── ShieldSystem.ts            # EXPAND - Enhanced shield API
│   │   ├── ProjectileSystem.ts        # NEW - Projectile injection API
│   │   └── StatTrackingSystem.ts      # NEW - Stat tracking API
│   └── ...
├── types/
│   ├── inventory.ts                   # EXPAND - Add rolled stats types
│   └── ...
└── ...
```

---

## 🗄️ DATABASE SCHEMA

### New Tables Needed

**1. `capper_items` - Store owned items with rolled stats**
```sql
CREATE TABLE capper_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capper_id UUID REFERENCES user_cappers(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL, -- e.g., 'LAL_def_ironman_armor'
  rolled_stats JSONB NOT NULL, -- { startShieldHp: 7, hpPerDestroyedOrb: 2 }
  quality_tier TEXT NOT NULL, -- 'Warped', 'Balanced', 'Honed', 'Masterwork'
  acquired_at TIMESTAMP DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE,
  equipped_slot INTEGER, -- 1, 2, or 3
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_capper_items_capper ON capper_items(capper_id);
CREATE INDEX idx_capper_items_equipped ON capper_items(capper_id, is_equipped);
```

**2. `battle_item_loadouts` - Track items used in specific battles**
```sql
CREATE TABLE battle_item_loadouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID REFERENCES battle_matchups(id) ON DELETE CASCADE,
  capper_id UUID REFERENCES user_cappers(id) ON DELETE CASCADE,
  side TEXT NOT NULL, -- 'left' or 'right'
  slot1_item_id UUID REFERENCES capper_items(id),
  slot2_item_id UUID REFERENCES capper_items(id),
  slot3_item_id UUID REFERENCES capper_items(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_battle_loadouts_battle ON battle_item_loadouts(battle_id);
```

**3. Expand `battle_matchups` table**
```sql
ALTER TABLE battle_matchups
  ADD COLUMN left_items JSONB, -- Snapshot of left capper's items
  ADD COLUMN right_items JSONB; -- Snapshot of right capper's items
```

---

## 🔌 API ENDPOINTS

### Item Management

**1. `GET /api/battle-bets/items/inventory`**
- Get capper's owned items
- Returns: Array of items with rolled stats and quality tiers

**2. `POST /api/battle-bets/items/equip`**
- Equip item to slot
- Body: `{ itemId: UUID, slot: 1 | 2 | 3 }`

**3. `POST /api/battle-bets/items/unequip`**
- Unequip item from slot
- Body: `{ slot: 1 | 2 | 3 }`

**4. `POST /api/battle-bets/items/roll`** (Admin/Testing)
- Generate a new item with random rolls
- Body: `{ itemId: string, capperId: UUID }`
- Returns: Rolled item with stats and quality tier

### Battle Integration

**5. `GET /api/battle-bets/[battleId]/loadouts`**
- Get item loadouts for both cappers in a battle
- Returns: Left and right capper equipped items

---

## 🎨 VISUAL DESIGN

### Item Quality Tiers

**Visual Indicators:**
- **Warped** (Weak roll) - Gray border, no glow
- **Balanced** (Average roll) - Blue border, subtle glow
- **Honed** (Good roll) - Purple border, medium glow
- **Masterwork** (Perfect roll) - Gold border, strong glow, particle effects

**Item Slot Display:**
- Show item icon with quality tier border
- Tooltip shows rolled stats (e.g., "Shield HP: 7/8, +2 HP per orb")
- Pulsing animation when item activates

### In-Battle Effects

**Shield Visuals:**
- Different colors per item (Ironman = silver, Golden Shield = gold, etc.)
- HP bar above castle showing shield HP
- Break animation when shield depletes

**Projectile Visuals:**
- Item projectiles have unique colors/trails
- Tag projectiles with item icon
- Special effects for high-tier items

---

## 🧪 TESTING STRATEGY

### Phase 1: Unit Tests
- Test event emitter (subscribe, emit, unsubscribe)
- Test roll system (min/max ranges, quality tier calculation)
- Test counter tracking (increment, reset, get)

### Phase 2: Integration Tests
- Test item effects with mock events
- Test defense orb manipulation
- Test shield creation/healing
- Test projectile injection

### Phase 3: End-to-End Tests
- Test full battle with items equipped
- Test item activation triggers
- Test visual effects
- Test database persistence

### Phase 4: Balance Testing
- Test all 12 items in real battles
- Adjust roll ranges if items too weak/strong
- Test edge cases (multiple shields, orb overflow, etc.)

---

## ⚠️ CRITICAL DECISIONS

### Decision 1: Event System Architecture

**Option A: Global Event Bus** ⭐ RECOMMENDED
- Single EventEmitter instance
- All items subscribe to global events
- Pros: Simple, easy to debug, centralized
- Cons: Potential performance issues with many items

**Option B: Per-Battle Event Bus**
- Each battle has its own EventEmitter
- Items scoped to specific battle
- Pros: Better performance, isolated state
- Cons: More complex, harder to debug

**Recommendation:** Start with Option A, migrate to Option B if performance issues arise.

### Decision 2: Item Effect Storage

**Option A: Database-Driven**
- Store item effect logic in database as JSON
- Interpret at runtime
- Pros: Can add items without code deploy
- Cons: Complex interpreter, limited flexibility

**Option B: Code-Driven** ⭐ RECOMMENDED
- Each item is a TypeScript file
- Register effects in code
- Pros: Full TypeScript power, easier to debug
- Cons: Requires code deploy for new items

**Recommendation:** Option B for now (faster development), migrate to Option A later for scalability.

### Decision 3: Item Activation Timing

**Question:** When do items activate in a battle?

**Answer:**
- Items are **locked in** when battle is created (snapshot in `battle_matchups.left_items/right_items`)
- Items activate based on their triggers (BATTLE_START, QUARTER_START, etc.)
- Changing equipped items mid-battle does NOT affect active battles
- Only affects future battles

---

## 📈 SUCCESS METRICS

### Phase 1 Success Criteria
- ✅ Event system fires 100+ events per battle
- ✅ Item roll system generates 1000+ unique item instances
- ✅ Counter tracking handles 50+ counters per item
- ✅ Zero memory leaks after 100 battles

### Phase 2 Success Criteria
- ✅ Defense orb API adds/removes orbs correctly
- ✅ Shield API creates/heals shields correctly
- ✅ Projectile API fires extra projectiles correctly
- ✅ Stat tracking returns accurate quarter stats

### Phase 3 Success Criteria
- ✅ All 12 items functional in real battles
- ✅ Visual effects render correctly
- ✅ Database persistence working
- ✅ No crashes or errors in 100 test battles

---

## 🚀 DEPLOYMENT PLAN

### Week 1: Foundation
- Deploy event system to staging
- Deploy roll system to staging
- Test with existing Blue Orb Shield and Fire Orb

### Week 2: Core Subsystems
- Deploy defense orb API to staging
- Deploy shield API expansion to staging
- Deploy projectile injection API to staging
- Deploy stat tracking API to staging

### Week 3: First 12 Items
- Deploy 4 items per day to staging
- Test each item thoroughly
- Fix bugs and balance issues
- Deploy to production when all 12 items stable

### Week 4: Remaining 48 Items (Optional)
- Deploy 8 items per day to staging
- Focus on high-priority teams first
- Production deploy in batches of 12

---

## 🎯 IMMEDIATE NEXT STEPS (Tonight)

Since you're going to sleep and don't want prompts for approval, here's what I'll implement:

### Step 1: Create Event System ✅
**File:** `src/battle-bets/game/items/EventEmitter.ts`
- Implement subscribe, emit, unsubscribe methods
- Add TypeScript types for all events
- Support event filtering by gameId

### Step 2: Create Item Roll System ✅
**File:** `src/battle-bets/game/items/ItemRollSystem.ts`
- Implement roll generation with min/max ranges
- Implement quality tier calculation
- Parse item definitions from nba-team-items.txt

### Step 3: Create Item Effect Registry ✅
**File:** `src/battle-bets/game/items/ItemEffectRegistry.ts`
- Implement counter tracking per item instance
- Implement effect registration
- Support multiple items per battle

### Step 4: Create Core Subsystems ✅
**Files:**
- `src/battle-bets/game/systems/DefenseOrbSystem.ts` - Defense orb manipulation API
- `src/battle-bets/game/systems/ProjectileSystem.ts` - Projectile injection API
- `src/battle-bets/game/systems/StatTrackingSystem.ts` - Stat tracking API

### Step 5: Integrate Event System ✅
**Files to modify:**
- `src/battle-bets/store/multiGameStore.ts` - Emit events at key moments
- `src/battle-bets/game/entities/Castle.ts` - Emit CASTLE_DAMAGED events

### Step 6: Create First Item Effect ✅
**File:** `src/battle-bets/game/items/effects/LAL_IronmanArmor.ts`
- Implement using generic engine
- Test with rolled stats
- Add visual effects

### Step 7: Update Types ✅
**File:** `src/battle-bets/types/inventory.ts`
- Add RolledItemStats interface
- Add ItemRuntimeContext interface
- Add quality tier types

### Step 8: Create Testing Utilities ✅
**File:** `src/battle-bets/game/items/ItemTestUtils.ts`
- Helper functions to equip items in debug mode
- Mock item roll generation
- Event logging for debugging

---

## 📚 REFERENCE MATERIALS

**Key Files to Study:**
1. `nba-team-items.txt` - All 60 item designs
2. `src/battle-bets/game/items/ITEM_ENGINE_SPEC.md` - Technical spec
3. `src/battle-bets/game/items/FireOrb.ts` - Working item example
4. `src/battle-bets/types/inventory.ts` - Current item types

**Key Concepts:**
- Event-driven architecture
- Randomized item rolls (like Diablo/Path of Exile)
- Quality tiers (Warped < Balanced < Honed < Masterwork)
- Counter-based triggers (every X projectiles, every Y orbs destroyed)

---

## ✅ FINAL RECOMMENDATION

**Start with Phase 1 (Event System + Roll System + Effect Registry)**

This is the foundation everything else builds on. Once this is solid, the rest will be straightforward.

**Timeline:**
- **Tonight:** Build foundation (Steps 1-8 above) - ~3 hours
- **Week 1:** Complete Phase 1 (event system, roll system, effect registry)
- **Week 2:** Complete Phase 2 (core subsystems)
- **Week 3:** Complete Phase 3 (first 12 items)

**By end of Week 3, you'll have:**
- ✅ Generic item engine working
- ✅ 12 NBA team items functional
- ✅ Database persistence
- ✅ Visual effects
- ✅ Ready to scale to remaining 48 items

**Let's build this! 🏀⚔️🎮**

---

## 🔥 IMPLEMENTATION STARTING NOW

I'm going to implement Steps 1-8 above without prompting for approval. You'll wake up to:

1. ✅ **Event system** - Fully functional, integrated with game loop
2. ✅ **Roll system** - Generating random item stats with quality tiers
3. ✅ **Effect registry** - Items can register effects and listen to events
4. ✅ **Core subsystems** - Defense orb, projectile, and stat tracking APIs
5. ✅ **First item** - LAL Ironman Armor working in debug mode
6. ✅ **Testing utilities** - Easy to test items in battle-bets-game
7. ✅ **Documentation** - Updated with implementation details

**Estimated completion time:** 3 hours

**Testing instructions for morning:**
1. Go to `https://deep-pick.vercel.app/battle-bets-game?debug=1&testItems=1`
2. Look for Ironman Armor in left capper's inventory
3. Watch shield activate at battle start
4. Watch shield HP increase when defense orbs destroyed
5. Check console for event logs

**Let's do this! 🚀**

