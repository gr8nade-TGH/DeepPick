# Testing AI-Enhanced Shiva

## Prerequisites
✅ Database migration `012_ai_capper_system.sql` has been run
✅ API keys are in `.env.local` file
✅ Dev server is running (`npm run dev`)

## Method 1: Using cURL (Terminal)

Open a new terminal and run:

```bash
curl -X POST http://localhost:3000/api/test-ai-capper
```

## Method 2: Using PowerShell

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/test-ai-capper" -Method POST | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## Method 3: Using VS Code Extension (Thunder Client or REST Client)

### Thunder Client:
1. Install "Thunder Client" extension in VS Code
2. Create new request
3. Method: `POST`
4. URL: `http://localhost:3000/api/test-ai-capper`
5. Click "Send"

### REST Client:
1. Install "REST Client" extension
2. Create a file called `test.http` with:
```http
POST http://localhost:3000/api/test-ai-capper
```
3. Click "Send Request" above the line

## Method 4: Using Postman

1. Open Postman
2. Create new request
3. Method: `POST`
4. URL: `http://localhost:3000/api/test-ai-capper`
5. Click "Send"

## What to Expect

The test will take **30-60 seconds** (AI research runs take time). You'll see:

### ✅ Success Response:
```json
{
  "success": true,
  "message": "AI-enhanced Shiva test complete for Boston Celtics @ Los Angeles Lakers",
  "game": {
    "id": "...",
    "matchup": "Boston Celtics @ Los Angeles Lakers",
    "sport": "nba",
    "date": "2025-10-19",
    "time": "19:30:00"
  },
  "ai_research": {
    "run1": {
      "provider": "Perplexity",
      "model": "sonar-medium-online",
      "type": "analytical",
      "factors_found": 2,
      "statmuse_queries": 2,
      "duration_ms": 15234,
      "factors": {
        "home_recent_form": {
          "description": "Lakers have won 8 of last 10 games",
          "value": "8-2",
          "confidence": "high",
          "impact": 2.5
        },
        ...
      }
    },
    "run2": {
      "provider": "ChatGPT",
      "model": "gpt-4o-mini",
      "type": "strategic_validation",
      "factors_found": 2,
      "statmuse_queries": 2,
      "validation_result": {
        "status": "validated",
        "corrections": [],
        "breaking_news": "No significant breaking news"
      },
      "duration_ms": 18456,
      "factors": { ... }
    },
    "total_duration_ms": 33690
  },
  "ai_insight": {
    "summary": "Strong home advantage and recent form favor the Lakers in this matchup.",
    "key_factors": [ ... ],
    "bold_prediction": "Anthony Davis will record a double-double",
    "writeup": "The Lakers come into this matchup with strong momentum..."
  },
  "performance": {
    "total_duration_seconds": "33.69",
    "estimated_cost_usd": 0.007
  },
  "next_steps": [
    "Check the ai_research_runs table in your database to see the stored data",
    "Run POST /api/run-shiva to generate actual picks with AI enhancement",
    "Check the picks table to see AI insights stored with picks"
  ]
}
```

### ❌ Error Response (if API keys not set):
```json
{
  "success": false,
  "error": "PERPLEXITY_API_KEY not set in environment",
  "hint": "Add it to your .env.local file"
}
```

## Verify in Database

After a successful test, check your Supabase dashboard:

### 1. Check `ai_research_runs` table
You should see 2 new rows:
- Run 1: Perplexity analytical research
- Run 2: ChatGPT strategic validation

### 2. Check `capper_settings` table
You should see Shiva's settings with default values

## What Happens During Test

1. ✅ Validates API keys
2. 🎮 Fetches a real scheduled game (or creates a mock Lakers vs Celtics game)
3. ⚙️ Loads Shiva's AI settings from database
4. 🤖 **Run 1**: Perplexity generates StatMuse questions → queries StatMuse → analyzes data
5. 🤖 **Run 2**: ChatGPT generates more StatMuse questions → validates Run 1 → checks for breaking news
6. 💾 Saves both runs to `ai_research_runs` table
7. 📝 Generates comprehensive AI insight writeup
8. ✅ Returns full results

## Troubleshooting

### Error: "PERPLEXITY_API_KEY not set"
- Make sure `.env.local` exists in project root
- Restart your dev server after adding keys

### Error: "Failed to create mock game"
- Check Supabase connection
- Verify `games` table exists

### Test takes too long (>2 minutes)
- This is normal for first run (cold start)
- Perplexity and ChatGPT APIs can be slow
- StatMuse web scraping can take 2-5 seconds per question

### Error: "Failed to parse JSON"
- AI sometimes returns invalid JSON
- System will fallback gracefully
- Check the error details in response

## Next Steps After Successful Test

1. ✅ View AI research in Supabase (`ai_research_runs` table)
2. 🎯 Run full Shiva with AI enhancement: `POST /api/run-shiva`
3. 📊 Check generated picks in `picks` table (with AI insights)
4. 💰 Monitor costs in your OpenAI and Perplexity dashboards

---

**Need help?** The test endpoint provides detailed error messages and stack traces to help debug issues.

