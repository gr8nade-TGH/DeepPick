/**
 * Test endpoint for exploring different Grok insight types
 * GET /api/test/grok-insights?type=pace&away=Lakers&home=Celtics&total=225
 */

import { NextRequest, NextResponse } from 'next/server'

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

async function callGrok(prompt: string): Promise<any> {
  const apiKey = process.env.GROK_API_KEY
  console.log('[Grok Test] API Key present:', !!apiKey)
  if (!apiKey) throw new Error('GROK_API_KEY not configured')

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content: `You are a sports betting analyst with access to real-time X/Twitter data. 
Analyze public sentiment and conversations about NBA games. 
Always respond in valid JSON format.`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })
  })

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content,
    usage: data.usage
  }
}

// Different insight prompts to test
const INSIGHT_PROMPTS: Record<string, (away: string, home: string, total: number) => string> = {

  // PACE SENTIMENT - Is this expected to be a fast or slow game?
  pace: (away, home, total) => `Analyze X/Twitter sentiment about the PACE of tonight's NBA game:

**${away} @ ${home}** (Total: ${total})

Search for posts discussing:
- "shootout", "high-scoring", "run and gun", "fast pace"
- "defensive battle", "grind", "slow", "under"
- Team pace ratings, tempo discussions
- Matchup-specific pace predictions

Respond in JSON:
{
  "paceSentiment": "fast" | "slow" | "neutral",
  "fastPacePct": <0-100>,
  "slowPacePct": <0-100>,
  "fastReasons": ["reason1", "reason2"],
  "slowReasons": ["reason1", "reason2"],
  "samplePosts": [{"text": "...", "likes": <num>, "pace": "fast"|"slow"}],
  "rawAnalysis": "2-3 sentence summary"
}`,

  // SCORING BUZZ - What combined score are people predicting?
  scoring: (away, home, total) => `Analyze X/Twitter for SCORING PREDICTIONS on tonight's NBA game:

**${away} @ ${home}** (Vegas Total: ${total})

Search for posts with:
- Explicit score predictions (e.g., "Lakers 115, Celtics 120")
- Total predictions ("I'm taking over 225", "this stays under")
- Point total discussions

Respond in JSON:
{
  "averagePredictedTotal": <number>,
  "vsVegasLine": "over" | "under" | "even",
  "marginVsLine": <points above/below vegas>,
  "overPct": <0-100>,
  "underPct": <0-100>,
  "scorePredictions": [{"awayScore": <num>, "homeScore": <num>, "likes": <num>}],
  "samplePosts": [{"text": "...", "likes": <num>}],
  "rawAnalysis": "2-3 sentence summary"
}`,

  // BLOWOUT RISK - Are people expecting a lopsided game?
  blowout: (away, home, total) => `Analyze X/Twitter for BLOWOUT RISK on tonight's NBA game:

**${away} @ ${home}** (Total: ${total})

Search for posts about:
- "blowout", "gonna be ugly", "no contest", "domination"
- Margin of victory predictions (10+ points)
- Garbage time implications
- Competitive game expectations

Respond in JSON:
{
  "blowoutRisk": "high" | "medium" | "low",
  "expectedMargin": <points>,
  "blowoutPct": <0-100>,
  "closeGamePct": <0-100>,
  "favoredTeam": "${away}" | "${home}",
  "blowoutReasons": ["reason1", "reason2"],
  "samplePosts": [{"text": "...", "likes": <num>}],
  "rawAnalysis": "2-3 sentence summary",
  "totalsImplication": "Blowouts often lead to garbage time scoring / or starters sitting"
}`,

  // REST/LOAD MANAGEMENT - Are key players expected to rest?
  rest: (away, home, total) => `Analyze X/Twitter for REST/LOAD MANAGEMENT chatter on tonight's NBA game:

**${away} @ ${home}** (Total: ${total})

Search for posts about:
- "resting", "DNP", "load management", "sitting out"
- Player availability rumors
- Back-to-back fatigue
- Injury concerns

Respond in JSON:
{
  "restRisk": "high" | "medium" | "low",
  "playersLikelyResting": [{"name": "...", "team": "...", "confidence": "high"|"medium"|"low"}],
  "backToBackTeam": "${away}" | "${home}" | "neither",
  "fatigueLevel": "high" | "medium" | "low",
  "samplePosts": [{"text": "...", "likes": <num>}],
  "rawAnalysis": "2-3 sentence summary",
  "totalsImplication": "Expected impact on scoring"
}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'pace'
  const away = searchParams.get('away') || 'Lakers'
  const home = searchParams.get('home') || 'Celtics'
  const total = Number(searchParams.get('total')) || 225

  const promptBuilder = INSIGHT_PROMPTS[type]
  if (!promptBuilder) {
    return NextResponse.json({
      error: `Unknown type: ${type}. Available: ${Object.keys(INSIGHT_PROMPTS).join(', ')}`
    }, { status: 400 })
  }

  try {
    const prompt = promptBuilder(away, home, total)
    const result = await callGrok(prompt)

    // Try to parse JSON from response
    let parsed = null
    try {
      const jsonMatch = result.content?.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch { /* ignore parse errors */ }

    return NextResponse.json({
      success: true,
      insightType: type,
      matchup: `${away} @ ${home}`,
      total,
      rawResponse: result.content,
      parsed,
      usage: result.usage
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

