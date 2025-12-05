# 🤖 AI Archetype Insights - Implementation Task

## 📋 Your Mission

Build an **AI-powered archetype insights system** with 3-pass verification to prevent hallucinations. This will add real AI reasoning to all 24 archetypes (12 TOTALS, 12 SPREAD).

---

## 🎯 Phase 1: Build AI Manager Admin Page (START HERE)

### **Goal**: Create `/admin/ai-manager` page for testing

### **Tasks**:

1. **Create Admin Page**: `src/app/admin/ai-manager/page.tsx`
   - Display all 24 archetypes in tabs (TOTALS / SPREAD)
   - Show archetype metadata: name, icon, description, bet type
   - Show X, Y, Z factor input definitions
   - Add "View Prompts" expandable section (Pass 1, 2, 3 prompts)
   - Add "Test Archetype" button

2. **Create Test Endpoint**: `src/app/api/admin/test-archetype/route.ts`
   - Accept: `{ archetypeId: string, gameId: string }`
   - Run 3-pass pipeline (stub for now)
   - Return results from each pass

3. **Test Flow UI**:
   - User clicks "Test Archetype"
   - Modal opens with game selector dropdown
   - User selects game (e.g., "LAL @ BOS")
   - Click "Run Test"
   - Show Pass 1 results → Pass 2 results → Pass 3 results
   - Display final X, Y, Z values + quality score
   - Show "PASS ✓" or "FAIL ✗" based on quality

### **UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ AI Archetype Insights Manager                           │
├─────────────────────────────────────────────────────────┤
│ [TOTALS Tab] [SPREAD Tab] [Monitoring Tab]             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 🚀 The Pace Prophet                              │   │
│ │ Tempo is destiny. Fast pace creates more points. │   │
│ │ Bet Type: TOTAL                                  │   │
│ │                                                   │   │
│ │ Required Outputs:                                │   │
│ │ X = Pace differential vs league avg              │   │
│ │ Y = Recent matchup pace                          │   │
│ │ Z = Confidence multiplier (0.0-1.0)              │   │
│ │                                                   │   │
│ │ [View Prompts ▼] [Test Archetype]               │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### **Deliverable**: 
Admin can navigate to `/admin/ai-manager`, see all 24 archetypes, and click "Test" to run the 3-pass flow.

---

## 📚 Read These Files First

1. **`docs/AI_ARCHETYPE_INSIGHTS_IMPLEMENTATION.md`** - Complete implementation guide
2. **`docs/AI_INSIGHTS_HANDOFF.md`** - Quick start guide
3. **`src/lib/ai-insights/archetype-definitions.ts`** - Archetype metadata (complete this file)

---

## 📊 Complete the Archetype Definitions

**File**: `src/lib/ai-insights/archetype-definitions.ts`

Currently has 4 TOTALS + 1 SPREAD archetype as examples. **Add the remaining 19 archetypes** using the definitions in `docs/AI_ARCHETYPE_INSIGHTS_IMPLEMENTATION.md` (lines 176-450).

Each archetype needs:
- `id`, `name`, `icon`, `description` (2 sentences max)
- `betType` ('TOTAL' or 'SPREAD')
- `philosophy`, `focusFactors`
- `factorInputs` (X, Y, Z definitions)

---

## 🗄️ Database Migration

Create migration: `supabase/migrations/XXX_create_game_archetype_insights.sql`

```sql
CREATE TABLE game_archetype_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  archetype_id TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  
  -- PASS 1: Initial Analysis
  pass1_raw_analysis TEXT,
  pass1_claims JSONB,
  pass1_timestamp TIMESTAMP,
  pass1_tokens_used INTEGER,
  
  -- PASS 2: Fact Verification
  pass2_validation_report JSONB,
  pass2_data_quality_score DECIMAL,
  pass2_timestamp TIMESTAMP,
  pass2_tokens_used INTEGER,
  
  -- PASS 3: Final Synthesis
  pass3_insight_score DECIMAL NOT NULL,
  pass3_confidence TEXT NOT NULL,
  pass3_direction TEXT NOT NULL,
  pass3_magnitude DECIMAL NOT NULL,
  pass3_reasoning TEXT NOT NULL,
  pass3_key_factors JSONB NOT NULL,
  pass3_timestamp TIMESTAMP,
  pass3_tokens_used INTEGER,
  
  -- Quality Metrics
  overall_quality_score DECIMAL,
  verification_status TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  total_tokens_used INTEGER,
  
  UNIQUE(game_id, archetype_id),
  INDEX idx_verification_status ON game_archetype_insights(verification_status)
);
```

---

## ⚠️ Important Rules

- **Don't push to production** until user approves
- **Start with admin UI** so user can test along the way
- **Use existing UI patterns** from other admin pages
- **Test with real game data** from today's games
- **Ask questions** if anything is unclear

---

## 🚀 Next Steps After Phase 1

Once admin UI is complete and user approves:
1. Implement 3-pass pipeline (Pass 1, 2, 3)
2. Write prompts for all 24 archetypes
3. Integrate with factor system (F10, S14)
4. Deploy cache warming cron

---

## 📁 Key Files to Reference

- **Current archetypes**: `src/app/cappers/create/page.tsx` (lines 357-701)
- **Admin page examples**: `src/app/admin/*`
- **Factor system**: `src/lib/factors/types.ts`

---

## ✅ Success Criteria

Phase 1 complete when:
- ✅ Admin UI shows all 24 archetypes
- ✅ Can click "Test" on any archetype
- ✅ Test flow executes (even if stubbed)
- ✅ X, Y, Z definitions display correctly

---

**Start with Phase 1. Build the AI Manager admin page first. Get user approval before proceeding to Phase 2.**

Production URL: https://deep-pick.vercel.app
Repository: https://github.com/gr8nade-TGH/DeepPick.git

