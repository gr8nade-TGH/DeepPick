# 🚀 Next 3 Steps - Implementation Guide

**Goal:** Make LAL Ironman Armor fully functional in battle  
**Estimated Time:** 1.5-2 hours  
**Priority:** CRITICAL - Required for testing

---

## Step 1: Create Castle Health System (45 min)

### File: `src/battle-bets/game/systems/CastleHealthSystem.ts`

**Purpose:** Manage castle shields that absorb damage before castle HP

**Key Functions:**
```typescript
export interface Shield {
  id: string;
  side: 'left' | 'right';
  type: 'STATIC' | 'REGENERATING';
  currentHP: number;
  maxHP: number;
  canRefill: boolean;
  meta?: Record<string, any>;
}

// Create a new shield
export function createShield(
  gameId: string,
  side: 'left' | 'right',
  type: 'STATIC' | 'REGENERATING',
  initialHP: number,
  options?: {
    maxHP?: number;
    canRefill?: boolean;
    meta?: Record<string, any>;
  }
): string; // Returns shieldId

// Heal shield by amount
export function healShield(
  gameId: string,
  shieldId: string,
  amount: number
): void;

// Damage shield (returns overflow damage if shield breaks)
export function damageShield(
  gameId: string,
  shieldId: string,
  damage: number
): number; // Returns overflow damage

// Get shield HP
export function getShieldHP(
  gameId: string,
  shieldId: string
): { currentHP: number; maxHP: number } | null;

// Get all shields for a side
export function getShields(
  gameId: string,
  side: 'left' | 'right'
): Shield[];

// Remove shield
export function removeShield(
  gameId: string,
  shieldId: string
): void;
```

**Implementation Notes:**
- Store shields in a Map: `Map<gameId, Map<shieldId, Shield>>`
- When shield HP reaches 0, emit `SHIELD_BROKEN` event
- `damageShield()` should return overflow damage if shield breaks
- Integrate with `Castle.takeDamage()` to check shields first

**Integration Point:**
Modify `src/battle-bets/game/entities/Castle.ts`:
```typescript
public takeDamage(damage: number): void {
  // Check if there are any shields
  const shields = getShields(this.gameId, this.side);
  
  if (shields.length > 0) {
    // Apply damage to first shield
    const shield = shields[0];
    const overflow = damageShield(this.gameId, shield.id, damage);
    
    // If shield broke, apply overflow to castle HP
    if (overflow > 0) {
      this.currentHP = Math.max(0, this.currentHP - overflow);
      this.updateHPBar();
    }
  } else {
    // No shields, apply damage directly to castle HP
    this.currentHP = Math.max(0, this.currentHP - damage);
    this.updateHPBar();
  }
}
```

---

## Step 2: Emit DEFENSE_ORB_DESTROYED Events (30 min)

### File: `src/battle-bets/game/managers/CollisionManager.ts`

**Purpose:** Emit event when defense orb is destroyed so items can react

**Find the code that destroys defense orbs:**
Search for: `defenseDot.destroy()` or `defenseDot.hp = 0` or similar

**Add event emission:**
```typescript
import { battleEventEmitter } from '../items/EventEmitter';

// When defense orb is destroyed:
const side = defenseDot.side; // 'left' or 'right'
const lane = defenseDot.lane; // 'pts' | 'reb' | 'ast' | 'stl' | '3pt'
const orbId = defenseDot.id;

// Emit event
await battleEventEmitter.emit({
  type: 'DEFENSE_ORB_DESTROYED',
  payload: {
    side,
    opponentSide: side === 'left' ? 'right' : 'left',
    quarter: currentQuarter, // Get from store
    battleId: gameId,
    gameId,
    lane,
    orbId,
    destroyedByProjectileId: projectile?.id,
  },
});

console.log(`🔴 [Event] DEFENSE_ORB_DESTROYED: ${side} ${lane} orb destroyed`);
```

**Testing:**
After this step, you should see console logs:
```
🔴 [Event] DEFENSE_ORB_DESTROYED: left pts orb destroyed
🛡️ [IronmanArmor] Defense orb destroyed on left pts, adding +2 HP to shield
```

---

## Step 3: Activate Items on Battle Start (30 min)

### File: `src/battle-bets/store/multiGameStore.ts`

**Purpose:** Activate equipped items when battle initializes

**Modify `initializeBattle()` function:**
```typescript
import { itemEffectRegistry } from '../game/items/ItemEffectRegistry';
import { rollTestItem } from '../game/items/ItemTestUtils';
import type { RolledItemStats } from '../types/inventory';

// Inside initializeBattle():
initializeBattle: (battleId: string, game: Game) => {
  console.log(`[Multi-Game Store] Initializing battle: ${battleId}`);

  const battleState: BattleState = {
    game,
    currentQuarter: 0,
    capperHP: new Map(),
    defenseDots: new Map(),
    projectiles: []
  };

  set(state => {
    const newBattles = new Map(state.battles);
    newBattles.set(battleId, battleState);
    return { battles: newBattles };
  });

  // Initialize HP and defense dots for this battle
  get().initializeCapperHP(battleId);
  get().initializeDefenseDots(battleId);
  
  // NEW: Activate equipped items
  activateEquippedItems(battleId, game);
},

// NEW: Helper function to activate items
async function activateEquippedItems(battleId: string, game: Game) {
  console.log(`🎮 [Items] Activating equipped items for battle ${battleId}`);
  
  // Left side items
  const leftItems = game.leftCapper.equippedItems;
  if (leftItems.slot1) {
    const rolled = rollTestItem(leftItems.slot1); // TODO: Get from database
    if (rolled) {
      await itemEffectRegistry.activateItem(battleId, 'left', rolled);
    }
  }
  if (leftItems.slot2) {
    const rolled = rollTestItem(leftItems.slot2);
    if (rolled) {
      await itemEffectRegistry.activateItem(battleId, 'left', rolled);
    }
  }
  if (leftItems.slot3) {
    const rolled = rollTestItem(leftItems.slot3);
    if (rolled) {
      await itemEffectRegistry.activateItem(battleId, 'left', rolled);
    }
  }
  
  // Right side items
  const rightItems = game.rightCapper.equippedItems;
  if (rightItems.slot1) {
    const rolled = rollTestItem(rightItems.slot1);
    if (rolled) {
      await itemEffectRegistry.activateItem(battleId, 'right', rolled);
    }
  }
  if (rightItems.slot2) {
    const rolled = rollTestItem(rightItems.slot2);
    if (rolled) {
      await itemEffectRegistry.activateItem(battleId, 'right', rolled);
    }
  }
  if (rightItems.slot3) {
    const rolled = rollTestItem(rightItems.slot3);
    if (rolled) {
      await itemEffectRegistry.activateItem(battleId, 'right', rolled);
    }
  }
  
  console.log(`✅ [Items] All equipped items activated for battle ${battleId}`);
}
```

**Alternative: URL Parameter Testing**
For quick testing, modify `App.tsx` to check URL params:
```typescript
import { autoActivateTestItems } from './game/items/ItemTestUtils';

// After battle initialization:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('testItems')) {
    autoActivateTestItems(battleId);
  }
}, [battleId]);
```

---

## 🧪 Testing Checklist

After completing all 3 steps:

1. **Start battle with LAL Ironman Armor equipped**
2. **Check console logs:**
   ```
   🛡️ [IronmanArmor] Registering effect for left (Start HP: 7, +2 per orb)
   🎬 [EventEmitter] Emitting BATTLE_START events for battle game1
   🛡️ [IronmanArmor] Creating shield for left with 7 HP
   ✅ [CastleHealthSystem] Shield created: shield_123 (7/7 HP)
   ```
3. **When Q1 starts, projectiles should fire**
4. **When defense orb destroyed:**
   ```
   🔴 [Event] DEFENSE_ORB_DESTROYED: left pts orb destroyed
   🛡️ [IronmanArmor] Defense orb destroyed on left pts, adding +2 HP to shield
   ✅ [CastleHealthSystem] Shield healed: shield_123 (9/7 HP)
   ```
5. **When projectile hits castle:**
   ```
   💥 [Castle] Taking 1 damage (shield absorbs)
   🛡️ [CastleHealthSystem] Shield damaged: shield_123 (8/7 HP)
   ```
6. **When shield breaks:**
   ```
   💥 [CastleHealthSystem] Shield broken: shield_123
   🎬 [EventEmitter] Emitting SHIELD_BROKEN event
   🛡️ [IronmanArmor] Shield broken on left!
   ```

---

## 🎯 Success Criteria

- ✅ Shield appears at battle start
- ✅ Shield HP displays correctly
- ✅ Shield gains HP when orbs destroyed
- ✅ Shield absorbs damage before castle HP
- ✅ Shield breaks when HP reaches 0
- ✅ All console logs appear correctly

---

**After these 3 steps, LAL Ironman Armor will be FULLY FUNCTIONAL!** 🛡️🏀⚔️

