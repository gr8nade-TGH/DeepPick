/**
 * Grok API Client for Sentiment Analysis
 * 
 * Uses xAI's Grok models which are trained on real-time X/Twitter data
 * for sentiment analysis on sports betting.
 */

export interface GrokSentimentRequest {
  awayTeam: string
  homeTeam: string
  spread?: { away: number; home: number }
  total?: number
  gameDate: string
  betType: 'SPREAD' | 'TOTAL'
}

export interface GrokSentimentResponse {
  success: boolean
  sentiment?: {
    awaySentimentPct: number  // % of public backing away team (SPREAD) or OVER (TOTAL)
    homeSentimentPct: number  // % of public backing home team (SPREAD) or UNDER (TOTAL)
    awayReasons: string[]
    homeReasons: string[]
    overallConfidence: 'high' | 'medium' | 'low'
    samplePosts: Array<{ text: string; likes: number; sentiment: string }>
    rawAnalysis: string
  }
  quantified?: {
    X: number  // Sentiment skew score (-10 to +10)
    Y: number  // Conviction strength (0 to 10)
    Z: number  // Data quality (0 to 1)
  }
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

export async function getGrokSentiment(request: GrokSentimentRequest): Promise<GrokSentimentResponse> {
  const apiKey = process.env.GROK_API_KEY

  if (!apiKey) {
    return { success: false, error: 'GROK_API_KEY not configured' }
  }

  // Build the prompt based on bet type
  const prompt = request.betType === 'SPREAD'
    ? buildSpreadSentimentPrompt(request)
    : buildTotalSentimentPrompt(request)

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',  // Fast and cheap for high-volume
        messages: [
          {
            role: 'system',
            content: `You are a sports betting sentiment analyst. Analyze public sentiment from X/Twitter about NBA games. 
You have access to real-time X data through your training.
Always respond in valid JSON format with the exact structure requested.
Be specific about percentages and cite real sentiment patterns you observe.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,  // Low for consistency
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Grok API] Error response:', errorText)
      return { success: false, error: `Grok API error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { success: false, error: 'No content in Grok response' }
    }

    // Parse the JSON response
    const parsed = parseGrokResponse(content, request.betType)

    return {
      success: true,
      sentiment: parsed.sentiment,
      quantified: parsed.quantified,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    }

  } catch (error) {
    console.error('[Grok API] Exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling Grok API'
    }
  }
}

function buildSpreadSentimentPrompt(req: GrokSentimentRequest): string {
  const awaySpread = req.spread?.away ?? 0
  const homeSpread = req.spread?.home ?? 0
  const awayLine = awaySpread > 0 ? `+${awaySpread}` : awaySpread.toString()
  const homeLine = homeSpread > 0 ? `+${homeSpread}` : homeSpread.toString()

  return `Analyze public sentiment on X/Twitter for tonight's NBA game:

**${req.awayTeam} (${awayLine}) @ ${req.homeTeam} (${homeLine})**
**Date:** ${req.gameDate}

Search for recent posts about this game and analyze:
1. What percentage of fans/bettors favor ${req.awayTeam} ${awayLine}?
2. What percentage favor ${req.homeTeam} ${homeLine}?
3. What are the top 2-3 reasons cited for each side?
4. How confident/loud is each camp?
5. Find 2-3 sample posts with high engagement

Respond in this exact JSON format:
{
  "awaySentimentPct": <number 0-100>,
  "homeSentimentPct": <number 0-100>,
  "awayReasons": ["reason1", "reason2"],
  "homeReasons": ["reason1", "reason2"],
  "overallConfidence": "high" | "medium" | "low",
  "samplePosts": [
    {"text": "post text...", "likes": <number>, "sentiment": "away" | "home"}
  ],
  "rawAnalysis": "Brief 2-3 sentence summary of the overall vibe"
}`
}

function buildTotalSentimentPrompt(req: GrokSentimentRequest): string {
  return `Analyze public sentiment on X/Twitter for tonight's NBA game total:

**${req.awayTeam} @ ${req.homeTeam}**
**Total Line:** ${req.total}
**Date:** ${req.gameDate}

Search for recent posts about this game's total and analyze:
1. What percentage of fans/bettors favor OVER ${req.total}?
2. What percentage favor UNDER ${req.total}?
3. What are the top 2-3 reasons cited for each side?
4. How confident/loud is each camp?
5. Find 2-3 sample posts with high engagement

Respond in this exact JSON format:
{
  "awaySentimentPct": <number 0-100 for OVER>,
  "homeSentimentPct": <number 0-100 for UNDER>,
  "awayReasons": ["reason for OVER 1", "reason for OVER 2"],
  "homeReasons": ["reason for UNDER 1", "reason for UNDER 2"],
  "overallConfidence": "high" | "medium" | "low",
  "samplePosts": [
    {"text": "post text...", "likes": <number>, "sentiment": "over" | "under"}
  ],
  "rawAnalysis": "Brief 2-3 sentence summary of the overall vibe"
}`
}

function parseGrokResponse(content: string, betType: 'SPREAD' | 'TOTAL'): {
  sentiment: GrokSentimentResponse['sentiment']
  quantified: GrokSentimentResponse['quantified']
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    const awaySentimentPct = Number(parsed.awaySentimentPct) || 50
    const homeSentimentPct = Number(parsed.homeSentimentPct) || 50

    // Quantify into X, Y, Z values
    // X = Sentiment Skew: (awaySentiment - 50) / 5 → range -10 to +10
    //     Positive = public favors away/OVER, Negative = public favors home/UNDER
    const X = Math.max(-10, Math.min(10, (awaySentimentPct - 50) / 5))

    // Y = Conviction Strength: how one-sided is it? |away - home| / 10 → range 0 to 10
    const Y = Math.abs(awaySentimentPct - homeSentimentPct) / 10

    // Z = Data Quality: based on confidence level
    const confidenceMap: Record<string, number> = { 'high': 0.9, 'medium': 0.7, 'low': 0.5 }
    const Z = confidenceMap[parsed.overallConfidence] || 0.6

    return {
      sentiment: {
        awaySentimentPct,
        homeSentimentPct,
        awayReasons: parsed.awayReasons || [],
        homeReasons: parsed.homeReasons || [],
        overallConfidence: parsed.overallConfidence || 'medium',
        samplePosts: parsed.samplePosts || [],
        rawAnalysis: parsed.rawAnalysis || ''
      },
      quantified: {
        X: Number(X.toFixed(2)),
        Y: Number(Y.toFixed(2)),
        Z: Number(Z.toFixed(2))
      }
    }
  } catch (error) {
    console.error('[Grok] Failed to parse response:', error, 'Content:', content)
    // Return neutral values on parse failure
    return {
      sentiment: {
        awaySentimentPct: 50,
        homeSentimentPct: 50,
        awayReasons: ['Parse error'],
        homeReasons: ['Parse error'],
        overallConfidence: 'low',
        samplePosts: [],
        rawAnalysis: content.substring(0, 500)
      },
      quantified: { X: 0, Y: 0, Z: 0.3 }
    }
  }
}

