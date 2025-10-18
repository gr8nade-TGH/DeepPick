# Oracle AI Capper Setup Guide

## Overview

Oracle is DeepPick's first fully AI-powered capper that uses artificial intelligence to:
- 🔍 **Research matchups** via deep web search (injuries, trends, expert opinions)
- 🤖 **Analyze data** using AI to weigh factors and predict outcomes
- 📊 **Compare to Vegas** to find value bets
- 💡 **Generate insights** with natural language explanations
- 🎯 **Make autonomous betting decisions** based on confidence thresholds

## How Oracle Works

### 1. Deep Web Research (Perplexity API)
Oracle uses Perplexity's AI search to gather real-time information:
- Recent team form and performance
- Injury reports and lineup changes
- Head-to-head history
- Weather conditions (for outdoor sports)
- Betting trends and line movement
- Expert analyst opinions

### 2. AI Analysis
The AI then:
- Assigns weights to various factors (recent form, injuries, trends, etc.)
- Predicts the game score
- Compares prediction to Vegas odds
- Calculates value and confidence level

### 3. Decision Making
Oracle only makes a pick when:
- Confidence is **7.0+ out of 10**
- Clear value exists vs Vegas odds
- No duplicate pick type for the game

### 4. Units Allocation
Based on confidence:
- **7.0-7.9**: 1 unit
- **8.0-8.9**: 2 units
- **9.0-9.4**: 3 units
- **9.5-9.7**: 4 units
- **9.8+**: 5 units

## Setup Instructions

### Step 1: Get Perplexity API Key

1. Go to https://www.perplexity.ai/settings/api
2. Sign up for a Perplexity account
3. Subscribe to API access:
   - **Standard**: ~$5 per 1,000 requests (good for testing)
   - **Pro**: ~$50 per 1,000 requests (deeper research, better for production)
4. Copy your API key

### Step 2: Add to Environment

Add to your `.env.local`:

```bash
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Run Database Migration

```bash
# Apply the AI capper migration
npx supabase db push
```

This adds:
- `oracle` to the capper enum
- `ai_insight` column for natural language explanations
- `ai_research` column for research data and sources
- `factors_analyzed` column for weighted factor breakdown
- `ai_model_version` column to track which AI model was used

### Step 4: Run Oracle

```bash
# Via API
curl -X POST http://localhost:3000/api/run-oracle

# Or trigger manually in your app
```

## Cost Considerations

### Perplexity API Costs

Each Oracle pick involves:
- **1 research call** (~500-1000 tokens): $0.005-$0.05 depending on model
- **1 recommendation call** (~1000-1500 tokens): $0.01-$0.05 depending on model

**Total per pick: ~$0.015-$0.10**

### Cost Management Tips

1. **Use Standard model for testing** (`sonar` vs `sonar-pro`)
2. **Limit games analyzed** (we default to 20 games, max 3 picks)
3. **Run less frequently** (once per day vs every hour)
4. **Enable for specific sports only** (start with NBA/NFL)

### Example Monthly Costs

- **Conservative**: 3 picks/day × $0.02/pick = $1.80/month
- **Moderate**: 10 picks/day × $0.05/pick = $15/month
- **Aggressive**: 30 picks/day × $0.10/pick = $90/month

## Database Schema

### New Columns in `picks` Table

```sql
-- Natural language explanation from AI
ai_insight TEXT

-- Research data with sources
ai_research JSONB
{
  "summary": "Overall matchup summary",
  "insights": ["Key insight 1", "Key insight 2"],
  "injuries": [{"team": "LAL", "player": "LeBron", "status": "Questionable"}],
  "sources": [{"url": "...", "title": "...", "snippet": "..."}]
}

-- Factors and their weights
factors_analyzed JSONB
{
  "recent_form": {
    "value": 75,
    "weight": 20,
    "impact": "Home team on 5-game win streak"
  },
  "injuries": {
    "value": 60,
    "weight": 15,
    "impact": "Away team missing starting PG"
  }
}

-- AI model identifier
ai_model_version TEXT  -- e.g., 'perplexity-sonar-pro'
```

## API Endpoints

### Run Oracle
```
POST /api/run-oracle?trigger=manual
```

**Response:**
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
        "keyInsights": [...],
        "injuries": [...],
        "sources": [...]
      },
      "factors": {
        "recent_form": { "value": 75, "weight": 20, "impact": "..." }
      }
    }
  ]
}
```

## Monitoring Oracle Performance

### Track AI vs Deterministic Cappers

```sql
-- Compare Oracle to other cappers
SELECT 
  capper,
  COUNT(*) as total_picks,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
  ROUND(AVG(confidence), 2) as avg_confidence,
  SUM(net_units) as total_units
FROM picks
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY capper
ORDER BY total_units DESC;
```

### Analyze Factor Effectiveness

```sql
-- See which factors lead to wins
SELECT 
  jsonb_object_keys(factors_analyzed) as factor,
  AVG(CAST(factors_analyzed->jsonb_object_keys(factors_analyzed)->>'value' AS FLOAT)) as avg_value,
  AVG(CAST(factors_analyzed->jsonb_object_keys(factors_analyzed)->>'weight' AS FLOAT)) as avg_weight,
  COUNT(*) FILTER (WHERE status = 'won') as wins,
  COUNT(*) as total
FROM picks
WHERE capper = 'oracle' AND factors_analyzed IS NOT NULL
GROUP BY factor
ORDER BY wins DESC;
```

## Future Enhancements

### Phase 2: Learning from Past Picks (Coming Soon)
- Track which factors correlate with wins/losses
- Automatically adjust factor weights
- Model versioning system
- A/B testing different AI models

### Phase 3: Multi-Model Ensemble
- Run multiple AI models (GPT-4, Claude, Gemini)
- Combine predictions
- Use ensemble for higher confidence

### Alternative AI Options

If you want to experiment with different AIs:

#### OpenAI + Tavily Search
```typescript
// Replace Perplexity with OpenAI + Tavily
// Pros: More control, excellent reasoning
// Cons: More complex setup, need separate search API
```

#### Anthropic Claude + MCP
```typescript
// Use Claude with Model Context Protocol
// Pros: Excellent analysis, tool use
// Cons: More expensive, setup complexity
```

#### Gemini with Google Search
```typescript
// Use Google's Gemini with built-in search
// Pros: Fast, integrated search
// Cons: Less sports-specific data
```

## Troubleshooting

### "PERPLEXITY_API_KEY not set"
- Make sure you've added the API key to `.env.local`
- Restart your development server after adding

### "Rate limit exceeded"
- Perplexity has rate limits (varies by plan)
- Add delays between requests (already implemented)
- Upgrade to higher tier if needed

### "Failed to parse AI recommendation"
- AI sometimes returns invalid JSON
- Check logs for the raw response
- Adjust temperature parameter (lower = more consistent)

### Picks always pass
- AI might be too conservative
- Lower confidence threshold in code (currently 7.0)
- Adjust factor weights in the prompt

## Integration with Existing Cappers

Oracle works alongside your existing cappers:
- **Cerberus**: Three-model consensus (deterministic)
- **Nexus**: Balanced approach (deterministic)
- **Shiva**: High-risk, high-reward (deterministic)
- **Ifrit**: Value hunting (deterministic)
- **Oracle**: AI-powered research (autonomous AI) ⭐ NEW

You can run all cappers and compare their performance!

## Questions?

- Check the [Perplexity API Docs](https://docs.perplexity.ai/)
- Review the code: `src/lib/cappers/oracle-algorithm.ts`
- See the AI client: `src/lib/ai/perplexity-client.ts`

