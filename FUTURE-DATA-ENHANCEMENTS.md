# 🚀 Future Data Enhancements for DeepPick

## 📊 What The Odds API Offers (Beyond What We're Using)

### Currently Using ✅
- Moneyline odds (who wins)
- Spread odds (point spread)
- Totals (over/under)
- 4 bookmakers (DraftKings, FanDuel, BetMGM, Caesars)

### Available But Not Yet Implemented 🔜

---

## 1. Player Props 🏀🏈⚾

**What it is**: Betting markets for individual player performance

**Examples**:
- LeBron James over/under 25.5 points
- Patrick Mahomes over/under 2.5 passing TDs
- Aaron Judge over/under 1.5 total bases

**API Endpoint**: `/v4/sports/{sport}/events/{eventId}/odds`
- Add `markets=player_points,player_rebounds,player_assists` parameter

**Use Cases for DeepPick**:
- Ifrit algorithm could target high-scoring players
- Nexus could analyze player consistency
- Create a "Player Props" page showing top opportunities

**Implementation Complexity**: Medium
- Need to store player-specific data
- Requires new database tables (`player_props`, `player_stats`)

---

## 2. Live In-Game Odds 🔴

**What it is**: Real-time odds updates DURING games

**How it works**:
- Odds change every few seconds as game progresses
- Example: Lakers -5 at halftime becomes -8 if they're dominating

**API Endpoint**: Same as current, but called more frequently during game time

**Use Cases for DeepPick**:
- Live betting opportunities
- Track how odds move with game flow
- Analyze which bookmakers adjust fastest
- Create "Live Betting" dashboard

**Implementation Complexity**: High
- Requires very frequent API calls (expensive)
- Need real-time UI updates (websockets?)
- Database would grow rapidly

**Cost Consideration**: 🚨
- Live odds = 1 API call per sport per minute during games
- NFL: ~15 games/week × 3 hours × 60 calls = 2,700 calls/week
- **Not recommended for free tier**

---

## 3. Historical Odds Data 📈

**What it is**: Archive of past odds for trend analysis

**API Endpoint**: `/v4/historical/sports/{sport}/odds`
- Requires paid "Historical Data" add-on

**Use Cases for DeepPick**:
- Train ML models on past odds movements
- Analyze which bookmakers have best lines historically
- Identify patterns (e.g., "home underdogs in NFL cover 60% of time")
- Backtest capper algorithms

**Implementation Complexity**: Medium
- One-time data import
- Analyze offline, not real-time

**Cost**: 💰
- Separate subscription ($50-200/month depending on volume)

---

## 4. Additional Bookmakers 🎰

**Currently using**: 4 bookmakers

**Available**: 20+ bookmakers including:
- Bet365
- PointsBet
- Barstool
- Unibet
- WynnBET
- BetRivers
- And more...

**How to add**: Just add bookmaker keys to API request
```javascript
bookmakers: 'draftkings,fanduel,betmgm,williamhill_us,bet365,pointsbet'
```

**Use Cases**:
- Find the best line across more books
- Arbitrage opportunities (bet both sides at different books for guaranteed profit)
- More data points = better average odds

**Cost**: Same API call, just more data returned

---

## 5. Alternate Lines 📊

**What it is**: Multiple spread/total options for same game

**Example**:
- Standard: Lakers -5.5 (-110)
- Alt Line 1: Lakers -3.5 (-150)
- Alt Line 2: Lakers -7.5 (+120)

**API Endpoint**: Add `markets=alternate_spreads,alternate_totals`

**Use Cases**:
- Find value in alternate lines
- Cappers could target specific spreads
- More betting options per game

**Implementation Complexity**: Low
- Just add market types to API call
- Display in UI

---

## 6. Team Statistics (External APIs) 📈

**The Odds API does NOT provide team stats**, but we could integrate:

### Option A: SportsData.io
- Team records (W-L)
- Recent form (last 5 games)
- Offensive/defensive rankings
- Home/away splits

**Cost**: $20-100/month

### Option B: ESPN API (Unofficial)
- Free but rate-limited
- Less reliable

### Option C: Scrape from public sources
- Free but fragile
- Against some sites' ToS

**Use Cases**:
- Ifrit: Target high-scoring teams
- Nexus: Factor in recent form
- Cerberus: Analyze defensive matchups

---

## 7. Injury Reports 🏥

**Not available from The Odds API**

**Alternative Sources**:
- ESPN API
- FantasyData.com
- SportsData.io

**Use Cases**:
- Adjust capper confidence if star player out
- Alert users to injury-impacted games
- Factor into algorithm decisions

**Implementation**: Would require separate API integration

---

## 8. Weather Data ☁️

**For outdoor sports** (NFL, MLB)

**API Options**:
- OpenWeatherMap (free tier available)
- WeatherAPI.com

**Use Cases**:
- NFL: Wind affects passing, cold affects kicking
- MLB: Wind affects home runs, rain delays
- Adjust totals (O/U) based on weather

**Implementation Complexity**: Low
- Fetch weather for game location
- Display on game cards

---

## 🎯 Recommended Priority

### Phase 1 (Now) ✅
- [x] Basic odds (moneyline, spread, totals)
- [x] Odds history tracking
- [x] Settings system for API management

### Phase 2 (Next 2-4 weeks)
1. **Add more bookmakers** (easy, free)
2. **Alternate lines** (easy, adds value)
3. **Weather integration** (medium, useful for NFL/MLB)

### Phase 3 (1-2 months)
4. **Team statistics** (medium, requires paid API)
5. **Player props** (medium-hard, new data model)

### Phase 4 (Future)
6. **Historical data** (for ML training)
7. **Live in-game odds** (expensive, advanced)
8. **Injury reports** (requires scraping or paid API)

---

## 💰 Cost Breakdown

### Current Setup (Free Tier)
- The Odds API: 500 requests/month FREE
- 3 sports × 15 min intervals = ~8,640 calls/month
- **Need paid plan**: $10-50/month for 10,000-50,000 calls

### With Enhancements
- **More bookmakers**: No extra cost (same API call)
- **Alternate lines**: No extra cost (same API call)
- **Weather API**: FREE (OpenWeatherMap free tier)
- **Team stats**: $20-100/month (SportsData.io)
- **Player props**: Included in base API cost
- **Historical data**: $50-200/month (separate add-on)
- **Live odds**: $100-500/month (very high call volume)

---

## 🛠️ Implementation Roadmap

### Week 1-2: More Bookmakers & Alternate Lines
```javascript
// In simple-ingest route
const bookmakers = 'draftkings,fanduel,betmgm,williamhill_us,bet365,pointsbet,barstool'
const markets = 'h2h,spreads,totals,alternate_spreads,alternate_totals'
```

### Week 3-4: Weather Integration
```javascript
// New API route: /api/weather
// Fetch weather for game location
// Display on odds page and dashboard
```

### Month 2: Team Statistics
```javascript
// Integrate SportsData.io
// New tables: team_stats, recent_form
// Display on "Factors" page
```

### Month 3: Player Props
```javascript
// New tables: player_props, player_stats
// New page: /props
// Cappers can analyze player performance
```

---

## 📝 Notes

- Focus on **free/cheap enhancements first** (more bookmakers, weather)
- **Player props** are high-value but require database redesign
- **Live odds** are expensive and complex - save for later
- **Historical data** is best for ML training, not real-time betting

Your debug report now validates settings are working correctly. Next step is to add more data sources based on priority! 🚀


