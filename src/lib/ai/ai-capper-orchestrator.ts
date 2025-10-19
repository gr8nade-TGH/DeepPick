/**
 * AI Capper Orchestrator
 * 
 * Coordinates 2-run AI enhancement system:
 * - Run 1: Perplexity + 2 StatMuse questions
 * - Run 2: ChatGPT + 2 StatMuse questions
 */

import { getPerplexityClient } from './perplexity-client'
import { getStatMuseClient, type StatMuseAnswer } from '@/lib/data/statmuse-client'
import OpenAI from 'openai'
import type { CapperGame } from '@/lib/cappers/shared-logic'

export interface AIResearchRun {
  runNumber: 1 | 2
  aiProvider: 'perplexity' | 'chatgpt'
  statmuseQuestions: string[]
  statmuseAnswers: StatMuseAnswer[]
  aiAnalysis: {
    factors: Record<string, any>
    insights: string[]
  }
  cost: number
  timestamp: string
}

export interface AIResearchResult {
  run1: AIResearchRun
  run2: AIResearchRun
  totalCost: number
  scorePrediction?: {
    home: number
    away: number
    total: number
    margin: number
  }
  writeup?: string
  boldPrediction?: string
}

export class AICapperOrchestrator {
  private perplexity: any
  private openai: OpenAI
  private statmuse: any

  constructor() {
    this.perplexity = getPerplexityClient()
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    })
    this.statmuse = getStatMuseClient()
  }

  /**
   * Run complete 2-phase AI research
   */
  async researchGame(
    game: CapperGame,
    capperPersonality: {
      name: string
      style: string
      run1_focus: string[]
      run2_focus: string[]
    }
  ): Promise<AIResearchResult> {
    console.log(`🔮 Starting AI research for: ${game.away_team.name} @ ${game.home_team.name}`)
    
    // Run 1: Perplexity + 2 StatMuse
    const run1 = await this.executeRun1(game, capperPersonality)
    
    // Run 2: ChatGPT + 2 StatMuse (with Run 1 context)
    const run2 = await this.executeRun2(game, capperPersonality, run1)
    
    return {
      run1,
      run2,
      totalCost: run1.cost + run2.cost,
      scorePrediction: run2.aiAnalysis.scorePrediction,
      writeup: run2.aiAnalysis.writeup,
      boldPrediction: run2.aiAnalysis.boldPrediction
    }
  }

  /**
   * Run 1: Perplexity + 2 StatMuse Questions
   */
  private async executeRun1(
    game: CapperGame,
    personality: any
  ): Promise<AIResearchRun> {
    const startTime = Date.now()
    
    console.log('🟣 Run 1: Perplexity + StatMuse')
    
    // Step 1: Perplexity generates 2 clever StatMuse questions
    const questionPrompt = this.buildStatMuseQuestionPrompt(game, personality.run1_focus)
    
    const perplexityResponse = await this.perplexity.chat({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are ${personality.name}. Generate 2 clever StatMuse questions that will reveal key insights for this matchup. Focus on: ${personality.run1_focus.join(', ')}`
        },
        {
          role: 'user',
          content: questionPrompt
        }
      ],
      temperature: 0.3
    })
    
    const questions = this.extractStatMuseQuestions(
      perplexityResponse.choices[0].message.content
    )
    
    console.log(`📊 Perplexity generated questions:`, questions)
    
    // Step 2: Query StatMuse (FREE)
    const statmuseAnswers = await this.statmuse.askBatch(
      questions.map(q => ({
        sport: this.mapSportToStatMuse(game.sport),
        question: q
      }))
    )
    
    console.log(`✅ StatMuse answers received`)
    
    // Step 3: Perplexity analyzes StatMuse results + does own research
    const analysisPrompt = this.buildRun1AnalysisPrompt(
      game,
      statmuseAnswers,
      personality
    )
    
    const analysisResponse = await this.perplexity.chat({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are ${personality.name}. Analyze the StatMuse data and provide factors in JSON format.`
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.2
    })
    
    const analysis = this.parseAIResponse(analysisResponse.choices[0].message.content)
    
    const duration = (Date.now() - startTime) / 1000
    console.log(`✅ Run 1 complete in ${duration}s`)
    
    return {
      runNumber: 1,
      aiProvider: 'perplexity',
      statmuseQuestions: questions,
      statmuseAnswers,
      aiAnalysis: analysis,
      cost: 0.025, // Perplexity cost
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Run 2: ChatGPT + 2 StatMuse Questions + Validation
   */
  private async executeRun2(
    game: CapperGame,
    personality: any,
    run1: AIResearchRun
  ): Promise<AIResearchRun> {
    const startTime = Date.now()
    
    console.log('🔵 Run 2: ChatGPT + StatMuse + Validation')
    
    // Step 1: ChatGPT generates 2 DIFFERENT clever questions
    const questionPrompt = this.buildStatMuseQuestionPrompt(
      game,
      personality.run2_focus,
      run1.statmuseQuestions // Avoid duplicates
    )
    
    const chatgptQuestions = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cheap
      messages: [
        {
          role: 'system',
          content: `You are ${personality.name}. Generate 2 clever StatMuse questions that are DIFFERENT from Run 1. Focus on: ${personality.run2_focus.join(', ')}`
        },
        {
          role: 'user',
          content: questionPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
    
    const questions = this.extractStatMuseQuestions(
      chatgptQuestions.choices[0].message.content || '{}'
    )
    
    console.log(`📊 ChatGPT generated questions:`, questions)
    
    // Step 2: Query StatMuse (FREE)
    const statmuseAnswers = await this.statmuse.askBatch(
      questions.map(q => ({
        sport: this.mapSportToStatMuse(game.sport),
        question: q
      }))
    )
    
    console.log(`✅ StatMuse answers received`)
    
    // Step 3: ChatGPT analyzes everything + predicts
    const analysisPrompt = this.buildRun2AnalysisPrompt(
      game,
      run1,
      statmuseAnswers,
      personality
    )
    
    const analysisResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o', // More powerful for final analysis
      messages: [
        {
          role: 'system',
          content: `You are ${personality.name}. Analyze all data, validate Run 1, search for injuries, predict score, and provide comprehensive writeup.`
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
    
    const analysis = JSON.parse(analysisResponse.choices[0].message.content || '{}')
    
    const duration = (Date.now() - startTime) / 1000
    console.log(`✅ Run 2 complete in ${duration}s`)
    
    return {
      runNumber: 2,
      aiProvider: 'chatgpt',
      statmuseQuestions: questions,
      statmuseAnswers,
      aiAnalysis: analysis,
      cost: 0.01, // Approximate ChatGPT cost
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Build prompt for generating StatMuse questions
   */
  private buildStatMuseQuestionPrompt(
    game: CapperGame,
    focusAreas: string[],
    avoidQuestions?: string[]
  ): string {
    return `Generate exactly 2 clever StatMuse questions for this matchup:

Game: ${game.away_team.name} @ ${game.home_team.name}
Sport: ${game.sport.toUpperCase()}
Date: ${game.game_date}

Focus areas: ${focusAreas.join(', ')}

${avoidQuestions ? `AVOID these questions (already asked):
${avoidQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : ''}

StatMuse accepts natural language. Examples:
- "Lakers last 5 games record"
- "Celtics points allowed per game this season"
- "Lakers vs Celtics last 3 meetings who won"

Return JSON:
{
  "questions": [
    "Your clever question 1",
    "Your clever question 2"
  ],
  "reasoning": "Why these questions reveal key insights"
}`
  }

  /**
   * Build Run 1 analysis prompt
   */
  private buildRun1AnalysisPrompt(
    game: CapperGame,
    statmuseAnswers: StatMuseAnswer[],
    personality: any
  ): string {
    return `Analyze this matchup using StatMuse data and your own research:

Game: ${game.away_team.name} @ ${game.home_team.name}
Current Odds:
- Spread: ${game.odds?.spread?.home || 'N/A'}
- Total: ${game.odds?.total?.line || 'N/A'}

StatMuse Results:
${statmuseAnswers.map((a, i) => `
Q${i + 1}: ${a.question}
A${i + 1}: ${a.answer}
Confidence: ${a.confidence}
`).join('\n')}

Your task (${personality.name}):
1. Analyze StatMuse results
2. Create 2-3 factors with weights
3. Provide insights

Return JSON:
{
  "factors": {
    "factor_name": {
      "description": "...",
      "value": 0-100,
      "weight": 1-20,
      "edge": "home/away/neutral",
      "source": "StatMuse + your analysis"
    }
  },
  "insights": ["insight 1", "insight 2"]
}`
  }

  /**
   * Build Run 2 analysis prompt
   */
  private buildRun2AnalysisPrompt(
    game: CapperGame,
    run1: AIResearchRun,
    statmuseAnswers: StatMuseAnswer[],
    personality: any
  ): string {
    return `Final analysis - combine all data and predict:

Game: ${game.away_team.name} @ ${game.home_team.name}
Current Odds:
- Spread: ${game.odds?.spread?.home || 'N/A'}
- Total: ${game.odds?.total?.line || 'N/A'}
- Moneyline: Home ${game.odds?.moneyline?.home || 'N/A'}, Away ${game.odds?.moneyline?.away || 'N/A'}

RUN 1 RESULTS (Perplexity):
${JSON.stringify(run1.aiAnalysis, null, 2)}

YOUR STATMUSE RESULTS:
${statmuseAnswers.map((a, i) => `
Q${i + 1}: ${a.question}
A${i + 1}: ${a.answer}
`).join('\n')}

Your tasks:
1. Validate Run 1 critical data (flag if inaccurate)
2. Search web for latest injuries and news (important!)
3. Analyze your StatMuse results
4. Create 2-3 additional factors
5. Predict final score
6. Write comprehensive analysis
7. Make one bold prediction

Return JSON:
{
  "validation": {
    "run1_accurate": true/false,
    "concerns": ["list any inaccuracies"]
  },
  "factors": {
    "injuries": {
      "description": "Latest injury report",
      "home_injuries": [...],
      "away_injuries": [...],
      "value": 0-100,
      "weight": 1-20,
      "source": "Web search"
    },
    "your_factor_2": { ... },
    "your_factor_3": { ... }
  },
  "scorePrediction": {
    "home": 115,
    "away": 108,
    "total": 223,
    "margin": 7
  },
  "writeup": "Comprehensive 3-4 paragraph analysis...",
  "boldPrediction": "Specific bold call"
}`
  }

  /**
   * Extract StatMuse questions from AI response
   */
  private extractStatMuseQuestions(response: string): string[] {
    try {
      const json = JSON.parse(response)
      return json.questions || []
    } catch {
      // Fallback: extract from text
      const lines = response.split('\n')
      const questions: string[] = []
      
      for (const line of lines) {
        // Look for quoted text or numbered items
        const match = line.match(/"([^"]+)"/) || line.match(/\d+\.\s*(.+)/)
        if (match && match[1] && match[1].length > 10) {
          questions.push(match[1].trim())
        }
      }
      
      return questions.slice(0, 2) // Max 2
    }
  }

  /**
   * Parse AI response (handle both JSON and text)
   */
  private parseAIResponse(response: string): any {
    try {
      return JSON.parse(response)
    } catch {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch {
          return { error: 'Could not parse JSON', raw: response }
        }
      }
      return { error: 'Could not parse JSON', raw: response }
    }
  }

  /**
   * Map game sport to StatMuse sport key
   */
  private mapSportToStatMuse(sport: string): 'nfl' | 'nba' | 'mlb' | 'nhl' {
    const map: Record<string, 'nfl' | 'nba' | 'mlb' | 'nhl'> = {
      'nfl': 'nfl',
      'nba': 'nba',
      'mlb': 'mlb',
      'nhl': 'nhl'
    }
    return map[sport.toLowerCase()] || 'nba'
  }
}

// Export singleton
let orchestrator: AICapperOrchestrator | null = null

export function getAICapperOrchestrator(): AICapperOrchestrator {
  if (!orchestrator) {
    orchestrator = new AICapperOrchestrator()
  }
  return orchestrator
}

