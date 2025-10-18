# Oracle AI Capper - Implementation Summary

## 🎯 What We Built

We've implemented **Oracle**, your first fully AI-powered sports betting capper that autonomously researches matchups, analyzes data, and generates picks with natural language insights.

## 📁 Files Created/Modified

### New Files

1. **Database Migration**
   - `supabase/migrations/011_ai_capper_system.sql`
   - Adds Oracle to capper enum
   - Adds AI-specific columns: `ai_insight`, `ai_research`, `factors_analyzed`, `ai_model_version`

2. **AI Client Library**
   - `src/lib/ai/perplexity-client.ts`
   - Handles Perplexity API integration
   - Performs deep web research
   - Gets AI betting recommendations
   - Parses responses and extracts structured data

3. **Oracle Algorithm**
   - `src/lib/cappers/oracle-algorithm.ts`
   - Full AI-powered capper logic
   - Research → Analysis → Prediction → Decision pipeline
   - Integrates with existing capper infrastructure

4. **API Route**
   - `src/app/api/run-oracle/route.ts`
   - Endpoint to trigger Oracle
   - Handles API key validation
   - Stores picks with AI insights
   - Manages timeouts (5 min max duration)

5. **UI Page**
   - `src/app/cappers/oracle/page.tsx`
   - Beautiful purple/pink gradient theme
   - Shows AI capabilities
   - Manual trigger with status feedback
   - Cost and performance info

6. **Documentation**
   - `AI_CAPPER_SETUP.md` - Complete setup guide
   - `ORACLE_AI_IMPLEMENTATION_SUMMARY.md` - This file

### Modified Files

1. **Environment Config**
   - `env.example` - Added `PERPLEXITY_API_KEY`

2. **Auto-Run System**
   - `src/app/api/auto-run-cappers/route.ts` - Added Oracle (commented out by default)

3. **Cappers README**
   - `src/app/cappers/README.md` - Added Oracle to list

## 🔮 How Oracle Works

### 1. Deep Web Research (Perplexity API)
```typescript
const research = await perplexity.researchMatchup(
  homeTeam, awayTeam, sport, gameDate,
  { useProSearch: true, recencyFilter: 'week' }
)
```

Oracle searches the web for:
- Recent team form and performance
- Injury reports and lineup changes
- Head-to-head history
- Weather conditions
- Betting trends and line movement
- Expert analyst opinions

### 2. AI Analysis & Prediction
```typescript
const recommendation = await perplexity.getBettingRecommendation(
  homeTeam, awayTeam, sport, gameDate, 
  currentOdds, research, capperPersonality
)
```

AI then:
- Assigns weights to factors (recent form: 20%, injuries: 15%, vegas comparison: 30%, etc.)
- Predicts the game score
- Compares prediction to Vegas odds
- Calculates confidence (1-10 scale)
- Recommends bet type and units

### 3. Decision Making

Oracle only makes a pick when:
- ✅ Confidence ≥ 7.0/10
- ✅ Clear value vs Vegas odds
- ✅ No duplicate pick type exists
- ✅ Passes favorite rule (if applicable)

### 4. Units Allocation
- 7.0-7.9 confidence → 1 unit
- 8.0-8.9 confidence → 2 units
- 9.0-9.4 confidence → 3 units
- 9.5-9.7 confidence → 4 units
- 9.8+ confidence → 5 units

## 💾 Database Schema

### New Columns in `picks` Table

```sql
ai_insight TEXT
-- Natural language explanation of the pick
-- Example: "The Lakers have dominated the Clippers in recent matchups, 
-- winning 7 of the last 10. LeBron's return from injury gives them a 
-- significant edge. Our model predicts a 8-point victory vs the 5.5 spread."

ai_research JSONB
-- Structured research data
{
  "summary": "Lakers vs Clippers analysis...",
  "insights": [
    "Lakers on 5-game win streak",
    "Clippers missing Kawhi Leonard"
  ],
  "injuries": [
    {"team": "LAC", "player": "Kawhi Leonard", "status": "Out"}
  ],
  "sources": [
    {"url": "espn.com/...", "title": "Lakers dominate Clippers", "snippet": "..."}
  ]
}

factors_analyzed JSONB
-- Weighted factors that influenced the decision
{
  "recent_form": {
    "value": 75,
    "weight": 20,
    "impact": "Home team on 5-game win streak"
  },
  "injuries": {
    "value": 60,
    "weight": 15,
    "impact": "Away team missing starting player"
  },
  "vegas_comparison": {
    "value": 85,
    "weight": 30,
    "impact": "Our prediction shows 8-point edge"
  }
}

ai_model_version TEXT
-- Example: 'perplexity-sonar-pro'
```

## 🚀 Usage

### Setup

1. Get Perplexity API key: https://www.perplexity.ai/settings/api
2. Add to `.env.local`:
   ```bash
   PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. Run migration:
   ```bash
   npx supabase db push
   ```

### Running Oracle

**Via API:**
```bash
curl -X POST http://localhost:3000/api/run-oracle
```

**Via UI:**
Visit `/cappers/oracle` and click "Run Oracle AI"

**Via Cron (optional):**
Uncomment Oracle in `src/app/api/auto-run-cappers/route.ts`

### Response Example

```json
{
  "success": true,
  "message": "Oracle generated 3 AI-powered picks",
  "picks": [...],
  "analysis": [
    {
      "selection": "Lakers -5.5",
      "confidence": 8.5,
      "units": 2,
      "aiInsight": "Detailed AI reasoning...",
      "research": {
        "keyInsights": ["Lakers on streak", "Clippers injuries"],
        "injuries": [...],
        "sources": [...]
      },
      "factors": {
        "recent_form": { "value": 75, "weight": 20, "impact": "..." },
        "vegas_comparison": { "value": 85, "weight": 30, "impact": "..." }
      }
    }
  ]
}
```

## 💰 Cost Analysis

### Per-Pick Costs
- **Research call**: ~$0.01-0.03 (Perplexity Sonar Pro)
- **Recommendation call**: ~$0.01-0.02 (Perplexity Sonar Pro)
- **Total**: ~$0.02-0.05 per pick

### Monthly Estimates
- **Conservative** (3 picks/day): ~$1.80-4.50/month
- **Moderate** (10 picks/day): ~$6-15/month
- **Aggressive** (30 picks/day): ~$18-45/month

### Cost Optimization
- Use standard `sonar` model instead of `sonar-pro` (~5x cheaper)
- Reduce max picks per run (currently 3)
- Run less frequently (daily vs hourly)
- Enable only for specific high-value sports

## 📊 Monitoring Performance

### Compare Oracle to Other Cappers

```sql
SELECT 
  capper,
  COUNT(*) as total_picks,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
  ROUND(AVG(confidence), 2) as avg_confidence,
  SUM(net_units) as total_units,
  ROUND(SUM(net_units)::NUMERIC / COUNT(*)::NUMERIC, 2) as avg_units_per_pick
FROM picks
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY capper
ORDER BY total_units DESC;
```

### Analyze Which Factors Lead to Wins

```sql
SELECT 
  jsonb_object_keys(factors_analyzed) as factor,
  AVG(CAST(factors_analyzed->jsonb_object_keys(factors_analyzed)->>'value' AS FLOAT)) as avg_value,
  AVG(CAST(factors_analyzed->jsonb_object_keys(factors_analyzed)->>'weight' AS FLOAT)) as avg_weight,
  COUNT(*) FILTER (WHERE status = 'won') as wins,
  COUNT(*) FILTER (WHERE status = 'lost') as losses,
  ROUND(COUNT(*) FILTER (WHERE status = 'won')::NUMERIC / COUNT(*)::NUMERIC * 100, 1) as win_rate
FROM picks
WHERE capper = 'oracle' AND factors_analyzed IS NOT NULL
GROUP BY factor
ORDER BY win_rate DESC;
```

### View Oracle Insights

```sql
SELECT 
  p.id,
  g.away_team->>'name' || ' @ ' || g.home_team->>'name' as matchup,
  p.selection,
  p.confidence,
  p.units,
  p.status,
  p.net_units,
  p.ai_insight,
  p.factors_analyzed
FROM picks p
JOIN games g ON p.game_id = g.id
WHERE p.capper = 'oracle'
ORDER BY p.created_at DESC
LIMIT 10;
```

## 🎨 UI Features

The Oracle page (`/cappers/oracle`) includes:

1. **Beautiful AI-themed design**
   - Purple/pink/blue gradient
   - Animated pulsing brain icon
   - Glassmorphism effects

2. **Setup validation**
   - Checks if API key is set
   - Shows setup instructions if not
   - Direct link to Perplexity API settings

3. **AI capability showcase**
   - Deep Research card
   - AI Analysis card
   - Smart Betting card

4. **Cost transparency**
   - Per-pick cost estimate
   - Processing time info
   - Max picks per run

5. **Live game list**
   - Shows available games
   - Ready-for-AI badges
   - Game details

## 🔧 Extending Oracle

### Add More AI Models

The architecture is designed to be model-agnostic. To add OpenAI, Claude, or other models:

1. **Create AI client** (e.g., `src/lib/ai/openai-client.ts`)
2. **Implement same interface**:
   - `researchMatchup()` - Use OpenAI + Tavily/Serper for search
   - `getBettingRecommendation()` - Use GPT-4 for analysis
3. **Update Oracle algorithm** to support multiple models
4. **A/B test** different models and compare performance

Example structure for OpenAI:
```typescript
// src/lib/ai/openai-client.ts
export class OpenAIClient {
  async researchMatchup(...) {
    // Use Tavily API for web search
    const searchResults = await tavily.search(query)
    
    // Use GPT-4 to analyze results
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [...]
    })
    
    return parseResearch(analysis)
  }
  
  async getBettingRecommendation(...) {
    // Similar to Perplexity but with GPT-4
  }
}
```

### Phase 2: Learning System (Future)

Next step is to make Oracle learn from past picks:

```typescript
// After game is graded
async function updateOracleWeights(pickId: string) {
  const pick = await getPick(pickId)
  const factors = pick.factors_analyzed
  
  // If pick won, increase weight of high-value factors
  // If pick lost, decrease weight of high-value factors
  
  await updateModelWeights({
    capper: 'oracle',
    version: pick.ai_model_version,
    adjustments: calculateAdjustments(pick)
  })
}
```

Store model versions and weights in database:
```sql
CREATE TABLE ai_model_versions (
  id UUID PRIMARY KEY,
  capper TEXT NOT NULL,
  version TEXT NOT NULL,
  factor_weights JSONB NOT NULL,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🤝 Integration with Existing System

Oracle integrates seamlessly:

✅ Uses same `CapperGame` and `CapperPick` types  
✅ Works with duplicate checker  
✅ Logs to `algorithm_run_logs` table  
✅ Follows same confidence/units system  
✅ Respects favorite odds rules  
✅ Shows up in leaderboard with other cappers  

## 🐛 Troubleshooting

### "PERPLEXITY_API_KEY not set"
- Add key to `.env.local`
- Restart dev server

### "Rate limit exceeded"
- Add delays between picks (already implemented: 1s)
- Upgrade Perplexity plan
- Reduce max picks

### "Failed to parse AI recommendation"
- AI returned invalid JSON
- Check logs for raw response
- Lower temperature for more consistent output (currently 0.3)

### Picks always PASS
- AI might be too conservative
- Lower confidence threshold (currently 7.0)
- Adjust prompts to be more aggressive

## 📈 Next Steps

### Phase 2: Multi-Model Ensemble
- Add OpenAI GPT-4 option
- Add Anthropic Claude option
- Compare models and combine predictions

### Phase 3: Learning System
- Track factor effectiveness
- Auto-adjust weights based on wins/losses
- Model versioning and A/B testing

### Phase 4: Real-Time Adaptation
- Live game analysis
- In-game betting recommendations
- Dynamic odds tracking

## 🎓 Key Learnings

1. **AI for sports betting is powerful** - Real-time research + analysis finds edges
2. **Prompt engineering matters** - Specific prompts with JSON schema = consistent output
3. **Cost management is crucial** - Use limits, delays, and model selection
4. **Transparency builds trust** - Show sources, factors, and reasoning
5. **Hybrid approach works best** - Combine AI insights with deterministic rules

## 🙏 Credits

- **Perplexity AI** - Web search and analysis
- **Supabase** - Database and storage
- **Vercel** - Hosting and serverless functions
- **Your existing capper architecture** - Clean, extensible design

---

## Summary

You now have a fully functional AI-powered sports betting capper that:
- 🔍 Researches matchups via web search
- 🤖 Uses AI to analyze and predict
- 📊 Compares to Vegas for value
- 💡 Generates natural language insights
- 🎯 Makes autonomous betting decisions
- 📈 Tracks performance alongside other cappers

**Oracle is ready to find value that humans and deterministic algorithms might miss!** 🔮✨

