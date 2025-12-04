# OpenAI Usage Analysis in Sharp Siege Pick Generation

**Generated:** December 4, 2025

---

## Overview

OpenAI is used for **presentation and analysis enhancement only** - NOT for the core pick decision. The actual OVER/UNDER or SPREAD selection comes from the factor-based mathematical model (Steps 1-5 of the wizard pipeline).

---

## 1. Bold Player Predictions

**File:** `src/lib/cappers/bold-predictions-generator.ts`

| Setting | Value |
|---------|-------|
| Model | `gpt-4o` (full model) |
| Temperature | 0.3 (conservative) |
| Max Tokens | 1500 |
| Response Format | JSON object |
| When Called | Step 6, only for non-PASS picks |

### Data Sent to OpenAI:
- Game matchup (teams, date)
- Predicted total/spread vs market line
- Pick direction (OVER/UNDER or spread selection)
- Confidence score & edge
- **Current-season player stats** from MySportsFeeds (PPG, RPG, APG)
- **Factor analysis summary** (which factors drove the prediction)
- **Injury report** from MySportsFeeds

### What It Returns:
```json
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Data-driven reasoning",
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ],
  "summary": "How predictions support the pick"
}
```

### Key Prompt Instructions:
- ONLY use players from provided current-season stats
- DO NOT use outdated training data
- Quality over quantity - only 2-3 high-probability predictions
- Must align with pick direction (no contradictions)
- Conservative estimates preferred

---

## 2. Professional Analysis

**File:** `src/lib/cappers/professional-analysis-generator.ts`

| Setting | Value |
|---------|-------|
| Model | `gpt-4o-mini` |
| Temperature | 0.8 (creative) |
| Max Tokens | 1500 |
| Response Format | Plain text (bullet points) |
| When Called | Step 7, only for non-PASS picks |

### Data Sent to OpenAI:
- Game matchup, date, market line
- Predicted value, edge, confidence, units
- **Full factor breakdown** with contributions and raw values
- **Injury report** with impact analysis
- **Team stats** (offensive/defensive rating, pace, 3PT%, turnovers)
- For SPREAD picks: Total edge analysis (secondary angle)

### What It Returns (400-600 words):
```
**🎯 THE THESIS**
• Market inefficiency explanation
• Core edge reasoning

**📊 FACTOR DEEP DIVE**
• 2-3 most impactful factors analyzed
• How factors interact

**🏥 INJURY & LINEUP IMPACT**
• Key injury effects on pace/efficiency
• Rotation changes

**🔍 CONTEXTUAL FACTORS**
• Recent form, schedule, venue
• Stylistic matchups

**⚖️ RISK ASSESSMENT**
• What could go wrong
• Uncertain factors

**💡 FINAL VERDICT**
• Synthesized conclusion
• Specific score prediction
```

### Key Prompt Instructions:
- DO NOT cite ATS records unless provided
- DO NOT cite H2H records unless provided
- DO NOT reference players not in injury report
- Use ONLY statistics provided in prompt
- Will be reviewed against actual results

---

## 3. Post-Game Results Analysis

**File:** `src/lib/cappers/results-analysis-generator.ts`

| Setting | Value |
|---------|-------|
| Model | `gpt-4o-mini` |
| Temperature | 0.7 |
| Max Tokens | 1200 |
| When Called | After game ends, via cron job |

### Data Sent to OpenAI:
- Original prediction vs actual result
- Box score summary (team stats, final score)
- **Factor accuracy analysis** with ✅/❌ indicators
- Win/loss outcome

### What It Returns:
- Post-mortem analysis explaining why pick won/lost
- Factor-by-factor evaluation
- Lessons learned for model improvement

---

## Summary Comparison

| Feature | Model | Temp | Purpose |
|---------|-------|------|---------|
| Bold Predictions | gpt-4o | 0.3 | Player performance predictions |
| Professional Analysis | gpt-4o-mini | 0.8 | Game breakdown writeup |
| Results Analysis | gpt-4o-mini | 0.7 | Post-game win/loss explanation |

---

## Key Takeaways

1. **OpenAI does NOT make pick decisions** - The OVER/UNDER or SPREAD selection comes from the mathematical factor model

2. **OpenAI enhances presentation** - Generates human-readable analysis AFTER pick is determined

3. **Data grounding is critical** - Prompts explicitly require using ONLY provided MySportsFeeds data

4. **Conservative for accuracy** - Bold predictions use low temperature (0.3) to stay data-driven

5. **Fallback exists** - If OpenAI fails, system uses template-based analysis

---

## Cost Considerations

| Call Type | Model | Est. Input Tokens | Est. Output Tokens |
|-----------|-------|-------------------|-------------------|
| Bold Predictions | gpt-4o | ~2000 | ~500 |
| Professional Analysis | gpt-4o-mini | ~1500 | ~800 |
| Results Analysis | gpt-4o-mini | ~1000 | ~600 |

**Per pick cost estimate:** ~$0.02-0.05 (depending on prompt length)

---

## File Locations

```
src/lib/cappers/bold-predictions-generator.ts      # Bold player predictions
src/lib/cappers/professional-analysis-generator.ts # Professional analysis
src/lib/cappers/results-analysis-generator.ts      # Post-game analysis
src/app/api/shiva/generate-pick/route.ts           # Main pick generation (calls above)
src/app/api/shiva/insight-card/[pickId]/route.ts   # Insight card API
```

