# Prompt for New AI Agent

Copy and paste this entire message to the new AI chatbot:

---

I need help fixing the battle-bets game integration in my DeepPick App. The game is currently broken and doesn't match the working original version.

**CRITICAL**: Read the handoff document first:
```
View the file: BATTLE_BETS_HANDOFF.md
```

## Quick Context:

**Working Directory**: `C:\Users\Tucke\OneDrive\Desktop\DeepPick App`

**Original Source (Reference Only)**: `C:\Users\Tucke\Documents\augment-projects\Optimize Projects\battle-bets-v3`

**What I need**: The battle-bets game in DeepPick App needs to look and function EXACTLY like the original source. Right now it's missing critical visual elements and logic.

## Current Issues:

1. Defense orbs are not appearing in the grid (or only 1 per row instead of distributed)
2. GameInfoBar is incomplete (missing capper icons, units, records, spread badges)
3. Item slots may be showing wrong visuals
4. Overall layout doesn't match the reference screenshot

## Reference Screenshot:

I have a screenshot showing how the game SHOULD look. The key elements are:
- Horizontal GameInfoBar at top with: `[1] SHIVA | LAKERS | +32U ↑ | 12-5-1 | [LAL -4.5]` on left side
- PixiJS canvas with castles, defense orbs filling grid cells, stat labels on BOTH sides
- Defense orbs are 3-segment circles distributed across 5 stat rows (PTS, REB, AST, BLK, 3PT)
- Item slots with golden borders and icons (shield, fire orb)

## What I Need You To Do:

1. **Read BATTLE_BETS_HANDOFF.md** - It has all the technical details
2. **Compare current code with original source** - Files are in the paths mentioned above
3. **Fix the defense orb distribution logic** - They should appear on game initialization based on capper units
4. **Ensure GameInfoBar shows all elements** - Compare with original GameInfoBar.tsx
5. **Make it match the screenshot EXACTLY** - No improvising, use the original source as reference

## Important Notes:

- I've been working on this for a long time and previous AI attempts have broken things
- **DO NOT make assumptions** - always check the original source code first
- **Copy entire files from original when possible** - Partial edits often break things
- The original source at `C:\Users\Tucke\Documents\augment-projects\Optimize Projects\battle-bets-v3` is the WORKING version
- Build command: `npm run build:battle-game`
- Push to GitHub: `git add -A && git commit -m "message" && git push origin main`

## First Steps:

1. View BATTLE_BETS_HANDOFF.md to understand the full context
2. Compare `src/battle-bets/store/multiGameStore.ts` with the original to check defense dot initialization
3. Compare `src/battle-bets/game/rendering/premiumGrid.ts` with the original
4. Check browser console logs for errors after building

Please start by reading the handoff document and then let me know your plan of action.

