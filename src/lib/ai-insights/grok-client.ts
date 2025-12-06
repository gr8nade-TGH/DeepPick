/**
 * Grok API Client for Sentiment Analysis
 *
 * Uses xAI's Grok models which are trained on real-time X/Twitter data
 * for sentiment analysis on sports betting.
 *
 * Two insight sources:
 * 1. THE PULSE - General public sentiment (all X users)
 * 2. THE INFLUENCER - Betting influencer sentiment (10K+ follower accounts)
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

function parseGrokResponse(
  content: string,
  betType: 'SPREAD' | 'TOTAL',
  request: GrokSentimentRequest
): {
  sentiment: GrokSentimentResponse['sentiment']
  pulseScore: GrokSentimentResponse['pulseScore']
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
      }
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
  "rawAnalysis": "2-3 sentence summary of influencer consensus"
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
  "rawAnalysis": "2-3 sentence summary of influencer consensus"
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
      }
    }
  }
}
