# Prompt for New AI Agent

Copy and paste this entire message to the new AI chatbot:

---

I need help fixing the battle-bets game integration in my **DeepPick App** - an AI-powered NBA sports betting platform. The battle-bets game is currently broken and doesn't match the working original version.

**CRITICAL**: Read the handoff document first:
```
View the file: BATTLE_BETS_HANDOFF.md
```

---

## 📱 ABOUT DEEPPICK APP

**DeepPick** is a comprehensive NBA sports betting platform that uses AI-powered "cappers" (betting models) to generate and track spread picks.

### Core Features:
1. **AI Cappers**: SHIVA, ORACLE, IFRIT - AI models that analyze NBA games and generate spread picks
2. **Pick Generation**: Automated system that generates picks using MySportsFeeds API data + AI analysis
3. **Battle Bets Game**: Visual castle-defense game where cappers compete based on their picks (THIS IS WHAT WE'RE FIXING)
4. **Leaderboard**: Tracks capper performance with units, win-loss records
5. **Pick History**: Shows all past picks with outcomes and analysis

### Tech Stack:
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **APIs**: MySportsFeeds (NBA stats), OpenAI (AI analysis)
- **Deployment**: Vercel
- **Game Engine**: PixiJS v8+ (for battle-bets)

### Repository Info:
- **GitHub**: https://github.com/gr8nade-TGH/DeepPick.git
- **Branch**: `main`
- **Working Directory**: `C:\Users\Tucke\OneDrive\Desktop\DeepPick App`
- **Git User**: gr8nade-TGH (tucker.harris@gmail.com)

### Key Database Tables (Supabase):
- `cappers` - AI capper profiles (SHIVA, ORACLE, IFRIT)
- `picks` - All generated picks with confidence, factors, outcomes
- `games` - NBA game data from MySportsFeeds
- `battle_matchups` - Battle-bets game instances
- `factors` - Configurable factors used in pick generation

---

## 🎮 BATTLE BETS GAME (WHAT WE'RE FIXING)

The battle-bets game is a visual representation of capper competition. It's a separate Vite-built game that gets embedded into the main Next.js app.

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

## 🗂️ DeepPick App Structure:

```
DeepPick App/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API routes
│   │   │   ├── battle-bets/          # Battle game endpoints
│   │   │   ├── picks/                # Pick generation endpoints
│   │   │   └── games/                # NBA game data endpoints
│   │   ├── picks/                    # Picks page
│   │   ├── leaderboard/              # Leaderboard page
│   │   └── battle-arena/             # Battle game page
│   ├── battle-bets/                  # Battle game (Vite build) ⚠️ THIS IS WHAT WE'RE FIXING
│   │   ├── App.tsx                   # Game entry point
│   │   ├── components/               # React components
│   │   ├── game/                     # PixiJS game logic
│   │   ├── store/                    # Zustand state
│   │   └── types/                    # TypeScript types
│   ├── components/                   # Shared React components
│   ├── lib/                          # Utilities, Supabase client
│   └── types/                        # Shared TypeScript types
├── public/
│   ├── battle-bets-game/             # Built battle game (output)
│   └── assets/                       # Images, icons
├── vite.battle-bets.config.ts        # Vite config for battle game
└── package.json
```

## 🔑 Important Commands:

```bash
# Install dependencies
npm install

# Run Next.js dev server (main app)
npm run dev

# Build battle-bets game (Vite)
npm run build:battle-game

# Build entire app for production
npm run build

# Git workflow
git add -A
git commit -m "your message"
git push origin main
```

## 🌐 Deployment:

- **Platform**: Vercel (auto-deploys on push to main)
- **Main App URL**: https://deeppick.vercel.app
- **Battle Game URL**: https://deeppick.vercel.app/battle-bets-game/
- **Deploy Time**: 1-2 minutes after push

## 🔐 Environment Variables (Already Configured):

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `MYSPORTSFEEDS_API_KEY` - NBA stats API
- `OPENAI_API_KEY` - AI analysis

## 📊 Key App Features You Should Know:

### 1. Capper System
- **SHIVA**: Main AI capper, uses OpenAI for bold predictions
- **ORACLE**: Secondary capper
- **IFRIT**: Third capper
- Each capper has: leaderboard rank, unit records per team, win-loss-push records

### 2. Pick Generation Workflow
1. Fetch NBA games from MySportsFeeds API
2. Get sportsbook odds (spread, moneyline, totals)
3. Calculate factors (F1-F5 base factors + Edge vs Market)
4. Generate AI analysis using OpenAI
5. Calculate confidence score (Sharp Score)
6. Store pick in Supabase
7. Create battle matchup if multiple cappers pick same game

### 3. Battle Matchups
- Created when 2+ cappers pick the same game
- Each capper defends their spread pick
- Defense orbs based on capper's unit record for that team
- Game syncs with live NBA stats during quarters

## 🎯 Current Task: Fix Battle-Bets Game

The battle-bets game was working perfectly in the original `battle-bets-v3` project, but after integrating it into DeepPick App, several visual elements and logic broke.

## First Steps:

1. View BATTLE_BETS_HANDOFF.md to understand the full battle game context
2. Compare `src/battle-bets/store/multiGameStore.ts` with the original to check defense dot initialization
3. Compare `src/battle-bets/game/rendering/premiumGrid.ts` with the original
4. Compare `src/battle-bets/App.tsx` with the original to verify layout
5. Check browser console logs for errors after building

## 🚨 Critical Notes:

- **DO NOT edit files in the original source** (`C:\Users\Tucke\Documents\augment-projects\Optimize Projects\battle-bets-v3`) - it's READ-ONLY reference
- **ALWAYS copy FROM original TO DeepPick App**, never the other way
- **Test after every change**: `npm run build:battle-game` then check browser console
- **The user has been working on this for a long time** - respect the existing architecture
- **No improvising** - use the original source as the single source of truth

Please start by reading the handoff document and then let me know your plan of action.

