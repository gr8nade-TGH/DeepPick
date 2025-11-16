# Battle Bets Game Integration - AI Agent Handoff

## 🎯 CURRENT OBJECTIVE

**Restore the battle-bets game in DeepPick App to match the EXACT working version from the original source.**

The game is currently broken and missing critical visual elements and logic. We need to make it look and function EXACTLY like the screenshot provided by the user.

---

## 📁 PROJECT STRUCTURE

### Main Repository (WHERE YOU'LL BE WORKING)
- **Path**: `C:\Users\Tucke\OneDrive\Desktop\DeepPick App`
- **GitHub**: https://github.com/gr8nade-TGH/DeepPick.git
- **Branch**: `main`
- **Battle-Bets Code**: `src/battle-bets/` directory

### Original Working Source (REFERENCE ONLY - DO NOT EDIT)
- **Path**: `C:\Users\Tucke\Documents\augment-projects\Optimize Projects\battle-bets-v3`
- **Purpose**: This is the WORKING version - use it as the source of truth
- **Important**: Copy files FROM here TO the DeepPick App, never the other way around

---

## 🎮 WHAT IS BATTLE BETS?

Battle Bets is a visual game system where sports betting "cappers" (expert bettors) compete against each other based on their NBA spread picks. It's a castle defense-style game rendered using PixiJS.

### Game Mechanics:

1. **Two Cappers Battle**: Each capper has a castle and defends their pick
2. **Defense Orbs**: Based on capper's unit record for that team
   - Formula: `units ÷ 3 = defense orbs` (min 1, max 10)
   - Example: +32 units = 10 defense orbs, +24 units = 8 defense orbs
3. **Orb Distribution**: Defense orbs are distributed across 5 stat rows:
   - PTS (orange): 40%
   - REB (cyan): 20%
   - AST (yellow): 20%
   - BLK (red): 10%
   - 3PT (blue): 10%
4. **Grid System**: 110-cell grid with defense dots positioned in cells
5. **Live Stats**: Game syncs with MySportsFeeds API for real NBA stats
6. **Quarters**: Game progresses through Q1-Q4 with stat updates

---

## 🖼️ WHAT THE GAME SHOULD LOOK LIKE

### Reference Screenshot Analysis:

**Top Bar (GameInfoBar component):**
- Left side: `[1] SHIVA | LAKERS | +32U ↑ | 12-5-1 | [LAL -4.5]`
- Center: `PHX vs MEM | Spread: +13.5`
- Right side: `[MEM +4.5] | 10-5-1 | +24U ↑ | GRIZZLIES | IFRIT [3]`

**Canvas (PixiJS):**
- Left castle with golden item slots showing shield and fire orb icons
- Defense orbs (colored circles) filling the grid cells on BOTH sides
- Stat labels on BOTH left and right sides: PTS, REB, AST, BLK, 3PT
- Health bars under castles showing "13/13" and "11/11"
- "VS" text in center battlefield
- Right castle with item slots

**Key Visual Elements:**
- Defense orbs are THREE-SEGMENT circles (like pie charts with gaps)
- Item slots have GOLDEN BORDERS with icons inside (not "LVL 1" text)
- Stat labels appear on BOTH sides of the grid
- Grid cells have subtle borders and depth effects
- Castles are 3D sprites with proper positioning

---

## ❌ CURRENT PROBLEMS

1. **GameInfoBar is incomplete** - Missing capper icons, units, records, spread badges
2. **Defense orbs not appearing** - Grid is empty or only showing 1 orb per row
3. **Defense orb distribution logic missing** - Orbs should be distributed on game start based on capper units
4. **Item slots showing wrong visuals** - May show "LVL 1" text instead of icons
5. **Stat labels may be missing on one side**
6. **Overall layout doesn't match the screenshot**

---

## 🔧 TECHNICAL STACK

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Game Engine**: PixiJS v8+
- **Build Tool**: Vite (for battle-bets game)
- **Database**: Supabase
- **Deployment**: Vercel
- **State Management**: Zustand (multiGameStore)

### Key Files:

```
src/battle-bets/
├── App.tsx                          # Main entry point
├── components/
│   ├── game/
│   │   ├── BattleCanvas.tsx        # PixiJS canvas wrapper
│   │   ├── GameInfoBar.tsx         # Horizontal info bar (TOP)
│   │   ├── GameInfoBar.css
│   │   ├── InventoryBar.tsx        # Vertical item slots (SIDES)
│   │   └── InventoryBar.css
├── game/
│   ├── entities/
│   │   ├── Castle.ts               # Castle rendering with item slots
│   │   ├── DefenseDot.ts           # Defense orb entity (3-segment circles)
│   │   └── Projectile.ts
│   ├── rendering/
│   │   ├── premiumGrid.ts          # Grid + stat labels rendering
│   │   └── battleStatusOverlay.ts
│   ├── managers/
│   │   ├── GridManager.ts          # 110-cell grid management
│   │   ├── CastleManager.ts
│   │   └── PixiManager.ts
│   ├── utils/
│   │   ├── positioning.ts          # Canvas dimensions, cell positions
│   │   ├── defenseAllocation.ts    # Orb distribution logic
│   │   └── colors.ts
│   └── simulation/
│       └── quarterSimulation.ts    # Quarter-by-quarter game logic
├── store/
│   └── multiGameStore.ts           # Zustand store for multiple battles
└── types/
    └── game.ts                     # TypeScript interfaces
```

---

## 🚀 BUILD & DEPLOY COMMANDS

```bash
# Build the battle-bets game
npm run build:battle-game

# Commit changes
git add -A
git commit -m "fix: your message here"
git push origin main

# Vercel auto-deploys on push (takes 1-2 minutes)
```

**Battle Game URL**: `https://deeppick.vercel.app/battle-bets-game/`

---

## 🔍 DEBUGGING APPROACH

### Step 1: Compare Files
Always compare current files with the original source:
```powershell
# View original file
Get-Content "C:\Users\Tucke\Documents\augment-projects\Optimize Projects\battle-bets-v3\src\[FILE_PATH]"

# View current file
Get-Content "src\battle-bets\[FILE_PATH]"
```

### Step 2: Check Console Logs
Look for these key logs in browser console:
- `✅ GridManager initialized with 110 cells`
- `[Multi-Game Store] Initialized X defense dots for battle`
- `[Multi-Game Store] Distribution for left: { pts: X, reb: X, ... }`
- `✅ Castle [ID] loaded successfully`

### Step 3: Verify Defense Dot Creation
Check `multiGameStore.ts` → `initializeDefenseDots()` function:
- Should create ALL dots based on distribution, not just 1 per row
- Should use `distributeDotsAcrossStats()` function
- Should create dots for BOTH left and right sides

### Step 4: Check Grid Rendering
Check `premiumGrid.ts` → `drawPremiumGrid()` function:
- Should draw stat labels on BOTH left and right sides
- Should create 110 grid cells total
- Should position everything correctly

---

## 📋 CRITICAL FUNCTIONS TO UNDERSTAND

### 1. Defense Orb Distribution
```typescript
// src/battle-bets/game/utils/defenseAllocation.ts
export function distributeDotsAcrossStats(totalDots: number): number[] {
  // Returns [pts, reb, ast, blk, 3pt] counts
  // Example: 10 dots → [4, 2, 2, 1, 1]
}
```

### 2. Units to Dots Conversion
```typescript
// src/battle-bets/types/game.ts
export function getTotalDefenseDotCount(units: number): number {
  const dots = Math.floor(units / 3);
  return Math.max(1, Math.min(10, dots)); // Clamp between 1-10
}
```

### 3. Defense Dot Initialization
```typescript
// src/battle-bets/store/multiGameStore.ts
initializeDefenseDots: (battleId: string, game: Game) => {
  // Should create ALL defense dots for both sides
  // Based on capper units and distribution
}
```

---

## 🎯 IMMEDIATE NEXT STEPS

1. **Compare App.tsx** with original to see full layout structure
2. **Check if InventoryBar is used** - may need to add it to App.tsx
3. **Verify defense dot creation logic** in multiGameStore.ts
4. **Compare premiumGrid.ts** - ensure stat labels on both sides
5. **Compare Castle.ts** - ensure item slots render correctly
6. **Test the game** - check browser console for errors

---

## 💡 KEY PRINCIPLES

1. **ALWAYS use the original source as reference** - Don't guess or improvise
2. **Copy entire files when possible** - Partial edits often break things
3. **Test after every change** - Build and check browser console
4. **Defense orbs are created on initialization** - Not during gameplay
5. **The game is a static display initially** - Animation happens during quarter simulation

---

## 📞 USER CONTEXT

- User has been working on this for a long time
- User is frustrated with AI making changes that break the carefully crafted layout
- User wants EXACT replication of the original, not "improvements"
- User has stated "for the 50th time" - take this seriously
- **DO NOT make assumptions** - always check the original source first

---

## 🔗 RELATED SYSTEMS

- **MySportsFeeds API**: Provides live NBA stats
- **Supabase Tables**: `battle_matchups`, `picks`, `games`, `cappers`
- **API Routes**: `/api/battle-bets/active` - fetches active battles
- **Capper System**: SHIVA, ORACLE, IFRIT - AI-powered betting models

---

## ✅ SUCCESS CRITERIA

The game is fixed when:
1. ✅ GameInfoBar shows all elements (icons, names, units, records, spread badges)
2. ✅ Defense orbs appear in grid cells on BOTH sides
3. ✅ Orbs are distributed correctly (40% PTS, 20% REB, etc.)
4. ✅ Item slots show icons with golden borders
5. ✅ Stat labels appear on BOTH left and right sides
6. ✅ Castles render with proper health bars
7. ✅ Layout matches the screenshot EXACTLY

---

**Good luck! Remember: When in doubt, check the original source code.**

