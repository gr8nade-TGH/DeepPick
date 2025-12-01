import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// ACTUAL stats available in NBAStatsBundle - these are what we can use in formulas
// Each stat exists for BOTH teams with away/home prefixes
const STATS_BUNDLE_REFERENCE = `
## NBAStatsBundle - Available Stats (from MySportsFeeds API)

Every game has TWO teams: away team and home team. Stats are prefixed accordingly.
For TOTALS, we typically combine both teams: (awayStat + homeStat) / 2 - leagueAvg

### Pace & Tempo
- awayPaceSeason / homePaceSeason: Season pace (possessions per game)
- awayPaceLast10 / homePaceLast10: Last 10 games pace
- leaguePace: League average pace (~100.1)

### Scoring
- awayPointsPerGame / homePointsPerGame: Average PPG (last 5 games)

### Offensive Efficiency
- awayORtgLast10 / homeORtgLast10: Offensive rating (pts per 100 poss)
- leagueORtg: League average ORtg (~114.5)

### Defensive Efficiency
- awayDRtgSeason / homeDRtgSeason: Defensive rating (opp pts per 100 poss)
- leagueDRtg: League average DRtg (~114.5)

### 3-Point Environment
- away3PAR / home3PAR: 3-point attempt rate (3PA / FGA)
- awayOpp3PAR / homeOpp3PAR: Opponent 3PA rate allowed
- away3Pct / home3Pct: Season 3-point percentage
- away3PctLast10 / home3PctLast10: Last 10 games 3P%
- league3PAR: League average 3PA rate (~0.39)
- league3Pct: League average 3P% (~0.36)

### Free Throw Environment
- awayFTr / homeFTr: Free throw rate (FTA / FGA)
- awayOppFTr / homeOppFTr: Opponent FT rate allowed
- leagueFTr: League average FT rate (~0.22)

### Turnovers
- awayTOVLast10 / homeTOVLast10: Turnovers per game (last 10)

### Rebounding
- awayOffReb / homeOffReb: Offensive rebounds per game
- awayDefReb / homeDefReb: Defensive rebounds per game
- awayOppOffReb / homeOppOffReb: Opponent OREB allowed
- awayOppDefReb / homeOppDefReb: Opponent DREB allowed

### Four Factors (Dean Oliver)
- awayEfg / homeEfg: Effective FG% = (FGM + 0.5*3PM) / FGA
- awayTovPct / homeTovPct: Turnover percentage
- awayOrebPct / homeOrebPct: Offensive rebound percentage
- awayFtr / homeFtr: Free throw rate

### Home/Away Splits
- awayORtgHome / awayORtgAway: Away team's ORtg at home vs road
- homeORtgHome / homeORtgAway: Home team's ORtg at home vs road
- awayDRtgHome / awayDRtgAway: Away team's DRtg at home vs road
- homeDRtgHome / homeDRtgAway: Home team's DRtg at home vs road
`

interface FactorProposal {
  name: string
  key: string
  description: string
  stats_used: string[]
  formula: string
  direction: 'higher_over' | 'higher_under' | 'higher_favorite' | 'higher_underdog'
  betting_thesis: string
  edge_explanation: string
  confidence: 'high' | 'medium' | 'low'
}

export async function POST(request: NextRequest) {
  try {
    const { betType, count = 8 } = await request.json()

    if (!betType || !['TOTALS', 'SPREAD'].includes(betType)) {
      return NextResponse.json({ error: 'Invalid bet type' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = `You are an elite NBA sports bettor with 20+ years of profitable experience. You understand:
- Market inefficiencies and where the public consistently gets it wrong
- The mathematics behind totals and spreads betting
- Which statistics actually predict outcomes vs. which are noise/variance
- How to combine factors for maximum edge while avoiding redundancy
- Sharp vs. square money movements and line psychology

You think like a professional handicapper, not a casual fan. You know that:
- Pace and efficiency matter more than raw points
- Defense travels, offense can be streaky
- Rest and scheduling create real edges
- The public overvalues recent scoring, undervalues defense
- Home court advantage varies significantly by team
- Back-to-backs affect defense more than offense`

    const userPrompt = betType === 'TOTALS'
      ? `TASK: Design ${count} NEW factor CONCEPTS for NBA TOTALS betting (over/under predictions).

${STATS_BUNDLE_REFERENCE}

CURRENT FACTORS ALREADY IN USE (avoid overlap):
- paceIndex: Combined team pace vs league average
- offForm: Combined offensive rating vs league average
- defErosion: Combined defensive rating + injury impact
- threeEnv: 3-point attempt rate and shooting percentage
- whistleEnv: Free throw rate environment

FORMULA STRUCTURE - IMPORTANT:
For TOTALS, we predict combined scoring of BOTH teams. Your formula should explain how to combine stats:

GOOD FORMULA EXAMPLES:
- "((awayOffReb + homeOffReb) / 2) - leagueAvg → Higher = more second chances = OVER"
- "((awayTOVLast10 + homeTOVLast10) / 2) → Higher turnovers = fewer possessions = UNDER"
- "(awayORtgLast10 + homeDRtgSeason) / 2 - leagueORtg → Matchup quality indicator"

BAD FORMULAS (too vague):
- "(pace + oppTov) / 2" ← Which team's pace? Who is the opponent?
- "offReb * ortg" ← Need away/home prefixes

REQUIREMENTS:
1. Use EXACT stat names from NBAStatsBundle (with away/home prefixes)
2. Explain how to combine both teams' stats for a TOTALS prediction
3. Compare to league average when relevant
4. Specify direction: higher value → OVER or UNDER
5. Include a clear betting thesis explaining the edge

Return JSON:
{
  "factors": [
    {
      "name": "Human-readable name",
      "key": "camelCaseKey",
      "description": "What this factor measures",
      "stats_used": ["awayStatName", "homeStatName", "leagueAvg"],
      "formula": "Exact formula using away/home/league prefixes",
      "direction": "higher_over" or "higher_under",
      "betting_thesis": "Why this predicts OVER or UNDER",
      "edge_explanation": "Why the market misses this",
      "confidence": "high" or "medium" or "low"
    }
  ]
}`
      : `TASK: Design ${count} NEW factor CONCEPTS for NBA SPREAD betting (point spread/ATS predictions).

${STATS_BUNDLE_REFERENCE}

CURRENT FACTORS ALREADY IN USE (avoid overlap):
- netRatingDiff: Away vs Home net rating (ORtg - DRtg)
- paceMismatch: Pace differential and tempo control
- homeAwaySplits: Location-based performance splits
- fourFactorsDiff: Dean Oliver's Four Factors comparison

FORMULA STRUCTURE - IMPORTANT:
For SPREAD betting, we compare the TWO teams to predict who covers.
Use "away" prefix for away team, "home" prefix for home team.
Positive signal = AWAY team covers, Negative signal = HOME team covers.

GOOD FORMULA EXAMPLES:
- "(awayDRtgSeason - homeDRtgSeason) → Lower DRtg = better defense, negative = home covers"
- "(awayEfg - homeEfg) → Positive = away is more efficient"
- "(awayTOVLast10 - homeTOVLast10) → Higher turnovers = disadvantage"

BAD FORMULAS (too vague):
- "drtg - oppDrtg" ← Which team is which?
- "pace * efficiency" ← Need away/home prefixes

REQUIREMENTS:
1. Use EXACT stat names from NBAStatsBundle (with away/home prefixes)
2. Explain the comparison logic between the two teams
3. Specify direction: positive signal favors AWAY or HOME covering
4. Include a clear betting thesis explaining the ATS edge

Return JSON:
{
  "factors": [
    {
      "name": "Human-readable name",
      "key": "camelCaseKey",
      "description": "What this factor measures",
      "stats_used": ["awayStatName", "homeStatName"],
      "formula": "Exact formula comparing away vs home team",
      "direction": "higher_away" or "higher_home",
      "betting_thesis": "Why this predicts spread coverage",
      "edge_explanation": "Why the market misses this",
      "confidence": "high" or "medium" or "low"
    }
  ]
}`

    console.log(`[Factor Strategist] Generating ${count} ${betType} factors with gpt-4o...`)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.8, // Higher for creative factor ideas
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(content) as { factors: FactorProposal[] }

    console.log(`[Factor Strategist] Generated ${parsed.factors.length} factor proposals`)

    return NextResponse.json({
      success: true,
      betType,
      model: 'gpt-4o',
      factors: parsed.factors,
      generated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Factor Strategist] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

