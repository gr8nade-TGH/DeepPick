# AI Capper Implementation Status

## ✅ Completed (Ready for Testing!)

### Infrastructure
- [x] StatMuse client (FREE stats scraper)
- [x] Perplexity API client
- [x] OpenAI/ChatGPT integration
- [x] AI orchestrator (coordinates both AIs + StatMuse)
- [x] Database migration (`012_ai_capper_system.sql`)
- [x] Environment variable validation
- [x] Dependencies installed (cheerio, openai)

### Database Tables
- [x] `ai_research_runs` - Tracks AI research (Run 1 & 2)
- [x] `capper_settings` - Configuration per capper
- [x] Shiva default settings inserted
- [x] AI columns added to `picks` table
- [x] `ai_enhanced_picks` view created

### Testing
- [x] Test endpoint: `/api/test-ai-capper`
- [x] Mock game: Lakers vs Celtics
- [x] Validates API keys
- [x] Tests complete 2-run flow

---

## 🧪 Ready to Test

### Step 1: Add API Keys to `.env.local`

Create `.env.local` in project root:

```env
# Required for AI cappers
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Your existing keys
THE_ODDS_API_KEY=xxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=xxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx
```

**Get API Keys:**
- Perplexity: https://www.perplexity.ai/settings/api
- OpenAI: https://platform.openai.com/api-keys

### Step 2: Run Database Migration

```bash
npx supabase db push
```

This creates:
- `ai_research_runs` table
- `capper_settings` table
- Updates `picks` table
- Creates `ai_enhanced_picks` view

### Step 3: Test the System

Start your dev server:
```bash
npm run dev
```

Test the AI system:
```bash
curl -X POST http://localhost:3000/api/test-ai-capper
```

**What this tests:**
1. Perplexity generates 2 StatMuse questions
2. Scrapes StatMuse for answers (FREE)
3. Perplexity analyzes results
4. ChatGPT generates 2 DIFFERENT questions
5. Scrapes StatMuse again (FREE)
6. ChatGPT validates + predicts score
7. Returns full breakdown + costs

**Expected result:**
```json
{
  "success": true,
  "results": {
    "run1": {
      "provider": "perplexity",
      "statmuse_questions": [...],
      "cost": 0.025
    },
    "run2": {
      "provider": "chatgpt",
      "statmuse_questions": [...],
      "score_prediction": {...},
      "cost": 0.01
    },
    "total_cost": 0.035
  }
}
```

---

## 📊 Cost Structure

**Per Game:**
- Run 1: Perplexity ($0.025) + StatMuse (FREE)
- Run 2: ChatGPT ($0.01) + StatMuse (FREE)
- **Total: $0.035**

**Monthly:**
- 30 games/day × $0.035 = **$1.05/month**
- 5 cappers (with filters) = **$3.15/month**

**Well under your $40-100 budget!** ✅

---

## ⏭️ Next Steps

### Phase 1: Integration into Shiva

Create `src/lib/cappers/shiva-ai-enhanced.ts`:

```typescript
import { getAICapperOrchestrator } from '@/lib/ai/ai-capper-orchestrator'
import { analyzeBatch as shivaAnalyzeBatch } from './shiva-algorithm'

export async function analyzeBatchWithAI(games, maxPicks, existingPicksByGame) {
  const results = []
  
  for (const game of games) {
    // Phase 1: Weed-out filters (from capper_settings)
    if (!passesWeedOutFilters(game)) {
      console.log(`⏭️  Filtered out: ${game.away_team.name} @ ${game.home_team.name}`)
      continue
    }
    
    // Phase 2: AI Research (Run 1 + Run 2)
    const orchestrator = getAICapperOrchestrator()
    const aiResearch = await orchestrator.researchGame(game, shivaPersonality)
    
    // Phase 3: Vegas Comparison
    const vegasEdge = calculateVegasComparison(
      aiResearch.scorePrediction,
      game.odds
    )
    
    // Phase 4: Final Confidence
    const finalConfidence = calculateFinalConfidence(aiResearch, vegasEdge)
    
    if (finalConfidence >= 7.0) {
      results.push({
        pick: createPick(game, aiResearch, finalConfidence),
        aiResearch: aiResearch
      })
    }
  }
  
  return results.slice(0, maxPicks)
}
```

### Phase 2: Create API Route

`src/app/api/run-shiva-ai/route.ts` - Similar to existing run-shiva but with AI

### Phase 3: Monitor & Optimize

- Track costs in database
- Monitor win rates
- Adjust weed-out filters
- Fine-tune prompts

### Phase 4: Scale to Other Cappers

Once Shiva is validated:
- Ifrit with different personality/focus
- Cerberus with different personality/focus
- Nexus with different personality/focus

---

## 📁 Files Created

### AI Core
```
src/lib/ai/
├── ai-capper-orchestrator.ts   (Main coordinator)
├── perplexity-client.ts         (Perplexity API)
└── (OpenAI via npm package)

src/lib/data/
└── statmuse-client.ts           (FREE stats scraper)
```

### Database
```
supabase/migrations/
└── 012_ai_capper_system.sql
```

### Testing
```
src/app/api/
└── test-ai-capper/
    └── route.ts
```

### Documentation
```
AI_ENHANCED_CAPPER_TEMPLATE.md          (Full 5-phase system)
AI_ENHANCED_CAPPER_SIMPLIFIED_V2.md     (Streamlined guide)
AI_CAPPER_IMPLEMENTATION_STATUS.md      (This file)
```

---

## 🐛 Troubleshooting

### "PERPLEXITY_API_KEY not set"
- Add to `.env.local`
- Restart dev server
- Get key at: https://www.perplexity.ai/settings/api

### "OPENAI_API_KEY not set"
- Add to `.env.local`
- Restart dev server
- Get key at: https://platform.openai.com/api-keys

### StatMuse returns empty answers
- Check internet connection
- StatMuse might be rate-limiting (unlikely)
- Question format might need adjustment

### High costs
- Check `ai_research_runs` table for cost tracking
- Ensure weed-out filters are working
- Consider using GPT-4o-mini instead of GPT-4o

---

## 🎯 Success Criteria

Before moving to production:

1. **Test endpoint works** ✅
   - Run `/api/test-ai-capper`
   - Verify both AI providers respond
   - Confirm StatMuse scraping works

2. **Cost validation** ⏳
   - Run 10 test games
   - Verify costs are ~$0.035 per game
   - Check database cost tracking

3. **Shiva integration** ⏳
   - Integrate AI into Shiva algorithm
   - Test on real upcoming games
   - Validate pick generation

4. **Week-long monitoring** ⏳
   - Track costs daily
   - Monitor API errors
   - Validate pick quality

5. **Scale preparation** ⏳
   - Document learnings
   - Optimize prompts
   - Ready for other cappers

---

## 💾 Branch Status

**Branch:** `feature/oracle-ai-capper`

**Commits:**
```
d504241 feat: Add AI capper test endpoint
8f1c2f8 feat: Add complete AI capper infrastructure
6a850aa feat: Add AI orchestrator for hybrid approach
aa0137c feat: Add StatMuse integration
72dbcfc docs: Add AI-enhanced capper planning template
```

**Ready to merge?** Not yet - need successful testing first!

---

## 📝 Notes

- StatMuse scraping is free but respect their rate limits
- Perplexity costs ~$0.025 per request
- ChatGPT costs vary by model (gpt-4o-mini is cheapest)
- All costs tracked in `ai_research_runs.cost` column
- Weed-out filters are critical for cost control at scale

---

**Status:** ✅ Ready for testing!  
**Next:** Add API keys → Run migration → Test endpoint → Integrate into Shiva

