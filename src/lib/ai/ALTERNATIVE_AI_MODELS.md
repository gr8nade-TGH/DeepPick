# Alternative AI Models for Oracle

This guide shows how to adapt Oracle to use different AI providers instead of (or in addition to) Perplexity.

## Current: Perplexity (Implemented)

**Pros:**
- Built-in web search
- Sports-optimized results
- Single API for research + analysis
- Good pricing

**Cons:**
- Smaller model than GPT-4/Claude
- Less control over search queries
- Newer company (stability concerns)

## Option 1: OpenAI GPT-4 + Tavily Search

### Setup

```bash
npm install openai tavily
```

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

### Implementation

```typescript
// src/lib/ai/openai-client.ts
import OpenAI from 'openai'
import { TavilySearchClient } from 'tavily'

export class OpenAIClient {
  private openai: OpenAI
  private tavily: TavilySearchClient

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.tavily = new TavilySearchClient({ apiKey: process.env.TAVILY_API_KEY })
  }

  async researchMatchup(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string
  ): Promise<MatchupResearch> {
    // Step 1: Use Tavily for web search
    const query = `${sport} ${awayTeam} vs ${homeTeam} ${gameDate} injuries trends predictions`
    
    const searchResults = await this.tavily.search(query, {
      search_depth: 'advanced',
      max_results: 10,
      include_domains: ['espn.com', 'nba.com', 'actionnetwork.com', 'covers.com']
    })

    // Step 2: Use GPT-4 to analyze search results
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sports analyst. Analyze the provided web search results and extract key insights for betting.'
        },
        {
          role: 'user',
          content: `Analyze this matchup: ${awayTeam} @ ${homeTeam}

Search Results:
${searchResults.results.map(r => `
Title: ${r.title}
Source: ${r.url}
Content: ${r.content}
`).join('\n---\n')}

Provide a comprehensive analysis including:
1. Recent form for both teams
2. Key injuries
3. Head-to-head history
4. Betting trends
5. Expert opinions
6. Weather (if applicable)

Format as JSON.`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}')
    
    return {
      summary: analysis.summary,
      keyInsights: analysis.key_insights || [],
      injuries: analysis.injuries || [],
      recentForm: analysis.recent_form || { homeTeam: '', awayTeam: '' },
      headToHead: analysis.head_to_head || '',
      weatherImpact: analysis.weather,
      bettingTrends: analysis.betting_trends,
      expertOpinions: analysis.expert_opinions || [],
      sources: searchResults.results.map(r => ({
        url: r.url,
        title: r.title,
        snippet: r.content.slice(0, 200)
      })),
      raw_response: completion.choices[0].message.content || ''
    }
  }

  async getBettingRecommendation(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string,
    currentOdds: any,
    research: MatchupResearch,
    capperPersonality: any
  ) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are ${capperPersonality.name}, a ${capperPersonality.style} sports bettor. Respond ONLY with valid JSON.`
        },
        {
          role: 'user',
          content: `Make a betting recommendation for: ${awayTeam} @ ${homeTeam}

Current Odds: ${JSON.stringify(currentOdds)}
Research: ${JSON.stringify(research)}

[... same prompt as Perplexity ...]

Respond ONLY with JSON in this format:
{
  "recommendation": "moneyline" | "spread" | "total" | "pass",
  "selection": "...",
  "confidence": 8.5,
  ...
}`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    return JSON.parse(completion.choices[0].message.content || '{}')
  }
}
```

**Pros:**
- GPT-4 is more powerful
- Tavily specializes in sports/news
- More control over search
- JSON mode for consistent output

**Cons:**
- More expensive (~$0.10-0.15 per pick)
- Two APIs to manage
- More complex setup

**Cost:** ~$0.10-0.15 per pick

---

## Option 2: Anthropic Claude + Brave Search

### Setup

```bash
npm install @anthropic-ai/sdk axios
```

```env
ANTHROPIC_API_KEY=sk-ant-...
BRAVE_SEARCH_API_KEY=BSA...
```

### Implementation

```typescript
// src/lib/ai/claude-client.ts
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'

export class ClaudeClient {
  private anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async searchBrave(query: string) {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: { q: query, count: 10 },
      headers: {
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
      }
    })
    return response.data.web.results
  }

  async researchMatchup(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string
  ): Promise<MatchupResearch> {
    // Step 1: Brave Search
    const query = `${sport} ${awayTeam} vs ${homeTeam} ${gameDate} injuries betting analysis`
    const searchResults = await this.searchBrave(query)

    // Step 2: Claude analysis
    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: `Analyze this ${sport} matchup: ${awayTeam} @ ${homeTeam} on ${gameDate}

Search Results:
${searchResults.map((r: any) => `
Title: ${r.title}
Source: ${r.url}
Description: ${r.description}
`).join('\n---\n')}

Provide comprehensive betting analysis. Respond with JSON only.`
        }
      ]
    })

    // Extract JSON from Claude's response
    const content = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const analysis = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      summary: analysis.summary,
      keyInsights: analysis.key_insights || [],
      injuries: analysis.injuries || [],
      recentForm: analysis.recent_form || { homeTeam: '', awayTeam: '' },
      headToHead: analysis.head_to_head || '',
      weatherImpact: analysis.weather,
      bettingTrends: analysis.betting_trends,
      expertOpinions: analysis.expert_opinions || [],
      sources: searchResults.map((r: any) => ({
        url: r.url,
        title: r.title,
        snippet: r.description
      })),
      raw_response: content
    }
  }

  async getBettingRecommendation(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string,
    currentOdds: any,
    research: MatchupResearch,
    capperPersonality: any
  ) {
    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `[... same prompt as Perplexity ...]

Respond ONLY with valid JSON.`
        }
      ]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] || '{}')
  }
}
```

**Pros:**
- Claude 3.5 Sonnet is excellent at analysis
- Good at following instructions
- Brave Search is privacy-focused and fast

**Cons:**
- Most expensive option (~$0.15-0.20 per pick)
- No built-in search (need separate API)
- JSON extraction can be tricky (Claude doesn't have JSON mode yet)

**Cost:** ~$0.15-0.20 per pick

---

## Option 3: Google Gemini + Google Search

### Setup

```bash
npm install @google/generative-ai
```

```env
GOOGLE_AI_API_KEY=...
```

### Implementation

```typescript
// src/lib/ai/gemini-client.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

export class GeminiClient {
  private genAI: GoogleGenerativeAI

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  }

  async researchMatchup(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string
  ): Promise<MatchupResearch> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      tools: [{ googleSearchRetrieval: {} }] // Built-in search!
    })

    const prompt = `Research the ${sport} matchup: ${awayTeam} @ ${homeTeam} on ${gameDate}.
    
Use Google Search to find:
1. Recent team form
2. Injury reports
3. Head-to-head history
4. Betting trends
5. Expert predictions

Provide comprehensive analysis as JSON.`

    const result = await model.generateContent(prompt)
    const response = result.response.text()
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    const analysis = JSON.parse(jsonMatch?.[0] || '{}')

    return {
      summary: analysis.summary,
      keyInsights: analysis.key_insights || [],
      injuries: analysis.injuries || [],
      recentForm: analysis.recent_form || { homeTeam: '', awayTeam: '' },
      headToHead: analysis.head_to_head || '',
      weatherImpact: analysis.weather,
      bettingTrends: analysis.betting_trends,
      expertOpinions: analysis.expert_opinions || [],
      sources: [], // Gemini doesn't return sources yet
      raw_response: response
    }
  }

  async getBettingRecommendation(
    homeTeam: string,
    awayTeam: string,
    sport: string,
    gameDate: string,
    currentOdds: any,
    research: MatchupResearch,
    capperPersonality: any
  ) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    const prompt = `[... same prompt as Perplexity ...]
    
Respond ONLY with valid JSON.`

    const result = await model.generateContent(prompt)
    const response = result.response.text()
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch?.[0] || '{}')
  }
}
```

**Pros:**
- Built-in Google Search
- Fast and reliable
- Competitive pricing
- Single API

**Cons:**
- Doesn't return search sources
- Less established for sports analysis
- No JSON mode (yet)

**Cost:** ~$0.05-0.08 per pick

---

## Multi-Model Ensemble (Phase 3)

Run multiple AI models and combine their predictions:

```typescript
// src/lib/ai/ensemble-client.ts
import { PerplexityClient } from './perplexity-client'
import { OpenAIClient } from './openai-client'
import { ClaudeClient } from './claude-client'

export class EnsembleClient {
  async getBettingRecommendation(...args: any[]) {
    // Run all three models in parallel
    const [perplexityRec, openaiRec, claudeRec] = await Promise.all([
      new PerplexityClient().getBettingRecommendation(...args),
      new OpenAIClient().getBettingRecommendation(...args),
      new ClaudeClient().getBettingRecommendation(...args)
    ])

    // Combine recommendations
    return this.combineRecommendations([perplexityRec, openaiRec, claudeRec])
  }

  private combineRecommendations(recs: any[]) {
    // If all 3 agree, use highest confidence
    const allAgree = recs.every(r => r.recommendation === recs[0].recommendation)
    if (allAgree) {
      return recs.reduce((best, curr) => 
        curr.confidence > best.confidence ? curr : best
      )
    }

    // If 2 agree, use their average
    const recommendations = recs.map(r => r.recommendation)
    const mostCommon = recommendations.sort((a, b) =>
      recommendations.filter(v => v === a).length - 
      recommendations.filter(v => v === b).length
    ).pop()

    const agreeing = recs.filter(r => r.recommendation === mostCommon)
    const avgConfidence = agreeing.reduce((sum, r) => sum + r.confidence, 0) / agreeing.length

    return {
      ...agreeing[0],
      confidence: avgConfidence,
      reasoning: `Ensemble: ${agreeing.length}/3 models agree. ${agreeing[0].reasoning}`
    }
  }
}
```

---

## Cost Comparison

| Provider | Research | Recommendation | Total | Quality |
|----------|----------|----------------|-------|---------|
| **Perplexity** | $0.01-0.03 | $0.01-0.02 | **$0.02-0.05** | ⭐⭐⭐⭐ |
| **OpenAI + Tavily** | $0.05-0.08 | $0.05-0.07 | **$0.10-0.15** | ⭐⭐⭐⭐⭐ |
| **Claude + Brave** | $0.08-0.10 | $0.07-0.10 | **$0.15-0.20** | ⭐⭐⭐⭐⭐ |
| **Gemini** | $0.02-0.04 | $0.03-0.04 | **$0.05-0.08** | ⭐⭐⭐⭐ |
| **Ensemble (all 3)** | $0.15-0.22 | $0.15-0.18 | **$0.30-0.40** | ⭐⭐⭐⭐⭐ |

## Recommendation

1. **Start with Perplexity** ✅ (Already implemented)
   - Best balance of cost, quality, and simplicity
   - Built-in search is perfect for sports

2. **Upgrade to OpenAI + Tavily** (if Perplexity isn't accurate enough)
   - More powerful model
   - Better search results
   - Worth the 2-3x cost increase

3. **Try Ensemble** (after collecting performance data)
   - Compare Perplexity vs OpenAI vs Claude
   - Use ensemble for high-stakes picks only
   - 3x cost, but potentially higher accuracy

## Implementation Priority

### Phase 1: ✅ Perplexity (Done)
Single model, easy setup, good results

### Phase 2: Add OpenAI option
```typescript
// oracle-algorithm.ts
const aiProvider = process.env.ORACLE_AI_PROVIDER || 'perplexity'
const client = aiProvider === 'openai' 
  ? new OpenAIClient() 
  : new PerplexityClient()
```

### Phase 3: Multi-model ensemble
Run multiple models and combine predictions

### Phase 4: Model router
Route different sports to different models based on performance:
- NBA → Perplexity (best for basketball)
- NFL → OpenAI (best for football)
- MLB → Claude (best for baseball)

---

**Current Status:** Perplexity implementation complete and ready to use! 🎉

