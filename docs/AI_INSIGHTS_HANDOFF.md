# 🤖 AI Archetype Insights - Handoff to Primary Agent

## 📋 What We Just Designed

You and I just designed a **3-pass AI verification system** that will power archetype-specific insights for all 24 archetypes (12 TOTALS, 12 SPREAD).

### **The Problem We're Solving**

Current system uses **mathematical factors only**. You want **real AI reasoning** that:
1. Analyzes matchups through each archetype's unique lens
2. Produces quantifiable outputs (X, Y, Z values)
3. Prevents hallucinations with 3-pass verification
4. Integrates seamlessly with existing factor system

### **The Solution**

**3-Pass Verification Pipeline:**
- **Pass 1 (Researcher)**: AI generates initial analysis with specific claims
- **Pass 2 (Auditor)**: Verifies claims against ground truth data (MySportsFeeds, NBA.com)
- **Pass 3 (Judge)**: Synthesizes verified data into X, Y, Z values for factor computation

**Quality Control:**
- Pass 2 quality < 0.70 → Reject
- Pass 2 quality 0.70-0.85 → Flag for review
- Overall quality ≥ 0.75 → Use in picks

**Cost:**
- $0.29 per game (24 archetypes)
- $4.35/day (15 games)
- $130/month (using GPT-4.1 for Pass 3)
- $35/month (optimization: GPT-4o-mini for all passes)

---

## 📁 Files Created for Primary Agent

### **1. Implementation Guide**
**File**: `docs/AI_ARCHETYPE_INSIGHTS_IMPLEMENTATION.md`

This is the **master document** with:
- Complete architecture overview
- All 6 implementation phases
- Database schema
- Admin UI specification
- All 24 archetype definitions with cool descriptions
- Technical implementation details
- Success criteria

**Primary agent should read this FIRST.**

### **2. Archetype Definitions**
**File**: `src/lib/ai-insights/archetype-definitions.ts`

TypeScript file with:
- ArchetypeDefinition interface
- 4 TOTALS archetypes (starter examples)
- 1 SPREAD archetype (starter example)
- X, Y, Z factor input definitions
- Helper functions

**Primary agent should complete this file** by adding remaining 19 archetypes.

---

## 🎯 What Primary Agent Should Do

### **Phase 1: Build AI Manager Admin Page (PRIORITY)**

**Goal**: Create `/admin/ai-manager` page so you can test as we build.

**Tasks**:
1. Create admin page at `src/app/admin/ai-manager/page.tsx`
2. Display all 24 archetypes in tabs (TOTALS / SPREAD)
3. Show archetype metadata (name, description, bet type, X/Y/Z definitions)
4. Add "Test Archetype" button
5. Build test flow:
   - Select matchup from dropdown
   - Run Pass 1 → Show results
   - Run Pass 2 → Show results + quality score
   - Run Pass 3 → Show X, Y, Z values + reasoning
   - Display "PASS" or "FAIL" based on quality

**Files to Create**:
- `src/app/admin/ai-manager/page.tsx`
- `src/app/api/admin/test-archetype/route.ts`

**Deliverable**: You can click "Test" on any archetype and see the 3-pass flow execute.

---

### **Phase 2: Implement 3-Pass Pipeline**

**Goal**: Build the actual verification system.

**Tasks**:
1. Create Pass 1 (Researcher) - OpenAI structured output
2. Create Pass 2 (Auditor) - Fact verification
3. Create Pass 3 (Judge) - Final synthesis
4. Add quality scoring
5. Test with "Pace Prophet" archetype

**Files to Create**:
- `src/lib/ai-insights/pass1-researcher.ts`
- `src/lib/ai-insights/pass2-auditor.ts`
- `src/lib/ai-insights/pass3-judge.ts`
- `src/lib/ai-insights/pipeline.ts`
- `src/lib/ai-insights/quality-scoring.ts`

**Deliverable**: Can run full 3-pass pipeline for one archetype.

---

### **Phase 3: Write All 24 Archetype Prompts**

**Goal**: Production-quality prompts for all archetypes.

**Tasks**:
1. Write Pass 1, 2, 3 prompts for all 12 TOTALS archetypes
2. Write Pass 1, 2, 3 prompts for all 12 SPREAD archetypes
3. Define X, Y, Z formulas for each
4. Test each archetype with real game data

**Files to Create**:
- `src/lib/ai-insights/prompt-templates.ts`

**Deliverable**: All 24 archetypes have working, tested prompts.

---

## 🎨 Admin UI Mockup

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

**Test Flow**:
1. Click "Test Archetype"
2. Select game: "LAL @ BOS"
3. Click "Run Test"
4. See Pass 1 results → Pass 2 results → Pass 3 results
5. Final output shows X, Y, Z values + quality score
6. "PASS" or "FAIL" indicator

---

## 📊 Database Schema

**Table**: `game_archetype_insights`

```sql
CREATE TABLE game_archetype_insights (
  id UUID PRIMARY KEY,
  game_id TEXT NOT NULL,
  archetype_id TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  
  -- Pass 1
  pass1_raw_analysis TEXT,
  pass1_claims JSONB,
  pass1_timestamp TIMESTAMP,
  
  -- Pass 2
  pass2_validation_report JSONB,
  pass2_data_quality_score DECIMAL,
  pass2_timestamp TIMESTAMP,
  
  -- Pass 3
  pass3_insight_score DECIMAL NOT NULL,
  pass3_confidence TEXT NOT NULL,
  pass3_direction TEXT NOT NULL,
  pass3_magnitude DECIMAL NOT NULL,
  pass3_reasoning TEXT NOT NULL,
  pass3_key_factors JSONB NOT NULL,
  pass3_timestamp TIMESTAMP,
  
  -- Quality
  overall_quality_score DECIMAL,
  verification_status TEXT,
  
  UNIQUE(game_id, archetype_id)
);
```

---

## 🚀 Getting Started

**Primary Agent - Start Here:**

1. **Read**: `docs/AI_ARCHETYPE_INSIGHTS_IMPLEMENTATION.md` (full spec)
2. **Complete**: `src/lib/ai-insights/archetype-definitions.ts` (add remaining 19 archetypes)
3. **Build**: Admin UI at `/admin/ai-manager`
4. **Test**: One archetype end-to-end (Pace Prophet recommended)
5. **Get approval**: Show user the test UI before scaling to all 24

---

## ⚠️ Important Notes

- **Don't push to production** until user approves
- **Start with admin UI** so user can test along the way
- **Test thoroughly** with real game data
- **Monitor costs** - track tokens used
- **Ask questions** if prompts need refinement

---

## 📚 Reference Files

**Current Archetypes**: `src/app/cappers/create/page.tsx` (lines 357-701)
**Factor System**: `src/lib/factors/types.ts`
**Orchestrators**: `src/lib/cappers/shiva-v1/factors/nba-*-orchestrator.ts`

**Production URL**: https://deep-pick.vercel.app
**Repository**: https://github.com/gr8nade-TGH/DeepPick.git

---

## ✅ Success Criteria

**Phase 1 Complete When**:
- ✅ Admin UI shows all 24 archetypes
- ✅ Can test any archetype with real game
- ✅ 3-pass flow executes and displays results
- ✅ X, Y, Z values show correctly

**Ready to Build!** 🚀

Primary agent should start with Phase 1 and build the AI Manager admin page first.

