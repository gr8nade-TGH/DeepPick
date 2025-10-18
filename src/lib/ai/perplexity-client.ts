/**
 * Perplexity AI Client
 * 
 * Handles deep web research for sports matchups using Perplexity's API
 * Perplexity is perfect for this because:
 * - Built-in web search capability
 * - Great at finding recent sports news, injuries, trends
 * - Returns sources for transparency
 */

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface PerplexityRequest {
  model: string
  messages: PerplexityMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  search_domain_filter?: string[]
  return_images?: boolean
  return_related_questions?: boolean
  search_recency_filter?: 'day' | 'week' | 'month'
  stream?: boolean
}

interface PerplexityCitation {
  url: string
  title?: string
  snippet?: string
}

interface PerplexityResponse {
  id: string
  model: string
  created: number
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  object: string
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
    delta?: {
      role?: string
      content?: string
    }
  }>
  citations?: string[]
}

export interface MatchupResearch {
  summary: string
  keyInsights: string[]
  injuries: Array<{ team: string; player: string; status: string }>
  recentForm: { homeTeam: string; awayTeam: string }
  headToHead: string
  weatherImpact?: string
  bettingTrends?: string
  expertOpinions: string[]
  sources: Array<{ url: string; title: string; snippet: string }>
  raw_response: string
}

export class PerplexityClient {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PERPLEXITY_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set')
    }
  }

  /**
   * Research a sports matchup using Perplexity's web search
   */
  async researchMatchup(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string,
    options?: {
      useProSearch?: boolean // Pro search is more thorough but more expensive
      recencyFilter?: 'day' | 'week' | 'month'
    }
  ): Promise<MatchupResearch> {
    const model = options?.useProSearch ? 'sonar-pro' : 'sonar'
    
    const prompt = this.buildMatchupResearchPrompt(homeTeam, awayTeam, sport, gameDate)

    const response = await this.chat({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert sports analyst and betting researcher. Provide comprehensive, factual analysis based on recent data. Focus on actionable insights for betting decisions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.2, // Low temperature for factual, consistent responses
      search_recency_filter: options?.recencyFilter || 'week'
    })

    return this.parseResearchResponse(response)
  }

  /**
   * Get AI-powered betting recommendation
   */
  async getBettingRecommendation(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string,
    currentOdds: {
      moneyline: { home: number; away: number }
      spread: { line: number; home: number; away: number }
      total: { line: number; over: number; under: number }
    },
    research: MatchupResearch,
    capperPersonality: {
      name: string
      style: string
      riskTolerance: string
      specialties: string[]
    }
  ): Promise<{
    recommendation: 'moneyline' | 'spread' | 'total' | 'pass'
    selection: string
    confidence: number // 1-10
    units: number
    reasoning: string
    factors: Record<string, { value: number; weight: number; impact: string }>
  }> {
    const prompt = this.buildBettingRecommendationPrompt(
      homeTeam,
      awayTeam,
      sport,
      gameDate,
      currentOdds,
      research,
      capperPersonality
    )

    const response = await this.chat({
      model: 'sonar-pro', // Use pro for betting decisions
      messages: [
        {
          role: 'system',
          content: `You are ${capperPersonality.name}, a ${capperPersonality.style} sports bettor. ${capperPersonality.riskTolerance}. You must respond ONLY with valid JSON. Your specialties: ${capperPersonality.specialties.join(', ')}.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
      search_recency_filter: 'day'
    })

    return this.parseBettingRecommendation(response)
  }

  private buildMatchupResearchPrompt(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string
  ): string {
    return `Research the upcoming ${sport} matchup: ${awayTeam} @ ${homeTeam} on ${gameDate}.

Provide a comprehensive analysis including:
1. **Recent Form**: Last 5 games for both teams (W-L record, scoring trends)
2. **Injuries**: Current injury report for key players
3. **Head-to-Head**: Recent matchup history
4. **Key Trends**: Relevant statistical trends (home/away splits, ATS records, etc.)
5. **Weather**: If outdoor sport, weather conditions and impact
6. **Betting Trends**: Public betting percentages, line movement, sharp money indicators
7. **Expert Opinions**: What professional analysts are saying
8. **X-Factors**: Any unique factors (revenge game, rest advantage, etc.)

Focus on RECENT data (last 1-2 weeks) and ACTIONABLE insights for betting.`
  }

  private buildBettingRecommendationPrompt(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string,
    currentOdds: any,
    research: MatchupResearch,
    capperPersonality: any
  ): string {
    return `Based on your research and the current odds, make a betting recommendation for: ${awayTeam} @ ${homeTeam}

**Current Odds:**
- Moneyline: ${homeTeam} ${currentOdds.moneyline.home}, ${awayTeam} ${currentOdds.moneyline.away}
- Spread: ${homeTeam} ${currentOdds.spread.line > 0 ? '+' : ''}${currentOdds.spread.line} (${currentOdds.spread.home}), ${awayTeam} ${currentOdds.spread.line < 0 ? '+' : ''}${-currentOdds.spread.line} (${currentOdds.spread.away})
- Total: ${currentOdds.total.line} (O: ${currentOdds.total.over}, U: ${currentOdds.total.under})

**Research Summary:**
${research.summary}

**Key Insights:**
${research.keyInsights.map(i => `- ${i}`).join('\n')}

**Your Task:**
1. Analyze all factors and assign weights (0-100)
2. Predict the game score
3. Compare your prediction to Vegas odds
4. Determine which bet (if any) offers value
5. Calculate confidence level (1-10, must be 7+ to make a pick)
6. Recommend units (1-5 based on confidence)

Respond with ONLY valid JSON in this exact format:
{
  "recommendation": "moneyline" | "spread" | "total" | "pass",
  "selection": "exact bet selection (e.g., 'Lakers -5.5', 'OVER 220.5', 'CHI')",
  "confidence": 8.5,
  "units": 2,
  "scorePrediction": {
    "home": 105,
    "away": 98
  },
  "reasoning": "Detailed explanation of your decision...",
  "factors": {
    "recent_form": { "value": 75, "weight": 20, "impact": "Home team on 5-game win streak" },
    "injuries": { "value": 60, "weight": 15, "impact": "Away team missing starting PG" },
    "head_to_head": { "value": 70, "weight": 10, "impact": "Home team won last 3 matchups" },
    "vegas_comparison": { "value": 85, "weight": 30, "impact": "Our prediction shows 8-point edge vs 5.5 spread" },
    "betting_trends": { "value": 55, "weight": 10, "impact": "Sharp money on home team" },
    "situational": { "value": 65, "weight": 15, "impact": "Revenge game for home team" }
  }
}

CRITICAL RULES:
- Confidence must be 7.0+ to recommend a bet (otherwise return "pass")
- Units: 1 (7.0-7.9), 2 (8.0-8.9), 3 (9.0-9.4), 4 (9.5-9.7), 5 (9.8+)
- Vegas comparison should be heavily weighted (25-30%)
- All factors must sum to 100% weight
- Respond ONLY with JSON, no other text`
  }

  private async chat(request: PerplexityRequest): Promise<PerplexityResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Perplexity API error: ${response.status} - ${error}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ Perplexity API error:', error)
      throw error
    }
  }

  private parseResearchResponse(response: PerplexityResponse): MatchupResearch {
    const content = response.choices[0]?.message?.content || ''
    
    // Parse the AI's response into structured data
    // This is a simplified parser - you might want to make it more robust
    return {
      summary: this.extractSection(content, 'summary') || content.slice(0, 500),
      keyInsights: this.extractBulletPoints(content, 'key trends') || 
                   this.extractBulletPoints(content, 'insights') || [],
      injuries: this.parseInjuries(content),
      recentForm: {
        homeTeam: this.extractSection(content, 'home team') || 'Unknown',
        awayTeam: this.extractSection(content, 'away team') || 'Unknown'
      },
      headToHead: this.extractSection(content, 'head-to-head') || 'No data',
      weatherImpact: this.extractSection(content, 'weather'),
      bettingTrends: this.extractSection(content, 'betting trends'),
      expertOpinions: this.extractBulletPoints(content, 'expert') || [],
      sources: (response.citations || []).map(url => ({
        url,
        title: this.extractDomain(url),
        snippet: ''
      })),
      raw_response: content
    }
  }

  private parseBettingRecommendation(response: PerplexityResponse): any {
    const content = response.choices[0]?.message?.content || '{}'
    
    try {
      // Extract JSON from response (in case AI added extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : content
      
      return JSON.parse(jsonStr)
    } catch (error) {
      console.error('❌ Failed to parse betting recommendation:', error)
      console.log('Raw response:', content)
      
      // Return safe default
      return {
        recommendation: 'pass',
        selection: 'PASS',
        confidence: 0,
        units: 0,
        reasoning: 'Failed to parse AI recommendation',
        factors: {}
      }
    }
  }

  private extractSection(text: string, sectionName: string): string | undefined {
    const regex = new RegExp(`\\*\\*${sectionName}[^\\*]*\\*\\*:?\\s*([^\\*]*?)(?=\\n\\*\\*|$)`, 'is')
    const match = text.match(regex)
    return match ? match[1].trim() : undefined
  }

  private extractBulletPoints(text: string, sectionName?: string): string[] {
    let searchText = text
    if (sectionName) {
      const section = this.extractSection(text, sectionName)
      if (section) searchText = section
    }
    
    const bullets = searchText.match(/^[\s]*[-•*]\s*(.+)$/gm)
    return bullets ? bullets.map(b => b.replace(/^[\s]*[-•*]\s*/, '').trim()) : []
  }

  private parseInjuries(text: string): Array<{ team: string; player: string; status: string }> {
    // Simple injury parser - could be improved
    const injuries: Array<{ team: string; player: string; status: string }> = []
    const injurySection = this.extractSection(text, 'injuries')
    if (!injurySection) return injuries

    // Look for patterns like "Player Name (Team) - Status"
    const pattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(([^)]+)\)\s*[-:]\s*([^,.\n]+)/g
    let match
    while ((match = pattern.exec(injurySection)) !== null) {
      injuries.push({
        player: match[1].trim(),
        team: match[2].trim(),
        status: match[3].trim()
      })
    }

    return injuries
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      return domain
    } catch {
      return url
    }
  }
}

// Export singleton instance
let perplexityClient: PerplexityClient | null = null

export function getPerplexityClient(): PerplexityClient {
  if (!perplexityClient) {
    perplexityClient = new PerplexityClient()
  }
  return perplexityClient
}

