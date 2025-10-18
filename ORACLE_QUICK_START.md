# 🚀 Oracle Quick Start Guide

## Setup in 3 Steps (5 minutes)

### 1. Get API Key
```bash
# Visit: https://www.perplexity.ai/settings/api
# Sign up and get your API key
```

### 2. Configure
```bash
# Add to .env.local
echo "PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx" >> .env.local

# Run migration
npx supabase db push

# Restart server
npm run dev
```

### 3. Run Oracle
```bash
# Visit: http://localhost:3000/cappers/oracle
# Click "✨ Run Oracle AI"
# Wait ~1-2 minutes
# View AI-powered picks!
```

## Quick Reference

### API Endpoints
```bash
# Trigger Oracle
POST /api/run-oracle

# View picks
GET /api/picks?capper=oracle
```

### Database Queries
```sql
-- Latest Oracle picks
SELECT * FROM picks WHERE capper = 'oracle' ORDER BY created_at DESC LIMIT 5;

-- Performance
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
  SUM(net_units) as profit
FROM picks WHERE capper = 'oracle';
```

### Key Files
- **Algorithm**: `src/lib/cappers/oracle-algorithm.ts`
- **AI Client**: `src/lib/ai/perplexity-client.ts`
- **API Route**: `src/app/api/run-oracle/route.ts`
- **UI Page**: `src/app/cappers/oracle/page.tsx`
- **Migration**: `supabase/migrations/011_ai_capper_system.sql`

### Cost Control
```typescript
// In oracle-algorithm.ts, line 237:
maxPicks: 3  // Change to adjust max picks per run

// In perplexity-client.ts, line 66:
useProSearch: true  // Set to false for 5x cheaper (standard model)
```

### Enable in Cron
```typescript
// In src/app/api/auto-run-cappers/route.ts, line 65:
// Uncomment this line:
{ name: 'oracle', endpoint: '/api/run-oracle' },
```

## Typical Pick Output

```json
{
  "selection": "Lakers -5.5",
  "confidence": 8.5,
  "units": 2,
  "ai_insight": "The Lakers have dominated in recent matchups...",
  "factors_analyzed": {
    "recent_form": { "value": 75, "weight": 20 },
    "vegas_comparison": { "value": 85, "weight": 30 }
  },
  "ai_research": {
    "insights": ["Lakers on 5-game streak", "Clippers missing Kawhi"],
    "sources": [...]
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not set" | Add `PERPLEXITY_API_KEY` to `.env.local` and restart |
| "Rate limit" | Add delays or upgrade Perplexity plan |
| "Always passes" | Lower confidence threshold (currently 7.0) |
| "Invalid JSON" | Check logs, may need prompt adjustment |

## Performance Metrics

Track these weekly:
- **Win Rate**: Target ≥55%
- **ROI**: (Profit / Total Risked) × 100
- **Avg Confidence**: Should correlate with wins
- **Cost per Pick**: ~$0.02-0.05

## Next Steps

1. ✅ Run Oracle on 10-20 games
2. ✅ Compare to deterministic cappers
3. ✅ Analyze factor effectiveness
4. ⏭️ Implement Phase 2: Learning system

---

**Full Documentation**: See `PHASE_1_COMPLETE.md`

