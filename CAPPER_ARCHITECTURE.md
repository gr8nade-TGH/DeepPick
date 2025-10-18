# 🤖 Multi-Capper System Architecture

## Overview

DeepPick uses 4 specialized betting bots, each with unique algorithms, plus the ultimate "DeepPick" bot that combines insights from all.

---

## 🎯 The Four Cappers

### 1. **NEXUS** - Pattern Recognition Bot
**Color:** Purple/Pink  
**Strategy:** Historical patterns, line movement, sharp money detection  
**Page:** `/cappers/nexus`

**Algorithm Focus:**
- Line movement analysis (tracks odds changes)
- Value detection (finds discrepancies between books)
- Sharp money indicators (reverse line movement)
- Contrarian approach (fade public when appropriate)

**Confidence Scoring:**
- Line Movement: +15%
- Odds Value: +20%
- Sharp Action: +25%
- Public Fade: +15%

---

### 2. **SHIVA** - Statistical Powerhouse
**Color:** Blue/Cyan  
**Strategy:** Advanced statistics, regression models, Elo ratings  
**Page:** `/cappers/shiva`

**Algorithm Focus:**
- Team performance metrics (offensive/defensive ratings)
- Advanced stats (possession, efficiency, pace)
- Elo rating system
- Regression to the mean analysis
- Home/away splits

**Confidence Scoring:**
- Statistical Edge: +30%
- Elo Advantage: +20%
- Matchup Favorability: +25%
- Regression Opportunity: +15%

---

### 3. **CERBERUS** - Multi-Model Ensemble
**Color:** Red/Orange  
**Strategy:** Combines multiple models, weighted voting system  
**Page:** `/cappers/cerberus`

**Algorithm Focus:**
- Runs 3 sub-models simultaneously:
  - Model A: Momentum-based
  - Model B: Value-based  
  - Model C: Situational
- Weighted voting system
- Only picks when 2+ models agree
- Confidence = agreement level

**Confidence Scoring:**
- All 3 Agree: 90%+
- 2 Models Agree: 60-75%
- Split Decision: No pick

---

### 4. **IFRIT** - Aggressive High-Variance
**Color:** Yellow/Red  
**Strategy:** High-risk, high-reward, underdog specialist  
**Page:** `/cappers/ifrit`

**Algorithm Focus:**
- Underdog value hunting (+150 or higher)
- Upset probability models
- Motivation factors (revenge games, playoffs)
- Live betting opportunities
- Parlay construction

**Confidence Scoring:**
- Underdog Value: +40%
- Upset Indicators: +30%
- Situational Edge: +20%

---

### 5. **DEEPPICK** - The Ultimate Bot
**Color:** Blue/Cyan/Green  
**Strategy:** Meta-algorithm that analyzes all 4 cappers  
**Page:** Main dashboard

**Algorithm Focus:**
- Aggregates picks from all 4 cappers
- Weights by historical performance
- Identifies consensus picks (high confidence)
- Manages bankroll across all bots
- Kelly Criterion for unit sizing

**Pick Selection:**
- If 3+ cappers agree: Auto-place (high units)
- If 2 cappers agree: Review (medium units)
- Unique picks: Monitor (low units)

---

## 📊 Record Tracking Logic

### Database Structure:
```sql
picks table:
- id (UUID)
- game_id (UUID, nullable)
- capper (ENUM: nexus, shiva, cerberus, ifrit, deeppick)
- pick_type (moneyline, spread, total)
- selection (team name)
- odds (integer)
- units (decimal)
- status (pending, won, lost, push)
- net_units (decimal, calculated on grade)
- confidence (decimal, 0-100)
- reasoning (text)
- created_at (timestamp)
```

### API Endpoints:
- `GET /api/picks?capper=nexus` - Get Nexus picks
- `GET /api/performance?capper=nexus` - Get Nexus stats
- `POST /api/place-pick` - Place pick (include capper field)

### Performance Calculation:
```typescript
// Calculated per capper
{
  total_picks: count(*),
  wins: count(status='won'),
  losses: count(status='lost'),
  pushes: count(status='push'),
  win_rate: (wins / (wins + losses)) * 100,
  units_bet: sum(units),
  net_units: sum(net_units),
  roi: (net_units / units_bet) * 100
}
```

---

## 🔄 Pick Generation Flow

### 1. **Scheduled Cron Job** (Every 15 minutes)
```
/api/auto-refresh-odds
  ↓
Fetches fresh odds
  ↓
Triggers each capper's algorithm
  ↓
Each capper analyzes games independently
```

### 2. **Individual Capper Analysis**
```
Capper fetches games from /api/odds
  ↓
Runs algorithm logic
  ↓
Calculates confidence scores
  ↓
If confidence > threshold:
  ↓
Places pick via /api/place-pick
  ↓
Pick stored with capper ID
```

### 3. **Auto-Grading** (When game completes)
```
/api/fetch-scores updates game status
  ↓
Database trigger: grade_picks_for_game()
  ↓
Grades ALL pending picks for that game
  ↓
Updates pick.status and pick.net_units
  ↓
Works for ALL cappers automatically
```

---

## 🎮 Dashboard Filtering

### Capper Selector:
- **All Cappers:** Shows combined results
  - All picks with capper badges
  - Combined profit chart
  - Total W-L-P record

- **Individual Capper:** Shows filtered results
  - Only that capper's picks
  - Their profit chart
  - Their W-L-P record

### Performance Comparison:
```typescript
// Future feature: Compare all cappers side-by-side
{
  nexus: { roi: 5.2%, record: '15-10-2' },
  shiva: { roi: 3.8%, record: '12-8-1' },
  cerberus: { roi: 7.1%, record: '10-5-0' },
  ifrit: { roi: -2.3%, record: '8-12-1' },
  deeppick: { roi: 6.5%, record: '20-15-2' }
}
```

---

## 🚀 Implementation Phases

### Phase 1: ✅ Infrastructure (COMPLETE)
- [x] Database schema with capper column
- [x] API filtering by capper
- [x] Dashboard capper selector
- [x] Performance tracking per capper

### Phase 2: 🔄 Algorithm Pages (IN PROGRESS)
- [x] Nexus page created
- [ ] Shiva page
- [ ] Cerberus page
- [ ] Ifrit page
- [ ] DeepPick meta-algorithm

### Phase 3: 📊 Algorithm Logic
- [ ] Implement Nexus pattern recognition
- [ ] Implement Shiva statistical models
- [ ] Implement Cerberus ensemble
- [ ] Implement Ifrit underdog hunting
- [ ] Implement DeepPick aggregation

### Phase 4: 🤖 Automation
- [ ] Auto-trigger cappers on odds refresh
- [ ] Auto-place high-confidence picks
- [ ] Bankroll management system
- [ ] Kelly Criterion unit sizing

### Phase 5: 📈 Advanced Features
- [ ] Machine learning models
- [ ] Public betting data integration
- [ ] Live betting support
- [ ] Parlay construction
- [ ] Performance comparison dashboard

---

## 💡 Key Design Decisions

### Why Separate Cappers?
1. **Specialization:** Each bot focuses on specific edge
2. **Risk Management:** Diversification across strategies
3. **A/B Testing:** Compare algorithm performance
4. **Transparency:** Users see which bot made which pick
5. **Modularity:** Easy to add/remove/modify bots

### Why Auto-Grading Works for All:
- Trigger runs on game completion (not capper-specific)
- Grades ALL pending picks for that game
- Each pick has its own status/net_units
- No manual intervention needed

### Why Capper Pages?
- Dedicated space for algorithm development
- Test/debug individual strategies
- Manual override capability
- Educational for users

---

## 📝 Next Steps

1. **Complete Algorithm Pages** - Create Shiva, Cerberus, Ifrit pages
2. **Implement Core Logic** - Build actual algorithm functions
3. **Add Auto-Placement** - Connect algorithms to /api/place-pick
4. **Build DeepPick Meta** - Aggregate insights from all cappers
5. **Performance Dashboard** - Compare all cappers side-by-side

---

**This architecture supports fully automated, multi-strategy sports betting!** 🤖🎯

