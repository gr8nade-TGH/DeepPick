/**
 * F6: Key Injuries & Availability - Totals Factor
 * 
 * AI-powered analysis of key player injuries and availability.
 * Considers impact on scoring, team performance, and game flow.
 * Max Points: 2.0
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx } from './types'
import { searchInjuries } from '../news'

export interface InjuryAnalysisInput {
  awayTeam: string
  homeTeam: string
  gameDate: string
  sport: string
}

export interface InjuryAnalysisOutput {
  overScore: number
  underScore: number
  signal: number
  meta: {
    awayImpact: number
    homeImpact: number
    totalImpact: number
    keyInjuries: string[]
    reasoning: string
  }
}

/**
 * AI-powered injury analysis using Perplexity
 * Returns a score from -10 to +10 based on injury impact on scoring
 */
export async function analyzeInjuriesWithAI(input: InjuryAnalysisInput): Promise<InjuryAnalysisOutput> {
  const { awayTeam, homeTeam, gameDate, sport } = input
  
  try {
    // Search for recent injury news (48 hour window)
    const injuryData = await searchInjuries(awayTeam, homeTeam, 48)
    
    if (!injuryData || !injuryData.ok || injuryData.findings.length === 0) {
      // No injury data found - neutral impact
      return {
        overScore: 0,
        underScore: 0,
        signal: 0,
        meta: {
          awayImpact: 0,
          homeImpact: 0,
          totalImpact: 0,
          keyInjuries: [],
          reasoning: 'No recent injury data found'
        }
      }
    }

    // Use Perplexity to analyze injury impact
    const analysisPrompt = `
Analyze the following injury data for a ${sport} game between ${awayTeam} (away) and ${homeTeam} (home) on ${gameDate}.

Injury Data: ${JSON.stringify(injuryData.findings, null, 2)}

Please provide a JSON response with this exact structure:
{
  "awayImpact": -10 to +10 (negative = hurts scoring, positive = helps scoring),
  "homeImpact": -10 to +10 (negative = hurts scoring, positive = helps scoring),
  "keyInjuries": ["list of key player injuries affecting the game"],
  "reasoning": "brief explanation of how injuries affect scoring potential"
}

Consider:
1. Are key offensive players out? (star players, top scorers, playmakers)
2. Are key defensive players out? (elite defenders, rim protectors, shutdown corners)
3. How long have they been out? (recent vs long-term)
4. How has the team performed without them? (scoring trends)
5. Are there multiple injuries creating depth issues?
6. Do injuries affect pace of play? (injured players often slow down games)
7. Are there any "questionable" players that might not be 100%?

For TOTALS betting, focus on scoring impact:
- Missing star offensive players = lower totals (negative impact)
- Missing key defensive players = higher totals (positive impact)
- Multiple injuries = compound effect
- Recent injuries = more impact than long-term ones
- Depth issues = affects bench scoring

Return ONLY the JSON, no other text.
`

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()
    
    if (!content) {
      throw new Error('No content returned from Perplexity')
    }

    // Parse JSON response
    const analysis = JSON.parse(content)
    
    // Validate and clamp impact scores
    const awayImpact = Math.max(-10, Math.min(10, analysis.awayImpact || 0))
    const homeImpact = Math.max(-10, Math.min(10, analysis.homeImpact || 0))
    const totalImpact = (awayImpact + homeImpact) / 2
    
    // Convert to our signal format (-1 to +1)
    const signal = Math.max(-1, Math.min(1, totalImpact / 10))
    
    // Convert to single positive scores
    let overScore = 0
    let underScore = 0
    
    if (signal > 0) {
      // Positive signal favors Over (injuries help scoring)
      overScore = Math.abs(signal) * 5.0 // Max 5.0 points
    } else if (signal < 0) {
      // Negative signal favors Under (injuries hurt scoring)
      underScore = Math.abs(signal) * 5.0 // Max 5.0 points
    }

    return {
      overScore,
      underScore,
      signal,
      meta: {
        awayImpact,
        homeImpact,
        totalImpact,
        keyInjuries: analysis.keyInjuries || [],
        reasoning: analysis.reasoning || 'AI analysis completed'
      }
    }

  } catch (error) {
    console.error('[INJURY_AI:ERROR]', error)
    
    // Return neutral impact on error
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      meta: {
        awayImpact: 0,
        homeImpact: 0,
        totalImpact: 0,
        keyInjuries: [],
        reasoning: `Error in AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

/**
 * Compute F6: Key Injuries & Availability - Totals
 */
export function computeInjuryAvailability(bundle: any, ctx: RunCtx): FactorComputation {
  // This is a placeholder - the real implementation will be async
  // and will be called from the orchestrator
  return {
    factor_no: 6,
    key: 'injuryAvailability',
    name: 'Key Injuries & Availability - Totals',
    normalized_value: 0,
    raw_values_json: {},
    parsed_values_json: {
      overScore: 0,
      underScore: 0,
      awayContribution: 0,
      homeContribution: 0
    },
    caps_applied: false,
    cap_reason: null,
    notes: 'AI analysis pending - will be computed asynchronously'
  }
}

/**
 * Async version for use in orchestrator
 */
export async function computeInjuryAvailabilityAsync(ctx: RunCtx): Promise<FactorComputation> {
  try {
    // Get game date from context (you'll need to pass this in)
    const gameDate = new Date().toISOString().split('T')[0] // Default to today
    
    const analysis = await analyzeInjuriesWithAI({
      awayTeam: ctx.away,
      homeTeam: ctx.home,
      gameDate,
      sport: ctx.sport
    })

    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Totals',
      normalized_value: analysis.signal,
      raw_values_json: {
        awayImpact: analysis.meta.awayImpact,
        homeImpact: analysis.meta.homeImpact,
        keyInjuries: analysis.meta.keyInjuries,
        reasoning: analysis.meta.reasoning
      },
      parsed_values_json: {
        overScore: analysis.overScore,
        underScore: analysis.underScore,
        awayContribution: analysis.overScore / 2, // Split evenly
        homeContribution: analysis.overScore / 2,
        awayImpact: analysis.meta.awayImpact,
        homeImpact: analysis.meta.homeImpact,
        keyInjuries: analysis.meta.keyInjuries,
        reasoning: analysis.meta.reasoning
      },
      caps_applied: false,
      cap_reason: null,
      notes: `AI Analysis: ${analysis.meta.reasoning} (${analysis.meta.keyInjuries.length} key injuries)`
    }

  } catch (error) {
    console.error('[INJURY_AVAILABILITY:ERROR]', error)
    
    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Totals',
      normalized_value: 0,
      raw_values_json: {
        awayImpact: 0,
        homeImpact: 0,
        keyInjuries: [],
        reasoning: 'AI analysis failed'
      },
      parsed_values_json: {
        overScore: 0,
        underScore: 0,
        awayContribution: 0,
        homeContribution: 0,
        awayImpact: 0,
        homeImpact: 0,
        keyInjuries: [],
        reasoning: 'AI analysis failed'
      },
      caps_applied: false,
      cap_reason: 'AI analysis error',
      notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
