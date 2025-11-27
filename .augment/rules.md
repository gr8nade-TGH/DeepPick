# Augment Workspace Rules

## Read the Brain First (MOST IMPORTANT)

**Rule:** Before starting ANY task, read the project brain to understand context, conventions, and recent changes

**When:** At the start of every conversation with a new agent

**Instructions:**
1. ✅ **DO:** Read `C:\Users\Tucke\Documents\augment-projects\Optimize Projects\DeepPick_BRAIN\NEW_AGENT_PROMPT.md` FIRST
2. ✅ **DO:** Check "Just Completed" section for recent changes (last 24-48 hours)
3. ✅ **DO:** Review critical gotchas before implementing features
4. ✅ **DO:** Follow established patterns documented in the brain
5. ❌ **DON'T:** Start coding without reading the brain
6. ❌ **DON'T:** Assume conventions - check the brain for actual patterns

**The Brain Contains:**
- Recent changes and what's currently in progress
- Critical gotchas (event filtering, castle ID format, etc.)
- Item implementation patterns (4-step registration)
- Existing systems and managers to reuse
- Code style conventions (emoji logging, file naming)
- Known issues to avoid wasting time on

**Why This Matters:**
- Prevents repeating mistakes that were already fixed
- Ensures you follow the correct naming conventions (DEFENSE/POWER/WEAPON, not ATTACK/SPECIAL)
- Saves time by knowing what systems already exist
- Avoids breaking recently completed features

---

## Copy Debug Button Logging

**Rule:** Always add debug logs to Copy Debug button, not just web console

**When:** Implementing new features, debugging, or adding diagnostic information

**Instructions:**
1. ✅ **DO:** Add logs to Copy Debug button capture system (ItemEffectRegistry, game state)
2. ❌ **DON'T:** Rely solely on console.log() for important debug information
3. ✅ **DO:** Include context (gameId, side, item names, stat values, event triggers)
4. ✅ **DO:** Use emoji prefixes (🛡️, ⚔️, ⚡, ✅, ❌, ⚠️)
5. ✅ **DO:** Make logs copy-paste friendly with clear formatting
6. ✅ **DO:** Add safety checks for undefined values

**Example:**
```typescript
// ✅ GOOD - Captured by Copy Debug button
itemEffectRegistry.log(gameId, side, `⚔️ Hornets Nest: Fired ${count} retaliatory projectiles`);

// ❌ BAD - Only in web console
console.log('Fired projectiles');
```

**Copy Debug should capture:**
- Item activation events
- Stat calculations and rolls
- Game state changes
- Error conditions
- Performance metrics
- Event emissions and subscriptions

---

## Emoji Logging Convention

**Required:** All console logs MUST use emojis for categorization

**Standard Emojis:**
- 🛡️ Defense items and shields
- ⚔️ Weapon items and projectiles
- ⚡ Power items and buffs
- 🏰 Castle items and knight units
- ✅ Success / Completion
- ❌ Error / Failure
- ⚠️ Warning / Important
- 🔧 Debug / Technical info
- 🎯 Event triggers
- 📊 Stats / Calculations

**Example:**
```typescript
console.log('🛡️ Ironman Armor: Shield created with', shieldHp, 'HP');
console.log('⚔️ Shortsword: Firing', count, 'bonus projectiles');
console.log('✅ Item effect registered successfully');
console.log('❌ ERROR: gameId is undefined');
```

---

## Always Check for Existing Modules First

**Rule:** Before creating any new file, function, or module, ALWAYS search for existing implementations

**When:** Creating new features, utilities, or components

**Instructions:**
1. ✅ **DO:** Use `codebase-retrieval` to search for existing similar functionality
2. ✅ **DO:** Check for existing factories, managers, systems, and utilities
3. ✅ **DO:** Reuse existing patterns and architectures
4. ❌ **DON'T:** Create duplicate functionality that already exists
5. ❌ **DON'T:** Reinvent the wheel - extend existing systems instead

**Example Search Queries:**
```
"projectile creation and spawning"
"defense orb manipulation"
"shield system implementation"
"event emission and subscription"
"item effect registration"
```

**Common Existing Systems to Check:**
- `ProjectileFactory` - For creating projectiles
- `ProjectileSystem` - For projectile management
- `DefenseSystem` - For defense orb manipulation
- `CastleHealthSystem` - For castle HP and shields
- `ItemEffectRegistry` - For item effect tracking
- `battleEventBus` / `battleEventEmitter` - For events
- `pixiManager` - For sprite management
- `attackNodeQueueManager` - For projectile queuing

---

## Follow Existing Architecture Patterns

**Rule:** Match the existing codebase architecture and patterns

**When:** Implementing new features or refactoring code

**Instructions:**
1. ✅ **DO:** Follow the event-driven architecture (emit events, subscribe to events)
2. ✅ **DO:** Use existing managers and systems (don't create parallel systems)
3. ✅ **DO:** Follow the 4-step item registration pattern
4. ✅ **DO:** Use TypeScript interfaces and types from existing files
5. ✅ **DO:** Follow the file naming convention: `TEAM_ItemName.ts`
6. ❌ **DON'T:** Create new architectural patterns without discussing first
7. ❌ **DON'T:** Mix different state management approaches

**Key Patterns:**
- **Items:** Event-driven effects that subscribe to game events
- **Projectiles:** Created via ProjectileFactory, managed by ProjectileSystem
- **Defense Orbs:** Manipulated via DefenseSystem methods
- **Sprites:** Registered via `pixiManager.addSprite(sprite, name, battleId)`
- **Events:** Filter by `gameId` AND `side` to prevent cross-battle interference

---

## Modular, Clean Code Practices

**Rule:** Write clean, modular, maintainable code following best practices

**When:** Writing any code

**Instructions:**
1. ✅ **DO:** Keep functions small and focused (single responsibility)
2. ✅ **DO:** Use descriptive variable and function names
3. ✅ **DO:** Add TypeScript types to all parameters and return values
4. ✅ **DO:** Extract magic numbers into named constants
5. ✅ **DO:** Add JSDoc comments for complex functions
6. ✅ **DO:** Handle edge cases and add safety checks
7. ❌ **DON'T:** Create god functions that do too many things
8. ❌ **DON'T:** Use `any` type unless absolutely necessary
9. ❌ **DON'T:** Leave commented-out code in commits

**Example:**
```typescript
// ✅ GOOD - Clean, typed, modular
interface ProjectileConfig {
  damage: number;
  speed: number;
  lane: string;
}

function createProjectile(config: ProjectileConfig): Projectile {
  const { damage, speed, lane } = config;
  // Implementation
}

// ❌ BAD - Unclear, untyped, monolithic
function doStuff(a: any, b: any, c: any) {
  // 200 lines of mixed concerns
}
```

---

## Always Update Existing Tests

**Rule:** When modifying code, update affected tests - never create new test files unless explicitly requested

**When:** Making changes to existing functionality

**Instructions:**
1. ✅ **DO:** Update existing test files that cover the changed code
2. ✅ **DO:** Add new test cases to existing test files
3. ✅ **DO:** Run tests after making changes
4. ❌ **DON'T:** Create new test files unless explicitly requested by user
5. ❌ **DON'T:** Leave broken tests after making changes
6. ❌ **DON'T:** Skip updating tests because "it's just a small change"

---

## Item Implementation Checklist

**Rule:** When implementing a new item, follow the complete 4-step registration pattern

**When:** Creating any new NBA team item

**Required Steps:**
1. ✅ Create `src/battle-bets/game/items/effects/TEAM_ItemName.ts`
2. ✅ Add to `ALL_ITEM_DEFINITIONS` in `src/battle-bets/game/items/ItemTestUtils.ts`
3. ✅ Add to `AVAILABLE_ITEMS` in `src/battle-bets/components/debug/PreGameItemSelector.tsx`
4. ✅ Add to `ITEM_REGISTRY` in `src/battle-bets/components/game/InventoryBar.tsx`

**Missing any step = item won't work!**

---

## Event Filtering is CRITICAL

**Rule:** Always filter events by gameId AND side

**When:** Subscribing to battle events in item effects

**Instructions:**
1. ✅ **DO:** Filter by `event.gameId === gameId`
2. ✅ **DO:** Filter by `event.side === side` (or opposite side for opponent events)
3. ❌ **DON'T:** Subscribe to events without filtering
4. ❌ **DON'T:** Use only gameId filter (will affect both sides)

**Example:**
```typescript
// ✅ GOOD - Properly filtered
battleEventBus.on('DEFENSE_ORB_DESTROYED', (event) => {
  if (event.gameId !== gameId || event.side !== side) return;
  // Handle event
});

// ❌ BAD - Will trigger for all battles and both sides
battleEventBus.on('DEFENSE_ORB_DESTROYED', (event) => {
  // Handle event - WRONG!
});
```

