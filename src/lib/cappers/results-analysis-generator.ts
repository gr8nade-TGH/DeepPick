/**
 * Results Analysis Generator
 * 
 * Generates AI-powered post-game analysis comparing predictions to actual results
 * Analyzes factor accuracy and generates tuning suggestions
 */

import { fetchGameBoxscore } from '@/lib/data-sources/mysportsfeeds-api'

export interface ResultsAnalysisInput {
  // Original prediction data
  pickId: string
  gameId: string
  betType: 'TOTAL' | 'SPREAD'
  selection: string
  predictedValue: number  // predicted_total or predicted_margin
  marketLine: number
  confidence: number
  units: number

  // Original analysis
  professionalAnalysis: string
  boldPredictions: any
  factors: any[]

  // Actual results
  finalScore: {
    away: number
    home: number
  }
  actualTotal?: number
  actualMargin?: number
  outcome: 'won' | 'lost' | 'push'

  // Game context
  game: {
    away_team: string
    home_team: string
    game_date: string
  }
}

export interface FactorAccuracy {
  factorId: string
  factorName: string
  contribution: number  // Original contribution (e.g., +4 points)
  wasCorrect: boolean
  accuracyScore: number  // 0-1 scale
  impact: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface TuningSuggestion {
  factorId: string
  factorName: string
  currentWeight: number
  suggestedWeight: number
  changePercent: number
  reason: string
  confidence: number  // 0-1 scale
  sampleSize: number
}

export interface ResultsAnalysisOutput {
  pickId: string
  analysis: string  // AI-generated results analysis
  factorAccuracy: FactorAccuracy[]
  tuningSuggestions: TuningSuggestion[]
  overallAccuracy: number
  generatedAt: string
}

/**
 * Generate comprehensive results analysis
 */
export async function generateResultsAnalysis(input: ResultsAnalysisInput): Promise<ResultsAnalysisOutput> {
  const startTime = Date.now()

  try {
    console.log('[ResultsAnalysis] Starting generation:', {
      pickId: input.pickId,
      betType: input.betType,
      outcome: input.outcome
    })

    // Step 1: Fetch box score data
    const boxScore = await fetchGameBoxscore(input.gameId)

    // Step 2: Analyze factor accuracy
    const factorAccuracy = analyzeFactorAccuracy(input)

    // Step 3: Generate tuning suggestions
    const tuningSuggestions = generateTuningSuggestions(factorAccuracy, input.factors)

    // Step 4: Generate AI analysis
    const analysis = await generateAIResultsAnalysis(input, boxScore, factorAccuracy)

    // Step 5: Calculate overall accuracy
    const overallAccuracy = calculateOverallAccuracy(factorAccuracy)

    console.log('[ResultsAnalysis] Analysis generated successfully:', {
      pickId: input.pickId,
      overallAccuracy,
      factorCount: factorAccuracy.length,
      suggestionCount: tuningSuggestions.length,
      latencyMs: Date.now() - startTime
    })

    return {
      pickId: input.pickId,
      analysis,
      factorAccuracy,
      tuningSuggestions,
      overallAccuracy,
      generatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error('[ResultsAnalysis] Error generating analysis:', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime
    })

    // Return fallback analysis
    return {
      pickId: input.pickId,
      analysis: generateFallbackResultsAnalysis(input),
      factorAccuracy: [],
      tuningSuggestions: [],
      overallAccuracy: 0,
      generatedAt: new Date().toISOString()
    }
  }
}

/**
 * Analyze accuracy of each factor
 */
function analyzeFactorAccuracy(input: ResultsAnalysisInput): FactorAccuracy[] {
  const accuracyResults: FactorAccuracy[] = []

  for (const factor of input.factors) {
    const contribution = factor.weighted_contribution || factor.impact || 0
    const factorName = factor.label || factor.name || 'Unknown Factor'
    const factorId = factor.id || factor.key || factorName

    // Determine if factor was correct based on bet type
    let wasCorrect = false
    let accuracyScore = 0
    let reasoning = ''

    if (input.betType === 'TOTAL') {
      const actualTotal = input.actualTotal || (input.finalScore.away + input.finalScore.home)
      const predictedDirection = input.predictedValue > input.marketLine ? 'OVER' : 'UNDER'
      const actualDirection = actualTotal > input.marketLine ? 'OVER' : 'UNDER'

      // Factor was correct if it pushed in the right direction
      if (contribution > 0 && predictedDirection === 'OVER' && actualDirection === 'OVER') {
        wasCorrect = true
        accuracyScore = Math.min(1, contribution / Math.abs(actualTotal - input.marketLine))
        reasoning = `Factor contributed +${contribution.toFixed(1)} to OVER, and OVER hit by ${(actualTotal - input.marketLine).toFixed(1)} points`
      } else if (contribution < 0 && predictedDirection === 'UNDER' && actualDirection === 'UNDER') {
        wasCorrect = true
        accuracyScore = Math.min(1, Math.abs(contribution) / Math.abs(actualTotal - input.marketLine))
        reasoning = `Factor contributed ${contribution.toFixed(1)} to UNDER, and UNDER hit by ${(input.marketLine - actualTotal).toFixed(1)} points`
      } else if (contribution > 0 && actualDirection === 'UNDER') {
        wasCorrect = false
        accuracyScore = 0
        reasoning = `Factor contributed +${contribution.toFixed(1)} to OVER, but UNDER hit by ${(input.marketLine - actualTotal).toFixed(1)} points`
      } else if (contribution < 0 && actualDirection === 'OVER') {
        wasCorrect = false
        accuracyScore = 0
        reasoning = `Factor contributed ${contribution.toFixed(1)} to UNDER, but OVER hit by ${(actualTotal - input.marketLine).toFixed(1)} points`
      }
    } else if (input.betType === 'SPREAD') {
      const actualMargin = input.actualMargin || (input.finalScore.home - input.finalScore.away)

      // Determine if spread was covered
      const spreadCovered = input.outcome === 'won'

      // Factor was correct if it pushed toward the winning side
      if (spreadCovered && contribution > 0) {
        wasCorrect = true
        accuracyScore = Math.min(1, contribution / Math.abs(actualMargin - input.marketLine))
        reasoning = `Factor contributed +${contribution.toFixed(1)} points, and spread covered by ${Math.abs(actualMargin - input.marketLine).toFixed(1)} points`
      } else if (!spreadCovered && contribution > 0) {
        wasCorrect = false
        accuracyScore = 0
        reasoning = `Factor contributed +${contribution.toFixed(1)} points, but spread did not cover`
      }
    }

    // Determine impact level
    const absContribution = Math.abs(contribution)
    const impact = absContribution >= 3 ? 'high' : absContribution >= 1.5 ? 'medium' : 'low'

    accuracyResults.push({
      factorId,
      factorName,
      contribution,
      wasCorrect,
      accuracyScore,
      impact,
      reasoning
    })
  }

  return accuracyResults
}

/**
 * Generate tuning suggestions based on factor accuracy
 */
function generateTuningSuggestions(
  factorAccuracy: FactorAccuracy[],
  originalFactors: any[]
): TuningSuggestion[] {
  const suggestions: TuningSuggestion[] = []

  for (const accuracy of factorAccuracy) {
    // Only suggest changes for high-impact factors that were wrong
    if (accuracy.impact === 'high' && !accuracy.wasCorrect) {
      const originalFactor = originalFactors.find(f =>
        (f.id || f.key || f.label || f.name) === accuracy.factorId
      )

      if (originalFactor) {
        const currentWeight = originalFactor.weight || 0.1
        const suggestedWeight = currentWeight * 0.75  // Reduce by 25%
        const changePercent = -25

        suggestions.push({
          factorId: accuracy.factorId,
          factorName: accuracy.factorName,
          currentWeight,
          suggestedWeight,
          changePercent,
          reason: accuracy.reasoning,
          confidence: 0.7,  // Medium confidence (need more samples)
          sampleSize: 1  // This is just one game
        })
      }
    }
  }

  return suggestions
}

/**
 * Calculate overall accuracy score
 */
function calculateOverallAccuracy(factorAccuracy: FactorAccuracy[]): number {
  if (factorAccuracy.length === 0) return 0

  const totalScore = factorAccuracy.reduce((sum, f) => sum + f.accuracyScore, 0)
  return totalScore / factorAccuracy.length
}

/**
 * Generate AI-powered results analysis
 */
async function generateAIResultsAnalysis(
  input: ResultsAnalysisInput,
  boxScore: any,
  factorAccuracy: FactorAccuracy[]
): Promise<string> {
  // Format box score data
  const boxScoreSummary = formatBoxScoreSummary(boxScore, input.game)

  // Format factor accuracy with impact indicators
  const factorAccuracySummary = factorAccuracy.map(f => {
    const icon = f.wasCorrect ? '✅' : '❌'
    const impactBadge = f.impact === 'high' ? '🔥' : f.impact === 'medium' ? '⚡' : '💨'
    return `• ${icon} ${impactBadge} ${f.factorName} (${f.contribution > 0 ? '+' : ''}${f.contribution.toFixed(1)} pts): ${f.reasoning}`
  }).join('\n')

  // Build AI prompt
  const aiPrompt = buildResultsAnalysisPrompt(input, boxScoreSummary, factorAccuracySummary)

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are an elite sports betting analyst reviewing predictions against actual results. Be direct, analytical, and constructive. Point out what was right and wrong, and explain why.'
        },
        {
          role: 'user',
          content: aiPrompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const aiResponse = await response.json()
  return aiResponse.choices?.[0]?.message?.content || ''
}

/**
 * Format box score summary
 */
function formatBoxScoreSummary(boxScore: any, game: any): string {
  // Extract key stats from MySportsFeeds box score
  // This is a placeholder - actual implementation depends on API response structure
  return `Final Score: ${game.away_team} ${boxScore?.away_score || 0} - ${game.home_team} ${boxScore?.home_score || 0}`
}

/**
 * Build AI prompt for results analysis
 */
function buildResultsAnalysisPrompt(
  input: ResultsAnalysisInput,
  boxScoreSummary: string,
  factorAccuracySummary: string
): string {
  const actualTotal = input.actualTotal || (input.finalScore.away + input.finalScore.home)
  const actualMargin = input.actualMargin || (input.finalScore.home - input.finalScore.away)

  if (input.betType === 'TOTAL') {
    const predictionDiff = input.predictedValue - input.marketLine
    const actualDiff = actualTotal - input.marketLine
    const predictionDirection = predictionDiff > 0 ? 'OVER' : 'UNDER'
    const actualDirection = actualDiff > 0 ? 'OVER' : 'UNDER'

    return `You are reviewing a pre-game TOTAL prediction against actual results. Be direct and analytical.

ORIGINAL PREDICTION:
${input.professionalAnalysis}

PREDICTED:
- Total: ${input.predictedValue.toFixed(1)} points
- Market Line: ${input.marketLine}
- Edge: ${Math.abs(predictionDiff).toFixed(1)} points ${predictionDirection}
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0

ACTUAL RESULTS:
${boxScoreSummary}
- Actual Total: ${actualTotal} points
- Market Line: ${input.marketLine}
- Result: ${actualDirection} by ${Math.abs(actualDiff).toFixed(1)} points
- Outcome: ${input.outcome.toUpperCase()}

FACTOR ACCURACY:
${factorAccuracySummary}

TASK:
Write a direct, analytical review comparing the prediction to reality. Use bullet points with checkmarks (✅/❌) to grade each claim.

REQUIRED FORMAT:

**📊 PREDICTION VS REALITY**
• You predicted ${input.predictedValue.toFixed(1)} points, but the actual total was ${actualTotal}
• You thought ${predictionDirection} by ${Math.abs(predictionDiff).toFixed(1)}, and ${actualDirection} hit by ${Math.abs(actualDiff).toFixed(1)}
• Prediction was ${predictionDirection === actualDirection ? '✅ DIRECTIONALLY CORRECT' : '❌ DIRECTIONALLY WRONG'}

**🔍 ORIGINAL ANALYSIS REVIEW**
Review each major claim from the original prediction and grade it:
• ✅ [Claim that was validated] - Explain why it was correct
• ❌ [Claim that was wrong] - Explain why it missed
• ⚠️ [Claim that was partially correct] - Explain the nuance
• ➖ [Claim that cannot be verified from box score] - Note it's unverifiable

Examples:
• ✅ "Predicted high pace would lead to 110+ possessions" - Game had 112 possessions
• ❌ "Expected strong defensive performance to limit scoring" - Defense allowed 58% shooting
• ⚠️ "Injury to star player would reduce scoring by 15 points" - Reduced by only 8 points
• ➖ "Motivation factor from rivalry game" - Cannot verify from box score

**📊 FACTOR ACCURACY BREAKDOWN**
${factorAccuracySummary}

**🔍 KEY INSIGHTS FROM BOX SCORE**
• What actually happened that explains the result?
• Were there unexpected performances?
• Did the game flow match expectations?

**💡 LESSONS LEARNED**
• What should be adjusted for future predictions?
• Which factors need reweighting?
• What new considerations should be added?

CRITICAL REQUIREMENTS:
- Use ✅ for correct predictions/claims
- Use ❌ for incorrect predictions/claims
- Use ⚠️ for partially correct predictions/claims
- Use ➖ for unverifiable claims (skip grading if you can't verify)
- Be specific about WHY each claim was right or wrong
- Reference actual box score data when possible
- Direct and honest tone (no sugarcoating)
- Analytical (explain WHY things happened)
- Constructive (focus on learning)

LENGTH: 350-450 words

Return ONLY the bullet-point analysis with checkmarks.`
  } else {
    // SPREAD analysis
    const predictionDiff = input.predictedValue - input.marketLine

    return `You are reviewing a pre-game SPREAD prediction against actual results. Be direct and analytical.

ORIGINAL PREDICTION:
${input.professionalAnalysis}

PREDICTED:
- Predicted Margin: ${input.predictedValue.toFixed(1)} points
- Market Spread: ${input.marketLine}
- Edge: ${Math.abs(predictionDiff).toFixed(1)} points
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0

ACTUAL RESULTS:
${boxScoreSummary}
- Actual Margin: ${actualMargin.toFixed(1)} points
- Market Spread: ${input.marketLine}
- Outcome: ${input.outcome.toUpperCase()}

FACTOR ACCURACY:
${factorAccuracySummary}

TASK:
Write a direct, analytical review comparing the prediction to reality. Use bullet points with checkmarks (✅/❌) to grade each claim.

REQUIRED FORMAT:

**📊 PREDICTION VS REALITY**
• You predicted a margin of ${input.predictedValue.toFixed(1)}, but the actual margin was ${actualMargin.toFixed(1)}
• Spread ${input.outcome === 'won' ? '✅ COVERED' : input.outcome === 'push' ? '➖ PUSHED' : '❌ DID NOT COVER'}
• Prediction was off by ${Math.abs(input.predictedValue - actualMargin).toFixed(1)} points

**🔍 ORIGINAL ANALYSIS REVIEW**
Review each major claim from the original prediction and grade it:
• ✅ [Claim that was validated] - Explain why it was correct
• ❌ [Claim that was wrong] - Explain why it missed
• ⚠️ [Claim that was partially correct] - Explain the nuance
• ➖ [Claim that cannot be verified from box score] - Note it's unverifiable

Examples:
• ✅ "Predicted home team's rebounding advantage would be decisive" - Out-rebounded by 12
• ❌ "Expected away team's defense to shut down paint scoring" - Allowed 62 points in paint
• ⚠️ "Injury to starting PG would hurt ball movement" - Assists down 15% (expected 30%)
• ➖ "Revenge game motivation for home team" - Cannot verify from box score

**📊 FACTOR ACCURACY BREAKDOWN**
${factorAccuracySummary}

**🔍 KEY INSIGHTS FROM BOX SCORE**
• What actually happened that explains the result?
• Were there unexpected performances?
• Did the game flow match expectations?

**💡 LESSONS LEARNED**
• What should be adjusted for future predictions?
• Which factors need reweighting?
• What new considerations should be added?

CRITICAL REQUIREMENTS:
- Use ✅ for correct predictions/claims
- Use ❌ for incorrect predictions/claims
- Use ⚠️ for partially correct predictions/claims
- Use ➖ for unverifiable claims (skip grading if you can't verify)
- Be specific about WHY each claim was right or wrong
- Reference actual box score data when possible
- Direct and honest tone
- Analytical (explain WHY)
- Constructive (focus on learning)

LENGTH: 350-450 words

Return ONLY the bullet-point analysis with checkmarks.`
  }
}

/**
 * Fallback results analysis if AI fails
 */
function generateFallbackResultsAnalysis(input: ResultsAnalysisInput): string {
  const actualTotal = input.actualTotal || (input.finalScore.away + input.finalScore.home)
  const result = input.outcome === 'won' ? 'WON' : input.outcome === 'lost' ? 'LOST' : 'PUSHED'

  return `Pick ${result}. Final score: ${input.game.away_team} ${input.finalScore.away} - ${input.game.home_team} ${input.finalScore.home}. Total: ${actualTotal} (Market: ${input.marketLine}).`
}

