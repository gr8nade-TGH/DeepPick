/**
 * Professional Analysis Generator
 * 
 * Generates AI-powered professional betting analysis for SHIVA picks
 * Uses OpenAI gpt-4o-mini with MySportsFeeds injury data
 */

import { fetchPlayerInjuriesForTeams } from '@/lib/data-sources/mysportsfeeds-api'
import { getTeamAbbrev } from '@/lib/data-sources/team-mappings'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'

export interface AnalysisInput {
  game: {
    away_team: string
    home_team: string
    game_date: string
  }
  predictedValue: number  // predicted_total for TOTAL, predicted_margin for SPREAD
  marketLine: number      // market_total for TOTAL, market_spread for SPREAD
  confidence: number      // 0-10 scale
  units: number
  factors: any[]          // factor_contributions array
  betType: 'TOTAL' | 'SPREAD'
  selection: string       // "OVER 223.5" or "Lakers -2.5"
  injuryData?: any        // Optional pre-fetched injury data
}

/**
 * Generate professional analysis using OpenAI
 */
export async function generateProfessionalAnalysis(input: AnalysisInput): Promise<string> {
  const startTime = Date.now()
  
  try {
    console.log('[ProfessionalAnalysis] Starting generation:', {
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
        
        injuryData = await fetchPlayerInjuriesForTeams(gameDate, [awayAbbrev, homeAbbrev])
      } catch (injuryError) {
        console.warn('[ProfessionalAnalysis] Failed to fetch injury data:', {
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
    const factorBreakdown = input.factors.map((f: any) => {
      const label = f.label || f.name || 'Unknown Factor'
      const impact = f.weighted_contribution || f.impact || 0
      return `- ${label}: ${impact > 0 ? '+' : ''}${impact.toFixed(1)} points`
    }).join('\n')

    // Generate AI prompt based on bet type
    let aiPrompt = ''
    
    if (input.betType === 'TOTAL') {
      const edge = Math.abs(input.predictedValue - input.marketLine)
      const direction = input.predictedValue > input.marketLine ? 'higher' : 'lower'
      
      aiPrompt = `You are a professional sports betting analyst writing a detailed game analysis for a premium betting service.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Market Total: ${input.marketLine} points
- Our Predicted Total: ${input.predictedValue.toFixed(1)} points
- Edge: ${edge.toFixed(1)} points ${direction}
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Units: ${input.units}

FACTOR ANALYSIS:
${factorBreakdown}

INJURY REPORT:
${injuryContext}

TASK:
Write a professional 3-4 paragraph analysis explaining this pick to a sophisticated betting audience.

STRUCTURE:

Paragraph 1 - MARKET EDGE:
- Lead with our edge (${edge.toFixed(1)} points ${direction})
- Explain why the market is mispriced
- Reference confidence level and unit allocation

Paragraph 2 - FACTOR ANALYSIS:
- Highlight the 2-3 most impactful factors
- Use specific data points (pace, efficiency, recent trends)
- Explain how factors combine to support the pick

Paragraph 3 - INJURY & CONTEXT:
- Discuss key injuries and their impact
- Mention recent team form (winning/losing streaks)
- Note any scheduling advantages (rest, travel)

Paragraph 4 - CONCLUSION:
- Summarize the thesis
- Restate confidence level
- Final recommendation

TONE:
- Professional and analytical (not hype or salesy)
- Data-driven (cite specific stats and trends)
- Confident but measured (acknowledge risks)
- Avoid clichés ("lock of the day", "can't miss")

LENGTH: 200-300 words

Return ONLY the analysis text (no JSON, no formatting).`
    } else if (input.betType === 'SPREAD') {
      const edge = Math.abs(input.predictedValue)
      
      aiPrompt = `You are a professional sports betting analyst writing a detailed game analysis for a premium betting service.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Market Spread: ${input.marketLine}
- Our Predicted Margin: ${input.predictedValue.toFixed(1)} points
- Edge: ${edge.toFixed(1)} points
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Units: ${input.units}

FACTOR ANALYSIS:
${factorBreakdown}

INJURY REPORT:
${injuryContext}

TASK:
Write a professional 3-4 paragraph analysis explaining this spread pick to a sophisticated betting audience.

STRUCTURE:

Paragraph 1 - MARKET EDGE:
- Lead with our edge (${edge.toFixed(1)} points)
- Explain why we favor ${input.selection}
- Reference confidence level and unit allocation

Paragraph 2 - MATCHUP ANALYSIS:
- Highlight the 2-3 most impactful factors
- Discuss offensive/defensive advantages
- Use specific data points (efficiency, pace, recent form)

Paragraph 3 - INJURY & CONTEXT:
- Discuss key injuries and their impact on the spread
- Mention recent team form and momentum
- Note any scheduling advantages (rest, travel, home/away splits)

Paragraph 4 - CONCLUSION:
- Summarize why ${input.selection} covers the spread
- Restate confidence level
- Final recommendation

TONE:
- Professional and analytical (not hype or salesy)
- Data-driven (cite specific stats and trends)
- Confident but measured (acknowledge risks)
- Avoid clichés ("lock of the day", "can't miss")

LENGTH: 200-300 words

Return ONLY the analysis text (no JSON, no formatting).`
    }

    // Call OpenAI API
    console.log('[ProfessionalAnalysis] Calling OpenAI API...')
    
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
            content: 'You are a professional sports betting analyst. Write clear, data-driven analysis without hype or clichés.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const aiResponse = await response.json()
    const analysis = aiResponse.choices?.[0]?.message?.content

    if (!analysis) {
      throw new Error('No content in AI response')
    }

    console.log('[ProfessionalAnalysis] Analysis generated successfully:', {
      length: analysis.length,
      latencyMs: Date.now() - startTime
    })

    return analysis.trim()

  } catch (error) {
    console.error('[ProfessionalAnalysis] Error generating analysis:', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime
    })

    // Fallback to template-based analysis
    return generateFallbackAnalysis(input)
  }
}

/**
 * Fallback template-based analysis if OpenAI fails
 */
function generateFallbackAnalysis(input: AnalysisInput): string {
  const confidenceTier = input.confidence >= 7.0 ? 'high' : input.confidence >= 5.0 ? 'moderate' : 'developing'
  const actionVerb = input.confidence >= 7.0 ? 'recommend' : 'identify value in'
  
  if (input.betType === 'TOTAL') {
    const edge = Math.abs(input.predictedValue - input.marketLine)
    const edgeDirection = input.predictedValue > input.marketLine ? 'higher' : 'lower'
    
    return `Our advanced analytics model has identified ${confidenceTier} value on ${input.selection} in the ${input.game.away_team} at ${input.game.home_team} matchup. The model projects a total of ${input.predictedValue.toFixed(1)} points, which is ${edge.toFixed(1)} points ${edgeDirection} than the current market line. This ${edge.toFixed(1)}-point edge represents a market inefficiency that we ${actionVerb}. With a confidence score of ${input.confidence.toFixed(1)}/10.0, this represents a ${confidenceTier}-conviction play in our betting model.`
  } else {
    const edge = Math.abs(input.predictedValue)
    
    return `Our advanced analytics model has identified ${confidenceTier} value on ${input.selection} in the ${input.game.away_team} at ${input.game.home_team} matchup. The model's predicted point differential represents a ${edge.toFixed(1)}-point edge over the current market spread. This edge represents a market inefficiency that we ${actionVerb}. With a confidence score of ${input.confidence.toFixed(1)}/10.0, this represents a ${confidenceTier}-conviction play in our spread betting model.`
  }
}

