import { CapperGame } from '@/lib/cappers/shared-logic'
import { PerplexityClient } from './perplexity-client'
import { StatMuseClient } from '@/lib/data/statmuse-client'
import OpenAI from 'openai'
import { env } from '@/lib/env'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { CapperSettings, AIRunResult, AIRunFactors, AIInsight } from '@/types'

interface OrchestratorOptions {
  capperName: string
  game: CapperGame
  capperSettings: CapperSettings
  existingAIRuns?: AIRunResult[]
}

export class AICapperOrchestrator {
  private capperName: string
  private game: CapperGame
  private capperSettings: CapperSettings
  private existingAIRuns: AIRunResult[]
  private perplexityClient: PerplexityClient
  private openaiClient: OpenAI
  private statMuseClient: StatMuseClient

  constructor(options: OrchestratorOptions) {
    this.capperName = options.capperName
    this.game = options.game
    this.capperSettings = options.capperSettings
    this.existingAIRuns = options.existingAIRuns || []

    if (!env.PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not set for AI Orchestrator.')
    }
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set for AI Orchestrator.')
    }

    this.perplexityClient = new PerplexityClient({
      model: this.capperSettings.ai_model_run1,
      useProSearch: true,
    })
    this.openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    this.statMuseClient = new StatMuseClient()
  }

  /**
   * Orchestrates the multi-run AI research process for a single game.
   * @returns A comprehensive AI research result including both runs.
   */
  async runResearchPipeline(): Promise<AIRunResult[]> {
    const allRuns: AIRunResult[] = []

    // Run 1: Perplexity + StatMuse Questions
    const run1Result = await this.executeRun1()
    allRuns.push(run1Result)
    await this.saveAIRun(run1Result)

    // Wait 20 minutes between runs (configurable, for now we'll run sequentially)
    // In production, this would be managed by a scheduler/cron job

    // Run 2: ChatGPT + StatMuse Questions + Validation
    const run2Result = await this.executeRun2(run1Result)
    allRuns.push(run2Result)
    await this.saveAIRun(run2Result)

    return allRuns
  }

  /**
   * Run 1: Perplexity AI research with StatMuse queries
   * Focus: Analytical factors (team trends, player performance, matchup history)
   */
  private async executeRun1(): Promise<AIRunResult> {
    console.log(`[${this.capperName}] Starting AI Run 1 (Perplexity + StatMuse) for ${this.game.id}`)
    const runStartTime = new Date()
    const factors: AIRunFactors = {}
    const statMuseQuestions: string[] = []
    const statMuseAnswers: Array<{ question: string; answer: string | null }> = []

    try {
      // 1. Generate StatMuse questions using Perplexity
      const gameContext = this.getGameContextForAI()
      const questionsPrompt = `You are ${this.capperName}, a sports analyst. Generate ${this.capperSettings.max_statmuse_questions_run1} clever and specific statistical questions about this matchup that could be answered by StatMuse. Focus on recent team/player performance, head-to-head history, and key matchup factors. Format each question as a single line, prefixed with "Q: ".

Game Context:
${gameContext}

Examples:
Q: ${this.game.home_team.name} record last 10 games
Q: ${this.game.away_team.name} scoring average vs ${this.game.home_team.name}
`

      const questionsResponse = await this.perplexityClient.chatCompletion(
        [{ role: 'user', content: questionsPrompt }],
        {
          systemPrompt: `You are ${this.capperName}, a sports analyst. Generate insightful StatMuse questions.`,
          model: this.capperSettings.ai_model_run1,
          max_tokens: 500,
          temperature: 0.8,
        }
      )

      if (questionsResponse) {
        const questions = questionsResponse
          .split('\n')
          .filter((line) => line.trim().startsWith('Q:'))
          .map((line) => line.substring(3).trim())
        statMuseQuestions.push(...questions)
      }

      // 2. Query StatMuse for answers
      for (const q of statMuseQuestions) {
        const answer = await this.statMuseClient.query(this.game.sport, q)
        statMuseAnswers.push({ question: q, answer })
      }

      // 3. Perplexity analyzes StatMuse answers and generates analytical factors
      const analysisPrompt = `Analyze the following game context and StatMuse data. Identify 2 key analytical factors that could influence the game outcome. For each factor, provide:
- description: Brief explanation
- value: Numerical or descriptive value
- confidence: low, medium, or high
- impact: Estimated points impact (e.g., +2.5 for home team advantage, -1.5 for away team disadvantage)

Game Context:
${gameContext}

StatMuse Data:
${JSON.stringify(statMuseAnswers, null, 2)}

Format your output as a JSON object with factor names as keys. Example:
{
  "home_recent_form": {
    "description": "Home team won 8 of last 10 games",
    "value": "8-2 in last 10",
    "confidence": "high",
    "impact": 2.5
  }
}`

      const perplexityAnalysis = await this.perplexityClient.chatCompletion(
        [{ role: 'user', content: analysisPrompt }],
        {
          systemPrompt: `You are ${this.capperName}, a sports analyst. Focus on analytical factors. Always respond with valid JSON.`,
          model: this.capperSettings.ai_model_run1,
          max_tokens: 700,
          temperature: 0.5,
        }
      )

      if (perplexityAnalysis) {
        try {
          const parsedFactors = JSON.parse(perplexityAnalysis)
          Object.assign(factors, parsedFactors)
        } catch (e) {
          console.error('Failed to parse Perplexity analysis JSON:', e)
          factors.perplexity_raw_analysis = {
            description: 'Raw Perplexity analysis due to JSON parse error',
            value: perplexityAnalysis,
            confidence: 'low',
          }
        }
      }
    } catch (error) {
      console.error(`[${this.capperName}] Error in AI Run 1:`, error)
      factors.run1_error = {
        description: 'Error during Perplexity AI Run 1',
        value: (error as Error).message,
        confidence: 'critical',
      }
    }

    const runEndTime = new Date()
    return {
      game_id: this.game.id,
      capper: this.capperName,
      run_number: 1,
      run_type: 'analytical',
      factors: factors,
      statmuse_queries: statMuseQuestions,
      statmuse_results: statMuseAnswers,
      odds_at_run: this.game.odds,
      timestamp: runStartTime.toISOString(),
      duration_ms: runEndTime.getTime() - runStartTime.getTime(),
    }
  }

  /**
   * Run 2: ChatGPT strategic analysis with validation
   * Focus: Strategic factors, injury validation, breaking news, and final confidence
   */
  private async executeRun2(previousRunResult: AIRunResult): Promise<AIRunResult> {
    console.log(`[${this.capperName}] Starting AI Run 2 (ChatGPT + StatMuse + Validation) for ${this.game.id}`)
    const runStartTime = new Date()
    const factors: AIRunFactors = {}
    const statMuseQuestions: string[] = []
    const statMuseAnswers: Array<{ question: string; answer: string | null }> = []
    let validationResult: any = null

    try {
      // 1. Generate StatMuse questions using ChatGPT
      const gameContext = this.getGameContextForAI()
      const chatGptQuestionsPrompt = `You are ${this.capperName}, a strategic sports analyst. Generate ${this.capperSettings.max_statmuse_questions_run2} clever and specific statistical questions for StatMuse. Focus on strategic factors, injury impacts, or validation of previous data. Format each question as a single line, prefixed with "Q: ".

Game Context:
${gameContext}

Previous AI Research (Run 1):
${JSON.stringify(previousRunResult.factors, null, 2)}

Examples:
Q: ${this.game.away_team.name} offensive efficiency without key players
Q: ${this.game.home_team.name} defensive rating last 5 games`

      const chatGptQuestionsResponse = await this.openaiClient.chat.completions.create({
        model: this.capperSettings.ai_model_run2 || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are ${this.capperName}, a strategic sports analyst. Generate insightful StatMuse questions.`,
          },
          { role: 'user', content: chatGptQuestionsPrompt },
        ],
        max_tokens: 500,
        temperature: 0.8,
      })

      const questions =
        chatGptQuestionsResponse.choices[0]?.message?.content
          ?.split('\n')
          .filter((line) => line.trim().startsWith('Q:'))
          .map((line) => line.substring(3).trim()) || []
      statMuseQuestions.push(...questions)

      // 2. Query StatMuse for answers
      for (const q of statMuseQuestions) {
        const answer = await this.statMuseClient.query(this.game.sport, q)
        statMuseAnswers.push({ question: q, answer })
      }

      // 3. ChatGPT analyzes StatMuse answers, previous run, and performs validation
      const chatGptAnalysisPrompt = `Analyze the following game context, StatMuse data, and previous AI research (Run 1).

Your tasks:
1. Identify 2 key strategic factors (e.g., injury impacts, weather, momentum, coaching matchups)
2. Perform a critical validation of key injury/player status information from Run 1
3. Search for any breaking news or recent updates that could impact the game
4. If any critical information from Run 1 is inaccurate or outdated, note it and provide corrected information

For each factor, provide:
- description: Brief explanation
- value: Numerical or descriptive value
- confidence: low, medium, or high
- impact: Estimated points impact (e.g., +3.0 for home team advantage)

Also include a "validation_summary" field with your validation findings.

Game Context:
${gameContext}

StatMuse Data:
${JSON.stringify(statMuseAnswers, null, 2)}

Previous AI Research (Run 1 Factors):
${JSON.stringify(previousRunResult.factors, null, 2)}

Format your output as a JSON object with factor names as keys, and include a "validation_summary" field. Example:
{
  "key_injury_impact": {
    "description": "Star player questionable with ankle injury",
    "value": "50% chance to play",
    "confidence": "medium",
    "impact": -3.5
  },
  "validation_summary": {
    "status": "validated",
    "corrections": [],
    "breaking_news": "No significant breaking news"
  }
}`

      const chatGptAnalysisResponse = await this.openaiClient.chat.completions.create({
        model: this.capperSettings.ai_model_run2 || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are ${this.capperName}, a strategic sports analyst and validator. Focus on strategic factors, real-time news, and data accuracy. Always respond with valid JSON.`,
          },
          { role: 'user', content: chatGptAnalysisPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      })

      if (chatGptAnalysisResponse.choices[0]?.message?.content) {
        try {
          const parsedResponse = JSON.parse(chatGptAnalysisResponse.choices[0].message.content)
          Object.assign(factors, parsedResponse)
          validationResult = parsedResponse.validation_summary || { status: 'no_specific_validation_performed' }
          delete factors.validation_summary // Remove from factors, keep in validationResult
        } catch (e) {
          console.error('Failed to parse ChatGPT analysis JSON:', e)
          factors.chatgpt_raw_analysis = {
            description: 'Raw ChatGPT analysis due to JSON parse error',
            value: chatGptAnalysisResponse.choices[0].message.content,
            confidence: 'low',
          }
        }
      }
    } catch (error) {
      console.error(`[${this.capperName}] Error in AI Run 2:`, error)
      factors.run2_error = {
        description: 'Error during ChatGPT AI Run 2',
        value: (error as Error).message,
        confidence: 'critical',
      }
    }

    const runEndTime = new Date()
    return {
      game_id: this.game.id,
      capper: this.capperName,
      run_number: 2,
      run_type: 'strategic_validation',
      factors: factors,
      statmuse_queries: statMuseQuestions,
      statmuse_results: statMuseAnswers,
      validation_result: validationResult,
      odds_at_run: this.game.odds,
      timestamp: runStartTime.toISOString(),
      duration_ms: runEndTime.getTime() - runStartTime.getTime(),
    }
  }

  /**
   * Generates a comprehensive AI insight writeup from all run results
   */
  async generateAIInsight(allRuns: AIRunResult[]): Promise<AIInsight> {
    const gameContext = this.getGameContextForAI()
    const allFactors = allRuns.flatMap((run) => Object.entries(run.factors))

    const insightPrompt = `You are ${this.capperName}, a professional sports analyst. Based on your comprehensive research, generate a compelling pick analysis.

Game Context:
${gameContext}

All Research Factors:
${JSON.stringify(Object.fromEntries(allFactors), null, 2)}

Generate a JSON response with:
1. "summary": A 1-sentence summary of your analysis
2. "key_factors": Array of top 3 factors that influenced your decision (with name, description, impact, confidence)
3. "bold_prediction": One bold prediction about the game (e.g., "Steph Curry will score 35+ points")
4. "writeup": A 2-3 paragraph data-driven analysis explaining your pick

Make it engaging, professional, and data-driven. Example:
{
  "summary": "Strong home advantage and recent form favor the Lakers in this matchup.",
  "key_factors": [
    {
      "name": "Home Court Dominance",
      "description": "Lakers are 12-2 at home this season",
      "impact": 2.5,
      "confidence": "high"
    }
  ],
  "bold_prediction": "Anthony Davis will record a double-double with 12+ rebounds",
  "writeup": "The Lakers come into this matchup..."
}`

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${this.capperName}, a professional sports analyst. Write engaging, data-driven pick analysis. Always respond with valid JSON.`,
        },
        { role: 'user', content: insightPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    try {
      const insight = JSON.parse(response.choices[0]?.message?.content || '{}')
      return insight as AIInsight
    } catch (e) {
      console.error('Failed to parse AI insight JSON:', e)
      return {
        summary: 'AI analysis completed with multiple factors considered.',
        key_factors: [],
        bold_prediction: 'Game outcome will be determined by key matchups.',
        writeup: response.choices[0]?.message?.content || 'Analysis unavailable.',
      }
    }
  }

  /**
   * Generates a rich context string for the AI to analyze
   */
  private getGameContextForAI(): string {
    return `Game: ${this.game.away_team.name} (${this.game.away_team.abbreviation}) @ ${this.game.home_team.name} (${this.game.home_team.abbreviation})
Sport: ${this.game.sport.toUpperCase()}
League: ${this.game.league}
Date: ${this.game.game_date}
Time: ${this.game.game_time}
Venue: ${this.game.venue || 'TBD'}

Current Odds (average):
Moneyline: Home ${this.game.odds?.moneyline?.home || 'N/A'}, Away ${this.game.odds?.moneyline?.away || 'N/A'}
Spread: Home ${this.game.odds?.spread?.home_line || 'N/A'} (${this.game.odds?.spread?.home || 'N/A'}), Away ${this.game.odds?.spread?.away_line || 'N/A'} (${this.game.odds?.spread?.away || 'N/A'})
Total: Over ${this.game.odds?.total?.line || 'N/A'} (${this.game.odds?.total?.over || 'N/A'}), Under ${this.game.odds?.total?.line || 'N/A'} (${this.game.odds?.total?.under || 'N/A'})`
  }

  /**
   * Saves an AI run result to the database
   */
  async saveAIRun(runResult: AIRunResult): Promise<void> {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ai_research_runs').insert(runResult)
    if (error) {
      console.error(`Error saving AI run for game ${runResult.game_id}, run ${runResult.run_number}:`, error)
      throw error
    }
    console.log(`✅ Successfully saved AI run ${runResult.run_number} for game ${runResult.game_id}`)
  }
}
