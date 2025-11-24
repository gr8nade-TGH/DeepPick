# Battle Bets Collision System - Technical Documentation

## Project Overview
**DeepPick App** - Sports betting application with a Battle Bets game feature where cappers battle each other using NBA game stats.

**Repository:** `C:\Users\Tucke\OneDrive\Desktop\DeepPick App`

## Battle Bets Game Architecture

### Core Concept
- Two cappers battle using real NBA game stats (PTS, REB, AST, BLK, 3PT)
- Each stat point fires a projectile from weapon slots
- Projectiles travel across a grid battlefield
- Defense orbs protect each side's castle
- Projectiles collide with each other mid-air and with defense orbs

### Key Technologies
- **PixiJS v8** - Graphics rendering
- **GSAP** - Animation
- **Zustand** - State management
- **Vite** - Build system
- **TypeScript** - Type safety

### Build & Deploy
```bash
npm run build:battle-game  # Builds to public/battle-bets-game/
git push origin main        # Auto-deploys to Vercel
```

**Live URL:** `https://deep-pick.vercel.app/battle-bets-game?debug=1`

## Critical File Paths

### Game Logic
- `src/battle-bets/game/managers/CollisionManager.ts` - **COLLISION DETECTION LOGIC**
- `src/battle-bets/game/managers/GridManager.ts` - Grid layout and cell positioning
- `src/battle-bets/game/entities/projectiles/BaseProjectile.ts` - Projectile movement
- `src/battle-bets/game/simulation/quarterSimulation.ts` - Projectile firing logic
- `src/battle-bets/types/projectileTypes.ts` - Projectile configurations

### State Management
- `src/battle-bets/store/multiGameStore.ts` - **DEFENSE DOTS STORAGE**
- Defense dots stored in: `battle.defenseDots` Map

### Visual Components
- `src/battle-bets/App.tsx` - Main game component (4 battles per page)
- `src/battle-bets/components/game/BattleCanvas.tsx` - Individual battle renderer
- `src/battle-bets/game/debug/CollisionDebugger.ts` - Debug snapshot system
- `src/battle-bets/game/debug/ProjectileDebugger.ts` - Visual grid overlay debugger

## Current Problem: Collision Detection Failures

### Issue #1: Projectiles Pass Through Defense Orbs
**Symptom:** Projectiles visually pass through defense orbs without hitting them

**Console Evidence:**
```
🎯 [GRID CHECK] Projectile is in cell defense-reb-right-2 at X=872.2
🔍 [CELL SEARCH] Looking for cellId="defense-reb-right-2" in 19 dots
  Sample dot: cellId="defense-pts-left-0"
  Sample dot: cellId="defense-pts-left-1"
  Sample dot: cellId="defense-pts-left-2"
❌ [CELL SEARCH] NOT FOUND! No dot with cellId="defense-reb-right-2"
```

**Root Cause:** The collision system is SEARCHING for defense dots by looping through the store, but:
1. Defense dots are stored in a Map with full IDs like `"battleId-defense-reb-right-2"`
2. The search is looking for `cellId="defense-reb-right-2"`
3. The sample dots shown are ALL from different stat rows (PTS instead of REB)

### Issue #2: Projectiles Don't Collide With Each Other
**Symptom:** Some projectiles pass through each other instead of colliding mid-air

**Current Logic:**
```typescript
// Path-crossing check
if (projectile.side === 'left') {
  hasCrossed = projectile.position.x >= other.position.x;
} else {
  hasCrossed = projectile.position.x <= other.position.x;
}
```

**Problem:** This checks if they've crossed, but doesn't account for frame timing or collision radius

## The Fundamental Design Flaw

### What We're Doing Wrong
**Current approach:** Projectiles SEARCH for defense dots
- Loop through all defense dots in the store
- Try to match cellId
- Check if dot is alive
- Apply damage if found

### What We Should Be Doing
**Correct approach:** Defense orbs are STATIONARY at FIXED GRID POSITIONS

**Simple logic:**
1. Projectile enters defense zone at X position
2. Check: "Is there a defense orb at this X position?"
3. If YES → Collision
4. If NO → Continue

**NO SEARCHING. NO LOOPING. NO CELL ID MATCHING.**

## Grid System

### Grid Layout (from GridManager)
```
[Castle] [Label] [Weapon] [Defense 10 cells] [Attack] [Battlefield] [Attack] [Defense 10 cells] [Weapon] [Label] [Castle]
```

### Cell Dimensions
- Cell width: 30px
- Cell height: 40px
- 5 stat rows: PTS (Y=0-40), REB (Y=40-80), AST (Y=80-120), BLK (Y=120-160), 3PT (Y=160-200)

### Defense Zone Boundaries
- **Left defense:** X[210-510] (10 cells × 30px)
- **Right defense:** X[660-960] (10 cells × 30px)

### Cell Numbering
- **Left side:** Cell 0 = leftmost (X=210-240), Cell 9 = rightmost (X=480-510)
- **Right side:** Cell 0 = rightmost (X=930-960), Cell 9 = leftmost (X=660-690)

## Defense Dot Storage Format

### Map Key Format
```typescript
// Full ID used as Map key
`${battleId}-defense-${stat}-${side}-${index}`
// Example: "29e883aa-6e7a-43b0-91d3-8e52c6686d0a-defense-reb-right-2"
```

### DefenseDot Object Properties
```typescript
{
  id: string;           // Full ID (same as Map key)
  cellId: string;       // "defense-reb-right-2"
  stat: StatType;       // "reb"
  side: 'left' | 'right';
  index: number;        // 0-9 (0-based)
  position: { x, y };   // Center of cell
  hp: number;           // Current HP (0-3)
  alive: boolean;
}
```

## What We Need To Accomplish

### Goal
Fix collision detection so that:
1. ✅ ALL projectiles collide with each other when they cross paths
2. ✅ ALL projectiles hit defense orbs when they reach the orb's position
3. ✅ No more "passing through" - collisions are instant and accurate

### Constraints
- Defense orbs are at FIXED positions (center of grid cells)
- Projectiles travel in straight lines at constant speed
- Collision detection runs every frame in GSAP's `onUpdate` callback
- Must work for 4 simultaneous battles on one page

### Success Criteria
- Projectile at X=885 in REB row MUST hit defense orb at X=885 (if one exists)
- Left projectile at X=500 and right projectile at X=600 MUST collide when they meet
- Console logs show successful collisions, not "NOT FOUND" errors
- Visual behavior matches collision detection (no passing through)

## Proposed Solution

### For Defense Orb Collision

**STOP SEARCHING!** Defense orbs are at fixed positions. Use direct position lookup:

```typescript
// Current WRONG approach:
1. Get cell at projectile position → "defense-reb-right-2"
2. Loop through ALL defense dots
3. Find dot with matching cellId
4. Check if alive
5. Apply damage

// Correct SIMPLE approach:
1. Projectile is at X=885, Y=60 (REB row)
2. Calculate which cell: X=885 → cell index 7
3. Check store directly: battle.defenseDots.get(`${battleId}-defense-reb-right-7`)
4. If exists and alive → COLLISION
5. If not → NO COLLISION
```

**Key insight:** We already know the battleId, stat, side, and can calculate the cell index from X position. We can construct the Map key directly without searching!

### For Projectile-to-Projectile Collision

**Current path-crossing logic is correct**, but needs refinement:

```typescript
// Check if projectiles have crossed paths
if (projectile.side === 'left') {
  // Left projectile traveling right
  hasCrossed = projectile.position.x >= other.position.x;
} else {
  // Right projectile traveling left
  hasCrossed = projectile.position.x <= other.position.x;
}
```

**Potential issue:** Frame timing - projectiles might "skip over" each other between frames if moving too fast.

**Solution:** Add collision radius check:
```typescript
const distance = Math.abs(projectile.position.x - other.position.x);
const combinedRadius = projectile.typeConfig.collisionRadius + other.typeConfig.collisionRadius;

if (distance <= combinedRadius) {
  // COLLISION!
}
```

## Implementation Steps

### Step 1: Fix Defense Orb Collision (PRIORITY)
1. Remove `findDefenseDotInCell()` method - we don't need to search!
2. In `checkCollisions()`, calculate cell index from projectile X position
3. Construct Map key directly: `${battleId}-defense-${stat}-${side}-${index}`
4. Get dot from store: `battle.defenseDots.get(key)`
5. If exists and alive → collision

### Step 2: Fix Projectile-to-Projectile Collision
1. Keep path-crossing logic
2. Add distance check with collision radius
3. Ensure both conditions are met for collision

### Step 3: Remove Debug Logging
Once working, remove excessive console logs:
- `[GRID SEARCH]` logs
- `[CELL SEARCH]` logs
- Keep only collision success logs

## Debug Tools

### CollisionDebugger
- Generates snapshot with Copy Debug button
- Shows defense orbs, projectiles, and collision events
- Access via `?debug=1` URL parameter

### Console Logs to Watch
```
✅ Good signs:
💥 [COLLISION!] Projectile hit defense orb
⚔️ [PROJECTILE COLLISION] projectile ↔ projectile

❌ Bad signs:
❌ [CELL SEARCH] NOT FOUND!
⚠️ Projectile in defense zone but no cell found
```

## Next Actions

1. **Rewrite `checkCollisions()` in CollisionManager.ts**
   - Remove all searching logic
   - Use direct Map key construction
   - Test with defense orb collisions

2. **Test projectile-to-projectile collisions**
   - Verify path-crossing logic works
   - Add distance check if needed

3. **Verify with debug snapshot**
   - All projectiles should collide
   - No "NOT FOUND" errors
   - Visual behavior matches logs

