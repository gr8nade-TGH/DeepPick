import { NextRequest, NextResponse } from 'next/server'

/**
 * AI Factor Strategist - Generates a comprehensive prompt for ChatGPT 5.0
 *
 * Instead of generating factors directly, this creates a detailed prompt
 * that includes all available stats, current factors, and formula requirements.
 */

export async function POST(request: NextRequest) {
  try {
    const { betType } = await request.json()

    if (!betType || !['TOTALS', 'SPREAD'].includes(betType)) {
      return NextResponse.json({ error: 'Invalid bet type. Use TOTALS or SPREAD.' }, { status: 400 })
    }

    // Generate the comprehensive prompt
    const prompt = betType === 'TOTALS'
      ? generateTotalsPrompt()
      : generateSpreadPrompt()

    return NextResponse.json({
      success: true,
      betType,
      prompt,
      generated_at: new Date().toISOString(),
      instructions: 'Copy this prompt and paste it into ChatGPT 5.0 for expert factor recommendations.'
    })

  } catch (error) {
    console.error('[Factor Strategist] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateTotalsPrompt(): string {
  return `# NBA TOTALS Factor Design Request

You are helping me design new betting factors for an NBA TOTALS (Over/Under) prediction system.

## How Our System Works

We predict the combined final score of NBA games. Each "factor" analyzes specific stats and outputs a signal:
- **Positive signal** → Favors OVER (higher scoring game expected)
- **Negative signal** → Favors UNDER (lower scoring game expected)
- **Signal magnitude** indicates confidence (±1.0 max)

### Factor Calculation Pattern:
\`\`\`typescript
// 1. Combine both teams' stats
const combined = (awayStat + homeStat) / 2

// 2. Compare to league average
const delta = combined - leagueAvg

// 3. Scale to -1 to +1 using tanh
const signal = Math.tanh(delta / SCALE)

// 4. Convert to points (max 5.0 per factor)
const overScore = signal > 0 ? signal * 5.0 : 0
const underScore = signal < 0 ? Math.abs(signal) * 5.0 : 0
\`\`\`

---

## Available Statistics (NBAStatsBundle)

These are the EXACT stat names we can use. Each stat exists for BOTH teams with away/home prefixes:

### Pace & Tempo
| Stat | Description | Status |
|------|-------------|--------|
| awayPaceSeason / homePaceSeason | Season pace (possessions/game) | ✅ IN USE (F1) |
| awayPaceLast10 / homePaceLast10 | Last 10 games pace | ✅ IN USE (F1) |
| leaguePace | League average (~100.1) | ✅ IN USE |

### Scoring
| Stat | Description | Status |
|------|-------------|--------|
| awayPointsPerGame / homePointsPerGame | PPG (last 5 games) | 🔓 AVAILABLE |

### Offensive Efficiency
| Stat | Description | Status |
|------|-------------|--------|
| awayORtgLast10 / homeORtgLast10 | Offensive rating (pts/100 poss) | ✅ IN USE (F2) |
| leagueORtg | League average (~114.5) | ✅ IN USE |

### Defensive Efficiency
| Stat | Description | Status |
|------|-------------|--------|
| awayDRtgSeason / homeDRtgSeason | Defensive rating (opp pts/100 poss) | ✅ IN USE (F3) |
| leagueDRtg | League average (~114.5) | ✅ IN USE |

### 3-Point Environment
| Stat | Description | Status |
|------|-------------|--------|
| away3PAR / home3PAR | 3-point attempt rate (3PA/FGA) | ✅ IN USE (F4) |
| awayOpp3PAR / homeOpp3PAR | Opponent 3PA rate allowed | 🔓 AVAILABLE |
| away3Pct / home3Pct | Season 3-point % | ✅ IN USE (F4) |
| away3PctLast10 / home3PctLast10 | Last 10 games 3P% | 🔓 AVAILABLE |
| league3PAR | League avg 3PA rate (~0.39) | ✅ IN USE |
| league3Pct | League avg 3P% (~0.36) | 🔓 AVAILABLE |

### Free Throw Environment
| Stat | Description | Status |
|------|-------------|--------|
| awayFTr / homeFTr | Free throw rate (FTA/FGA) | ✅ IN USE (F5) |
| awayOppFTr / homeOppFTr | Opponent FT rate allowed | 🔓 AVAILABLE |
| leagueFTr | League avg FT rate (~0.22) | ✅ IN USE |

### Turnovers
| Stat | Description | Status |
|------|-------------|--------|
| awayTOVLast10 / homeTOVLast10 | Turnovers/game (last 10) | 🔓 AVAILABLE |

### Rebounding
| Stat | Description | Status |
|------|-------------|--------|
| awayOffReb / homeOffReb | Offensive rebounds/game | 🔓 AVAILABLE |
| awayDefReb / homeDefReb | Defensive rebounds/game | 🔓 AVAILABLE |
| awayOppOffReb / homeOppOffReb | Opponent OREB allowed | 🔓 AVAILABLE |
| awayOppDefReb / homeOppDefReb | Opponent DREB allowed | 🔓 AVAILABLE |

### Four Factors (Dean Oliver)
| Stat | Description | Status |
|------|-------------|--------|
| awayEfg / homeEfg | Effective FG% | 🔓 AVAILABLE |
| awayTovPct / homeTovPct | Turnover % | 🔓 AVAILABLE |
| awayOrebPct / homeOrebPct | Offensive rebound % | 🔓 AVAILABLE |
| awayFtr / homeFtr | Free throw rate | 🔓 AVAILABLE |

### Home/Away Splits
| Stat | Description | Status |
|------|-------------|--------|
| awayORtgHome / awayORtgAway | Away team ORtg by location | 🔓 AVAILABLE |
| homeORtgHome / homeORtgAway | Home team ORtg by location | 🔓 AVAILABLE |
| awayDRtgHome / awayDRtgAway | Away team DRtg by location | 🔓 AVAILABLE |
| homeDRtgHome / homeDRtgAway | Home team DRtg by location | 🔓 AVAILABLE |

---

## Current Factors Already In Use (F1-F5)

**Do NOT propose factors that duplicate these:**

| # | Factor | Stats Used | Logic |
|---|--------|------------|-------|
| F1 | Pace Index | awayPaceLast10, homePaceLast10, leaguePace | Combined pace vs league avg. Higher → OVER |
| F2 | Offensive Form | awayORtgLast10, homeORtgLast10, leagueORtg | Combined ORtg vs league avg. Higher → OVER |
| F3 | Defensive Erosion | awayDRtgSeason, homeDRtgSeason, leagueDRtg | Combined DRtg vs league avg. Higher (worse D) → OVER |
| F4 | 3-Point Environment | away3PAR, home3PAR, away3Pct, home3Pct | Combined 3PA rate × 3P%. Higher → OVER |
| F5 | Whistle Environment | awayFTr, homeFTr, leagueFTr | Combined FT rate vs league avg. Higher → OVER |

---

## What I Need From You

Propose 3-5 NEW factors using the 🔓 AVAILABLE stats that are NOT currently in use.

For each factor, provide:

1. **Name**: Human-readable name
2. **Key**: camelCase identifier (e.g., "secondChancePoints")
3. **Stats Used**: List exact stat names from the table above
4. **Formula**: Show exactly how to calculate, e.g.:
   \`\`\`
   combined = (awayOffReb + homeOffReb) / 2
   delta = combined - leagueAvg (need to define this)
   signal = tanh(delta / SCALE)
   \`\`\`
5. **Direction**: Higher signal → OVER or UNDER?
6. **Betting Thesis**: Why does this predict scoring? What edge does it exploit?
7. **Market Inefficiency**: Why do sportsbooks/public miss this?
8. **Confidence**: High/Medium/Low based on logical soundness

---

## Constraints

- Use ONLY stats listed in the table above (exact names with away/home prefixes)
- Each factor must combine BOTH teams' stats (it's a TOTALS prediction)
- Explain the causal mechanism (why does X stat → higher/lower scoring?)
- Avoid factors that just re-measure what F1-F5 already capture
- Think like a sharp bettor: what do squares miss?`
}

function generateSpreadPrompt(): string {
  return `# NBA SPREAD Factor Design Request

You are helping me design new betting factors for an NBA SPREAD (Point Spread/ATS) prediction system.

## How Our System Works

We predict which team will cover the spread. Each "factor" compares the two teams:
- **Positive signal** → Away team covers
- **Negative signal** → Home team covers
- **Signal magnitude** indicates confidence (±1.0 max)

### Factor Calculation Pattern:
\`\`\`typescript
// Compare teams (away - home or home - away depending on stat meaning)
const diff = awayStat - homeStat

// Scale to -1 to +1 using tanh
const signal = Math.tanh(diff / SCALE)

// Positive = away covers, Negative = home covers
const awayScore = signal > 0 ? signal * 5.0 : 0
const homeScore = signal < 0 ? Math.abs(signal) * 5.0 : 0
\`\`\`

---

## Available Statistics (NBAStatsBundle)

These are the EXACT stat names we can use. Each stat exists for BOTH teams:

### Pace & Tempo
| Stat | Description | Status |
|------|-------------|--------|
| awayPaceSeason / homePaceSeason | Season pace | 🔓 AVAILABLE |
| awayPaceLast10 / homePaceLast10 | Last 10 games pace | 🔓 AVAILABLE |

### Offensive Efficiency
| Stat | Description | Status |
|------|-------------|--------|
| awayORtgLast10 / homeORtgLast10 | Offensive rating | ✅ IN USE (S1) |

### Defensive Efficiency
| Stat | Description | Status |
|------|-------------|--------|
| awayDRtgSeason / homeDRtgSeason | Defensive rating | ✅ IN USE (S1) |

### 3-Point Environment
| Stat | Description | Status |
|------|-------------|--------|
| away3PAR / home3PAR | 3-point attempt rate | 🔓 AVAILABLE |
| awayOpp3PAR / homeOpp3PAR | Opponent 3PA allowed | 🔓 AVAILABLE |
| away3Pct / home3Pct | Season 3P% | 🔓 AVAILABLE |
| away3PctLast10 / home3PctLast10 | Last 10 games 3P% | 🔓 AVAILABLE |

### Free Throw Environment
| Stat | Description | Status |
|------|-------------|--------|
| awayFTr / homeFTr | Free throw rate | 🔓 AVAILABLE |
| awayOppFTr / homeOppFTr | Opponent FT rate allowed | 🔓 AVAILABLE |

### Turnovers
| Stat | Description | Status |
|------|-------------|--------|
| awayTOVLast10 / homeTOVLast10 | Turnovers/game (last 10) | ✅ IN USE (S2) |

### Rebounding
| Stat | Description | Status |
|------|-------------|--------|
| awayOffReb / homeOffReb | Offensive rebounds/game | 🔓 AVAILABLE |
| awayDefReb / homeDefReb | Defensive rebounds/game | 🔓 AVAILABLE |
| awayOppOffReb / homeOppOffReb | Opponent OREB allowed | 🔓 AVAILABLE |

### Four Factors
| Stat | Description | Status |
|------|-------------|--------|
| awayEfg / homeEfg | Effective FG% | ✅ IN USE (S5) |
| awayTovPct / homeTovPct | Turnover % | ✅ IN USE (S5) |
| awayOrebPct / homeOrebPct | Offensive rebound % | ✅ IN USE (S5) |
| awayFtr / homeFtr | Free throw rate | ✅ IN USE (S5) |

### Home/Away Splits
| Stat | Description | Status |
|------|-------------|--------|
| awayORtgHome / awayORtgAway | Away team ORtg by location | ✅ IN USE (S4) |
| homeORtgHome / homeORtgAway | Home team ORtg by location | ✅ IN USE (S4) |
| awayDRtgHome / awayDRtgAway | Away team DRtg by location | ✅ IN USE (S4) |
| homeDRtgHome / homeDRtgAway | Home team DRtg by location | ✅ IN USE (S4) |

---

## Current Factors Already In Use (S1-S5)

| # | Factor | Stats Used | Logic |
|---|--------|------------|-------|
| S1 | Net Rating Diff | ORtg, DRtg (both teams) | Net rating comparison |
| S2 | Turnover Diff | awayTOVLast10, homeTOVLast10 | Ball security comparison |
| S3 | Shooting + Momentum | EFG, recent trends | Efficiency comparison |
| S4 | Home/Away Splits | Location-based ORtg/DRtg | Performance by location |
| S5 | Four Factors Diff | Efg, TovPct, OrebPct, Ftr | Dean Oliver metrics |

---

## What I Need From You

Propose 3-5 NEW factors using the 🔓 AVAILABLE stats.

For each factor provide:
1. **Name**: Human-readable name
2. **Key**: camelCase identifier
3. **Stats Used**: Exact stat names
4. **Formula**: Show calculation (away - home or vice versa)
5. **Direction**: Positive signal favors AWAY or HOME covering?
6. **Betting Thesis**: Why does this predict ATS performance?
7. **Market Inefficiency**: What do sportsbooks/public miss?
8. **Confidence**: High/Medium/Low

---

## Constraints

- Use ONLY stats listed above (exact names)
- Compare the TWO teams (it's spread betting, not totals)
- Explain causal mechanism for covering spreads
- Avoid duplicating S1-S5
- Think contrarian: what edges does the public miss?`
}

// Keep GET for backward compatibility - returns usage instructions
export async function GET() {
  return NextResponse.json({
    name: 'AI Factor Strategist',
    description: 'Generates a comprehensive prompt for ChatGPT 5.0 to design new betting factors',
    usage: 'POST with { "betType": "TOTALS" } or { "betType": "SPREAD" }',
    example_response: {
      success: true,
      betType: 'TOTALS',
      prompt: '# NBA TOTALS Factor Design Request...',
      instructions: 'Copy this prompt and paste it into ChatGPT 5.0 for expert factor recommendations.'
    }
  })
}

