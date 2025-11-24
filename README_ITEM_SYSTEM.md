# 🛡️ Battle Bets Item System

**Status:** Foundation Complete ✅ | Testing Ready ⏳  
**Last Updated:** 2025-11-24  
**Commits:** `fe9578d`, `52f1369`, `53fbedb`

---

## 📚 Documentation Index

1. **[ITEM_SYSTEM_NIGHT_WORK_SUMMARY.md](./ITEM_SYSTEM_NIGHT_WORK_SUMMARY.md)** - Comprehensive overview of what was built
2. **[NEXT_3_STEPS_IMPLEMENTATION_GUIDE.md](./NEXT_3_STEPS_IMPLEMENTATION_GUIDE.md)** - Step-by-step guide for next critical steps
3. **[ITEM_SYSTEM_IMPLEMENTATION_PLAN.md](./ITEM_SYSTEM_IMPLEMENTATION_PLAN.md)** - Full 3-phase implementation plan (555 lines)
4. **[nba-team-items.txt](./nba-team-items.txt)** - Catalog of 60 NBA team items (2 per team)

---

## 🎯 Quick Start

### What's Working Now
- ✅ Event system emits BATTLE_START and QUARTER_START events
- ✅ Item roll system generates quality tiers (Warped/Balanced/Honed/Masterwork)
- ✅ Item effect registry manages activations and counter tracking
- ✅ Core subsystems provide APIs for items (Defense Orb, Projectile, Stat Tracking)
- ✅ LAL Ironman Armor is fully coded and ready to test

### What's Needed for Testing
- ⏳ Castle Health System (shield mechanics)
- ⏳ DEFENSE_ORB_DESTROYED event emission
- ⏳ Item activation on battle start

**Estimated Time to First Playable Item:** 1.5-2 hours

---

## 🏗️ Architecture Overview

### Event-Driven Design
Items are **pure functions** that subscribe to battle events:
```typescript
battleEventEmitter.on('BATTLE_START', (payload) => {
  // Create shield at battle start
});

battleEventEmitter.on('DEFENSE_ORB_DESTROYED', (payload) => {
  // Heal shield when orb destroyed
});
```

### Quality Tier System
- **Warped (0-25%):** Worst rolls (e.g., 3 HP start, +1 per orb)
- **Balanced (25-60%):** Average rolls (e.g., 5-6 HP start, +2 per orb)
- **Honed (60-85%):** Good rolls (e.g., 7 HP start, +2-3 per orb)
- **Masterwork (85-100%):** Perfect rolls (e.g., 8 HP start, +3 per orb)

### Multi-Battle Support
- Event emitter filters by `gameId`
- Items only respond to events from their battle
- Supports 4 simultaneous battles on one page

---

## 📦 Core Systems

### 1. Event System (`src/battle-bets/game/items/EventEmitter.ts`)
Global event bus for all items to subscribe to battle events.

**Key Methods:**
- `on(eventType, listener, gameId?)` - Subscribe to event
- `emit(event)` - Emit event to all listeners
- `off(subscriptionId)` - Unsubscribe
- `clearGame(gameId)` - Clear all subscriptions for a game

### 2. Roll System (`src/battle-bets/game/items/ItemRollSystem.ts`)
Randomized stat rolling with quality tiers (like Diablo/Path of Exile).

**Key Functions:**
- `rollItem(definition)` - Roll random stats
- `rollItemWithTier(definition, tier)` - Force specific tier
- `calculateQualityScore(rolls, ranges)` - Calculate 0-100 score
- `determineQualityTier(score)` - Map score to tier

### 3. Effect Registry (`src/battle-bets/game/items/ItemEffectRegistry.ts`)
Manages item effect registration and counter tracking.

**Key Methods:**
- `registerEffect(itemId, effectFn)` - Register effect function
- `activateItem(gameId, side, rolledItem)` - Activate item in battle
- `deactivateItem(instanceId)` - Deactivate item
- `getCounter(instanceId, counterName)` - Get counter value
- `setCounter(instanceId, counterName, value)` - Set counter value
- `incrementCounter(instanceId, counterName, delta)` - Increment counter

### 4. Defense Orb System (`src/battle-bets/game/systems/DefenseOrbSystem.ts`)
API for items to manipulate defense orbs.

**Key Functions:**
- `addDefenseOrb(gameId, side, lane, options)` - Add single orb
- `addDefenseOrbs(gameId, side, lane, count, options)` - Add multiple orbs
- `buffRandomOrbs(gameId, side, count, hpDelta)` - Increase HP of random orbs
- `getWeakestLane(gameId, side)` - Find lane with fewest orbs

### 5. Projectile System (`src/battle-bets/game/systems/ProjectileSystem.ts`)
API for items to fire additional projectiles.

**Key Functions:**
- `fireProjectile(gameId, side, lane, options)` - Fire single projectile
- `fireProjectiles(gameId, side, lane, count, options)` - Fire multiple projectiles
- `fireProjectilesFromAllLanes(gameId, side, options)` - Fire from all 5 stat rows
- `fireFinalBlowProjectiles(gameId, side, lane, count, bonusDamage)` - Extra damage when opponent low HP

### 6. Stat Tracking System (`src/battle-bets/game/systems/StatTrackingSystem.ts`)
API for items to query game stats and scores.

**Key Functions:**
- `getQuarterStats(gameId, side, quarter)` - Get stats for specific quarter
- `getScore(gameId, side)` - Get current score
- `isWinning(gameId, side)` - Check if winning
- `getTotal3PTMakes(gameId, side)` - Get cumulative 3-pointers

---

## 🛡️ Example Item: LAL Ironman Armor

**File:** `src/battle-bets/game/items/effects/LAL_IronmanArmor.ts`

**Effect:** Castle shield that starts with 3-8 HP and gains +1-3 HP every time a defense orb is destroyed.

**Roll Ranges:**
- `startShieldHp`: 3-8 HP
- `hpPerDestroyedOrb`: 1-3 HP

**Event Subscriptions:**
- `BATTLE_START` - Create shield at battle start
- `DEFENSE_ORB_DESTROYED` - Add HP to shield when orbs destroyed
- `SHIELD_BROKEN` - Mark shield as inactive

**Quality Examples:**
- **Warped:** 3 HP start, +1 per orb (quality score: 0-25)
- **Balanced:** 5-6 HP start, +2 per orb (quality score: 25-60)
- **Honed:** 7 HP start, +2-3 per orb (quality score: 60-85)
- **Masterwork:** 8 HP start, +3 per orb (quality score: 85-100)

---

## 🧪 Testing

### URL Parameter Testing
```
https://deep-pick.vercel.app/battle-bets-game?debug=1&testItems=LAL_def_ironman_armor
```

### Expected Console Logs
```
🛡️ [IronmanArmor] Registering effect for left (Start HP: 7, +2 per orb)
🎬 [EventEmitter] Emitting BATTLE_START events for battle game1
🛡️ [IronmanArmor] Creating shield for left with 7 HP
✅ [CastleHealthSystem] Shield created: shield_123 (7/7 HP)
🔴 [Event] DEFENSE_ORB_DESTROYED: left pts orb destroyed
🛡️ [IronmanArmor] Defense orb destroyed on left pts, adding +2 HP to shield
✅ [CastleHealthSystem] Shield healed: shield_123 (9/7 HP)
```

---

## 🚀 Next Steps

### CRITICAL (1.5-2 hours)
1. Create `CastleHealthSystem.ts` - Shield mechanics
2. Emit `DEFENSE_ORB_DESTROYED` events - From collision manager
3. Activate items on battle start - In `initializeBattle()`

### SHORT-TERM (Week 1)
4. Test LAL Ironman Armor end-to-end
5. Create database tables: `capper_items`, `battle_item_loadouts`
6. Create API endpoints: `/api/inventory/*`, `/api/battles/loadout`
7. Implement visual shield indicator on castle sprite

### MEDIUM-TERM (Week 2-3)
8. Implement remaining 11 approved items
9. Create inventory UI for cappers
10. Implement treasure chest rewards
11. Add quality tier visual indicators

---

## 📊 Stats

- **Files Created:** 12
- **Lines Added:** ~1,993
- **Systems Implemented:** 6 (Event, Roll, Registry, Defense Orb, Projectile, Stat Tracking)
- **Items Implemented:** 1 (LAL Ironman Armor)
- **Items Designed:** 60 (2 per NBA team)
- **Items Approved:** 12 (ready for implementation)

---

🏀⚔️ **The foundation is solid. Time to bring items to life!** 🛡️🔥

