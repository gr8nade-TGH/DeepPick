# 🔍 BOLD PLAYER PREDICTIONS & PROFESSIONAL ANALYSIS - DETAILED REVIEW

**Date**: 2025-11-06  
**Status**: AWAITING APPROVAL TO IMPLEMENT

---

## 📊 PART 1: HOW BOLD PLAYER PREDICTIONS ARE DETERMINED

### **Current Implementation (Manual Wizard Only)**

**Data Sources Used**:
1. ✅ **Game Context** (from wizard state):
   - `game_data.away_team` - Away team name
   - `game_data.home_team` - Home team name
   - `game_data.game_date` - Game date/time

2. ✅ **Prediction Data** (from Step 4 & 5):
   - `prediction_data.predicted_total` - Our predicted total score
   - `prediction_data.pick_direction` - OVER or UNDER
   - `prediction_data.confidence` - Confidence score (0-5 scale in current prompt, should be 0-10)
   - `prediction_data.factors_summary` - Summary of key factors (F1-F5)

3. ❌ **NOT CURRENTLY USED** (but should be):
   - MySportsFeeds player stats (recent performance, averages)
   - MySportsFeeds injury data (player status, playing probability)
   - Team matchup history
   - Player vs opponent stats

### **AI Generation Process**

**Current Flow** (Lines 78-114 in `step5-5/route.ts`):
```
1. Build AI prompt with game context + prediction data
2. Call OpenAI (gpt-4o-mini) or Perplexity (llama-3.1-sonar-small-128k-online)
3. AI generates 2-4 player predictions with:
   - Player name
   - Team
   - Specific measurable prediction (e.g., "Will score 30+ points")
   - Reasoning (why this is likely)
   - Confidence level (High/Medium/Low)
4. AI generates summary explaining how predictions support the pick
5. Store in runs.metadata.steps.step6.bold_predictions (JSONB)
```

**Current Limitations**:
- ❌ Only uses internal prediction data (no external player stats)
- ❌ AI has no access to recent player performance trends
- ❌ AI has no access to injury reports
- ❌ Confidence scale mismatch (prompt says 0-5, but we use 0-10)
- ❌ Only works for TOTAL picks (not SPREAD)

---

## 🎯 PART 2: MYSPORTSFEEDS API CONFIRMATION

### **Your Current Subscription**

Based on your confirmation, you have:
- ✅ **NBA Live with 10-min delay** package
- ✅ **ODDS** addon
- ✅ **STATS** addon

### **Available Endpoints for Professional Analysis**

#### **1. Player Injuries** (5-second backoff)
- **Endpoint**: `/nba/{season}/player_injuries.json`
- **Addon Required**: STATS (✅ YOU HAVE THIS)
- **Data Returned**:
  - `currentInjury` object with:
    - `description` - Injury description
    - `playingProbability` - Likelihood of playing
    - `injuryStatus` - OUT, QUESTIONABLE, PROBABLE, etc.
- **Use Case**: Critical for professional analysis context

#### **2. Injury History** (5-second backoff)
- **Endpoint**: `/nba/{season}/injury_history.json`
- **Addon Required**: STATS (✅ YOU HAVE THIS)
- **Data Returned**: Historical injury data for trend analysis
- **Use Case**: Identify injury-prone players

#### **3. Daily/Weekly Player Gamelogs** (5-second backoff)
- **Endpoint**: `/nba/{season}/date/{date}/player_gamelogs.json`
- **Addon Required**: STATS (✅ YOU HAVE THIS)
- **Data Returned**: Recent player performance (points, rebounds, assists, etc.)
- **Use Case**: Identify hot/cold streaks for bold predictions

#### **4. Seasonal Player Stats** (5-second backoff)
- **Endpoint**: `/nba/{season}/player_stats_totals.json`
- **Addon Required**: STATS (✅ YOU HAVE THIS)
- **Data Returned**: Season averages for all players
- **Use Case**: Baseline for player performance expectations

#### **5. Daily/Weekly Team Gamelogs** (5-second backoff)
- **Endpoint**: `/nba/{season}/date/{date}/team_gamelogs.json`
- **Addon Required**: None (CORE) (✅ YOU HAVE THIS)
- **Data Returned**: Team performance trends
- **Use Case**: Already used in factors, can enhance analysis

#### **6. Game Lines (Odds)** (15-second backoff)
- **Endpoint**: `/nba/{season}/date/{date}/odds_gamelines.json`
- **Addon Required**: ODDS (✅ YOU HAVE THIS)
- **Data Returned**: Betting lines from multiple sportsbooks
- **Use Case**: Already used in odds sync

### **Rate Limit Summary**

**Your Current Implementation**:
- ✅ Global 30-second backoff enforced (Line 24 in `mysportsfeeds-api.ts`)
- ✅ Retry logic for 429 errors (max 3 retries)
- ✅ 100 requests per minute limit respected

**Backoff Requirements**:
- 5-second backoff: Player injuries, player gamelogs, team gamelogs, player stats
- 15-second backoff: Game lines (odds)
- 30-second backoff: Seasonal projections

**Your 30-second global backoff is SAFE** - it exceeds all requirements.

---

## 📝 PART 3: CURRENT PROMPTS REVIEW

### **3.1 Bold Player Predictions Prompt (TOTAL)**

**Current Prompt** (Lines 78-114 in `step5-5/route.ts`):

```
You are an expert NBA analyst tasked with making BOLD player predictions for an upcoming game.

GAME CONTEXT:
- Matchup: {away_team} @ {home_team}
- Game Date: {game_date}
- Predicted Total: {predicted_total} points
- Pick Direction: {pick_direction}
- Confidence: {confidence}/5.0  ⚠️ WRONG SCALE (should be /10.0)
- Key Factors: {factors_summary}

TASK:
Generate 2-4 BOLD player predictions that align with the {pick_direction} prediction.
If we're predicting OVER, focus on players likely to exceed expectations.
If UNDER, focus on players likely to underperform.

REQUIREMENTS:
1. Each prediction should be specific and measurable (e.g., "Player X will score 25+ points")
2. Predictions must align with the {pick_direction} direction
3. Consider recent form, matchups, injuries, and team dynamics
4. Be bold but realistic - these are high-confidence predictions
5. Include reasoning for each prediction
6. Focus on key players who can significantly impact the total

FORMAT:
Return a JSON object with this structure:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Why this prediction is likely",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief overall assessment of why these predictions support the {pick_direction} pick"
}

Research recent news, injury reports, and statistical trends to make the most accurate predictions possible.
```

**Issues**:
1. ❌ Confidence scale is wrong (says `/5.0` but should be `/10.0`)
2. ❌ No actual player stats provided (AI has to guess or use training data)
3. ❌ No injury data provided (AI can't know who's out)
4. ❌ Only works for TOTAL picks (not SPREAD)
5. ⚠️ Asks AI to "research" but doesn't provide data (only Perplexity can do web search)

---

### **3.2 Professional Analysis Prompt (TOTAL)**

**Current Implementation** (Lines 7-52 in `insight-card/[pickId]/route.ts`):

**NOT AI-GENERATED** - Uses template-based generation:

```typescript
function generateProfessionalWriteup(
  pick, confidence, factors, predictedTotal, marketTotal, awayTeam, homeTeam
): string {
  const edge = Math.abs(predictedTotal - marketTotal)
  const confidenceTier = confidence >= 7.0 ? 'high' : confidence >= 5.0 ? 'moderate' : 'low'
  
  return `Our advanced analytics model has identified ${confidenceTier} value on the ${selection} ${marketTotal.toFixed(1)} 
          in the ${awayTeam} at ${homeTeam} matchup. The model projects a total of ${predictedTotal.toFixed(1)} points, 
          which is ${edge.toFixed(1)} points ${edgeDirection} than the current market line...`
}
```

**Issues**:
1. ❌ Static template (not AI-generated)
2. ❌ No MySportsFeeds data integration
3. ❌ No injury context
4. ❌ No player performance trends
5. ❌ Generic and repetitive

---

### **3.3 Professional Analysis Prompt (SPREAD)**

**Current Implementation** (Lines 57-102 in `insight-card/[pickId]/route.ts`):

**Same issues as TOTAL** - Template-based, no AI, no external data.

---

## 🚀 PART 4: PROPOSED IMPROVED PROMPTS

### **4.1 Enhanced Bold Player Predictions Prompt (TOTAL)**

**New Prompt Structure**:

```
You are an expert NBA analyst specializing in player performance predictions.

GAME CONTEXT:
- Matchup: {away_team} @ {home_team}
- Game Date: {game_date}
- Predicted Total: {predicted_total} points
- Market Total: {market_total} points
- Pick Direction: {pick_direction}
- Confidence: {confidence}/10.0
- Edge: {edge} points

KEY FACTORS ANALYSIS:
{factors_summary}

INJURY REPORT:
{injury_data from MySportsFeeds}

RECENT PLAYER PERFORMANCE (Last 5 Games):
{player_gamelogs from MySportsFeeds}

TASK:
Generate 2-4 BOLD player predictions that align with our {pick_direction} prediction.

PREDICTION CRITERIA:
- If OVER: Focus on players likely to EXCEED their season averages
- If UNDER: Focus on players likely to UNDERPERFORM their season averages
- Consider injury impact (missing stars, role players stepping up)
- Consider recent form (hot/cold streaks)
- Consider matchup advantages/disadvantages

REQUIREMENTS:
1. Each prediction must be SPECIFIC and MEASURABLE
   ✅ Good: "Jayson Tatum will score 30+ points and grab 8+ rebounds"
   ❌ Bad: "Tatum will have a good game"

2. Predictions must ALIGN with our {pick_direction} pick
   - OVER picks: Predict high-scoring performances
   - UNDER picks: Predict defensive struggles or off-nights

3. Use PROVIDED DATA (injury reports, recent stats) in your reasoning

4. Be BOLD but REALISTIC - these are high-conviction predictions

5. Assign confidence levels based on:
   - HIGH: Player has 3+ game streak supporting prediction
   - MEDIUM: Player has mixed recent form but favorable matchup
   - LOW: Prediction is bold but has risk factors

FORMAT:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Data-driven explanation using injury reports and recent stats",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief assessment of how these predictions support the {pick_direction} pick"
}
```

**Key Improvements**:
- ✅ Correct confidence scale (0-10)
- ✅ Includes injury data from MySportsFeeds
- ✅ Includes recent player performance data
- ✅ Clear criteria for HIGH/MEDIUM/LOW confidence
- ✅ Specific examples of good vs bad predictions

---

### **4.2 Enhanced Bold Player Predictions Prompt (SPREAD)**

**New Prompt Structure**:

```
You are an expert NBA analyst specializing in player performance predictions.

GAME CONTEXT:
- Matchup: {away_team} @ {home_team}
- Game Date: {game_date}
- Predicted Margin: {predicted_margin} points ({favored_team} favored)
- Market Spread: {market_spread}
- Pick: {selection} ({team_name})
- Confidence: {confidence}/10.0
- Edge: {edge} points

KEY FACTORS ANALYSIS:
{factors_summary}

INJURY REPORT:
{injury_data from MySportsFeeds}

RECENT PLAYER PERFORMANCE (Last 5 Games):
{player_gamelogs from MySportsFeeds}

TASK:
Generate 2-4 BOLD player predictions that align with our {selection} pick.

PREDICTION CRITERIA:
- If picking FAVORITE: Focus on star players dominating, role players contributing
- If picking UNDERDOG: Focus on opponent stars struggling, underdog stars stepping up
- Consider injury impact (missing defenders, offensive weapons)
- Consider recent form (momentum, confidence)
- Consider matchup advantages (size, speed, shooting)

REQUIREMENTS:
1. Each prediction must be SPECIFIC and MEASURABLE
   ✅ Good: "Luka Doncic will score 35+ points and dish 10+ assists"
   ❌ Bad: "Luka will play well"

2. Predictions must SUPPORT our {selection} pick
   - If picking favorite: Predict dominant performances from favorite's stars
   - If picking underdog: Predict struggles from favorite's stars OR breakout from underdog

3. Use PROVIDED DATA (injury reports, recent stats) in your reasoning

4. Be BOLD but REALISTIC - these are high-conviction predictions

5. Assign confidence levels based on:
   - HIGH: Player has 3+ game streak supporting prediction + favorable matchup
   - MEDIUM: Player has mixed recent form but strong historical vs opponent
   - LOW: Prediction is bold but has risk factors (injury concern, tough matchup)

FORMAT:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Data-driven explanation using injury reports and recent stats",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief assessment of how these predictions support the {selection} pick"
}
```

**Key Improvements**:
- ✅ Adapted for SPREAD picks (margin, favorite/underdog)
- ✅ Includes injury data from MySportsFeeds
- ✅ Includes recent player performance data
- ✅ Clear criteria for favorite vs underdog predictions
- ✅ Specific examples of good vs bad predictions

---

### **4.3 Enhanced Professional Analysis Prompt (TOTAL)**

**New AI-Generated Prompt**:

```
You are a professional sports betting analyst writing a detailed game analysis for a premium betting service.

GAME CONTEXT:
- Matchup: {away_team} @ {home_team}
- Game Date: {game_date}
- Market Total: {market_total} points
- Our Predicted Total: {predicted_total} points
- Edge: {edge} points {direction}
- Pick: {selection} {market_total}
- Confidence: {confidence}/10.0
- Units: {units}

FACTOR ANALYSIS:
{detailed_factor_breakdown}

INJURY REPORT:
{injury_data from MySportsFeeds}

RECENT TEAM PERFORMANCE:
{team_gamelogs from MySportsFeeds}

TASK:
Write a professional 3-4 paragraph analysis explaining this pick to a sophisticated betting audience.

STRUCTURE:

Paragraph 1 - MARKET EDGE:
- Lead with our edge ({edge} points {direction})
- Explain why the market is mispriced
- Reference confidence level and unit allocation

Paragraph 2 - FACTOR ANALYSIS:
- Highlight the 2-3 most impactful factors
- Use specific data points (pace, efficiency, recent trends)
- Explain how factors combine to support the pick

Paragraph 3 - INJURY & CONTEXT:
- Discuss key injuries and their impact
- Mention recent team form (winning/losing streaks)
- Note any scheduling advantages (rest, travel)

Paragraph 4 - CONCLUSION:
- Summarize the thesis
- Restate confidence level
- Final recommendation

TONE:
- Professional and analytical (not hype or salesy)
- Data-driven (cite specific stats and trends)
- Confident but measured (acknowledge risks)
- Avoid clichés ("lock of the day", "can't miss")

LENGTH: 200-300 words

Return ONLY the analysis text (no JSON, no formatting).
```

**Key Improvements**:
- ✅ AI-generated (not template)
- ✅ Includes MySportsFeeds injury data
- ✅ Includes team performance trends
- ✅ Structured 3-4 paragraph format
- ✅ Professional tone guidelines
- ✅ Specific word count (200-300 words)

---

### **4.4 Enhanced Professional Analysis Prompt (SPREAD)**

**New AI-Generated Prompt**:

```
You are a professional sports betting analyst writing a detailed game analysis for a premium betting service.

GAME CONTEXT:
- Matchup: {away_team} @ {home_team}
- Game Date: {game_date}
- Market Spread: {market_spread}
- Our Predicted Margin: {predicted_margin} points
- Edge: {edge} points
- Pick: {selection}
- Confidence: {confidence}/10.0
- Units: {units}

FACTOR ANALYSIS:
{detailed_factor_breakdown}

INJURY REPORT:
{injury_data from MySportsFeeds}

RECENT TEAM PERFORMANCE:
{team_gamelogs from MySportsFeeds}

TASK:
Write a professional 3-4 paragraph analysis explaining this spread pick to a sophisticated betting audience.

STRUCTURE:

Paragraph 1 - MARKET EDGE:
- Lead with our edge ({edge} points)
- Explain why we favor {selection}
- Reference confidence level and unit allocation

Paragraph 2 - MATCHUP ANALYSIS:
- Highlight the 2-3 most impactful factors
- Discuss offensive/defensive advantages
- Use specific data points (efficiency, pace, recent form)

Paragraph 3 - INJURY & CONTEXT:
- Discuss key injuries and their impact on the spread
- Mention recent team form and momentum
- Note any scheduling advantages (rest, travel, home/away splits)

Paragraph 4 - CONCLUSION:
- Summarize why {selection} covers the spread
- Restate confidence level
- Final recommendation

TONE:
- Professional and analytical (not hype or salesy)
- Data-driven (cite specific stats and trends)
- Confident but measured (acknowledge risks)
- Avoid clichés ("lock of the day", "can't miss")

LENGTH: 200-300 words

Return ONLY the analysis text (no JSON, no formatting).
```

**Key Improvements**:
- ✅ AI-generated (not template)
- ✅ Adapted for SPREAD picks (margin, matchup analysis)
- ✅ Includes MySportsFeeds injury data
- ✅ Includes team performance trends
- ✅ Structured 3-4 paragraph format
- ✅ Professional tone guidelines

---

## ✅ PART 5: NEXT STEPS

### **Decisions Made**:
1. ✅ Use **OpenAI** (gpt-4o-mini) for all AI generation
2. ✅ Store professional analysis in **runs table** (single source of truth)
3. ✅ Include in **locked snapshots** (immutable)

### **Implementation Plan**:

**Phase 1**: Add MySportsFeeds injury endpoint (30 min)
**Phase 2**: Update bold predictions prompt + add SPREAD support (1 hour)
**Phase 3**: Create professional analysis generator with OpenAI (2 hours)
**Phase 4**: Add database columns and update trigger (1 hour)
**Phase 5**: Test end-to-end (1 hour)

**Total Time**: 5-6 hours

### **Questions for Final Approval**:

1. ✅ **AI Provider**: OpenAI (confirmed)
2. ✅ **Storage**: Runs table (confirmed)
3. ⏳ **MySportsFeeds Data**: Should we fetch injury data for EVERY pick, or only when injuries are detected?
4. ⏳ **Fallback**: If OpenAI fails, should we use template-based analysis or return error?
5. ⏳ **Caching**: Should we cache MySportsFeeds injury data for 5 minutes to reduce API calls?

**Ready to proceed once you approve the prompts and answer the 3 remaining questions!**

