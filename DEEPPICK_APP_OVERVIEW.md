# DeepPick App - Complete Overview for AI Assistant

## 🎯 **What is DeepPick?**

DeepPick is an **AI-powered sports betting platform** where:
- **AI Cappers** (SHIVA, IFRIT, CERBERUS) generate NBA picks using custom algorithms
- **Human Cappers** can sign up, make picks, and compete on leaderboards
- **Free Users** can view picks and analytics (read-only)
- **Admin Users** manage cappers, monitor system health, configure algorithms

---

## 🏗️ **Tech Stack**

### **Frontend**
- **Framework**: Next.js 14 (App Router)
- **UI**: React Server Components (RSC) + Client Components
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: React Context (AuthContext, BettingSlipContext)

### **Backend**
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with RLS policies
- **API Routes**: Next.js API routes (`/api/*`)
- **External APIs**: 
  - MySportsFeeds (player stats, game data)
  - Perplexity AI (analysis)
  - OpenAI (bold predictions, insights)

### **Deployment**
- **Hosting**: Vercel
- **Database**: Supabase Cloud (Project ID: `xckbsyeaywrfzvcahhtk`)
- **Domain**: `deep-pick.vercel.app`

---

## 👥 **User Roles**

### **1. Free (Default)**
- View AI-generated picks
- View leaderboard (read-only)
- View performance analytics
- **Cannot**: Make picks, appear on leaderboard

### **2. Capper ($19.99/month - Coming Soon)**
- Everything in Free, plus:
- Make picks via betting slip
- Appear on leaderboard
- Track personal performance/ROI
- Featured on main dashboard

### **3. Admin**
- Full system access
- Manage AI cappers (SHIVA, IFRIT, CERBERUS)
- Configure factor weights, thresholds
- Monitor system health
- View debug logs

---

## 🤖 **AI Cappers**

### **SHIVA** (Balanced Precision Model)
- **Strategy**: Balanced, data-driven picks
- **Bet Types**: TOTAL (Over/Under), SPREAD
- **Factors**: 5 base factors (F1-F5) + Edge vs Market
- **Confidence Thresholds**: 
  - HIGH: ≥70%
  - MEDIUM: 60-69%
  - LOW: 50-59%
  - PASS: <50%

### **IFRIT** (Aggressive Value Hunter)
- **Strategy**: High-scoring OVER picks
- **Bet Types**: TOTAL (Over only)
- **Focus**: Offensive firepower, pace, defensive weaknesses

### **CERBERUS** (Multi-Model Consensus Guardian)
- **Strategy**: Consensus picks from SHIVA, IFRIT, and future models
- **Bet Types**: TOTAL, SPREAD
- **Logic**: Only picks when 2+ models agree

---

## 📊 **Database Schema (Key Tables)**

### **`profiles`** (User accounts)
```sql
id UUID (PK, references auth.users)
email TEXT
full_name TEXT
username TEXT
role TEXT ('free' | 'capper' | 'admin')
email_verified BOOLEAN
avatar_url, bio, twitter_url, instagram_url
created_at, updated_at
```

### **`user_cappers`** (AI Capper configurations)
```sql
id UUID (PK)
user_id UUID (FK to profiles) -- 'shiva', 'ifrit', 'cerberus'
display_name TEXT
sport TEXT ('NBA', 'MLB', 'NFL')
bet_type TEXT ('TOTAL', 'SPREAD', 'MONEYLINE')
is_active BOOLEAN
factor_config JSONB -- Custom factor weights
created_at, updated_at
```

### **`picks`** (All picks - AI and human)
```sql
id UUID (PK)
capper_id UUID (FK to profiles or user_cappers)
game_id TEXT
sport TEXT
bet_type TEXT ('TOTAL', 'SPREAD', 'MONEYLINE')
pick_value TEXT -- 'OVER 220.5', 'LAL -4.5', etc.
confidence TEXT ('HIGH', 'MEDIUM', 'LOW')
odds DECIMAL
stake DECIMAL
result TEXT ('WIN', 'LOSS', 'PUSH', 'PENDING')
created_at TIMESTAMPTZ
game_date DATE
```

### **`algorithm_runs`** (Pick generation history)
```sql
id UUID (PK)
capper_id UUID
sport TEXT
bet_type TEXT
status TEXT ('SUCCESS', 'FAILED', 'RUNNING')
picks_generated INTEGER
metadata JSONB -- Locked odds, spreads, game data at pick time
execution_time_ms INTEGER
created_at TIMESTAMPTZ
```

### **`event_log`** (System audit trail)
```sql
id UUID (PK)
event_type TEXT
user_id UUID (nullable)
metadata JSONB
created_at TIMESTAMPTZ
```

---

## 🔑 **Authentication System**

**See `DEEPPICK_AUTH_SYSTEM.md` for complete details.**

### **Quick Summary**
- Email/password signup/login
- Server-side session management
- Client-side auth state sync via AuthContext
- RLS policies protect data access
- Triggers auto-create profiles on signup
- Middleware protects routes by role

### **Critical Files**
- `src/contexts/auth-context.tsx` - Auth state management
- `src/middleware.ts` - Route protection
- `src/app/login/page.tsx` - Login page
- `src/app/signup/page.tsx` - Signup page

---

## 🎨 **Key Features**

### **1. Dashboard** (`/`)
- Recent activity feed (last 20 picks)
- Performance chart (daily units, cumulative)
- Top cappers leaderboard
- Quick stats (win rate, ROI, total picks)

### **2. Leaderboard** (`/leaderboard`)
- All cappers ranked by performance
- Filters: Sport, timeframe, bet type
- Stats: Win rate, ROI, total units, streak

### **3. Make Picks** (`/make-picks`) - Capper/Admin only
- Global betting slip (persistent across pages)
- Live odds from MySportsFeeds
- Pick submission with confidence levels
- Real-time validation

### **4. Capper Pages** (`/cappers/shiva`, `/cappers/ifrit`, `/cappers/cerberus`)
- Capper profile and stats
- Recent picks with results
- "Run Algorithm" button (admin only)
- Debug logs (admin only)

### **5. Capper Management** (`/cappers/shiva/management`) - Admin only
- Configure factor weights
- Set confidence thresholds
- Enable/disable factors
- Test algorithm with live data

### **6. System Health** (`/admin/system-health`) - Admin only
- Recent algorithm runs
- Success/failure rates
- Execution times
- Error logs

### **7. Upgrade Page** (`/upgrade`)
- Pricing tiers (Free vs Capper)
- Feature comparison
- Payment integration (coming soon)

---

## 🔧 **API Routes**

### **Picks**
- `GET /api/picks` - Fetch picks (filters: capper, sport, date range)
- `POST /api/place-pick` - Submit a pick (capper/admin only)
- `POST /api/picks/grade` - Grade picks based on game results

### **Cappers**
- `GET /api/cappers/generate-pick` - Generate picks for a capper
- `GET /api/cappers/profile` - Get capper configuration
- `POST /api/cappers/profile` - Update capper configuration

### **Odds & Games**
- `GET /api/odds` - Fetch live odds from MySportsFeeds
- `GET /api/games` - Fetch scheduled games

### **Performance**
- `GET /api/performance` - Get capper performance stats
- `GET /api/leaderboard` - Get leaderboard data

### **Admin**
- `GET /api/admin/algorithm-runs` - Get algorithm run history
- `POST /api/admin/run-algorithm` - Manually trigger algorithm

---

## 📁 **Project Structure**

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── cappers/           # Capper pages
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── upgrade/           # Upgrade page
│   ├── leaderboard/       # Leaderboard page
│   └── page.tsx           # Dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── navigation/       # NavBar, UserMenu
│   ├── picks/            # Pick cards, betting slip
│   └── cappers/          # Capper-specific components
├── contexts/             # React contexts
│   ├── auth-context.tsx  # Auth state management
│   └── betting-slip-context.tsx
├── lib/                  # Utilities
│   ├── supabase/         # Supabase clients
│   ├── cappers/          # Capper algorithms
│   └── utils.ts          # Helper functions
└── middleware.ts         # Route protection
```

---

## 🎯 **SHIVA Algorithm (Example)**

### **Pick Generation Flow**
1. Fetch scheduled NBA games from MySportsFeeds
2. Fetch live odds (totals, spreads) from MySportsFeeds
3. For each game:
   - Calculate 5 base factors (F1-F5) using player stats, team stats
   - Calculate baseline average (e.g., 220 points)
   - Apply factor adjustments: `Projected Total = Baseline + F1 + F2 + F3 + F4 + F5`
   - Calculate Edge vs Market: `Edge = Projected - Market Line`
   - Calculate final confidence including Edge factor
   - Determine pick: OVER/UNDER based on edge direction
   - Apply confidence threshold (≥50% to pick, <50% = PASS)
4. Save picks to `picks` table
5. Log run to `algorithm_runs` table

### **Factor Configuration** (stored in `user_cappers.factor_config`)
```json
{
  "factors": [
    {
      "id": "F1",
      "name": "Offensive Firepower",
      "weight": 1.0,
      "enabled": true,
      "data_source": "MySportsFeeds"
    },
    // ... F2-F5
    {
      "id": "F6",
      "name": "Edge vs Market",
      "weight": 1.0,
      "enabled": true,
      "data_source": "System"
    }
  ],
  "thresholds": {
    "high": 70,
    "medium": 60,
    "low": 50
  }
}
```

---

## 🐛 **Known Issues & Quirks**

1. **Payment Integration**: Not yet implemented - upgrade button is disabled
2. **Email Verification**: Not enforced - users can sign up without verifying email
3. **Profile Fetch Timeout**: 3-second timeout to prevent infinite hangs
4. **Auth Flash**: Fixed - skip profile refetch if already loaded
5. **Spread Data**: Must be locked in `algorithm_runs.metadata` at pick generation time

---

## 🚀 **Deployment**

### **Vercel**
- Auto-deploys on push to `main` branch
- Environment variables set in Vercel dashboard
- Build command: `npm run build`
- Output directory: `.next`

### **Environment Variables**
```
NEXT_PUBLIC_SUPABASE_URL=https://xckbsyeaywrfzvcahhtk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MYSPORTSFEEDS_API_KEY=...
PERPLEXITY_API_KEY=...
OPENAI_API_KEY=...
```

---

## 📝 **Important Memories**

- **MySportsFeeds API** is critical - used frequently for odds, stats, games
- **Bold Predictions AI** was hallucinating stats - now uses real MySportsFeeds data
- **Data sources**: System, MySportsFeeds, Perplexity, OpenAI (only these 4)
- **SPREAD picks**: home/away spreads are opposite signs, sum to zero
- **run.metadata** is source of truth for locked odds/spreads at pick time
- **Missing market data** = PASS (never use fallback values)

---

**Last Updated**: 2025-11-13  
**App Version**: v1.0 (Post-Auth Fix)

