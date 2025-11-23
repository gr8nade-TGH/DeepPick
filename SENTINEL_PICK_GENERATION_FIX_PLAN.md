# SENTINEL Pick Generation - Critical Data Accuracy Fix Plan

## Executive Summary
GPT-5.1 Pro audit revealed 9 critical categories of data accuracy bugs in SENTINEL pick generation. The root cause is that the professional analysis AI prompt does NOT receive actual team stats data - it only receives factor labels and impact scores, causing it to hallucinate all statistics.

## Root Cause Analysis

### Current Professional Analysis Flow
```typescript
// src/lib/cappers/professional-analysis-generator.ts (Lines 156-232)
aiPrompt = `
GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Market Spread: ${input.marketLine}
- Our Predicted Margin: ${input.predictedValue.toFixed(1)} points
- Edge: ${edge.toFixed(1)} points
- Pick: ${input.selection}

FACTOR ANALYSIS (Our Proprietary Model):
${factorBreakdown}  // ❌ ONLY LABELS + IMPACT SCORES, NO ACTUAL STATS

INJURY REPORT:
${injuryContext}  // ✅ Has actual injury data

TASK: Write detailed analysis...
`
```

### What's Missing
The AI prompt does NOT include:
- ❌ Actual offensive/defensive ratings (ORtg, DRtg, NetRtg)
- ❌ Actual 3-point percentages and defensive 3P% allowed
- ❌ Actual turnover stats (TOV/game, forced turnovers)
- ❌ Actual ATS records (last 10 games, home/away splits)
- ❌ Actual head-to-head records
- ❌ Actual travel/schedule data (back-to-back, days rest)
- ❌ Actual total prediction vs market (for spread picks)

## Fix Strategy

### Phase 1: Enhance Professional Analysis Input (PRIORITY 1)
**Goal**: Pass actual team stats to AI prompt so it stops hallucinating

**Changes Required**:
1. **Extend `AnalysisInput` interface** to include team stats bundle
2. **Fetch team stats in generate-pick route** before calling professional analysis
3. **Format stats into AI prompt** with clear sections
4. **Add validation** to ensure stats match what factors used

**Files to Modify**:
- `src/lib/cappers/professional-analysis-generator.ts` (interface + prompt)
- `src/app/api/shiva/generate-pick/route.ts` (fetch stats before analysis)

### Phase 2: Add Spread Line Validation (PRIORITY 1)
**Goal**: Prevent favorite/dog direction errors

**Changes Required**:
1. **Validate spread line direction** against consensus before generating writeup
2. **Store both home and away spread** explicitly in run metadata
3. **Add sanity check** that predicted margin direction matches pick selection

**Files to Modify**:
- `src/lib/cappers/shiva-wizard-orchestrator.ts` (spread validation)
- `src/app/api/shiva/step2-odds-snapshot/route.ts` (store both spreads)

### Phase 3: Injury Gating (PRIORITY 1)
**Goal**: Block picks when star players are OUT

**Changes Required**:
1. **Add injury impact threshold** - if top player OUT (>20 PPG or >30 MPG), auto-downgrade confidence or PASS
2. **Block narrative mentions** of OUT players in writeup
3. **Re-run injury check** right before finalizing pick (not just at factor computation)

**Files to Modify**:
- `src/lib/cappers/shiva-v1/factors/s6-injury-availability.ts` (add gating logic)
- `src/app/api/shiva/generate-pick/route.ts` (final injury check)

### Phase 4: Add ATS & H2H Data Sources (PRIORITY 2)
**Goal**: Replace hallucinated trends with real data

**Changes Required**:
1. **Fetch ATS records** from MySportsFeeds or The Odds API historical data
2. **Fetch H2H records** from MySportsFeeds game logs
3. **Pass to AI prompt** with actual numbers

**Files to Create**:
- `src/lib/data-sources/ats-trends.ts` (fetch ATS records)
- `src/lib/data-sources/head-to-head.ts` (fetch H2H records)

### Phase 5: Add Schedule/Travel Data (PRIORITY 2)
**Goal**: Replace hallucinated travel narratives with real schedule data

**Changes Required**:
1. **Fetch last 5 games** for each team from MySportsFeeds
2. **Calculate days rest** and back-to-back situations
3. **Determine home/away streaks** from actual schedule

**Files to Modify**:
- `src/lib/data-sources/mysportsfeeds-stats.ts` (add schedule fetching)

### Phase 6: Total Edge Surfacing (PRIORITY 2)
**Goal**: Flag large total discrepancies in spread picks

**Changes Required**:
1. **Calculate implied total** from predicted margin + baseline
2. **Compare to market total** (if available)
3. **Surface in AI prompt** if >10pt discrepancy

**Files to Modify**:
- `src/lib/cappers/professional-analysis-generator.ts` (add total edge calculation)

### Phase 7: Confidence Recalibration (PRIORITY 3)
**Goal**: Penalize confidence for missing data or large market disagreements

**Changes Required**:
1. **Penalize confidence** when key injury missing from analysis
2. **Penalize confidence** when implied line >5pts off consensus
3. **Penalize confidence** when favorite/dog direction uncertain

**Files to Modify**:
- `src/lib/cappers/shiva-wizard-orchestrator.ts` (confidence adjustments)

## Implementation Order

### Week 1: Critical Fixes (Don't Break Anything)
1. ✅ Create this plan document
2. [ ] **Task 1**: Enhance professional analysis input with team stats
3. [ ] **Task 2**: Add spread line validation
4. [ ] **Task 3**: Add injury gating logic

### Week 2: Data Source Enhancements
5. [ ] **Task 4**: Add ATS trends data source
6. [ ] **Task 5**: Add H2H records data source
7. [ ] **Task 6**: Add schedule/travel data

### Week 3: Polish & Calibration
8. [ ] **Task 7**: Add total edge surfacing
9. [ ] **Task 8**: Recalibrate confidence scoring
10. [ ] **Task 9**: Test with historical picks and validate accuracy

## Success Metrics
- ✅ Professional analysis uses actual stats (no hallucinations)
- ✅ Spread line direction matches consensus
- ✅ Picks with star players OUT are auto-downgraded or PASS
- ✅ ATS/H2H records match official data
- ✅ Travel narratives match actual schedules
- ✅ Large total discrepancies are surfaced
- ✅ Confidence scores reflect data quality and market agreement

