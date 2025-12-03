# Deterministic Battle System - Implementation Plan

## 🎯 Objective

Make battles **fully deterministic** so:
- Server runs battle once when quarter ends
- Result stored in database (single source of truth for rewards)
- Client can replay battle anytime with **exact same outcome**

---

## 🔑 Core Concept

**Seeded RNG (Random Number Generator)**

Instead of `Math.random()` (different every time), use `seedrandom(seed)` (same sequence every time with same seed).

```typescript
// Current (non-deterministic)
const damage = Math.floor(Math.random() * 10) + 10; // Different every time

// New (deterministic)
const rng = seedrandom("game123-Q1");
const damage = Math.floor(rng() * 10) + 10; // Same every time with same seed
```

---

## 📋 Phase 1: Foundation (Start Here)

### Step 1: Install Library
```bash
npm install seedrandom
npm install --save-dev @types/seedrandom
```

### Step 2: Create Deterministic Engine
**File:** `src/battle-bets/game/simulation/DeterministicBattleEngine.ts`

**Purpose:** Wrapper around `seedrandom` that provides:
- `random()` - Returns 0-1 (like Math.random)
- `randomInt(min, max)` - Returns integer in range

**Constructor:** Takes seed string (e.g., `"game123-Q1-1701234567890"`)

### Step 3: Find All Math.random() Calls
Search codebase for `Math.random()` in these files:
- `src/battle-bets/game/simulation/quarterSimulation.ts`
- `src/battle-bets/game/entities/KnightDefender.ts`
- `src/battle-bets/game/entities/projectiles/*.ts`

**Goal:** Identify what needs to be replaced (don't replace yet, just document)

---

## 📋 Phase 2: Replace Randomness (Later)

### Step 4: Update Function Signatures
Add `battleEngine` parameter to simulation functions

### Step 5: Replace Math.random()
Replace all `Math.random()` with `battleEngine.random()`

### Step 6: Test Determinism
Run same battle 3 times with same seed, verify identical results

---

## 📋 Phase 3: Server-Side (Later)

### Step 7: Create Database Table
Table: `battle_results` (stores game_id, quarter, seed, final HP, winner)

### Step 8: Create API Route
Server runs battle, stores result in database

### Step 9: Create Cron Job
Checks for ended quarters, triggers battles

---

## 📋 Phase 4: Client Replay (Later)

### Step 10: Fetch Result
Client fetches battle result from database

### Step 11: Replay with Seed
Client runs simulation with stored seed, verifies HP matches

---

## 🎯 Success Criteria (Phase 1)

- ✅ `seedrandom` installed
- ✅ `DeterministicBattleEngine` class created
- ✅ All `Math.random()` locations documented
- ✅ Engine can be instantiated with seed
- ✅ `engine.random()` and `engine.randomInt()` work

---

## 📝 Notes

**Knight AI:** Will still be smart (analyzes defense dots, picks weakest lanes), just deterministic

**Shared Code:** Server and client use same simulation files (edit once, works everywhere)

**Storage:** ~500 bytes per battle result (minimal)

**Testing:** Use `https://deep-pick.vercel.app/battle-arena-v2/index.html?debug=1&testMode=1`

