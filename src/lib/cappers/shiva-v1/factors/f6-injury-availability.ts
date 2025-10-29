/**
 * F6: Key Injuries & Availability - Totals Factor
 *
 * AI-powered analysis of key player injuries and availability.
 * Merges MySportsFeeds official injury data with web search results.
 * Considers impact on scoring, team performance, and game flow.
 * Max Points: 5.0
 */

import { FactorComputation } from '@/types/factors'
import { RunCtx } from './types'
import { searchInjuries } from '../news'
import { mergeInjuryData, formatMergedDataForAI } from './injury-data-merger'
import type { MergedInjuryData, AIInjuryAnalysis } from '@/lib/data-sources/types/player-injury'

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
  mergedData: MergedInjuryData
  meta: {
    awayImpact: number
    homeImpact: number
    totalImpact: number
    keyInjuries: string[]
    reasoning: string
    dataSourcesUsed: string[]
  }
}

/**
 * AI-powered injury analysis using Perplexity or OpenAI
 * Merges MySportsFeeds official data with web search results
 * Returns a score from -10 to +10 based on injury impact on scoring
 */
export async function analyzeInjuriesWithAI(input: InjuryAnalysisInput, provider: 'perplexity' | 'openai' = 'perplexity'): Promise<InjuryAnalysisOutput> {
  const { awayTeam, homeTeam, gameDate, sport } = input
  const startTime = Date.now()

  console.log('[Injury AI] Starting injury analysis...')
  console.log(`[Injury AI] Teams: ${awayTeam} @ ${homeTeam}`)
  console.log(`[Injury AI] Provider: ${provider}`)

  try {
    // STEP 1: Search for recent injury news (48 hour window)
    console.log('[Injury AI] Step 1: Fetching web search injury news...')
    const injuryNews = await searchInjuries(awayTeam, homeTeam, 48)

    // STEP 2: Merge MySportsFeeds data with web search
    console.log('[Injury AI] Step 2: Merging MySportsFeeds data with web search...')
    const mergedData = await mergeInjuryData(awayTeam, homeTeam, injuryNews)

    console.log(`[Injury AI] Merged data: ${mergedData.awayTeam.injuredPlayers.length} away injuries, ${mergedData.homeTeam.injuredPlayers.length} home injuries`)
    console.log(`[Injury AI] Data sources: ${mergedData.dataSourcesUsed.join(', ')}`)

    // Check if there are any injuries at all
    const hasInjuries = mergedData.awayTeam.injuredPlayers.length > 0 ||
                        mergedData.homeTeam.injuredPlayers.length > 0 ||
                        mergedData.recentNews.length > 0

    if (!hasInjuries) {
      console.log('[Injury AI] No injuries found - returning neutral impact')
      return {
        overScore: 0,
        underScore: 0,
        signal: 0,
        mergedData,
        meta: {
          awayImpact: 0,
          homeImpact: 0,
          totalImpact: 0,
          keyInjuries: [],
          reasoning: 'No injured players found for either team',
          dataSourcesUsed: mergedData.dataSourcesUsed
        }
      }
    }

    // STEP 3: Format merged data for AI prompt
    console.log('[Injury AI] Step 3: Formatting data for AI analysis...')
    const formattedData = formatMergedDataForAI(mergedData)

    // STEP 4: Enhanced AI prompt with MySportsFeeds data
    const analysisPrompt = `
Analyze injury impact for ${sport} game: ${awayTeam} (away) @ ${homeTeam} (home) on ${gameDate}

**OFFICIAL INJURY DATA (MySportsFeeds STATS Addon):**
${formattedData}

**ANALYSIS INSTRUCTIONS:**
Provide a JSON response with this exact structure:
{
  "awayImpact": -10 to +10 (negative = hurts scoring, positive = helps scoring),
  "homeImpact": -10 to +10 (negative = hurts scoring, positive = helps scoring),
  "keyInjuries": ["Player Name (Position, PPG, Status, Impact)"],
  "reasoning": "Detailed explanation of scoring impact",
  "confidence": "low" | "medium" | "high"
}

**SCORING GUIDELINES FOR TOTALS BETTING:**

**Offensive Player Injuries (NEGATIVE impact on scoring):**
- Star player (25+ PPG) OUT: -7 to -8 impact
- All-star (20-25 PPG) OUT: -5 to -6 impact
- Key contributor (15-20 PPG) OUT: -3 to -4 impact
- Role player (10-15 PPG) OUT: -2 to -3 impact
- Bench player (<10 PPG) OUT: -1 to -2 impact

**Defensive Player Injuries (POSITIVE impact on scoring):**
- Elite rim protector OUT: +4 to +5 impact (easier to score inside)
- DPOY candidate OUT: +3 to +4 impact
- Above-average defender OUT: +2 to +3 impact
- Average defender OUT: +1 to +2 impact

**Status Adjustments:**
- OUT: 100% of impact (no adjustment)
- DOUBTFUL: 75% of impact
- QUESTIONABLE: 50% of impact
- PROBABLE: 25% of impact

**Multiple Injuries:**
- 2+ key players injured: multiply total impact by 1.3x (depth concerns)
- 3+ key players injured: multiply total impact by 1.5x (severe depth issues)

**Special Considerations:**
1. Pace impact: Injuries often slow down games (subtract 1-2 points for pace reduction)
2. Replacement quality: Consider who replaces the injured player
3. Recent vs long-term: Recent injuries have more uncertainty
4. Team performance without player: Check if team has adapted

**CRITICAL RULES:**
- Focus ONLY on ${awayTeam} and ${homeTeam} injuries
- Ignore injuries from other teams
- Consider both offensive AND defensive impact
- Explain your reasoning clearly
- Be conservative with impact scores

Return ONLY the JSON, no other text.
`

    // STEP 5: Call AI provider
    console.log('[Injury AI] Step 4: Calling AI provider for analysis...')
    let response: Response

    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are an expert NBA injury analyst specializing in totals betting. Analyze injury data and provide accurate impact scores. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      })
    } else {
      response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert NBA injury analyst specializing in totals betting. Analyze injury data and provide accurate impact scores. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        })
      })
    }

    if (!response.ok) {
      throw new Error(`${provider} API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()

    if (!content) {
      throw new Error(`No content returned from ${provider}`)
    }

    console.log('[Injury AI] Step 5: Parsing AI response...')

    // Parse JSON response
    const analysis = JSON.parse(content) as AIInjuryAnalysis

    // Validate and clamp impact scores
    const awayImpact = Math.max(-10, Math.min(10, analysis.awayImpact || 0))
    const homeImpact = Math.max(-10, Math.min(10, analysis.homeImpact || 0))
    const totalImpact = (awayImpact + homeImpact) / 2

    console.log(`[Injury AI] AI Analysis: Away=${awayImpact}, Home=${homeImpact}, Total=${totalImpact.toFixed(1)}`)
    console.log(`[Injury AI] Key Injuries: ${analysis.keyInjuries?.length || 0}`)
    console.log(`[Injury AI] Confidence: ${analysis.confidence || 'unknown'}`)

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

    const latencyMs = Date.now() - startTime
    console.log(`[Injury AI] Analysis complete in ${latencyMs}ms`)
    console.log(`[Injury AI] Result: signal=${signal.toFixed(2)}, overScore=${overScore.toFixed(2)}, underScore=${underScore.toFixed(2)}`)

    return {
      overScore,
      underScore,
      signal,
      mergedData,
      meta: {
        awayImpact,
        homeImpact,
        totalImpact,
        keyInjuries: analysis.keyInjuries || [],
        reasoning: analysis.reasoning || 'AI analysis completed',
        dataSourcesUsed: mergedData.dataSourcesUsed
      }
    }

  } catch (error) {
    console.error('[Injury AI] ERROR:', error)

    // Try to return partial data if we have merged data
    const fallbackMergedData = await mergeInjuryData(awayTeam, homeTeam).catch(() => null)

    // Return neutral impact on error
    return {
      overScore: 0,
      underScore: 0,
      signal: 0,
      mergedData: fallbackMergedData || {
        awayTeam: { teamName: awayTeam, teamAbbrev: '', totalPlayers: 0, injuredPlayers: [], keyPlayers: [], injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'Error' } },
        homeTeam: { teamName: homeTeam, teamAbbrev: '', totalPlayers: 0, injuredPlayers: [], keyPlayers: [], injuryImpact: { severity: 'none', impactScore: 0, reasoning: 'Error' } },
        recentNews: [],
        dataSourcesUsed: [],
        fetchedAt: new Date().toISOString()
      },
      meta: {
        awayImpact: 0,
        homeImpact: 0,
        totalImpact: 0,
        keyInjuries: [],
        reasoning: `Error in AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dataSourcesUsed: []
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
 * Enhanced with MySportsFeeds data integration
 */
export async function computeInjuryAvailabilityAsync(
  ctx: RunCtx,
  provider: 'perplexity' | 'openai' = 'perplexity',
  gameDate?: string
): Promise<FactorComputation> {
  console.log('[INJURY_AVAILABILITY] Starting async computation...')
  console.log(`[INJURY_AVAILABILITY] Teams: ${ctx.away} @ ${ctx.home}`)
  console.log(`[INJURY_AVAILABILITY] Provider: ${provider}`)

  try {
    // Use provided game date or default to today
    const analysisDate = gameDate || new Date().toISOString().split('T')[0]

    const analysis = await analyzeInjuriesWithAI({
      awayTeam: ctx.away,
      homeTeam: ctx.home,
      gameDate: analysisDate,
      sport: ctx.sport
    }, provider)

    console.log('[INJURY_AVAILABILITY] Analysis complete')
    console.log(`[INJURY_AVAILABILITY] Signal: ${analysis.signal.toFixed(2)}`)
    console.log(`[INJURY_AVAILABILITY] Data sources: ${analysis.meta.dataSourcesUsed.join(', ')}`)

    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Totals',
      normalized_value: analysis.signal,
      raw_values_json: {
        awayImpact: analysis.meta.awayImpact,
        homeImpact: analysis.meta.homeImpact,
        totalImpact: analysis.meta.totalImpact,
        keyInjuries: analysis.meta.keyInjuries,
        reasoning: analysis.meta.reasoning,
        dataSourcesUsed: analysis.meta.dataSourcesUsed,
        awayInjuredCount: analysis.mergedData.awayTeam.injuredPlayers.length,
        homeInjuredCount: analysis.mergedData.homeTeam.injuredPlayers.length,
        awayInjurySeverity: analysis.mergedData.awayTeam.injuryImpact.severity,
        homeInjurySeverity: analysis.mergedData.homeTeam.injuryImpact.severity
      },
      parsed_values_json: {
        overScore: analysis.overScore,
        underScore: analysis.underScore,
        signal: analysis.signal,
        awayContribution: analysis.meta.awayImpact,
        homeContribution: analysis.meta.homeImpact,
        awayImpact: analysis.meta.awayImpact,
        homeImpact: analysis.meta.homeImpact,
        totalImpact: analysis.meta.totalImpact,
        keyInjuries: analysis.meta.keyInjuries,
        reasoning: analysis.meta.reasoning
      },
      caps_applied: Math.abs(analysis.signal) >= 0.99,
      cap_reason: Math.abs(analysis.signal) >= 0.99 ? 'Signal saturated at max impact' : null,
      notes: `${analysis.meta.dataSourcesUsed.join(' + ')} | ${analysis.meta.keyInjuries.length} key injuries | ${analysis.meta.reasoning.substring(0, 100)}...`
    }

  } catch (error) {
    console.error('[INJURY_AVAILABILITY] ERROR:', error)

    return {
      factor_no: 6,
      key: 'injuryAvailability',
      name: 'Key Injuries & Availability - Totals',
      normalized_value: 0,
      raw_values_json: {
        awayImpact: 0,
        homeImpact: 0,
        totalImpact: 0,
        keyInjuries: [],
        reasoning: 'AI analysis failed',
        dataSourcesUsed: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      parsed_values_json: {
        overScore: 0,
        underScore: 0,
        signal: 0,
        awayContribution: 0,
        homeContribution: 0,
        awayImpact: 0,
        homeImpact: 0,
        totalImpact: 0,
        keyInjuries: [],
        reasoning: 'AI analysis failed'
      },
      caps_applied: false,
      cap_reason: 'AI analysis error',
      notes: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
