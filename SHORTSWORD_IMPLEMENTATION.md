# Shortsword Weapon Item - Implementation Summary

**Date:** 2025-11-25  
**Status:** ✅ COMPLETE - Build successful, ready for testing

---

## Overview

Created the first **WEAPON** slot item: **Shortsword** - a starter weapon that fires bonus projectiles from support stat rows when PTS projectiles are fired.

---

## Item Details

### Basic Info
- **ID:** `STARTER_wpn_shortsword`
- **Team:** STARTER (Starter Equipment)
- **Slot:** WEAPON (Slot 3) ⚔️
- **Name:** Shortsword
- **Icon:** ⚔️
- **Rarity:** Starter (default equipment)

### Description
"Every 3 to 8 projectiles fired from the PTS row, fire 1 to 3 projectiles from the REB, AST, STL, 3PT rows."

### Roll Ranges
- **ptsThreshold:** 3-8 projectiles (how many PTS projectiles before triggering)
- **bonusProjectiles:** 1-3 projectiles (how many bonus projectiles to fire from each support row)

### Quality Tiers
- **Warped:** Low rolls (e.g., 7-8 PTS threshold, +1 bonus projectile)
- **Balanced:** Average rolls (e.g., 5-6 PTS threshold, +2 bonus projectiles)
- **Honed:** Good rolls (e.g., 4-5 PTS threshold, +2-3 bonus projectiles)
- **Masterwork:** Perfect rolls (e.g., 3 PTS threshold, +3 bonus projectiles)

---

## How It Works

### Trigger Mechanism
1. Listens to `PROJECTILE_FIRED` events
2. Filters for PTS lane projectiles from BASE source (not item-generated)
3. Increments counter for each PTS projectile fired
4. When counter reaches threshold (3-8), triggers bonus projectiles

### Bonus Projectile Behavior
1. Resets PTS counter to 0
2. Fires 1-3 projectiles from each of these lanes:
   - REB (Rebounds)
   - AST (Assists)
   - STL (Steals)
   - 3PT (Three-Pointers)
3. Total bonus projectiles = bonusProjectiles × 4 lanes
4. 50ms delay between each projectile for visual effect

### Example Scenarios
- **Warped Roll (8 PTS, +1 bonus):** Every 8 PTS projectiles → 4 bonus projectiles (1 from each support row)
- **Balanced Roll (5 PTS, +2 bonus):** Every 5 PTS projectiles → 8 bonus projectiles (2 from each support row)
- **Masterwork Roll (3 PTS, +3 bonus):** Every 3 PTS projectiles → 12 bonus projectiles (3 from each support row)

---

## Files Created/Modified

### New Files
1. **`src/battle-bets/game/items/effects/STARTER_Shortsword.ts`** (201 lines)
   - Item definition
   - Effect registration function
   - Bonus projectile firing logic
   - Event listeners for PROJECTILE_FIRED

### Modified Files
1. **`src/battle-bets/game/items/ItemTestUtils.ts`**
   - Added STARTER_SHORTSWORD_DEFINITION import
   - Added to ALL_ITEM_DEFINITIONS array

2. **`src/battle-bets/components/game/InventoryBar.tsx`**
   - Added STARTER_SHORTSWORD_DEFINITION import
   - Added to ITEM_REGISTRY

3. **`src/battle-bets/components/debug/PreGameItemSelector.tsx`**
   - Added STARTER_SHORTSWORD_DEFINITION import
   - Added to AVAILABLE_ITEMS array

---

## Testing Instructions

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Open Test Mode
Navigate to: `http://localhost:3000/battle-bets-game?testMode=1`

### 3. Equip Shortsword
1. Click on any WEAPON slot (Slot 3) in the Pre-Game Item Selector
2. Select "Shortsword" from the available items
3. Click "APPLY ITEMS" to activate

### 4. Watch for Triggers
- Monitor console logs for `⚔️ [Shortsword]` messages
- PTS projectiles will increment counter
- When threshold reached, bonus projectiles fire from REB, AST, STL, 3PT rows

### 5. Console Log Examples
```
⚔️ [Shortsword] PTS projectile fired! Count: 1/5
⚔️ [Shortsword] PTS projectile fired! Count: 2/5
⚔️ [Shortsword] PTS projectile fired! Count: 3/5
⚔️⚔️⚔️ [Shortsword] THRESHOLD REACHED! Firing 2 bonus projectiles from each stat row!
⚔️ [Shortsword] Firing bonus projectile from REB on left side
⚔️ [Shortsword] Firing bonus projectile from AST on left side
⚔️ [Shortsword] Firing bonus projectile from STL on left side
⚔️ [Shortsword] Firing bonus projectile from 3PT on left side
✅ [Shortsword] Fired 8 bonus projectiles! Total bonus projectiles: 8
```

---

## Technical Implementation Notes

### Event-Driven Architecture
- Uses `battleEventBus` for battle-scoped events
- Filters events by `gameId` and `side` to prevent cross-battle interference
- Only counts BASE source projectiles (not item-generated ones)

### Projectile Firing
- Uses same manual projectile creation as FireOrb.ts
- Creates projectiles with proper collision detection
- Emits PROJECTILE_FIRED events with `source: 'ITEM'` and `isExtraFromItem: true`
- Handles impact and cleanup properly

### Counter Tracking
- Uses `itemEffectRegistry.setCounter()` and `incrementCounter()`
- Tracks `ptsFired` counter per item instance
- Tracks `totalBonusProjectiles` for debugging

---

## Next Steps

1. **Test in multi-battle mode** - Ensure Shortsword only affects its own battle
2. **Balance testing** - Adjust roll ranges if too powerful/weak
3. **Create more WEAPON items** - Implement team-specific weapons
4. **Create POWER items** - Implement Slot 2 (formerly ATTACK) items

---

## Notes

- This is the first WEAPON slot item (Slot 3)
- LAL Ironman Armor is the first DEFENSE slot item (Slot 1)
- POWER slot (Slot 2) still needs its first item
- Shortsword is designed as a starter weapon (equipped by default)

