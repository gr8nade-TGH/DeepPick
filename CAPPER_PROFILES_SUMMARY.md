# Capper Profiles Summary - NBA v1

## Profile Differences

### **SHIVA (Baseline)**
- **Style:** Balanced, comprehensive
- **Weights:** Even distribution across all factors
- **Key Emphasis:** Season strength (21%), Recent form (17.5%), Matchup quality (14%)
- **Providers:** Perplexity (Step 3), OpenAI (Step 4)
- **Search Mode:** Quick
- **Thresholds:** Pass <2.5, 1u = 2.5-3.0, 2u = 3.01-4.0, 3u >4.0
- **Philosophy:** Trust the full picture, moderate confidence thresholds

### **IFRIT (Aggressive)**
- **Style:** Momentum-focused, high volatility
- **Weights:** 
  - ↑ Recent Form: 25% (vs SHIVA 17.5%) - **Chases hot streaks**
  - ↑ H2H PPG: 12% (vs SHIVA 7%) - **Style matchups matter more**
  - ↑ 3PT: 2% (vs SHIVA 2.1%) - **Minor tweak**
  - ↓ Season Net: 15% (vs SHIVA 21%) - **Less weight on full season**
  - ↓ Home Edge: 1% (vs SHIVA 3.5%) - **Discounts home court**
  - ↓ News: 5% (vs SHIVA 7%) - **Less reactive to news**
- **Providers:** OpenAI (both steps) - **Faster execution**
- **Search Mode:** Quick
- **Caps:** H2H ±8 (vs ±6), Home 1.0 (vs 1.5), Market Adj 1.3 (vs 1.2)
- **Thresholds:** More aggressive - Pass <2.3, 1u = 2.3-2.8, 2u = 2.81-3.8
- **Philosophy:** Ride the wave, favor recent performance over season-long trends

### **CERBERUS (Defensive/Conservative)**
- **Style:** Season-long strength, defensive focus
- **Weights:**
  - ↑ Season Net: 28% (vs SHIVA 21%) - **Trust the full body of work**
  - ↑ Matchup ORtg/DRtg: 18% (vs SHIVA 14%) - **Defensive matchups key**
  - ↓ Recent Form: 12% (vs SHIVA 17.5%) - **Less reactive to streaks**
  - ↓ H2H: 5% (vs SHIVA 7%) - **Small sample skepticism**
  - ✗ Home Edge: 0% - **Ignores home court entirely**
  - ✗ 3PT: Disabled - **Not a factor**
- **Providers:** Perplexity (both steps) - **Deeper research**
- **Search Mode:** Deep
- **Caps:** Tighter - H2H ±5, News ±2.5, Side 5, Total 10, Market Adj 1.0
- **Thresholds:** Conservative - Pass <2.8, 1u = 2.8-3.2, 2u = 3.21-4.2
- **Philosophy:** Bet on quality, not variance; stricter confidence requirements

### **NEXUS (Balanced + Deep Search)**
- **Style:** SHIVA weights + enhanced search
- **Weights:** Identical to SHIVA (21%, 17.5%, 14%, 7%, 7%, 3.5%, 2.1%)
- **Providers:** Perplexity (Step 3), OpenAI (Step 4) - **Same as SHIVA**
- **Search Mode:** Deep - **Key difference: more thorough data gathering**
- **Caps:** Same as SHIVA
- **Thresholds:** Same as SHIVA
- **Philosophy:** SHIVA's logic with deeper research - tests if search depth improves outcomes

---

## How They Differ in Practice

### Example Game: OKC @ HOU

| Factor | SHIVA | IFRIT | CERBERUS | NEXUS |
|--------|-------|-------|----------|-------|
| Season Net (4.3) | +0.90 | +0.65 | +1.20 | +0.90 |
| Recent (4.8) | +0.84 | +1.20 | +0.58 | +0.84 |
| Matchup ORtg (1.6) | +0.22 | +0.16 | +0.29 | +0.22 |
| H2H PPG (0.7) | +0.05 | +0.08 | +0.04 | +0.05 |
| News (0.5) | +0.04 | +0.03 | +0.04 | +0.04 |
| Home (+1.5) | +0.05 | +0.02 | +0.00 | +0.05 |
| 3PT (0.0) | +0.00 | +0.00 | N/A | +0.00 |
| **Delta per 100** | **+2.10** | **+2.14** | **+2.15** | **+2.10** |
| **Spread Pred** | **+2.08** | **+2.12** | **+2.13** | **+2.08** |
| **Conf7** | **2.39** | **2.41** | **2.42** | **2.39** |
| **Market Adj** | **+0.26** | **+0.34** | **+0.21** | **+0.26** |
| **Conf Final** | **2.65** | **2.75** | **2.63** | **2.65** |
| **Decision** | **PASS** | **1u** | **PASS** | **PASS** |

**Key Insight:** IFRIT's lower thresholds + aggressive weighting → makes a 1u bet. Others pass.

---

## Testing Plan

1. **Seed all 4 profiles** into `capper_settings` with `is_active=false`
2. **Test SHIVA first** (is_active=true) → verify baseline
3. **Enable IFRIT** → run same game → compare Insight Cards
4. **Enable CERBERUS** → run same game → see defensive focus
5. **Enable NEXUS** → verify search depth affects data quality

---

## Future Expansion

- **Add MLB factors** (8-10 factors: SP xERA, bullpen xFIP, park factor, wRC+ vs handedness, etc.)
- **Add capper-specific factors** (e.g., IFRIT gets "clutch rating", CERBERUS gets "turnover differential")
- **Learning memory** (track which cappers perform best per situation and auto-adjust weights)
- **Multi-sport profiles** (NFL coming after MLB)

