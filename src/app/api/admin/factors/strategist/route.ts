'use server'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// All available stats for the AI to work with
const AVAILABLE_STATS = {
  // Pace & Tempo
  pace: { name: 'Pace', desc: 'Possessions per game', unit: 'poss/game', inUse: true },
  paceDelta: { name: 'Pace vs League', desc: 'Team pace minus league average', unit: 'delta', inUse: false },
  paceVariance: { name: 'Pace Variance', desc: 'Std dev of pace over last 10 games', unit: 'stdev', inUse: false },
  
  // Offense
  ortg: { name: 'Offensive Rating', desc: 'Points per 100 possessions', unit: 'pts/100', inUse: true },
  ppg: { name: 'Points Per Game', desc: 'Average points scored', unit: 'pts', inUse: false },
  fgPct: { name: 'Field Goal %', desc: 'Field goal percentage', unit: '%', inUse: false },
  avgEfg: { name: 'Effective FG%', desc: '(FGM + 0.5*3PM) / FGA', unit: '%', inUse: true },
  threeP_pct: { name: '3-Point %', desc: '3-point percentage', unit: '%', inUse: true },
  threeP_rate: { name: '3-Point Rate', desc: '3PA as % of total FGA', unit: '%', inUse: true },
  fg3PtMade: { name: '3-Pointers Made', desc: '3PM per game', unit: '3pm', inUse: false },
  ft_rate: { name: 'Free Throw Rate', desc: 'FTA per FGA', unit: 'ratio', inUse: true },
  ftPct: { name: 'Free Throw %', desc: 'FT percentage', unit: '%', inUse: false },
  assists: { name: 'Assists Per Game', desc: 'Avg assists', unit: 'ast', inUse: false },
  astTovRatio: { name: 'AST/TOV Ratio', desc: 'Assists per turnover', unit: 'ratio', inUse: false },
  
  // Defense
  drtg: { name: 'Defensive Rating', desc: 'Opp points per 100 poss', unit: 'pts/100', inUse: true },
  oppPpg: { name: 'Opp Points Per Game', desc: 'Points allowed', unit: 'pts', inUse: false },
  steals: { name: 'Steals Per Game', desc: 'Avg steals', unit: 'stl', inUse: false },
  blocks: { name: 'Blocks Per Game', desc: 'Avg blocks', unit: 'blk', inUse: false },
  oppFgPct: { name: 'Opp FG%', desc: 'Opponent FG% allowed', unit: '%', inUse: false },
  oppThreePct: { name: 'Opp 3P%', desc: 'Opponent 3P% allowed', unit: '%', inUse: false },
  
  // Ball Control
  avgTurnovers: { name: 'Turnovers Per Game', desc: 'Avg turnovers', unit: 'tov', inUse: true },
  avgTovPct: { name: 'Turnover %', desc: 'TOV per 100 poss', unit: '%', inUse: true },
  oppTov: { name: 'Opp Turnovers', desc: 'Turnovers forced', unit: 'tov', inUse: false },
  tovDiff: { name: 'Turnover Diff', desc: 'Forced minus committed', unit: 'diff', inUse: false },
  
  // Rebounding
  avgOffReb: { name: 'Offensive Rebounds', desc: 'OREB per game', unit: 'oreb', inUse: true },
  avgDefReb: { name: 'Defensive Rebounds', desc: 'DREB per game', unit: 'dreb', inUse: true },
  totalReb: { name: 'Total Rebounds', desc: 'Total REB per game', unit: 'reb', inUse: false },
  avgOrebPct: { name: 'OREB%', desc: 'Offensive rebound %', unit: '%', inUse: true },
  rebDiff: { name: 'Rebound Differential', desc: 'REB minus opp REB', unit: 'diff', inUse: false },
  
  // Splits
  ortgHome: { name: 'Home ORtg', desc: 'ORtg in home games', unit: 'pts/100', inUse: true },
  ortgAway: { name: 'Away ORtg', desc: 'ORtg in away games', unit: 'pts/100', inUse: true },
  drtgHome: { name: 'Home DRtg', desc: 'DRtg in home games', unit: 'pts/100', inUse: true },
  drtgAway: { name: 'Away DRtg', desc: 'DRtg in away games', unit: 'pts/100', inUse: true },
  
  // Standings
  winPct: { name: 'Win %', desc: 'Overall win percentage', unit: '%', inUse: false },
  confRank: { name: 'Conference Rank', desc: 'Ranking in conference', unit: 'rank', inUse: false },
  streak: { name: 'Win/Loss Streak', desc: 'Current streak', unit: 'games', inUse: false },
  last10: { name: 'Last 10 Record', desc: 'Wins in last 10', unit: 'wins', inUse: false },
  netRtg: { name: 'Net Rating', desc: 'ORtg minus DRtg', unit: 'pts/100', inUse: false },
  
  // Situational
  restDays: { name: 'Rest Days', desc: 'Days since last game', unit: 'days', inUse: true },
  b2bGame: { name: 'Back-to-Back', desc: 'Is this a B2B game?', unit: 'bool', inUse: false },
  q4Diff: { name: 'Q4 Scoring Diff', desc: '4th quarter scoring margin', unit: 'pts', inUse: false },
  
  // Misc
  fouls: { name: 'Fouls Per Game', desc: 'Personal fouls', unit: 'pf', inUse: false },
  plusMinus: { name: 'Plus/Minus', desc: 'Point differential', unit: '+/-', inUse: false },
}

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

    // Build the expert prompt
    const statsDescription = Object.entries(AVAILABLE_STATS)
      .map(([key, stat]) => `- ${key}: ${stat.name} (${stat.desc}) [${stat.unit}] ${stat.inUse ? '⚡IN USE' : ''}`)
      .join('\n')

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
      ? `TASK: Design ${count} NEW factors for NBA TOTALS betting (over/under predictions).

AVAILABLE STATISTICS:
${statsDescription}

CURRENT FACTORS ALREADY IN USE:
- paceIndex: Uses pace (combined team tempos)
- threeEnv: Uses threeP_pct, threeP_rate (3-point environment)
- whistleEnv: Uses ft_rate (free throw environment)
- defErosion: Uses drtg, restDays (defensive fatigue)
- fourFactorsDiff: Uses avgEfg, avgTovPct, avgOrebPct (Dean Oliver's Four Factors)
- homeAwaySplits: Uses ortgHome, ortgAway, drtgHome, drtgAway

REQUIREMENTS:
1. Each factor should combine 2-4 stats in a MEANINGFUL way
2. Avoid redundancy with existing factors
3. Focus on factors that predict SCORING TOTALS (over/under)
4. Each factor needs a clear betting thesis explaining WHY it works
5. Specify direction: does higher value predict OVER or UNDER?
6. Think contrarian - what edges does the public miss?

FACTOR IDEAS TO CONSIDER:
- Pace mismatch factors (fast vs slow team matchups)
- Offensive rebounding creates second chances = more points
- Teams that force turnovers create transition opportunities
- Free throw variance (high FT teams = more consistent scoring)
- Defensive matchup vulnerabilities

Return a JSON object with this exact structure:
{
  "factors": [
    {
      "name": "Human-readable name",
      "key": "camelCaseKey",
      "description": "What this factor measures",
      "stats_used": ["stat1", "stat2"],
      "formula": "How to calculate: (statA + statB) / 2 or similar",
      "direction": "higher_over" or "higher_under",
      "betting_thesis": "Why this predicts scoring totals - the betting edge",
      "edge_explanation": "Why the market misses this / what inefficiency it exploits",
      "confidence": "high" or "medium" or "low"
    }
  ]
}`
      : `TASK: Design ${count} NEW factors for NBA SPREAD betting (point spread/moneyline predictions).

AVAILABLE STATISTICS:
${statsDescription}

CURRENT FACTORS ALREADY IN USE:
- netRatingDiff: Uses ortg, drtg (overall team quality gap)
- homeAwaySplits: Uses ortgHome, ortgAway, drtgHome, drtgAway (location performance)
- restAdvantage: Uses restDays (fatigue differential)
- momentumFactor: Uses last10, streak (recent form)

REQUIREMENTS:
1. Each factor should combine 2-4 stats in a MEANINGFUL way
2. Avoid redundancy with existing factors  
3. Focus on factors that predict WHICH TEAM COVERS THE SPREAD
4. Each factor needs a clear betting thesis explaining WHY it works
5. Specify direction: does higher value favor FAVORITE or UNDERDOG covering?
6. Think contrarian - what edges does the public miss?

FACTOR IDEAS TO CONSIDER:
- True quality gaps (the market overreacts to recent games)
- Defensive consistency predicts spread coverage better than offense
- Turnover differential = possession advantage = more chances
- Road teams with elite defense often cover
- Public fades: contrarian plays against popular teams

Return a JSON object with this exact structure:
{
  "factors": [
    {
      "name": "Human-readable name",
      "key": "camelCaseKey", 
      "description": "What this factor measures",
      "stats_used": ["stat1", "stat2"],
      "formula": "How to calculate: (statA - statB) or similar",
      "direction": "higher_favorite" or "higher_underdog",
      "betting_thesis": "Why this predicts spread coverage - the betting edge",
      "edge_explanation": "Why the market misses this / what inefficiency it exploits",
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

