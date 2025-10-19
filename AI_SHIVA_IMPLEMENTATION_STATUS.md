# AI-Enhanced Shiva Implementation Status

## ✅ Completed Features

### 1. Core Infrastructure
- ✅ Created `.env.local` with API keys (OpenAI + Perplexity)
- ✅ Updated environment validation in `src/lib/env.ts`
- ✅ Added AI capper types to `src/types/index.ts`
- ✅ Created database migration `012_ai_capper_system.sql`

### 2. AI Clients
- ✅ **Perplexity Client** (`src/lib/ai/perplexity-client.ts`)
  - Chat completions with online search
  - Web search capability
  - StatMuse question generation
  
- ✅ **StatMuse Client** (`src/lib/data/statmuse-client.ts`)
  - Web scraping with Cheerio
  - Natural language query support
  - Batch query capability

- ✅ **OpenAI Integration** (via `openai` package)
  - GPT-4o-mini for strategic analysis
  - JSON response formatting
  - Validation and fact-checking

### 3. AI Orchestrator
- ✅ **AI Capper Orchestrator** (`src/lib/ai/ai-capper-orchestrator.ts`)
  - **Run 1**: Perplexity + StatMuse (analytical factors)
  - **Run 2**: ChatGPT + StatMuse (strategic validation)
  - AI insight generation
  - Database integration for storing runs
  
### 4. Shiva AI Enhancement
- ✅ **Updated Shiva Algorithm** (`src/lib/cappers/shiva-algorithm.ts`)
  - Async support for AI research
  - Vegas edge factor calculation (0-30 points)
  - AI confidence boost (up to 3 points)
  - Enhanced prediction logging
  - Integration of AI research into confidence scoring

- ✅ **Updated Shiva API** (`src/app/api/run-shiva/route.ts`)
  - Async `analyzeBatch` support
  - AI research data in pick results

### 5. Database Schema
- ✅ `ai_research_runs` table
  - Stores Run 1 and Run 2 results
  - Tracks StatMuse queries and results
  - Stores validation results
  - Indexes for efficient querying
  
- ✅ `capper_settings` table
  - Configurable AI providers and models
  - Timing offsets for NFL vs other sports
  - Factor weights and weed-out filters
  - Default settings for Shiva

- ✅ Enhanced `picks` table
  - `ai_insight` column for natural language explanations
  - `ai_research` column for raw research data
  - `factors_analyzed` column for factor breakdown
  - `ai_model_version` column for versioning

## 🎯 How It Works

### Phase 1: Data Collection (Baseline)
1. Shiva identifies a scheduled game
2. Fetches baseline data from The Odds API
3. Checks for existing AI research runs in the database

### Phase 2: AI Research Pipeline
**Run 1: Perplexity (Analytical)**
- Generates 2 clever StatMuse questions
- Queries StatMuse for statistical data
- Analyzes data and identifies 2 analytical factors
- Saves Run 1 results to database

**Run 2: ChatGPT (Strategic + Validation)**
- Generates 2 additional StatMuse questions
- Queries StatMuse for more data
- Validates Run 1 findings (especially injuries)
- Identifies 2 strategic factors
- Checks for breaking news
- Saves Run 2 results to database

### Phase 3: Confidence Calculation
1. **Base Confidence**: Shiva's three-model consensus (existing logic)
2. **Vegas Edge Factor**: 0-30 points based on prediction vs Vegas lines
   - Total gap: Up to 15 points (max at 10+ point difference)
   - Spread gap: Up to 15 points (max at 5+ point difference)
   - Converted to 0-3 confidence boost (30% weight)
3. **AI Confidence Boost**: 0-3 points from AI research factors
   - Impact-weighted by confidence level (high/medium/low)
   - Aggregated from both runs
4. **Final Confidence**: Base + Vegas Boost + AI Boost (capped at 10)

### Phase 4: Pick Generation
1. If confidence >= 7.0, generate pick
2. If 7.0-7.5: 1 unit
3. If 7.5-8.5: 2 units
4. If 8.5+: 3 units
5. Store pick with AI insight and research data

## 🔧 Configuration

### Shiva Settings (in database)
```json
{
  "capper_name": "shiva",
  "ai_provider_run1": "perplexity",
  "ai_provider_run2": "openai",
  "ai_model_run1": "sonar-medium-online",
  "ai_model_run2": "gpt-4o-mini",
  "timing_offset_hours": 4,
  "timing_offset_nfl_hours": 24,
  "min_confidence_to_pick": 7.0,
  "max_statmuse_questions_run1": 2,
  "max_statmuse_questions_run2": 2,
  "factor_weights": {
    "vegas_edge": 0.3,
    "ai_factors": 0.2,
    "consensus": 0.3,
    "recent_form": 0.2
  }
}
```

## 💰 Cost Analysis

### Per Game (with AI research)
- **Run 1 (Perplexity)**: 
  - 1 question generation: ~500 tokens (~$0.0005)
  - 1 analysis: ~700 tokens (~$0.0007)
  - Total: ~$0.0012
  
- **Run 2 (ChatGPT)**:
  - 1 question generation: ~500 tokens (~$0.001)
  - 1 analysis + validation: ~1000 tokens (~$0.002)
  - Total: ~$0.003
  
- **StatMuse**: FREE (web scraping)
  
- **AI Insight Generation**: ~1200 tokens (~$0.0024)

**Total per game**: ~$0.0066 (less than 1 cent!)
**Monthly (300 games)**: ~$2.00

## 📊 Test Endpoint

A test endpoint is available at `/api/test-ai-capper` (POST) to manually trigger AI research for a single game.

## 🚀 Next Steps

### Immediate
1. ✅ Run database migration (`012_ai_capper_system.sql`)
2. ⬜ Test AI-enhanced Shiva with a real game
3. ⬜ Monitor costs and performance
4. ⬜ Add weed-out filters (e.g., game already started, no odds)

### Short-term
5. ⬜ Create UI for viewing AI research runs
6. ⬜ Add AI insight display in pick popups
7. ⬜ Create capper settings management page
8. ⬜ Add error handling for API rate limits

### Long-term
9. ⬜ Extend AI enhancement to other cappers (Ifrit, Cerberus, Nexus)
10. ⬜ Define unique personalities and factor priorities for each capper
11. ⬜ Add learning/feedback loop based on pick outcomes
12. ⬜ Create AI capper leaderboard

## 🐛 Known Issues / Limitations

1. **Rate Limits**: No rate limit handling yet for Perplexity/OpenAI
2. **StatMuse Scraping**: May break if StatMuse changes their HTML structure
3. **No Caching**: AI research runs for every game, even duplicates (mitigated by DB check)
4. **Sequential Processing**: Games are analyzed one at a time (could be parallelized)

## 📝 Testing Checklist

- ⬜ Test with NBA game
- ⬜ Test with NFL game (24-hour timing)
- ⬜ Verify AI research saves to database
- ⬜ Verify confidence boosts are calculated correctly
- ⬜ Verify Vegas edge factor is working
- ⬜ Test with game that has no odds (should skip)
- ⬜ Test with game that already started (should skip)
- ⬜ Verify AI insight is generated and stored
- ⬜ Verify pick display includes AI data

## 🎉 Success Criteria

- [ ] Shiva successfully generates AI-enhanced picks
- [ ] AI research runs are stored and retrievable
- [ ] Vegas comparison factor influences confidence as expected
- [ ] Costs remain under $0.01 per game
- [ ] Picks include rich AI insights and data-driven writeups

---

**Created**: October 19, 2025  
**Branch**: `feature/oracle-ai-capper`  
**Status**: Core implementation complete, ready for testing

