import { CapperGame } from '@/lib/cappers/shared-logic'
import { PerplexityClient } from './perplexity-client'
import { StatMuseClient } from '@/lib/data/statmuse-client'
import OpenAI from 'openai'
import { env } from '@/lib/env'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { CapperSettings, AIRunResult, AIRunFactors, AIInsight } from '@/types'
import { logApiCall } from '@/lib/monitoring/api-logger'

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

    this.perplexityClient = new PerplexityClient(env.PERPLEXITY_API_KEY)
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
      // 1. Execute predefined StatMuse queries (Run 1: First 4 factors)
      const statMuseQueriesRun1 = [
        // Factor 1: Head-to-Head Scoring
        `${this.game.home_team.name} average points per game vs ${this.game.away_team.name} this season`,
        `${this.game.away_team.name} average points per game vs ${this.game.home_team.name} this season`,
        
        // Factor 2: Opponent Defensive Quality  
        `${this.game.home_team.name} defensive rating this season`,
        `${this.game.away_team.name} defensive rating this season`,
        
        // Factor 3: Pace
        `${this.game.home_team.name} pace this season`,
        `${this.game.away_team.name} pace this season`,
        
        // Factor 4: Recent Form
        `${this.game.home_team.name} net rating last 10 games`,
        `${this.game.away_team.name} net rating last 10 games`
      ]

      // Execute StatMuse queries for Run 1
      for (const query of statMuseQueriesRun1) {
        const result = await this.queryStatMuseWithRetry(query)
        statMuseQuestions.push(query)
        statMuseAnswers.push({ question: query, answer: result.text })
        
        // Log if question failed
        if (result.failed) {
          console.warn(`[${this.capperName}] StatMuse query failed: "${query}"`)
        }
      }

      // 2. Perplexity web search for injury information
      const injurySearchPrompt = `Search for current injury information specifically for the NBA game: ${this.game.home_team.name} vs ${this.game.away_team.name}.

IMPORTANT: Only include injuries for these two teams:
- ${this.game.home_team.name} (home team)
- ${this.game.away_team.name} (away team)

Look for:
- Key player injuries (starters, important role players) for BOTH teams
- Injury status (out, questionable, doubtful, probable) 
- Recent injury updates (last 48 hours)
- Impact on team performance

Focus on injuries that could significantly affect the game outcome. Ignore injuries for any other NBA teams.

Format your response to clearly separate:
1. ${this.game.home_team.name} injuries
2. ${this.game.away_team.name} injuries`

      const injuryResponse = await this.perplexityClient.chat({
        model: this.capperSettings.ai_model_run1 || 'sonar-medium-online',
        messages: [
          { role: 'system', content: `You are a sports injury analyst. Search for current injury information and provide detailed analysis.` },
          { role: 'user', content: injurySearchPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      })

      let injuryAnalysis = ''
      if (injuryResponse?.choices?.[0]?.message?.content) {
        injuryAnalysis = injuryResponse.choices[0].message.content
        
        // Validate that injury analysis contains only the correct teams
        const homeTeamName = this.game.home_team.name.toLowerCase()
        const awayTeamName = this.game.away_team.name.toLowerCase()
        const analysisText = injuryAnalysis.toLowerCase()
        
        // Check if analysis mentions the correct teams
        const mentionsHomeTeam = analysisText.includes(homeTeamName) || 
                               analysisText.includes(this.game.home_team.abbreviation.toLowerCase())
        const mentionsAwayTeam = analysisText.includes(awayTeamName) || 
                               analysisText.includes(this.game.away_team.abbreviation.toLowerCase())
        
        if (mentionsHomeTeam && mentionsAwayTeam) {
          console.log(`[${this.capperName}] Injury analysis validated for correct teams`)
        } else {
          console.warn(`[${this.capperName}] Injury analysis may not be for correct teams - filtering results`)
          // Filter to only include relevant team mentions
          const lines = injuryAnalysis.split('\n')
          const filteredLines = lines.filter(line => {
            const lowerLine = line.toLowerCase()
            return lowerLine.includes(homeTeamName) || 
                   lowerLine.includes(awayTeamName) ||
                   lowerLine.includes(this.game.home_team.abbreviation.toLowerCase()) ||
                   lowerLine.includes(this.game.away_team.abbreviation.toLowerCase()) ||
                   lowerLine.includes('injury') || lowerLine.includes('out') || 
                   lowerLine.includes('questionable') || lowerLine.includes('doubtful')
          })
          injuryAnalysis = filteredLines.join('\n')
        }
      }

      // 3. Perplexity analyzes StatMuse answers and injury data to generate analytical factors
      const gameContext = this.getGameContextForAI()
      const analysisPrompt = `Analyze the following game context, StatMuse data, and injury information. Identify 3 key analytical factors that could influence the game outcome. For each factor, provide:
- description: Brief explanation
- value: Numerical or descriptive value
- confidence: low, medium, or high
- impact: Estimated points impact (e.g., +2.5 for home team advantage, -1.5 for away team disadvantage)

Game Context:
${gameContext}

StatMuse Data:
${statMuseAnswers.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}

Injury Analysis:
${injuryAnalysis}

CRITICAL: Only analyze injuries for ${this.game.home_team.name} and ${this.game.away_team.name}. Ignore any other team injuries mentioned.

Generate 3 factors including at least 1 injury-related factor.

Format your output as a JSON object with factor names as keys. Example:
{
  "home_recent_form": {
    "description": "Home team won 8 of last 10 games",
    "value": "8-2 in last 10",
    "confidence": "high",
    "impact": 2.5
  },
  "injury_impact": {
    "description": "Key player out for away team",
    "value": "Starting PG questionable",
    "confidence": "medium",
    "impact": -1.5
  }
}`

      const perplexityAnalysis = await this.perplexityClient.chat({
        model: this.capperSettings.ai_model_run1 || 'sonar-medium-online',
        messages: [
          { role: 'system', content: `You are ${this.capperName}, a sports analyst. Focus on analytical factors. Always respond with valid JSON.` },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 700,
        temperature: 0.5,
      })

      if (perplexityAnalysis?.choices?.[0]?.message?.content) {
        try {
          const parsedFactors = JSON.parse(perplexityAnalysis.choices[0].message.content)
          Object.assign(factors, parsedFactors)
        } catch (e) {
          console.error('Failed to parse Perplexity analysis JSON:', e)
          factors.perplexity_raw_analysis = {
            description: 'Raw Perplexity analysis due to JSON parse error',
            value: perplexityAnalysis.choices[0].message.content,
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
      // 1. Execute predefined StatMuse queries (Run 2: Last 3 factors)
      const statMuseQueriesRun2 = [
        // Factor 5: Rest / 0 Days Rest
        `${this.game.home_team.name} record on 0 days rest this season`,
        `${this.game.away_team.name} record on 0 days rest this season`,
        
        // Factor 6: Role Split (Favorites/Underdogs)
        `${this.game.home_team.name} record this season as favorites`,
        `${this.game.away_team.name} record this season as underdogs`,
        
        // Factor 7: 3-Point Environment Allowed
        `${this.game.home_team.name} opponent 3 point attempts per game this season`,
        `${this.game.away_team.name} opponent 3 point attempts per game this season`
      ]

      // Execute StatMuse queries for Run 2
      for (const query of statMuseQueriesRun2) {
        const result = await this.queryStatMuseWithRetry(query)
        statMuseQuestions.push(query)
        statMuseAnswers.push({ question: query, answer: result.text })
        
        // Log if question failed
        if (result.failed) {
          console.warn(`[${this.capperName}] StatMuse query failed: "${query}"`)
        }
      }

      // 3. ChatGPT analyzes StatMuse answers, previous run, and performs validation
      const gameContext = this.getGameContextForAI()
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
    // Get average odds from all bookmakers
    const bookmakers = Object.keys(this.game.odds || {})
    let avgMoneylineHome = 'N/A'
    let avgMoneylineAway = 'N/A'
    let avgSpreadLine = 'N/A'
    let avgSpreadHome = 'N/A'
    let avgTotalLine = 'N/A'
    let avgTotalOver = 'N/A'

    if (bookmakers.length > 0) {
      const mlHome: number[] = []
      const mlAway: number[] = []
      const spreadLines: number[] = []
      const spreadOdds: number[] = []
      const totalLines: number[] = []
      const totalOdds: number[] = []

      bookmakers.forEach(book => {
        const odds = this.game.odds[book]
        const homeTeam = this.game.home_team?.name
        const awayTeam = this.game.away_team?.name
        
        if (odds.moneyline && homeTeam && awayTeam) {
          mlHome.push(odds.moneyline[homeTeam])
          mlAway.push(odds.moneyline[awayTeam])
        }
        if (odds.spread && homeTeam) {
          spreadLines.push(Math.abs(odds.spread[homeTeam]?.point || 0))
          spreadOdds.push(odds.spread[homeTeam]?.price || 0)
        }
        if (odds.total) {
          totalLines.push(odds.total.Over?.point || 0)
          totalOdds.push(odds.total.Over?.price || 0)
        }
      })

      if (mlHome.length) avgMoneylineHome = Math.round(mlHome.reduce((a, b) => a + b) / mlHome.length).toString()
      if (mlAway.length) avgMoneylineAway = Math.round(mlAway.reduce((a, b) => a + b) / mlAway.length).toString()
      if (spreadLines.length) avgSpreadLine = (spreadLines.reduce((a, b) => a + b) / spreadLines.length).toFixed(1)
      if (spreadOdds.length) avgSpreadHome = Math.round(spreadOdds.reduce((a, b) => a + b) / spreadOdds.length).toString()
      if (totalLines.length) avgTotalLine = (totalLines.reduce((a, b) => a + b) / totalLines.length).toFixed(1)
      if (totalOdds.length) avgTotalOver = Math.round(totalOdds.reduce((a, b) => a + b) / totalOdds.length).toString()
    }

    return `Game: ${this.game.away_team.name} (${this.game.away_team.abbreviation}) @ ${this.game.home_team.name} (${this.game.home_team.abbreviation})
Sport: ${this.game.sport.toUpperCase()}
Date: ${this.game.game_date}
Time: ${this.game.game_time}
Status: ${this.game.status}

Current Odds (averaged across ${bookmakers.length} bookmaker${bookmakers.length !== 1 ? 's' : ''}):
Moneyline: Home ${avgMoneylineHome}, Away ${avgMoneylineAway}
Spread: ${avgSpreadLine} (odds: ${avgSpreadHome})
Total: ${avgTotalLine} (over odds: ${avgTotalOver})`
  }

  /**
   * Query StatMuse with retry logic
   * If query fails or returns no data, rephrase and try again
   */
  private async queryStatMuseWithRetry(
    question: string,
    maxRetries: number = 1
  ): Promise<{ text: string | null; failed: boolean }> {
    try {
      // First attempt
      const answer = await this.statMuseClient.query(this.game.sport, question)
      
      // Check if answer is valid
      if (answer && !answer.toLowerCase().includes('no data') && !answer.toLowerCase().includes('not found')) {
        return { text: answer, failed: false }
      }
      
      // If no valid answer and we have retries left, try rephrasing
      if (maxRetries > 0) {
        console.log(`[${this.capperName}] StatMuse query unclear, rephrasing: "${question}"`)
        
        // Simple rephrase: make it more specific or simpler
        const rephrased = question
          .replace('Compare', 'What is the difference between')
          .replace(' vs ', ' versus ')
          .replace(' last 5', ' recent')
        
        // Try again with rephrased question
        const retryAnswer = await this.statMuseClient.query(this.game.sport, rephrased)
        
        if (retryAnswer && !retryAnswer.toLowerCase().includes('no data')) {
          return { text: retryAnswer, failed: false }
        }
      }
      
      // Failed after retries
      return { text: null, failed: true }
      
    } catch (error) {
      console.error(`[${this.capperName}] StatMuse error:`, error)
      return { text: null, failed: true }
    }
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
