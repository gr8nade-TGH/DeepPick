/**
 * Bold Predictions Generator
 * 
 * Generates AI-powered bold player predictions for SHIVA picks
 * Uses OpenAI gpt-4o-mini with MySportsFeeds injury data
 * 
 * This is a standalone function that can be called directly without HTTP requests
 */

import { fetchPlayerInjuriesForTeams } from '@/lib/data-sources/mysportsfeeds-api'
import { getTeamAbbrev } from '@/lib/data-sources/team-mappings'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'

export interface BoldPredictionsInput {
  game: {
    away_team: string
    home_team: string
    game_date: string
  }
  predictedValue: number  // predicted_total for TOTAL, predicted_margin for SPREAD
  marketLine: number      // market_total for TOTAL, market_spread for SPREAD
  confidence: number      // 0-10 scale
  factors: any[]          // factor_contributions array
  betType: 'TOTAL' | 'SPREAD'
  selection: string       // "OVER 223.5" or "Lakers -2.5"
  injuryData?: any        // Optional pre-fetched injury data
}

export interface BoldPredictionsResult {
  bold_predictions: {
    predictions: Array<{
      player: string
      team: string
      prediction: string
      reasoning: string
      confidence: 'HIGH' | 'MEDIUM' | 'LOW'
    }>
    summary: string
  } | null
  injury_summary: any
}

/**
 * Generate bold player predictions using OpenAI
 */
export async function generateBoldPredictions(input: BoldPredictionsInput): Promise<BoldPredictionsResult> {
  const startTime = Date.now()

  try {
    console.log('[BoldPredictions] Starting generation:', {
      betType: input.betType,
      selection: input.selection,
      confidence: input.confidence
    })

    // Fetch injury data if not provided
    let injuryData = input.injuryData
    if (!injuryData) {
      try {
        const gameDate = formatDateForAPI(new Date(input.game.game_date))
        const awayAbbrev = getTeamAbbrev(input.game.away_team)
        const homeAbbrev = getTeamAbbrev(input.game.home_team)

        console.log('[BoldPredictions] Fetching injury data:', {
          gameDate,
          teams: [awayAbbrev, homeAbbrev]
        })

        injuryData = await fetchPlayerInjuriesForTeams(gameDate, [awayAbbrev, homeAbbrev])

        console.log('[BoldPredictions] Injury data fetched:', {
          totalPlayers: injuryData.players?.length || 0,
          injuredPlayers: injuryData.players?.filter((p: any) => p.currentInjury).length || 0
        })
      } catch (injuryError) {
        console.warn('[BoldPredictions] Failed to fetch injury data:', {
          error: injuryError instanceof Error ? injuryError.message : String(injuryError)
        })
      }
    }

    // Format injury context
    let injuryContext = 'No significant injuries reported.'
    if (injuryData && injuryData.players && injuryData.players.length > 0) {
      const injured = injuryData.players.filter((p: any) => p.currentInjury)
      if (injured.length > 0) {
        injuryContext = injured.map((p: any) => {
          const name = `${p.player.firstName} ${p.player.lastName}`
          const team = p.currentTeam?.abbreviation || 'Unknown'
          const status = p.currentInjury.description || 'Injured'
          return `- ${name} (${team}): ${status}`
        }).join('\n')
      }
    }

    // Format factor analysis
    const factorsSummary = input.factors.map((f: any) => {
      const label = f.label || f.name || 'Unknown Factor'
      const impact = f.weighted_contribution || f.impact || 0
      return `${label}: ${impact > 0 ? '+' : ''}${impact.toFixed(1)}`
    }).join(', ')

    // Generate AI prompt based on bet type
    let aiPrompt = ''

    if (input.betType === 'TOTAL') {
      const edge = Math.abs(input.predictedValue - input.marketLine)
      const pickDirection = input.selection.split(' ')[0] // "OVER" or "UNDER"

      aiPrompt = `You are an expert NBA analyst specializing in player performance predictions.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Predicted Total: ${input.predictedValue.toFixed(1)} points
- Market Total: ${input.marketLine} points
- Pick Direction: ${pickDirection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Edge: ${edge.toFixed(1)} points

KEY FACTORS ANALYSIS:
${factorsSummary}

INJURY REPORT:
${injuryContext}

TASK:
Generate 2-4 BOLD player predictions that SUPPORT our ${pickDirection} prediction.

CRITICAL: Your predictions MUST align with the ${pickDirection} pick. DO NOT predict outcomes that would contradict this pick.

PREDICTION CRITERIA:
- If OVER: Focus on players likely to EXCEED their season averages (high scoring, efficient shooting, fast pace)
- If UNDER: Focus on players likely to UNDERPERFORM their season averages (defensive struggles, poor shooting, slow pace)

REQUIREMENTS:
1. Each prediction must be SPECIFIC and MEASURABLE
2. Predictions MUST SUPPORT our ${pickDirection} pick
3. Include confidence level (HIGH, MEDIUM, LOW)
4. Provide clear reasoning based on data

EXAMPLES:
For OVER 223.5 pick:
✅ "Luka Doncic will score 35+ points and dish 10+ assists" (supports OVER)
❌ "Luka Doncic will struggle to 18 points on poor shooting" (contradicts OVER)

For UNDER 223.5 pick:
✅ "Both teams will shoot under 42% from the field due to elite defense" (supports UNDER)
❌ "Steph Curry will explode for 45 points on 10 threes" (contradicts UNDER)

Return ONLY valid JSON in this exact format:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Why this is likely based on data/matchup",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "summary": "Brief summary of how these predictions support the ${pickDirection} pick"
}`
    } else {
      // SPREAD predictions
      const edge = Math.abs(input.predictedValue - input.marketLine)
      
      aiPrompt = `You are an expert NBA analyst specializing in player performance predictions.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Predicted Margin: ${input.predictedValue.toFixed(1)} points
- Market Spread: ${input.marketLine}
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Edge: ${edge.toFixed(1)} points

KEY FACTORS ANALYSIS:
${factorsSummary}

INJURY REPORT:
${injuryContext}

TASK:
Generate 2-4 BOLD player predictions that SUPPORT our ${input.selection} pick.

CRITICAL: Your predictions MUST align with the ${input.selection} pick. DO NOT predict outcomes that would contradict this pick.

REQUIREMENTS:
1. Each prediction must be SPECIFIC and MEASURABLE
2. Predictions MUST SUPPORT our ${input.selection} pick
3. Include confidence level (HIGH, MEDIUM, LOW)
4. Provide clear reasoning based on data

Return ONLY valid JSON in this exact format:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Why this is likely based on data/matchup",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "summary": "Brief summary of how these predictions support the pick"
}`
    }

    // Call OpenAI API directly
    console.log('[BoldPredictions] Calling OpenAI API...')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert NBA analyst specializing in player performance predictions. You provide specific, measurable predictions that align with the overall game prediction. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const boldPredictions = JSON.parse(data.choices[0].message.content)

    console.log('[BoldPredictions] Generated successfully:', {
      predictionCount: boldPredictions.predictions?.length || 0,
      latencyMs: Date.now() - startTime
    })

    return {
      bold_predictions: boldPredictions,
      injury_summary: injuryData
    }

  } catch (error) {
    console.error('[BoldPredictions] Error generating predictions:', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime
    })

    // Return null on error
    return {
      bold_predictions: null,
      injury_summary: null
    }
  }
}

