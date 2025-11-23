# ITEM ENGINE SPEC – Battle Grid Item Engine

This document defines the **minimum feature set** the battle engine must support so that *all current and future NBA team items* can function without any item‑specific hardcoding.

> The goal: implement a **generic item engine** that listens to game events, tracks counters, and applies effects using rolled stats, so new items can be added just by data config, not new code.

---

## 1. Core Concepts

### 1.1 Battle Structure

Assumptions (align with current grid implementation):

- Game is divided into **4 quarters**.
- Each side has:
  - A **castle** with primary HP (e.g., `castleHp`).
  - Optional **shield layers** that absorb damage before castle HP.
  - **5 stat lanes**: `PTS`, `REB`, `AST`, `BLK`, `3PT`.
  - Each lane contains **defense orbs** with their own HP.
- There is a **Final Blow phase** after the real game ends, where stored/projected attacks resolve.

These are assumptions; if reality differs, keep the *interfaces* but wire them to your actual state.

---

## 2. One‑Time Item Roll System

Each item copy is created by winning it from a chest.

### 2.1 Requirements

When an item is awarded:

- Run a **one‑time roll** for its variable stats, within min/max ranges defined in item config.
- Store rolled values *per item instance*, e.g.:

```ts
type RolledItemStats = {
  itemId: string
  ownerPlayerId: string
  rolls: Record<string, number> // e.g. { startShieldHp: 7, perOrbHpGain: 2 }
  qualityTier: 'Warped' | 'Balanced' | 'Honed' | 'Masterwork'
}
```

### 2.2 Engine Responsibilities

- Provide a helper like `rollItemStats(itemConfig) -> RolledItemStats`.
- Never reroll once assigned.
- Quality tier is derived from the strength of the roll (e.g., percentile of total power score).

---

## 3. Event System

Items should be expressed as **effects that subscribe to events**.

Minimum events the engine must expose:

```ts
// high-level event names
type BattleEvent =
  | 'BATTLE_START'
  | 'QUARTER_START'
  | 'QUARTER_END'
  | 'PROJECTILE_FIRED'
  | 'PROJECTILE_COLLISION'
  | 'PROJECTILE_HIT_CASTLE'
  | 'DEFENSE_ORB_DESTROYED'
  | 'OPPONENT_ORB_DESTROYED'
  | 'CASTLE_SHIELD_HIT'
  | 'CASTLE_PRIMARY_HIT'
  | 'FINAL_BLOW_START'
  | 'TICK' // optional, if needed later
```

### 3.1 Event Payloads (Minimal Shape)

You don’t have to expose all fields everywhere, but must support at least:

```ts
type Lane = 'PTS' | 'REB' | 'AST' | 'BLK' | '3PT'

type Side = 'HOME' | 'AWAY'

interface BaseEventPayload {
  side: Side              // which side this event is about
  opponentSide: Side      // the enemy
  quarter: 1 | 2 | 3 | 4  // current quarter
}

interface ProjectileFiredPayload extends BaseEventPayload {
  lane: Lane              // which stat lane spawned this projectile
  projectileId: string
  isExtraFromItem?: boolean
}

interface ProjectileCollisionPayload extends BaseEventPayload {
  projectileId: string
  otherProjectileId?: string
}

interface ProjectileHitCastlePayload extends BaseEventPayload {
  projectileId: string
  damage: number
  lane: Lane
}

interface DefenseOrbDestroyedPayload extends BaseEventPayload {
  lane: Lane
  orbId: string
}

interface OpponentOrbDestroyedPayload extends BaseEventPayload {
  lane: Lane
  orbId: string
}

interface CastleShieldHitPayload extends BaseEventPayload {
  damage: number
  shieldId: string
}

interface CastlePrimaryHitPayload extends BaseEventPayload {
  damage: number
}

interface QuarterStartPayload extends BaseEventPayload {
  prevQuarterStats: QuarterStats // see below
}

interface QuarterEndPayload extends BaseEventPayload {
  score: { self: number; opponent: number }
}

interface FinalBlowStartPayload extends BaseEventPayload {
  score: { self: number; opponent: number }
}
```

You can evolve these, but keep the semantics.

The engine should allow **item effects** to register listeners, e.g.:

```ts
on('QUARTER_START', (payload) => {
  // item effect logic
})
```

---

## 4. Core Subsystems the Engine Must Provide

These are generic utilities/item hooks. Items should use these; they should NOT directly mutate game state.

### 4.1 Defense Orbs

Each lane has a list of defense orbs:

```ts
interface DefenseOrb {
  id: string
  lane: Lane
  hp: number
  ownerSide: Side
}
```

Engine must expose:

```ts
addDefenseOrb(side: Side, lane: Lane, hp: number): string
addDefenseOrbs(side: Side, lane: Lane, count: number, hp: number): string[]

buffRandomOrbs(side: Side, count: number, hpDelta: number): void
buffSpecificOrb(orbId: string, hpDelta: number): void

getWeakestLane(side: Side): Lane // fewest orbs; tiebreak random
getDefenseOrbs(side: Side): DefenseOrb[]
```

Orb destruction should automatically emit `DEFENSE_ORB_DESTROYED` (& `OPPONENT_ORB_DESTROYED` for the other side).

---

### 4.2 Shields

Support multiple shield **types** via a generic structure:

```ts
type ShieldKind = 'STATIC' | 'REFRESH_EACH_QUARTER' | 'REGENERATING' |
                  'EMERGENCY_ON_LOW_HP' | 'MAGIC' // you can map internal behavior

interface Shield {
  id: string
  side: Side
  kind: ShieldKind
  hp: number
  maxHp: number
  canRefill: boolean
  canRespawn: boolean
  meta: Record<string, any> // item-specific metadata (e.g., refillPerOrb, triggerHp, etc)
}
```

Engine utilities:

```ts
createShield(side: Side, kind: ShieldKind, hp: number, options?: {
  maxHp?: number
  canRefill?: boolean
  canRespawn?: boolean
  meta?: Record<string, any>
}): string

damageShield(side: Side, damage: number): {
  absorbed: number
  overflow: number // goes to castle if > 0
}

getShield(side: Side): Shield | null
updateShieldMeta(shieldId: string, patch: Partial<Shield['meta']>): void
healShield(shieldId: string, hpDelta: number): void
```

All shield damage must emit `CASTLE_SHIELD_HIT`. If overflow > 0, then emit `CASTLE_PRIMARY_HIT`.

This covers:
- AC “Ironman” Armor  
- Golden Shield (quarter-refresh)  
- Steve Nash Tower, Golden Nugget Vault, Thunder Dome  
- Magic Ward, Wizards’ Watchtower  
- Keep of Kings emergency shield  
- Stockton’s Tunic persistent shield, etc.

---

### 4.3 Projectiles

Projectiles must be tagged with:

```ts
interface Projectile {
  id: string
  side: Side
  lane: Lane
  hp: number         // default 1; >1 used for Magic Missiles
  damage: number     // typically 1 HP to orbs/castle
  source: 'BASE' | 'ITEM'
  itemId?: string    // if from an item
}
```

Engine utilities:

```ts
fireProjectiles(side: Side, lane: Lane, count: number, options?: {
  hp?: number
  damage?: number
  source?: 'BASE' | 'ITEM'
  itemId?: string
}): string[] // projectileIds
```

- Any time **base stats** generate a projectile, engine emits `PROJECTILE_FIRED` with `source = 'BASE'`.
- When items spawn extra projectiles, use `source = 'ITEM'` and `itemId`.

For collisions and hits, engine should already handle pathing; items only need notifications via events.

---

### 4.4 Counters & Thresholds per Item

Each item effect needs its own **internal counters**:

Examples:
- `ptsFired`, `rebFired`, `astFired`, `blkFired`, `threesFired`
- `orbsDestroyed`
- `castleHpLost`
- `hitsOnCastle`
- `quarterMissilesFired`
- etc.

Provide a small API:

```ts
interface ItemRuntimeContext {
  itemInstanceId: string
  side: Side
  rolls: Record<string, number> // the rolled stats
}

getItemCounter(itemInstanceId: string, key: string): number
setItemCounter(itemInstanceId: string, key: string, value: number): void
incrementItemCounter(itemInstanceId: string, key: string, delta?: number): number
resetItemCounter(itemInstanceId: string, key: string): void
```

Items will use these to implement:

- “every X projectiles fired” triggers  
- “every Y orbs destroyed” triggers  
- “every Z HP lost” triggers  
- etc.

---

### 4.5 Scoreboard & Quarter Stats

You must provide access to:

```ts
interface QuarterStats {
  pts: number
  reb: number
  ast: number
  blk: number
  threesMade: number
  // can expand with steals, fouls, etc later
}

getScore(side: Side): number
getQuarterStats(side: Side, quarter: number): QuarterStats
getPreviousQuarterStats(side: Side, currentQuarter: number): QuarterStats | null
```

This is used by items like:

- Golden Shield (GSW): shield HP depends on 3PT makes from previous quarter.
- Heat Culture, Parquet Bulwark, etc. (stat comparisons).
- “If team is losing by X at end of quarter” (Hornets, Wizards’ Watchtower, etc).

---

### 4.6 Final Blow Phase

Some items bank power for Final Blow:

- Dirk’s Dirk (stores PTS projectiles for Final Blow)
- Sun Ring (adds extra Final Blow projectiles)

Provide:

```ts
addFinalBlowProjectiles(side: Side, lane: Lane, count: number, options?: {
  damage?: number
  itemId?: string
}): void
```

During `FINAL_BLOW_START`:

- Engine reads all banks and spawns the projectiles.
- Items may add more in response to this event.

---

## 5. Behavior Categories the Engine Must Support

Instead of implementing each item one‑off, the engine should support **these generic behavior patterns**. The current NBA team items are combinations of these.

### 5.1 Shields & Castle HP Effects

Patterns:

1. **Static front‑loaded shield**
   - Apply once at `BATTLE_START`.
   - HP never refills.
   - Ex: AC “Ironman” Armor, Steve Nash Tower.

2. **Quarter‑refresh shield**
   - Apply at each `QUARTER_START`.
   - HP based on baseRoll + multiplier * previousQuarterStat.
   - Ex: Golden Shield (GSW threes → HP).

3. **Regenerating shield**
   - Whenever certain events happen (orb destroyed, assist, etc.), add HP up to a cap.
   - Ex: Stockton’s Tunic, Thunder Dome, Golden Nugget Vault.

4. **Emergency shield**
   - Trigger once when castle HP falls to or below a threshold.
   - Apply shield; when broken, trigger a “break” effect (e.g., spawn orbs).
   - Ex: Keep of Kings.

5. **Magic shield w/ side effects**
   - Shield exists; every time it takes a hit, some number of orbs are buffed.
   - Ex: Magic Ward, Wizards’ Watchtower.

### 5.2 Defense Orb Manipulation

Patterns:

1. **Spawn orbs at quarter start**
   - For one lane (weakest or specific).
   - For all lanes.
   - Ex: Mavericks’ Moat, Jazz Rally Horn, Magic Ward quarter energize.

2. **Spawn orbs when castle loses HP**
   - Every N HP lost, spawn X orbs in one or more lanes.
   - Ex: Trailblazer Tower, Knicks/Bulls/Pistons style items.

3. **Spawn orbs when orbs are destroyed**
   - Every N orbs destroyed, spawn X new orbs.
   - Ex: Clippers’ Greaves, Grindhouse Portcullis, Timberwolves’ Den.

4. **Buff orbs**
   - Periodically add +1 HP to random orbs or last orb in each lane.
   - Used by ORL/WAS/GSW-style defensive buffs.

### 5.3 Projectile Generation & Conversion

Patterns:

1. **Stat conversion**
   - “Every N AST projectiles → +M PTS projectiles”
   - “Every N REB projectiles → +M PTS projectiles”
   - “Every N PTS → +M 3PT”
   - “Every N 3PT → +M mixed PTS/3PT”
   - “Every N BLK → +M PTS”
   - “Every N STL/deflection → +M PTS”
   - Implemented via:
     - Listening to `PROJECTILE_FIRED` with `lane` & `side`.
     - Using counters & thresholds.

2. **End‑of‑quarter barrages**
   - At `QUARTER_END`, fire X projectiles from each lane.
   - Sometimes chain more if they destroy orbs.
   - Ex: Northern Fury Bow, Sting Blade, Beale Street Drums.

3. **Retaliation projectiles**
   - When *your* orb is destroyed, fire X retaliatory projectiles from that same lane.
   - Extra effect if it was the last orb in the lane.
   - Ex: Hornets’ Nest, Kings’ Greatsword BLK retaliation.

4. **Banked projectiles for Final Blow**
   - While the game runs, track certain events (e.g., hits to your castle).
   - For each threshold, store M “banked” projectiles.
   - On `FINAL_BLOW_START`, fire them.
   - Ex: Dirk’s Dirk, Sun Ring.

5. **Multi‑HP projectiles**
   - Projectiles with HP > 1 (Magic Missiles).
   - On collision:
     - If HP > 1, decrement HP and keep projectile alive.
     - When HP reaches 0, destroy and emit appropriate events.

### 5.4 Scoreboard & Momentum Based Effects

Patterns:

1. **Losing by X at quarter end**
   - On `QUARTER_END`, check `score.self < score.opponent - deficitThreshold`.
   - If condition met: fire barrages or spawn shield.
   - Ex: Sting Blade, Wizards’ Watchtower magic shield.

2. **Leading vs trailing effects**
   - Some items only add extra projectiles when trailing, or disable bonuses when leading.
   - Ex: Black Mamba Ring (bonus 3s only when behind).

---

## 6. Minimal Engine API Summary (What Augment AI Should Implement)

Below is a compact list of **functions & hooks** Augment should guarantee exist for the item engine to work. Names can change, but functionality must be preserved.

```ts
// EVENT BUS
on(event: BattleEvent, handler: (payload: any) => void): void
emit(event: BattleEvent, payload: any): void

// DEFENSE ORBS
addDefenseOrb(side: Side, lane: Lane, hp: number): string
addDefenseOrbs(side: Side, lane: Lane, count: number, hp: number): string[]
buffRandomOrbs(side: Side, count: number, hpDelta: number): void
buffSpecificOrb(orbId: string, hpDelta: number): void
getWeakestLane(side: Side): Lane
getDefenseOrbs(side: Side): DefenseOrb[]

// SHIELDS
createShield(side: Side, kind: ShieldKind, hp: number, options?: {
  maxHp?: number
  canRefill?: boolean
  canRespawn?: boolean
  meta?: Record<string, any>
}): string

damageShield(side: Side, damage: number): { absorbed: number; overflow: number }
getShield(side: Side): Shield | null
healShield(shieldId: string, hpDelta: number): void
updateShieldMeta(shieldId: string, patch: Partial<Shield['meta']>): void

// PROJECTILES
fireProjectiles(side: Side, lane: Lane, count: number, options?: {
  hp?: number
  damage?: number
  source?: 'BASE' | 'ITEM'
  itemId?: string
}): string[]

// ITEM RUNTIME COUNTERS
getItemCounter(itemInstanceId: string, key: string): number
setItemCounter(itemInstanceId: string, key: string, value: number): void
incrementItemCounter(itemInstanceId: string, key: string, delta?: number): number
resetItemCounter(itemInstanceId: string, key: string): void

// SCORE / STATS
getScore(side: Side): number
getQuarterStats(side: Side, quarter: number): QuarterStats
getPreviousQuarterStats(side: Side, currentQuarter: number): QuarterStats | null

// FINAL BLOW
addFinalBlowProjectiles(side: Side, lane: Lane, count: number, options?: {
  damage?: number
  itemId?: string
}): void
```

---

## 7. How to Wire Items to This Engine

You **do not** have to code every item now.

Instead:

1. Build this **engine + API** first.
2. Then, for each item in the NBA items catalog, create a small effect module like:

```ts
function attachIronmanArmor(context: ItemRuntimeContext) {
  const { side, rolls } = context
  const { startShieldHp, hpPerDestroyedOrb } = rolls

  // BATTLE_START: create shield
  on('BATTLE_START', (payload: BaseEventPayload) => {
    if (payload.side !== side) return
    const shieldId = createShield(side, 'STATIC', startShieldHp, {
      maxHp: startShieldHp,
      canRefill: true,
      meta: { hpPerDestroyedOrb }
    })
    setItemCounter(context.itemInstanceId, 'shieldId', shieldId as any) // or store elsewhere
  })

  // DEFENSE_ORB_DESTROYED: add HP to shield
  on('DEFENSE_ORB_DESTROYED', (payload: DefenseOrbDestroyedPayload) => {
    if (payload.side !== side) return
    const shield = getShield(side)
    if (!shield) return
    const gain = rolls.hpPerDestroyedOrb
    healShield(shield.id, gain)
  })
}
```

Every other item is just a variation of:
- Which **event** it listens to
- Which **counters** it tracks
- Which **engine utilities** it calls
- Which **roll fields** it uses

---

## 8. Handoff Notes for Augment AI

When you give this file to Augment:

- Ask it to:
  1. **Implement the engine API** defined in section 6.
  2. Wire it into your existing **battle grid** so:
     - Base stat events emit `PROJECTILE_FIRED`.
     - Orb destruction emits the orb events.
     - Castle/shield damage emits the castle events.
     - Quarter boundaries emit `QUARTER_START` / `QUARTER_END`.
     - Game end emits `FINAL_BLOW_START`.
  3. Implement **one or two sample items** end‑to‑end (e.g., AC “Ironman” Armor + Black Mamba Ring) using the pattern in section 7 as a template.

Once that is done, we can layer in **all remaining items as pure config + small effect modules**, without needing to change core engine logic.

