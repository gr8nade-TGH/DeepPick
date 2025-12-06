/**
 * Grok API Client for AI Archetypes
 *
 * Uses xAI's Grok models which are trained on real-time X/Twitter data
 * for sentiment analysis and research on sports betting.
 *
 * AI Archetypes (0-5 points each):
 * 1. THE PULSE - General public sentiment (all X users)
 * 2. THE INFLUENCER - Betting influencer sentiment (10K+ follower accounts)
 * 3. THE INTERPRETER - Independent research-based analysis
 * 4. THE DEVIL'S ADVOCATE - Contrarian check / finds holes in picks
 */

export interface GrokSentimentRequest {
  awayTeam: string
  homeTeam: string
  spread?: { away: number; home: number }
  total?: number
  gameDate: string
  betType: 'SPREAD' | 'TOTAL'
}

export interface InfluencerSentimentRequest extends GrokSentimentRequest {
  minFollowers?: number  // Default 10000
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
    // Engagement breakdown
    awayTotalLikes: number
    homeTotalLikes: number
  }
  // The Pulse Factor Score (0 to 3.5 points toward one side)
  pulseScore?: {
    direction: 'away' | 'home'       // Which team gets the points
    points: number                    // 0 to 3.5
    teamName: string                  // e.g., "Celtics -7.5"
    breakdown: {
      sentimentLean: number           // -1 to +1 (positive = away favored)
      engagementLean: number          // -1 to +1 (positive = away more engagement)
      rawLean: number                 // Combined weighted score
      confidenceMultiplier: number    // 0.7 to 1.0
    }
  }
  // Baseline adjustment for pick diversity (-5 to +5 points)
  // Positive = shift baseline toward OVER/AWAY, Negative = shift toward UNDER/HOME
  baselineAdjustment?: {
    value: number                     // -5 to +5
    direction: 'OVER' | 'UNDER' | 'AWAY' | 'HOME'
    reasoning: string                 // Why this adjustment
  }
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

// The Influencer uses the same response structure but with influencer-specific data
export interface InfluencerSentimentResponse extends GrokSentimentResponse {
  influencerScore?: {
    direction: 'away' | 'home'
    points: number
    teamName: string
    breakdown: {
      influencerSentimentLean: number   // Sentiment from high-follower accounts
      influencerEngagementLean: number  // Engagement on influencer posts
      rawLean: number
      confidenceMultiplier: number
      accountsAnalyzed: number          // How many influencer accounts found
      avgFollowerCount: number          // Average followers of analyzed accounts
    }
  }
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

    // Parse the JSON response and calculate Pulse Score
    const parsed = parseGrokResponse(content, request.betType, request)

    return {
      success: true,
      sentiment: parsed.sentiment,
      pulseScore: parsed.pulseScore,
      baselineAdjustment: parsed.baselineAdjustment,
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

Finally, based on your sentiment analysis, provide a BASELINE ADJUSTMENT:
- If public sentiment strongly favors AWAY team, provide a positive number (+1 to +5)
- If public sentiment strongly favors HOME team, provide a negative number (-1 to -5)
- Small lean = ±1-2, Strong consensus = ±3-4, Overwhelming = ±5

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
  "rawAnalysis": "Brief 2-3 sentence summary of the overall vibe",
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "AWAY" | "HOME",
  "baselineReasoning": "One sentence explaining why this adjustment"
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

Finally, based on your sentiment analysis, provide a BASELINE ADJUSTMENT:
- If public sentiment strongly favors OVER, provide a positive number (+1 to +5)
- If public sentiment strongly favors UNDER, provide a negative number (-1 to -5)
- Small lean = ±1-2, Strong consensus = ±3-4, Overwhelming = ±5

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
  "rawAnalysis": "Brief 2-3 sentence summary of the overall vibe",
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "OVER" | "UNDER",
  "baselineReasoning": "One sentence explaining why this adjustment"
}`
}

function parseGrokResponse(
  content: string,
  betType: 'SPREAD' | 'TOTAL',
  request: GrokSentimentRequest
): {
  sentiment: GrokSentimentResponse['sentiment']
  pulseScore: GrokSentimentResponse['pulseScore']
  baselineAdjustment?: GrokSentimentResponse['baselineAdjustment']
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
    const samplePosts: Array<{ text: string; likes: number; sentiment: string }> = parsed.samplePosts || []

    // Calculate engagement by side
    let awayTotalLikes = 0
    let homeTotalLikes = 0
    for (const post of samplePosts) {
      const likes = Number(post.likes) || 0
      const sentiment = post.sentiment?.toLowerCase() || ''
      if (sentiment === 'away' || sentiment === 'over') {
        awayTotalLikes += likes
      } else if (sentiment === 'home' || sentiment === 'under') {
        homeTotalLikes += likes
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // THE PULSE FACTOR SCORE CALCULATION
    // ═══════════════════════════════════════════════════════════════════

    // Signal 1: Sentiment Lean (60% weight)
    // Range: -1 (100% home) to +1 (100% away)
    const sentimentLean = (awaySentimentPct - homeSentimentPct) / 100

    // Signal 2: Engagement Lean (40% weight)
    // Range: -1 (all home likes) to +1 (all away likes)
    const totalLikes = awayTotalLikes + homeTotalLikes
    const engagementLean = totalLikes > 0
      ? (awayTotalLikes - homeTotalLikes) / totalLikes
      : 0  // No engagement data = neutral

    // Combined weighted score
    const SENTIMENT_WEIGHT = 0.6
    const ENGAGEMENT_WEIGHT = 0.4
    const rawLean = (sentimentLean * SENTIMENT_WEIGHT) + (engagementLean * ENGAGEMENT_WEIGHT)

    // Confidence multiplier (reduces score when data quality is lower)
    const confidenceMultipliers: Record<string, number> = {
      'high': 1.0,
      'medium': 0.85,
      'low': 0.7
    }
    const confidenceMultiplier = confidenceMultipliers[parsed.overallConfidence] || 0.85

    // Adjust for confidence
    const adjustedLean = rawLean * confidenceMultiplier

    // Scale to 0-5.0 range using sqrt curve for amplification
    // Sqrt curve makes moderate signals (20-40% gaps) more meaningful
    // |adjustedLean| ranges from 0 to 1, sqrt amplifies smaller values
    const absLean = Math.abs(adjustedLean)
    const points = Math.min(5.0, Math.sqrt(absLean) * 5.0)

    // Determine direction
    const direction: 'away' | 'home' = adjustedLean >= 0 ? 'away' : 'home'

    // Build team name with spread for display
    let teamName: string
    if (betType === 'SPREAD') {
      if (direction === 'away') {
        const spread = request.spread?.away ?? 0
        teamName = `${request.awayTeam} ${spread > 0 ? '+' : ''}${spread}`
      } else {
        const spread = request.spread?.home ?? 0
        teamName = `${request.homeTeam} ${spread > 0 ? '+' : ''}${spread}`
      }
    } else {
      teamName = direction === 'away' ? 'OVER' : 'UNDER'
    }

    // Parse baseline adjustment from AI response
    const rawAdjustment = Number(parsed.baselineAdjustment) || 0
    const clampedAdjustment = Math.max(-5, Math.min(5, rawAdjustment))
    const baselineDirection = parsed.baselineDirection || (betType === 'TOTAL'
      ? (clampedAdjustment >= 0 ? 'OVER' : 'UNDER')
      : (clampedAdjustment >= 0 ? 'AWAY' : 'HOME'))

    return {
      sentiment: {
        awaySentimentPct,
        homeSentimentPct,
        awayReasons: parsed.awayReasons || [],
        homeReasons: parsed.homeReasons || [],
        overallConfidence: parsed.overallConfidence || 'medium',
        samplePosts,
        rawAnalysis: parsed.rawAnalysis || '',
        awayTotalLikes,
        homeTotalLikes
      },
      pulseScore: {
        direction,
        points: Number(points.toFixed(2)),
        teamName,
        breakdown: {
          sentimentLean: Number(sentimentLean.toFixed(3)),
          engagementLean: Number(engagementLean.toFixed(3)),
          rawLean: Number(rawLean.toFixed(3)),
          confidenceMultiplier
        }
      },
      baselineAdjustment: {
        value: clampedAdjustment,
        direction: baselineDirection as 'OVER' | 'UNDER' | 'AWAY' | 'HOME',
        reasoning: parsed.baselineReasoning || `Sentiment ${clampedAdjustment >= 0 ? 'favors' : 'against'} ${baselineDirection}`
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
        rawAnalysis: content.substring(0, 500),
        awayTotalLikes: 0,
        homeTotalLikes: 0
      },
      pulseScore: {
        direction: 'home',
        points: 0,
        teamName: 'N/A',
        breakdown: {
          sentimentLean: 0,
          engagementLean: 0,
          rawLean: 0,
          confidenceMultiplier: 0.7
        }
      },
      baselineAdjustment: undefined  // No adjustment on parse failure
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// THE INFLUENCER - Betting Influencer Sentiment Analysis
// ═══════════════════════════════════════════════════════════════════════════

export async function getInfluencerSentiment(request: InfluencerSentimentRequest): Promise<InfluencerSentimentResponse> {
  const apiKey = process.env.GROK_API_KEY
  const minFollowers = request.minFollowers || 10000

  if (!apiKey) {
    return { success: false, error: 'GROK_API_KEY not configured' }
  }

  const prompt = request.betType === 'SPREAD'
    ? buildInfluencerSpreadPrompt(request, minFollowers)
    : buildInfluencerTotalPrompt(request, minFollowers)

  try {
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
            content: `You are analyzing sports betting sentiment from INFLUENCER accounts on X/Twitter.
Focus ONLY on accounts with ${minFollowers.toLocaleString()}+ followers - betting analysts, handicappers, sports media, verified accounts.
Ignore regular fans. We want the smart money / influencer consensus.
Always respond in valid JSON format.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      return { success: false, error: `Grok API error: ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { success: false, error: 'No response from Grok' }
    }

    const parsed = parseInfluencerResponse(content, request.betType, request, minFollowers)

    return {
      success: true,
      sentiment: parsed.sentiment,
      influencerScore: parsed.influencerScore,
      baselineAdjustment: parsed.baselineAdjustment,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function buildInfluencerSpreadPrompt(req: InfluencerSentimentRequest, minFollowers: number): string {
  return `Analyze betting INFLUENCER sentiment on X/Twitter for tonight's NBA spread:

**${req.awayTeam} @ ${req.homeTeam}**
**Spread:** ${req.awayTeam} ${(req.spread?.away ?? 0) > 0 ? '+' : ''}${req.spread?.away ?? 0} / ${req.homeTeam} ${(req.spread?.home ?? 0) > 0 ? '+' : ''}${req.spread?.home ?? 0}
**Date:** ${req.gameDate}

⚠️ ONLY analyze posts from accounts with ${minFollowers.toLocaleString()}+ followers:
- Sports betting analysts and handicappers
- Sports media personalities
- Verified betting accounts
- Known sharp bettors

Ignore regular fans. We want INFLUENCER consensus only.

Find posts discussing this game's spread and analyze:
1. What % of INFLUENCERS favor ${req.awayTeam}?
2. What % favor ${req.homeTeam}?
3. Key reasons cited by influencers
4. Find 2-4 sample posts from high-follower accounts (include follower count)

Finally, based on INFLUENCER consensus, provide a BASELINE ADJUSTMENT:
- If influencers strongly favor AWAY team, provide a positive number (+1 to +5)
- If influencers strongly favor HOME team, provide a negative number (-1 to -5)
- Small lean = ±1-2, Strong consensus = ±3-4, Overwhelming = ±5

Respond in JSON:
{
  "awaySentimentPct": <0-100>,
  "homeSentimentPct": <0-100>,
  "awayReasons": ["reason 1", "reason 2"],
  "homeReasons": ["reason 1", "reason 2"],
  "overallConfidence": "high" | "medium" | "low",
  "accountsAnalyzed": <number of influencer accounts found>,
  "avgFollowerCount": <average followers of analyzed accounts>,
  "samplePosts": [
    {"text": "...", "likes": <num>, "sentiment": "away"|"home", "followers": <account follower count>}
  ],
  "rawAnalysis": "2-3 sentence summary of influencer consensus",
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "AWAY" | "HOME",
  "baselineReasoning": "One sentence explaining why"
}`
}

function buildInfluencerTotalPrompt(req: InfluencerSentimentRequest, minFollowers: number): string {
  return `Analyze betting INFLUENCER sentiment on X/Twitter for tonight's NBA total:

**${req.awayTeam} @ ${req.homeTeam}**
**Total Line:** ${req.total}
**Date:** ${req.gameDate}

⚠️ ONLY analyze posts from accounts with ${minFollowers.toLocaleString()}+ followers:
- Sports betting analysts and handicappers
- Sports media personalities
- Verified betting accounts
- Known sharp bettors

Ignore regular fans. We want INFLUENCER consensus only.

Find posts discussing this game's total and analyze:
1. What % of INFLUENCERS favor OVER ${req.total}?
2. What % favor UNDER ${req.total}?
3. Key reasons cited by influencers
4. Find 2-4 sample posts from high-follower accounts (include follower count)

Finally, based on INFLUENCER consensus, provide a BASELINE ADJUSTMENT:
- If influencers strongly favor OVER, provide a positive number (+1 to +5)
- If influencers strongly favor UNDER, provide a negative number (-1 to -5)
- Small lean = ±1-2, Strong consensus = ±3-4, Overwhelming = ±5

Respond in JSON:
{
  "awaySentimentPct": <0-100 for OVER>,
  "homeSentimentPct": <0-100 for UNDER>,
  "awayReasons": ["reason for OVER 1", "reason for OVER 2"],
  "homeReasons": ["reason for UNDER 1", "reason for UNDER 2"],
  "overallConfidence": "high" | "medium" | "low",
  "accountsAnalyzed": <number of influencer accounts found>,
  "avgFollowerCount": <average followers of analyzed accounts>,
  "samplePosts": [
    {"text": "...", "likes": <num>, "sentiment": "over"|"under", "followers": <account follower count>}
  ],
  "rawAnalysis": "2-3 sentence summary of influencer consensus",
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "OVER" | "UNDER",
  "baselineReasoning": "One sentence explaining why"
}`
}

function parseInfluencerResponse(
  content: string,
  betType: 'SPREAD' | 'TOTAL',
  request: InfluencerSentimentRequest,
  minFollowers: number
): {
  sentiment: InfluencerSentimentResponse['sentiment']
  influencerScore: InfluencerSentimentResponse['influencerScore']
  baselineAdjustment?: GrokSentimentResponse['baselineAdjustment']
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    const awaySentimentPct = Number(parsed.awaySentimentPct) || 50
    const homeSentimentPct = Number(parsed.homeSentimentPct) || 50
    const accountsAnalyzed = Number(parsed.accountsAnalyzed) || 0
    const avgFollowerCount = Number(parsed.avgFollowerCount) || minFollowers
    const samplePosts = parsed.samplePosts || []

    // Calculate engagement from influencer posts (weighted by followers)
    let awayEngagement = 0
    let homeEngagement = 0
    for (const post of samplePosts) {
      const weight = (Number(post.followers) || minFollowers) / minFollowers // Normalize by min followers
      const likes = Number(post.likes) || 0
      const sentiment = post.sentiment?.toLowerCase() || ''
      if (sentiment === 'away' || sentiment === 'over') {
        awayEngagement += likes * weight
      } else if (sentiment === 'home' || sentiment === 'under') {
        homeEngagement += likes * weight
      }
    }

    // Influencer Sentiment Lean
    const influencerSentimentLean = (awaySentimentPct - homeSentimentPct) / 100

    // Influencer Engagement Lean (weighted by follower count)
    const totalEngagement = awayEngagement + homeEngagement
    const influencerEngagementLean = totalEngagement > 0
      ? (awayEngagement - homeEngagement) / totalEngagement
      : 0

    // Combined score (sentiment weighted more heavily for influencers)
    const SENTIMENT_WEIGHT = 0.7  // Influencers get more sentiment weight
    const ENGAGEMENT_WEIGHT = 0.3
    const rawLean = (influencerSentimentLean * SENTIMENT_WEIGHT) + (influencerEngagementLean * ENGAGEMENT_WEIGHT)

    // Confidence based on accounts found and their quality
    let confidenceMultiplier = 0.7
    if (accountsAnalyzed >= 5 && avgFollowerCount >= 50000) {
      confidenceMultiplier = 1.0
    } else if (accountsAnalyzed >= 3 && avgFollowerCount >= 20000) {
      confidenceMultiplier = 0.9
    } else if (accountsAnalyzed >= 2) {
      confidenceMultiplier = 0.8
    }

    const adjustedLean = rawLean * confidenceMultiplier
    const absLean = Math.abs(adjustedLean)
    const points = Math.min(5.0, Math.sqrt(absLean) * 5.0)

    const direction: 'away' | 'home' = adjustedLean >= 0 ? 'away' : 'home'

    let teamName: string
    if (betType === 'SPREAD') {
      if (direction === 'away') {
        const spread = request.spread?.away ?? 0
        teamName = `${request.awayTeam} ${spread > 0 ? '+' : ''}${spread}`
      } else {
        const spread = request.spread?.home ?? 0
        teamName = `${request.homeTeam} ${spread > 0 ? '+' : ''}${spread}`
      }
    } else {
      teamName = direction === 'away' ? 'OVER' : 'UNDER'
    }

    // Parse baseline adjustment from AI response
    const rawAdjustment = Number(parsed.baselineAdjustment) || 0
    const clampedAdjustment = Math.max(-5, Math.min(5, rawAdjustment))
    const baselineDirection = parsed.baselineDirection || (betType === 'TOTAL'
      ? (clampedAdjustment >= 0 ? 'OVER' : 'UNDER')
      : (clampedAdjustment >= 0 ? 'AWAY' : 'HOME'))

    return {
      sentiment: {
        awaySentimentPct,
        homeSentimentPct,
        awayReasons: parsed.awayReasons || [],
        homeReasons: parsed.homeReasons || [],
        overallConfidence: parsed.overallConfidence || 'medium',
        samplePosts,
        rawAnalysis: parsed.rawAnalysis || '',
        awayTotalLikes: Math.round(awayEngagement),
        homeTotalLikes: Math.round(homeEngagement)
      },
      influencerScore: {
        direction,
        points: Number(points.toFixed(2)),
        teamName,
        breakdown: {
          influencerSentimentLean: Number(influencerSentimentLean.toFixed(3)),
          influencerEngagementLean: Number(influencerEngagementLean.toFixed(3)),
          rawLean: Number(rawLean.toFixed(3)),
          confidenceMultiplier,
          accountsAnalyzed,
          avgFollowerCount: Math.round(avgFollowerCount)
        }
      },
      baselineAdjustment: {
        value: clampedAdjustment,
        direction: baselineDirection as 'OVER' | 'UNDER' | 'AWAY' | 'HOME',
        reasoning: parsed.baselineReasoning || `Influencer consensus ${clampedAdjustment >= 0 ? 'favors' : 'against'} ${baselineDirection}`
      }
    }
  } catch (error) {
    console.error('[Grok Influencer] Parse error:', error)
    return {
      sentiment: {
        awaySentimentPct: 50,
        homeSentimentPct: 50,
        awayReasons: ['Parse error'],
        homeReasons: ['Parse error'],
        overallConfidence: 'low',
        samplePosts: [],
        rawAnalysis: content.substring(0, 500),
        awayTotalLikes: 0,
        homeTotalLikes: 0
      },
      influencerScore: {
        direction: 'home',
        points: 0,
        teamName: 'N/A',
        breakdown: {
          influencerSentimentLean: 0,
          influencerEngagementLean: 0,
          rawLean: 0,
          confidenceMultiplier: 0.7,
          accountsAnalyzed: 0,
          avgFollowerCount: 0
        }
      },
      baselineAdjustment: undefined
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE INTERPRETER - Independent Research-Based Analysis
// ═══════════════════════════════════════════════════════════════════════════

export interface InterpreterRequest {
  awayTeam: string
  homeTeam: string
  spread?: { away: number; home: number }
  total?: number
  gameDate: string
  betType: 'SPREAD' | 'TOTAL'
}

export interface InterpreterResponse {
  success: boolean
  analysis?: {
    pick: string                    // "OVER" | "UNDER" | "away_team" | "home_team"
    conviction: number              // 1-10
    confidence: 'high' | 'medium' | 'low'
    topReasons: string[]            // Top 3 reasons for the pick
    newsFindings: string[]          // Breaking news discovered
    riskFactors: string[]           // Potential concerns
    rawAnalysis: string
  }
  interpreterScore?: {
    direction: 'away' | 'home'      // or 'over' | 'under' for TOTALS
    points: number                  // 0-5
    teamName: string
    breakdown: {
      conviction: number            // 1-10 from Grok
      evidenceQuality: number       // How many concrete citations
      confidenceMultiplier: number  // Based on evidence quality
    }
  }
  // Baseline adjustment for pick diversity (-5 to +5 points)
  baselineAdjustment?: {
    value: number                   // -5 to +5
    direction: 'OVER' | 'UNDER' | 'AWAY' | 'HOME'
    reasoning: string
  }
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export async function getInterpreterAnalysis(request: InterpreterRequest): Promise<InterpreterResponse> {
  const apiKey = process.env.GROK_API_KEY

  if (!apiKey) {
    return { success: false, error: 'GROK_API_KEY not configured' }
  }

  const prompt = request.betType === 'SPREAD'
    ? buildInterpreterSpreadPrompt(request)
    : buildInterpreterTotalPrompt(request)

  try {
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
            content: `You are THE INTERPRETER - an elite sports betting analyst with real-time access to X/Twitter and news.
Your job is to RESEARCH and form your OWN independent opinion on games.
You don't just aggregate sentiment - you analyze news, matchups, trends, and form a thesis.
Be specific and cite evidence. Always respond in valid JSON format.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,  // Slightly higher for more creative research
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      return { success: false, error: `Grok API error: ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { success: false, error: 'No response from Grok' }
    }

    const parsed = parseInterpreterResponse(content, request.betType, request)

    return {
      success: true,
      analysis: parsed.analysis,
      interpreterScore: parsed.interpreterScore,
      baselineAdjustment: parsed.baselineAdjustment,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function buildInterpreterSpreadPrompt(req: InterpreterRequest): string {
  return `You are THE INTERPRETER. Research this NBA game and form your own opinion on the SPREAD:

**${req.awayTeam} @ ${req.homeTeam}**
**Spread:** ${req.awayTeam} ${(req.spread?.away ?? 0) > 0 ? '+' : ''}${req.spread?.away ?? 0} / ${req.homeTeam} ${(req.spread?.home ?? 0) > 0 ? '+' : ''}${req.spread?.home ?? 0}
**Date:** ${req.gameDate}

RESEARCH these areas using real-time X/Twitter and news:
1. **Breaking News** (last 24h) - Injuries, lineup changes, load management, trade rumors
2. **Recent Form** - Which team is hot/cold? Last 5 games performance
3. **Matchup Dynamics** - Key player matchups, style clashes, pace differences
4. **X-Factors** - Revenge games, back-to-backs, travel fatigue, motivation factors

Based on your research, form YOUR opinion. Who covers the spread?

Finally, provide a BASELINE ADJUSTMENT based on your research:
- If your research strongly favors AWAY team, provide a positive number (+1 to +5)
- If your research strongly favors HOME team, provide a negative number (-1 to -5)
- Small lean = ±1-2, Strong evidence = ±3-4, Overwhelming = ±5

Respond in JSON:
{
  "pick": "${req.awayTeam}" | "${req.homeTeam}",
  "conviction": <1-10>,
  "confidence": "high" | "medium" | "low",
  "topReasons": ["reason 1 with evidence", "reason 2 with evidence", "reason 3 with evidence"],
  "newsFindings": ["any breaking news you found"],
  "riskFactors": ["potential concerns for this pick"],
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "AWAY" | "HOME",
  "baselineReasoning": "One sentence explaining why"
}`
}

function buildInterpreterTotalPrompt(req: InterpreterRequest): string {
  return `You are THE INTERPRETER. Research this NBA game and form your own opinion on the TOTAL:

**${req.awayTeam} @ ${req.homeTeam}**
**Total:** ${req.total}
**Date:** ${req.gameDate}

RESEARCH these areas using real-time X/Twitter and news:
1. **Breaking News** (last 24h) - Injuries to key scorers, lineup changes affecting pace
2. **Pace Analysis** - Both teams' recent pace, tempo trends
3. **Defensive Matchups** - Are defenses clicking or struggling?
4. **Environment** - Back-to-backs, travel fatigue, rivalry intensity

Based on your research, form YOUR opinion. Over or Under?

Finally, provide a BASELINE ADJUSTMENT based on your research:
- If your research strongly favors OVER, provide a positive number (+1 to +5)
- If your research strongly favors UNDER, provide a negative number (-1 to -5)
- Small lean = ±1-2, Strong evidence = ±3-4, Overwhelming = ±5

Respond in JSON:
{
  "pick": "OVER" | "UNDER",
  "conviction": <1-10>,
  "confidence": "high" | "medium" | "low",
  "topReasons": ["reason 1 with evidence", "reason 2 with evidence", "reason 3 with evidence"],
  "newsFindings": ["any breaking news you found"],
  "riskFactors": ["potential concerns for this pick"],
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "OVER" | "UNDER",
  "baselineReasoning": "One sentence explaining why"
}`
}

function parseInterpreterResponse(content: string, betType: string, request: InterpreterRequest): {
  analysis: InterpreterResponse['analysis']
  interpreterScore: InterpreterResponse['interpreterScore']
  baselineAdjustment?: InterpreterResponse['baselineAdjustment']
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    const conviction = Math.min(10, Math.max(1, parsed.conviction || 5))
    const evidenceCount = (parsed.topReasons?.length || 0) + (parsed.newsFindings?.length || 0)
    const evidenceQuality = Math.min(1, evidenceCount / 5)  // Max at 5 pieces of evidence

    // Calculate points: conviction (1-10) -> 0-5 points, scaled by evidence quality
    const basePoints = (conviction / 10) * 5  // 0-5 range
    const confidenceMultiplier = evidenceQuality * 0.3 + 0.7  // 0.7-1.0 range
    const points = Math.min(5, basePoints * confidenceMultiplier)

    // Determine direction
    let direction: 'away' | 'home'
    if (betType === 'SPREAD') {
      direction = parsed.pick?.toLowerCase().includes(request.awayTeam.toLowerCase()) ? 'away' : 'home'
    } else {
      // For TOTALS, OVER = away (convention), UNDER = home
      direction = parsed.pick?.toUpperCase() === 'OVER' ? 'away' : 'home'
    }

    const teamName = betType === 'SPREAD'
      ? parsed.pick
      : parsed.pick?.toUpperCase()

    // Parse baseline adjustment from AI response
    const rawAdjustment = Number(parsed.baselineAdjustment) || 0
    const clampedAdjustment = Math.max(-5, Math.min(5, rawAdjustment))
    const baselineDirection = parsed.baselineDirection || (betType === 'TOTAL'
      ? (clampedAdjustment >= 0 ? 'OVER' : 'UNDER')
      : (clampedAdjustment >= 0 ? 'AWAY' : 'HOME'))

    return {
      analysis: {
        pick: parsed.pick || 'N/A',
        conviction,
        confidence: parsed.confidence || 'medium',
        topReasons: parsed.topReasons || [],
        newsFindings: parsed.newsFindings || [],
        riskFactors: parsed.riskFactors || [],
        rawAnalysis: content
      },
      interpreterScore: {
        direction,
        points: Number(points.toFixed(2)),
        teamName,
        breakdown: {
          conviction,
          evidenceQuality: Number(evidenceQuality.toFixed(2)),
          confidenceMultiplier: Number(confidenceMultiplier.toFixed(2))
        }
      },
      baselineAdjustment: {
        value: clampedAdjustment,
        direction: baselineDirection as 'OVER' | 'UNDER' | 'AWAY' | 'HOME',
        reasoning: parsed.baselineReasoning || `Research ${clampedAdjustment >= 0 ? 'favors' : 'against'} ${baselineDirection}`
      }
    }
  } catch (error) {
    return {
      analysis: {
        pick: 'N/A',
        conviction: 5,
        confidence: 'low',
        topReasons: ['Parse error'],
        newsFindings: [],
        riskFactors: [],
        rawAnalysis: content.substring(0, 500)
      },
      interpreterScore: {
        direction: 'home',
        points: 0,
        teamName: 'N/A',
        breakdown: {
          conviction: 5,
          evidenceQuality: 0,
          confidenceMultiplier: 0.7
        }
      },
      baselineAdjustment: undefined
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE DEVIL'S ADVOCATE - Contrarian Check / Find Holes in Picks
// ═══════════════════════════════════════════════════════════════════════════

export interface DevilsAdvocateRequest {
  awayTeam: string
  homeTeam: string
  spread?: { away: number; home: number }
  total?: number
  gameDate: string
  betType: 'SPREAD' | 'TOTAL'
  ourPick: string                   // Capper's pick (e.g., "Lakers" or "OVER")
  ourConfidence: number             // Capper's confidence (0-100)
  capperName?: string               // Name of the capper we're critiquing
  capperRecord?: {                  // Capper's track record
    wins: number
    losses: number
    net_units: number
    win_rate: number
    roi: number
  }
}

export interface DevilsAdvocateResponse {
  success: boolean
  analysis?: {
    riskScore: number               // 1-10: How much evidence found against our pick
    contraEvidence: string[]        // Evidence against our pick
    blindSpots: string[]            // Things our model might be missing
    breakingNews: string[]          // Recent news that could affect the pick
    recommendation: 'PROCEED' | 'CAUTION' | 'ABORT'
    capperCallout?: string          // Snarky one-liner about the capper
    rawAnalysis: string
  }
  devilsScore?: {
    direction: 'away' | 'home'      // Direction OPPOSITE to our pick (warns us)
    points: number                  // 0-5: Warning points against our pick
    teamName: string
    breakdown: {
      riskScore: number             // 1-10 from Grok
      evidenceCount: number         // How many contra points found
      severityMultiplier: number    // Based on breaking news
    }
  }
  // Baseline adjustment for pick diversity (-5 to +5 points)
  // Devil's Advocate typically provides NEGATIVE adjustments (warns against current direction)
  baselineAdjustment?: {
    value: number                   // -5 to +5
    direction: 'OVER' | 'UNDER' | 'AWAY' | 'HOME'
    reasoning: string
  }
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export async function getDevilsAdvocate(request: DevilsAdvocateRequest): Promise<DevilsAdvocateResponse> {
  const apiKey = process.env.GROK_API_KEY

  if (!apiKey) {
    return { success: false, error: 'GROK_API_KEY not configured' }
  }

  const prompt = request.betType === 'SPREAD'
    ? buildDevilsAdvocateSpreadPrompt(request)
    : buildDevilsAdvocateTotalPrompt(request)

  try {
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
            content: `You are THE DEVIL'S ADVOCATE - your job is to find HOLES in betting picks.
You are given a pick and you must research AGAINST it. Find every reason it could fail.
Search X/Twitter and news for breaking info, narratives, and concerns.
Be aggressive in finding counter-evidence. Always respond in valid JSON format.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,  // Higher for more creative devil's advocacy
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      return { success: false, error: `Grok API error: ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { success: false, error: 'No response from Grok' }
    }

    const parsed = parseDevilsAdvocateResponse(content, request.betType, request)

    return {
      success: true,
      analysis: parsed.analysis,
      devilsScore: parsed.devilsScore,
      baselineAdjustment: parsed.baselineAdjustment,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function buildDevilsAdvocateSpreadPrompt(req: DevilsAdvocateRequest): string {
  const capperIntro = req.capperName && req.capperRecord
    ? `We've selected **${req.capperName.toUpperCase()}** for scrutiny because they have a ${req.capperRecord.net_units >= 0 ? 'mediocre' : 'LOSING'} track record:
- Record: ${req.capperRecord.wins}W - ${req.capperRecord.losses}L (${req.capperRecord.win_rate.toFixed(1)}%)
- Net Units: ${req.capperRecord.net_units >= 0 ? '+' : ''}${req.capperRecord.net_units.toFixed(2)}u
- ROI: ${req.capperRecord.roi >= 0 ? '+' : ''}${req.capperRecord.roi.toFixed(1)}%

This capper thinks they're right, but let's see if the evidence says otherwise...`
    : req.capperName
      ? `We've selected **${req.capperName.toUpperCase()}** for scrutiny (new capper, no track record yet).`
      : ''

  return `You are THE DEVIL'S ADVOCATE. Your job is to DESTROY this pick if possible.

${capperIntro}

**THE PICK UNDER FIRE:**
- Game: ${req.awayTeam} @ ${req.homeTeam}
- Spread: ${req.awayTeam} ${(req.spread?.away ?? 0) > 0 ? '+' : ''}${req.spread?.away ?? 0} / ${req.homeTeam} ${(req.spread?.home ?? 0) > 0 ? '+' : ''}${req.spread?.home ?? 0}
- ${req.capperName ? req.capperName.toUpperCase() + "'s" : 'Their'} Pick: **${req.ourPick}** to cover
- Confidence: ${req.ourConfidence}%
- Date: ${req.gameDate}

YOUR MISSION: Find every reason this pick could FAIL. ${req.capperName ? `Show ${req.capperName} why they might be wrong!` : ''}

Search X/Twitter and news for:
1. **Breaking News** - Injuries, lineup changes announced in last 6 hours
2. **Contra Narratives** - What are people saying AGAINST ${req.ourPick}?
3. **Blind Spots** - What might this capper be missing? Historical trends, ref assignments, rest situations
4. **Red Flags** - Any concerning patterns or warnings

Rate the RISK to this pick (1-10):
- 1-3: Low risk, pick looks solid (even ${req.capperName || 'they'} got lucky)
- 4-6: Moderate risk, some concerns
- 7-10: High risk, significant evidence against pick

Finally, provide a BASELINE ADJUSTMENT (as the contrarian):
- If evidence strongly supports the OPPOSITE of the pick (AWAY team), provide POSITIVE adjustment (+1 to +5)
- If evidence strongly supports the OPPOSITE of the pick (HOME team), provide NEGATIVE adjustment (-1 to -5)
- Small concern = ±1-2, Moderate = ±3-4, Major red flags = ±5

Respond in JSON:
{
  "riskScore": <1-10>,
  "contraEvidence": ["evidence point 1", "evidence point 2", ...],
  "blindSpots": ["thing they might be missing 1", ...],
  "breakingNews": ["any breaking news found"],
  "recommendation": "PROCEED" | "CAUTION" | "ABORT",
  "capperCallout": "${req.capperName ? `A snarky one-liner calling out ${req.capperName} for this pick` : 'A snarky one-liner about this pick'}",
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "AWAY" | "HOME",
  "baselineReasoning": "One sentence explaining the contrarian view"
}`
}

function buildDevilsAdvocateTotalPrompt(req: DevilsAdvocateRequest): string {
  const capperIntro = req.capperName && req.capperRecord
    ? `We've selected **${req.capperName.toUpperCase()}** for scrutiny because they have a ${req.capperRecord.net_units >= 0 ? 'mediocre' : 'LOSING'} track record:
- Record: ${req.capperRecord.wins}W - ${req.capperRecord.losses}L (${req.capperRecord.win_rate.toFixed(1)}%)
- Net Units: ${req.capperRecord.net_units >= 0 ? '+' : ''}${req.capperRecord.net_units.toFixed(2)}u
- ROI: ${req.capperRecord.roi >= 0 ? '+' : ''}${req.capperRecord.roi.toFixed(1)}%

This capper thinks they're right about the total, but let's see if the evidence says otherwise...`
    : req.capperName
      ? `We've selected **${req.capperName.toUpperCase()}** for scrutiny (new capper, no track record yet).`
      : ''

  return `You are THE DEVIL'S ADVOCATE. Your job is to DESTROY this pick if possible.

${capperIntro}

**THE PICK UNDER FIRE:**
- Game: ${req.awayTeam} @ ${req.homeTeam}
- Total: ${req.total}
- ${req.capperName ? req.capperName.toUpperCase() + "'s" : 'Their'} Pick: **${req.ourPick}** (${req.ourPick === 'OVER' ? 'expecting high scoring' : 'expecting low scoring'})
- Confidence: ${req.ourConfidence}%
- Date: ${req.gameDate}

YOUR MISSION: Find every reason this pick could FAIL. ${req.capperName ? `Show ${req.capperName} why they might be wrong!` : ''}

Search X/Twitter and news for:
1. **Breaking News** - Injuries to key scorers/defenders announced in last 6 hours
2. **Contra Narratives** - What are people saying against ${req.ourPick}?
3. **Blind Spots** - Pace changes, defensive schemes, ref tendencies, weather/arena factors
4. **Red Flags** - Historical O/U trends, back-to-back fatigue, motivation factors

Rate the RISK to this pick (1-10):
- 1-3: Low risk, pick looks solid (even ${req.capperName || 'they'} got lucky)
- 4-6: Moderate risk, some concerns
- 7-10: High risk, significant evidence against pick

Finally, provide a BASELINE ADJUSTMENT (as the contrarian):
- If evidence strongly supports the OPPOSITE of the pick (OVER), provide POSITIVE adjustment (+1 to +5)
- If evidence strongly supports the OPPOSITE of the pick (UNDER), provide NEGATIVE adjustment (-1 to -5)
- Small concern = ±1-2, Moderate = ±3-4, Major red flags = ±5

Respond in JSON:
{
  "riskScore": <1-10>,
  "contraEvidence": ["evidence point 1", "evidence point 2", ...],
  "blindSpots": ["thing they might be missing 1", ...],
  "breakingNews": ["any breaking news found"],
  "recommendation": "PROCEED" | "CAUTION" | "ABORT",
  "capperCallout": "${req.capperName ? `A snarky one-liner calling out ${req.capperName} for this pick` : 'A snarky one-liner about this pick'}",
  "baselineAdjustment": <number -5 to +5>,
  "baselineDirection": "OVER" | "UNDER",
  "baselineReasoning": "One sentence explaining the contrarian view"
}`
}

function parseDevilsAdvocateResponse(content: string, betType: string, request: DevilsAdvocateRequest): {
  analysis: DevilsAdvocateResponse['analysis']
  devilsScore: DevilsAdvocateResponse['devilsScore']
  baselineAdjustment?: DevilsAdvocateResponse['baselineAdjustment']
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const parsed = JSON.parse(jsonMatch[0])

    const riskScore = Math.min(10, Math.max(1, parsed.riskScore || 5))
    const evidenceCount = (parsed.contraEvidence?.length || 0) + (parsed.blindSpots?.length || 0)
    const hasBreakingNews = (parsed.breakingNews?.length || 0) > 0

    // Calculate warning points: higher risk = more warning points against our pick
    // Risk 1-3 = 0-1.5 pts, Risk 4-6 = 1.5-3 pts, Risk 7-10 = 3-5 pts
    const basePoints = (riskScore / 10) * 5  // 0-5 range
    const severityMultiplier = hasBreakingNews ? 1.2 : 1.0  // Boost if breaking news found
    const points = Math.min(5, basePoints * severityMultiplier)

    // Direction is OPPOSITE to our pick (warning points go to the other side)
    let direction: 'away' | 'home'
    if (betType === 'SPREAD') {
      const ourPickIsAway = request.ourPick.toLowerCase().includes(request.awayTeam.toLowerCase())
      direction = ourPickIsAway ? 'home' : 'away'  // Opposite
    } else {
      // For TOTALS, if we picked OVER, warnings point to UNDER (home)
      direction = request.ourPick.toUpperCase() === 'OVER' ? 'home' : 'away'
    }

    const teamName = points >= 3 ? 'WARNING' : points >= 1.5 ? 'CAUTION' : 'CLEAR'

    // Parse baseline adjustment from AI response (contrarian view)
    const rawAdjustment = Number(parsed.baselineAdjustment) || 0
    const clampedAdjustment = Math.max(-5, Math.min(5, rawAdjustment))
    const baselineDirection = parsed.baselineDirection || (betType === 'TOTAL'
      ? (clampedAdjustment >= 0 ? 'OVER' : 'UNDER')
      : (clampedAdjustment >= 0 ? 'AWAY' : 'HOME'))

    return {
      analysis: {
        riskScore,
        contraEvidence: parsed.contraEvidence || [],
        blindSpots: parsed.blindSpots || [],
        breakingNews: parsed.breakingNews || [],
        recommendation: parsed.recommendation || 'PROCEED',
        capperCallout: parsed.capperCallout || undefined,
        rawAnalysis: content
      },
      devilsScore: {
        direction,
        points: Number(points.toFixed(2)),
        teamName,
        breakdown: {
          riskScore,
          evidenceCount,
          severityMultiplier: Number(severityMultiplier.toFixed(2))
        }
      },
      baselineAdjustment: {
        value: clampedAdjustment,
        direction: baselineDirection as 'OVER' | 'UNDER' | 'AWAY' | 'HOME',
        reasoning: parsed.baselineReasoning || `Contrarian view ${clampedAdjustment >= 0 ? 'favors' : 'against'} ${baselineDirection}`
      }
    }
  } catch (error) {
    return {
      analysis: {
        riskScore: 5,
        contraEvidence: ['Parse error'],
        blindSpots: [],
        breakingNews: [],
        recommendation: 'CAUTION',
        capperCallout: undefined,
        rawAnalysis: content.substring(0, 500)
      },
      devilsScore: {
        direction: 'home',
        points: 2.5,
        teamName: 'CAUTION',
        breakdown: {
          riskScore: 5,
          evidenceCount: 0,
          severityMultiplier: 1.0
        }
      },
      baselineAdjustment: undefined
    }
  }
}

// ============================================================================
// THE MATHEMATICIAN - Stats-Based Totals Analyst (0-5 points)
// ============================================================================

export interface MathematicianRequest {
  awayTeam: string
  homeTeam: string
  total: number
  gameDate: string
  stats: {
    away: TeamStatsInput
    home: TeamStatsInput
  }
}

export interface TeamStatsInput {
  pace: number
  ortg: number  // Offensive Rating
  drtg: number  // Defensive Rating
  ppg: number   // Points Per Game
  oppPpg: number // Opponent PPG
  threeP_pct: number
  threeP_rate: number
  ft_rate: number
  ftPct: number
  turnovers: number
  offReb: number
  defReb: number
  restDays?: number
  isBackToBack?: boolean
  winStreak?: number
  last10Record?: { wins: number; losses: number }
}

export interface MathematicianResponse {
  success: boolean
  analysis?: {
    projectedTotal: number
    marketLine: number
    edge: number
    direction: 'OVER' | 'UNDER'
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
    formula: {
      step1_baseProjection: number
      step2_paceAdjustment: number
      step3_restAdjustment: number
      step4_trendAdjustment: number
      step5_injuryAdjustment: number
      finalProjection: number
    }
    breakdown: {
      awayExpectedPts: number
      homeExpectedPts: number
      combinedPace: number
      combinedOffRtg: number
      combinedDefRtg: number
      paceImpact: string
      defenseMatchup: string
      restNotes: string
    }
    xFactors: string[]  // Breaking news from X that might affect total
    rawAnalysis: string
  }
  mathScore?: {
    direction: 'away' | 'home'  // away = OVER, home = UNDER
    points: number
    teamName: string  // "OVER" or "UNDER"
    breakdown: {
      edgeStrength: number       // 0-1 based on edge size
      confidenceMultiplier: number  // 0.7-1.0 based on data quality
      formulaScore: number       // Raw formula output
    }
  }
  // Baseline adjustment for pick diversity (-5 to +5 points)
  baselineAdjustment?: {
    value: number                   // -5 to +5
    direction: 'OVER' | 'UNDER' | 'AWAY' | 'HOME'
    reasoning: string
  }
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

/**
 * THE MATHEMATICIAN - Uses formula + Grok search for real-time adjustments
 */
export async function getMathematicianAnalysis(request: MathematicianRequest): Promise<MathematicianResponse> {
  const apiKey = process.env.GROK_API_KEY

  if (!apiKey) {
    return { success: false, error: 'GROK_API_KEY not configured' }
  }

  // Step 1: Calculate base projection using the formula
  const formulaResult = calculateMathematicianProjection(request)

  // Step 2: Use Grok to search X for injury/lineup news that might affect the total
  const prompt = buildMathematicianPrompt(request, formulaResult)

  try {
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
            content: `You are THE MATHEMATICIAN, an elite NBA totals analyst who combines statistical models with real-time X/Twitter intelligence.
Your job is to VERIFY or ADJUST a mathematical projection based on breaking news.
Be specific about player names, injury statuses, and lineup changes.
Search X for the most recent updates on this game.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,  // Low temp for analytical precision
        max_tokens: 1200
      })
    })

    if (!response.ok) {
      return { success: false, error: `Grok API error: ${response.status}` }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse Grok's response for adjustments
    const grokAnalysis = parseMathematicianResponse(content, formulaResult, request)

    return {
      success: true,
      analysis: grokAnalysis.analysis,
      mathScore: grokAnalysis.mathScore,
      baselineAdjustment: grokAnalysis.baselineAdjustment,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    }
  } catch (err) {
    console.error('[MATHEMATICIAN] Error:', err)

    // Return formula-only result if Grok fails
    return {
      success: true,
      analysis: {
        projectedTotal: formulaResult.projectedTotal,
        marketLine: request.total,
        edge: formulaResult.edge,
        direction: formulaResult.direction,
        confidence: formulaResult.confidence,
        formula: formulaResult.formula,
        breakdown: formulaResult.breakdown,
        xFactors: ['Grok search unavailable - using formula only'],
        rawAnalysis: 'Formula-based projection without X/Twitter verification'
      },
      mathScore: formulaResult.mathScore,
      baselineAdjustment: undefined  // No adjustment when Grok fails
    }
  }
}

interface FormulaResult {
  projectedTotal: number
  edge: number
  direction: 'OVER' | 'UNDER'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  formula: {
    step1_baseProjection: number
    step2_paceAdjustment: number
    step3_restAdjustment: number
    step4_trendAdjustment: number
    step5_injuryAdjustment: number
    finalProjection: number
  }
  breakdown: {
    awayExpectedPts: number
    homeExpectedPts: number
    combinedPace: number
    combinedOffRtg: number
    combinedDefRtg: number
    paceImpact: string
    defenseMatchup: string
    restNotes: string
  }
  mathScore: {
    direction: 'away' | 'home'
    points: number
    teamName: string
    breakdown: {
      edgeStrength: number
      confidenceMultiplier: number
      formulaScore: number
    }
  }
}

/**
 * Core mathematical projection formula
 */
function calculateMathematicianProjection(request: MathematicianRequest): FormulaResult {
  const { away, home } = request.stats
  const marketLine = request.total

  // League averages (2024-25 NBA)
  const LEAGUE_PACE = 99.5
  const LEAGUE_ORTG = 114.5
  const LEAGUE_DRTG = 114.5

  // =========================================================================
  // STEP 1: Base Projection using Offensive/Defensive Rating matchup
  // =========================================================================
  // Expected points = (Team ORtg × Opp DRtg / League Avg) × Pace / 100

  const combinedPace = (away.pace + home.pace) / 2
  const paceMultiplier = combinedPace / LEAGUE_PACE

  // Away team expected points: Their offense vs Home defense
  const awayExpectedPts = (away.ortg * home.drtg / LEAGUE_DRTG) * paceMultiplier / 100 * combinedPace

  // Home team expected points: Their offense vs Away defense
  const homeExpectedPts = (home.ortg * away.drtg / LEAGUE_DRTG) * paceMultiplier / 100 * combinedPace

  const step1_baseProjection = awayExpectedPts + homeExpectedPts

  // =========================================================================
  // STEP 2: Pace Adjustment (high pace = more possessions = more points)
  // =========================================================================
  const paceDelta = combinedPace - LEAGUE_PACE
  // Each possession above average = ~2.29 points (both teams)
  const step2_paceAdjustment = paceDelta * 2.29

  // =========================================================================
  // STEP 3: Rest Adjustment (B2B = tired = lower scoring)
  // =========================================================================
  let step3_restAdjustment = 0
  let restNotes = 'Normal rest for both teams'

  if (away.isBackToBack && home.isBackToBack) {
    step3_restAdjustment = -4.0  // Both tired
    restNotes = 'BOTH teams on B2B - expect lower total'
  } else if (away.isBackToBack) {
    step3_restAdjustment = -2.0
    restNotes = `${request.awayTeam} on B2B - fatigue factor`
  } else if (home.isBackToBack) {
    step3_restAdjustment = -2.0
    restNotes = `${request.homeTeam} on B2B - fatigue factor`
  } else if ((away.restDays || 1) >= 3 && (home.restDays || 1) >= 3) {
    step3_restAdjustment = +1.5  // Well rested = fresh legs
    restNotes = 'Both teams well-rested (3+ days)'
  }

  // =========================================================================
  // STEP 4: Trend Adjustment (hot/cold shooting, momentum)
  // =========================================================================
  // Compare recent PPG to season average
  const awayPpgTrend = away.ppg - ((away.ppg + away.oppPpg) / 2)
  const homePpgTrend = home.ppg - ((home.ppg + home.oppPpg) / 2)
  const step4_trendAdjustment = (awayPpgTrend + homePpgTrend) * 0.2  // 20% weight

  // =========================================================================
  // STEP 5: Injury placeholder (Grok will fill this in)
  // =========================================================================
  const step5_injuryAdjustment = 0  // Grok will adjust

  // =========================================================================
  // FINAL PROJECTION
  // =========================================================================
  const finalProjection = step1_baseProjection + step2_paceAdjustment + step3_restAdjustment + step4_trendAdjustment + step5_injuryAdjustment

  const edge = finalProjection - marketLine
  const direction: 'OVER' | 'UNDER' = edge > 0 ? 'OVER' : 'UNDER'

  // Confidence based on edge size
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  if (Math.abs(edge) >= 4) confidence = 'HIGH'
  else if (Math.abs(edge) >= 2) confidence = 'MEDIUM'

  // =========================================================================
  // MATH SCORE (0-5 points)
  // =========================================================================
  // Edge to points mapping:
  // 0-1 pts edge = 0.5-1.0 points
  // 1-2 pts edge = 1.0-2.0 points
  // 2-4 pts edge = 2.0-3.0 points
  // 4-6 pts edge = 3.0-4.0 points
  // 6+ pts edge = 4.0-5.0 points

  const absEdge = Math.abs(edge)
  let rawPoints = 0
  if (absEdge <= 1) rawPoints = 0.5 + (absEdge * 0.5)
  else if (absEdge <= 2) rawPoints = 1.0 + ((absEdge - 1) * 1.0)
  else if (absEdge <= 4) rawPoints = 2.0 + ((absEdge - 2) * 0.5)
  else if (absEdge <= 6) rawPoints = 3.0 + ((absEdge - 4) * 0.5)
  else rawPoints = 4.0 + Math.min((absEdge - 6) * 0.25, 1.0)

  // Confidence multiplier
  const confidenceMultiplier = confidence === 'HIGH' ? 1.0 : confidence === 'MEDIUM' ? 0.85 : 0.7
  const finalPoints = Math.min(rawPoints * confidenceMultiplier, 5.0)

  const paceImpact = paceDelta > 2 ? 'HIGH PACE - expect more possessions' :
    paceDelta < -2 ? 'LOW PACE - grinding matchup' : 'Neutral pace'

  const combinedOffRtg = (away.ortg + home.ortg) / 2
  const combinedDefRtg = (away.drtg + home.drtg) / 2
  const defenseMatchup = combinedDefRtg > LEAGUE_DRTG + 2 ? 'Poor defenses - expect points' :
    combinedDefRtg < LEAGUE_DRTG - 2 ? 'Strong defenses - lower total' : 'Average defensive matchup'

  return {
    projectedTotal: Math.round(finalProjection * 10) / 10,
    edge: Math.round(edge * 10) / 10,
    direction,
    confidence,
    formula: {
      step1_baseProjection: Math.round(step1_baseProjection * 10) / 10,
      step2_paceAdjustment: Math.round(step2_paceAdjustment * 10) / 10,
      step3_restAdjustment,
      step4_trendAdjustment: Math.round(step4_trendAdjustment * 10) / 10,
      step5_injuryAdjustment,
      finalProjection: Math.round(finalProjection * 10) / 10
    },
    breakdown: {
      awayExpectedPts: Math.round(awayExpectedPts * 10) / 10,
      homeExpectedPts: Math.round(homeExpectedPts * 10) / 10,
      combinedPace: Math.round(combinedPace * 10) / 10,
      combinedOffRtg: Math.round(combinedOffRtg * 10) / 10,
      combinedDefRtg: Math.round(combinedDefRtg * 10) / 10,
      paceImpact,
      defenseMatchup,
      restNotes
    },
    mathScore: {
      direction: direction === 'OVER' ? 'away' : 'home',
      points: Math.round(finalPoints * 100) / 100,
      teamName: direction,
      breakdown: {
        edgeStrength: Math.min(absEdge / 6, 1),
        confidenceMultiplier,
        formulaScore: rawPoints
      }
    }
  }
}

/**
 * Build prompt for Grok to search X for real-time adjustments
 */
function buildMathematicianPrompt(request: MathematicianRequest, formula: FormulaResult): string {
  const { awayTeam, homeTeam, total, stats } = request

  return `🧮 MATHEMATICAL PROJECTION VERIFICATION

GAME: ${awayTeam} @ ${homeTeam}
DATE: ${request.gameDate}
MARKET TOTAL: ${total}

═══════════════════════════════════════════════════════════
MY FORMULA PROJECTION: ${formula.projectedTotal} (${formula.direction} by ${Math.abs(formula.edge).toFixed(1)} pts)
═══════════════════════════════════════════════════════════

FORMULA BREAKDOWN:
┌─────────────────────────────────────────────────────────┐
│ Step 1 - Base Projection:     ${formula.formula.step1_baseProjection.toFixed(1).padStart(6)} pts           │
│ Step 2 - Pace Adjustment:     ${(formula.formula.step2_paceAdjustment >= 0 ? '+' : '')}${formula.formula.step2_paceAdjustment.toFixed(1).padStart(5)} pts           │
│ Step 3 - Rest Adjustment:     ${(formula.formula.step3_restAdjustment >= 0 ? '+' : '')}${formula.formula.step3_restAdjustment.toFixed(1).padStart(5)} pts           │
│ Step 4 - Trend Adjustment:    ${(formula.formula.step4_trendAdjustment >= 0 ? '+' : '')}${formula.formula.step4_trendAdjustment.toFixed(1).padStart(5)} pts           │
│ Step 5 - Injury Adjustment:   ${(formula.formula.step5_injuryAdjustment >= 0 ? '+' : '')}${formula.formula.step5_injuryAdjustment.toFixed(1).padStart(5)} pts (TBD)     │
├─────────────────────────────────────────────────────────┤
│ FINAL PROJECTION:             ${formula.projectedTotal.toFixed(1).padStart(6)} pts           │
│ vs MARKET LINE:               ${total.toFixed(1).padStart(6)} pts           │
│ EDGE:                         ${(formula.edge >= 0 ? '+' : '')}${formula.edge.toFixed(1).padStart(5)} pts (${formula.direction})   │
└─────────────────────────────────────────────────────────┘

STATS USED:
${awayTeam}: Pace=${stats.away.pace.toFixed(1)}, ORtg=${stats.away.ortg.toFixed(1)}, DRtg=${stats.away.drtg.toFixed(1)}, PPG=${stats.away.ppg.toFixed(1)}
${homeTeam}: Pace=${stats.home.pace.toFixed(1)}, ORtg=${stats.home.ortg.toFixed(1)}, DRtg=${stats.home.drtg.toFixed(1)}, PPG=${stats.home.ppg.toFixed(1)}

YOUR TASK:
1. Search X/Twitter for BREAKING NEWS about this game (injuries, lineup changes, rest decisions)
2. Provide an INJURY ADJUSTMENT value (-5 to +5 points) based on what you find
3. List any X-FACTORS that could affect the total
4. Give your FINAL VERDICT: agree with ${formula.direction} or flip to ${formula.direction === 'OVER' ? 'UNDER' : 'OVER'}?
5. Provide a BASELINE ADJUSTMENT (-5 to +5) based on your statistical analysis:
   - Positive = shift baseline toward OVER (higher scoring expected)
   - Negative = shift baseline toward UNDER (lower scoring expected)

RESPOND IN THIS FORMAT:
INJURY_ADJUSTMENT: [number between -5 and +5]
X_FACTORS:
- [factor 1]
- [factor 2]
- [factor 3]
FINAL_VERDICT: [OVER or UNDER]
CONFIDENCE: [HIGH, MEDIUM, or LOW]
BASELINE_ADJUSTMENT: [number between -5 and +5]
BASELINE_REASONING: [One sentence explaining why]
ANALYSIS: [2-3 sentence summary of your findings]`
}

/**
 * Parse Grok's response and merge with formula result
 */
function parseMathematicianResponse(
  content: string,
  formula: FormulaResult,
  request: MathematicianRequest
): {
  analysis: MathematicianResponse['analysis']
  mathScore: MathematicianResponse['mathScore']
  baselineAdjustment?: MathematicianResponse['baselineAdjustment']
} {

  // Extract injury adjustment
  const injuryMatch = content.match(/INJURY_ADJUSTMENT:\s*([+-]?\d+\.?\d*)/i)
  const injuryAdjustment = injuryMatch ? parseFloat(injuryMatch[1]) : 0

  // Extract X-factors
  const xFactorsSection = content.match(/X_FACTORS:([\s\S]*?)(?=FINAL_VERDICT|$)/i)
  const xFactors: string[] = []
  if (xFactorsSection) {
    const factors = xFactorsSection[1].match(/[-•]\s*(.+)/g)
    if (factors) {
      factors.forEach(f => xFactors.push(f.replace(/^[-•]\s*/, '').trim()))
    }
  }

  // Extract final verdict
  const verdictMatch = content.match(/FINAL_VERDICT:\s*(OVER|UNDER)/i)
  const grokVerdict = verdictMatch ? verdictMatch[1].toUpperCase() as 'OVER' | 'UNDER' : formula.direction

  // Extract confidence
  const confMatch = content.match(/CONFIDENCE:\s*(HIGH|MEDIUM|LOW)/i)
  const grokConfidence = confMatch ? confMatch[1].toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW' : formula.confidence

  // Extract baseline adjustment
  const baselineMatch = content.match(/BASELINE_ADJUSTMENT:\s*([+-]?\d+\.?\d*)/i)
  const rawBaselineAdjustment = baselineMatch ? parseFloat(baselineMatch[1]) : 0
  const clampedBaselineAdjustment = Math.max(-5, Math.min(5, rawBaselineAdjustment))

  // Extract baseline reasoning
  const baselineReasoningMatch = content.match(/BASELINE_REASONING:\s*(.+?)(?=\n|ANALYSIS:|$)/i)
  const baselineReasoning = baselineReasoningMatch ? baselineReasoningMatch[1].trim() : ''

  // Extract analysis
  const analysisMatch = content.match(/ANALYSIS:\s*([\s\S]+?)$/i)
  const rawAnalysis = analysisMatch ? analysisMatch[1].trim() : content.substring(0, 500)

  // Recalculate with injury adjustment
  const adjustedTotal = formula.projectedTotal + injuryAdjustment
  const adjustedEdge = adjustedTotal - request.total
  const finalDirection = grokVerdict

  // Recalculate points with adjustment
  const absEdge = Math.abs(adjustedEdge)
  let rawPoints = 0
  if (absEdge <= 1) rawPoints = 0.5 + (absEdge * 0.5)
  else if (absEdge <= 2) rawPoints = 1.0 + ((absEdge - 1) * 1.0)
  else if (absEdge <= 4) rawPoints = 2.0 + ((absEdge - 2) * 0.5)
  else if (absEdge <= 6) rawPoints = 3.0 + ((absEdge - 4) * 0.5)
  else rawPoints = 4.0 + Math.min((absEdge - 6) * 0.25, 1.0)

  const confidenceMultiplier = grokConfidence === 'HIGH' ? 1.0 : grokConfidence === 'MEDIUM' ? 0.85 : 0.7
  const finalPoints = Math.min(rawPoints * confidenceMultiplier, 5.0)

  // Determine baseline direction based on adjustment sign
  const baselineDirection = clampedBaselineAdjustment >= 0 ? 'OVER' : 'UNDER'

  return {
    analysis: {
      projectedTotal: Math.round(adjustedTotal * 10) / 10,
      marketLine: request.total,
      edge: Math.round(adjustedEdge * 10) / 10,
      direction: finalDirection,
      confidence: grokConfidence,
      formula: {
        ...formula.formula,
        step5_injuryAdjustment: injuryAdjustment,
        finalProjection: Math.round(adjustedTotal * 10) / 10
      },
      breakdown: formula.breakdown,
      xFactors: xFactors.length > 0 ? xFactors : ['No breaking news found'],
      rawAnalysis
    },
    mathScore: {
      direction: finalDirection === 'OVER' ? 'away' : 'home',
      points: Math.round(finalPoints * 100) / 100,
      teamName: finalDirection,
      breakdown: {
        edgeStrength: Math.min(absEdge / 6, 1),
        confidenceMultiplier,
        formulaScore: rawPoints
      }
    },
    baselineAdjustment: {
      value: clampedBaselineAdjustment,
      direction: baselineDirection as 'OVER' | 'UNDER',
      reasoning: baselineReasoning || `Statistical analysis ${clampedBaselineAdjustment >= 0 ? 'favors' : 'against'} ${baselineDirection}`
    }
  }
}
