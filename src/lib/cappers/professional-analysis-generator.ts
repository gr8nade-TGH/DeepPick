/**
 * Professional Analysis Generator
 * 
 * Generates AI-powered professional betting analysis for SHIVA picks
 * Uses OpenAI gpt-4o-mini with MySportsFeeds injury data
 */

import { fetchPlayerInjuriesForTeams } from '@/lib/data-sources/mysportsfeeds-api'
import { getTeamAbbrev } from '@/lib/data-sources/team-mappings'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'

export interface TeamStats {
  pace: number
  offensiveRating: number
  defensiveRating: number
  netRating: number
  threePointPct: number
  threePointPctDefense?: number  // Opponent 3P% allowed
  turnovers: number
  turnoversForced?: number
}

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
  teamStats?: {           // NEW: Actual team stats to prevent AI hallucination
    away: TeamStats
    home: TeamStats
  }
  totalEdge?: {           // NEW: Total edge analysis for SPREAD picks
    predicted_total: number
    market_total: number
    total_edge: number
    implication: 'OVER' | 'UNDER'
  }
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

      aiPrompt = `You are an elite sports betting analyst writing a comprehensive game breakdown for a premium analytics service. Your analysis will be reviewed post-game against actual results, so accuracy and depth matter more than speed.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Market Total: ${input.marketLine} points
- Our Predicted Total: ${input.predictedValue.toFixed(1)} points
- Edge: ${edge.toFixed(1)} points ${direction}
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Units: ${input.units}

FACTOR ANALYSIS (Our Proprietary Model):
${factorBreakdown}

INJURY REPORT:
${injuryContext}

TASK:
Write a detailed, bullet-point analysis that demonstrates deep research and creative analytical thinking. This analysis will later be compared against the actual game result, so be specific about your reasoning.

REQUIRED FORMAT (Use bullet points throughout):

**🎯 THE THESIS**
• State our edge (${edge.toFixed(1)} points ${direction} than market)
• Explain the core market inefficiency we're exploiting
• Why this specific total is mispriced

**📊 FACTOR DEEP DIVE**
• Analyze the 2-3 most impactful factors from our model
• For each factor, explain:
  - What specific trend/stat/matchup it captures
  - Why it matters for this specific game
  - How it interacts with other factors
• Connect the dots between factors (e.g., "pace advantage + defensive weakness = scoring explosion")
• Use concrete numbers and percentages where possible

**🏥 INJURY & LINEUP IMPACT**
• Analyze how injuries affect pace, efficiency, and scoring
• Discuss rotation changes and their ripple effects
• Consider both direct impact (missing scorer) and indirect (defensive adjustments, usage changes)

**🔍 CONTEXTUAL FACTORS**
• Recent form and momentum (focus on team performance trends)
• Schedule spot and rest factors (if known)
• Home/away splits and venue factors
• Stylistic matchups and pace dynamics
• Motivation factors (playoff race, rivalry)

⚠️ CRITICAL RESTRICTIONS - DO NOT CITE UNLESS PROVIDED:
• DO NOT cite specific ATS records (e.g., "7-3 ATS last 10") unless provided in data above
• DO NOT cite specific head-to-head records (e.g., "won 7 of last 10 meetings") unless provided
• DO NOT cite specific travel narratives (e.g., "coming off 3-game road trip") unless provided
• DO NOT cite specific rest advantages (e.g., "3 days rest vs 1 day") unless provided
• DO NOT reference specific players by name unless they appear in the INJURY REPORT above
• ROSTER VALIDATION: Only mention players who are confirmed on the current roster via injury data
• If you don't have the data, focus on the factors we DO have (team stats, injuries, efficiency metrics)

**⚖️ RISK ASSESSMENT**
• What could go wrong with this pick?
• Which factors are most uncertain?
• What would need to happen for the opposite outcome?

**💡 FINAL VERDICT**
• Synthesize all factors into a clear conclusion
• Restate confidence level with justification
• Specific prediction: "We project a final score of approximately [X-Y], landing [OVER/UNDER] the ${input.marketLine} total"

CRITICAL REQUIREMENTS:
- Use bullet points for ALL sections (no paragraphs)
- Be specific with numbers, percentages, and data points from the ACTUAL TEAM STATISTICS provided
- Show creative analytical thinking (connect dots others miss)
- Quality over speed - take time to think deeply
- Avoid generic statements - every point should be specific to THIS game
- No clichés or hype language
- This will be reviewed against actual results, so be precise
- DO NOT hallucinate ATS records, H2H records, travel data, or rest advantages

LENGTH: 400-600 words (prioritize quality over brevity)

Return ONLY the bullet-point analysis (no JSON, no extra formatting).`
    } else if (input.betType === 'SPREAD') {
      const edge = Math.abs(input.predictedValue)
      const favoredTeam = input.selection.includes(input.game.home_team) ? input.game.home_team : input.game.away_team

      // Format total edge section (if available)
      let totalEdgeSection = ''
      if (input.totalEdge && Math.abs(input.totalEdge.total_edge) > 5) {
        totalEdgeSection = `
TOTAL EDGE ANALYSIS:
- Our Predicted Total: ${input.totalEdge.predicted_total.toFixed(1)} points
- Market Total Line: ${input.totalEdge.market_total.toFixed(1)} points
- Total Edge: ${input.totalEdge.total_edge.toFixed(1)} points (${input.totalEdge.implication} lean)
${Math.abs(input.totalEdge.total_edge) > 10 ? '- ⚠️ LARGE DISCREPANCY: This suggests a strong secondary angle on the total' : ''}

NOTE: While this is a SPREAD pick, the large total discrepancy may indicate game script implications (pace, blowout risk, etc.)
`
      }

      // Format team stats section (if available)
      let teamStatsSection = ''
      if (input.teamStats) {
        const { away, home } = input.teamStats
        teamStatsSection = `
ACTUAL TEAM STATISTICS (Last 10 Games):
${input.game.away_team}:
- Offensive Rating: ${away.offensiveRating.toFixed(1)} (points per 100 possessions)
- Defensive Rating: ${away.defensiveRating.toFixed(1)} (points allowed per 100 possessions)
- Net Rating: ${away.netRating.toFixed(1)} (ORtg - DRtg)
- Pace: ${away.pace.toFixed(1)} possessions per game
- 3-Point Shooting: ${(away.threePointPct * 100).toFixed(1)}%${away.threePointPctDefense ? ` | Defense allows ${(away.threePointPctDefense * 100).toFixed(1)}%` : ''}
- Turnovers: ${away.turnovers.toFixed(1)} per game${away.turnoversForced ? ` | Forces ${away.turnoversForced.toFixed(1)} per game` : ''}

${input.game.home_team}:
- Offensive Rating: ${home.offensiveRating.toFixed(1)} (points per 100 possessions)
- Defensive Rating: ${home.defensiveRating.toFixed(1)} (points allowed per 100 possessions)
- Net Rating: ${home.netRating.toFixed(1)} (ORtg - DRtg)
- Pace: ${home.pace.toFixed(1)} possessions per game
- 3-Point Shooting: ${(home.threePointPct * 100).toFixed(1)}%${home.threePointPctDefense ? ` | Defense allows ${(home.threePointPctDefense * 100).toFixed(1)}%` : ''}
- Turnovers: ${home.turnovers.toFixed(1)} per game${home.turnoversForced ? ` | Forces ${home.turnoversForced.toFixed(1)} per game` : ''}

CRITICAL: Use ONLY the statistics provided above. Do NOT cite any other numbers or rankings.
`
      }

      aiPrompt = `You are an elite sports betting analyst writing a comprehensive game breakdown for a premium analytics service. Your analysis will be reviewed post-game against actual results, so accuracy and depth matter more than speed.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Market Spread: ${input.marketLine}
- Our Predicted Margin: ${input.predictedValue.toFixed(1)} points
- Edge: ${edge.toFixed(1)} points
- Pick: ${input.selection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Units: ${input.units}
${totalEdgeSection}
${teamStatsSection}
FACTOR ANALYSIS (Our Proprietary Model):
${factorBreakdown}

INJURY REPORT:
${injuryContext}

TASK:
Write a detailed, bullet-point analysis that demonstrates deep research and creative analytical thinking. This analysis will later be compared against the actual game result, so be specific about your reasoning.

REQUIRED FORMAT (Use bullet points throughout):

**🎯 THE THESIS**
• State our edge (${edge.toFixed(1)} points)
• Explain why we favor ${input.selection}
• What market inefficiency are we exploiting?

**📊 FACTOR DEEP DIVE**
• Analyze the 2-3 most impactful factors from our model
• For each factor, explain:
  - What specific matchup advantage it captures
  - Why it matters for covering the spread
  - How it interacts with other factors
• Connect offensive/defensive advantages (e.g., "elite perimeter defense vs. three-point dependent offense")
• Use concrete numbers and efficiency metrics

**🏥 INJURY & LINEUP IMPACT**
• How do injuries shift the spread?
• Analyze rotation changes and depth chart implications
• Consider both direct impact (missing star) and indirect (defensive schemes, usage redistribution)
• Which team is more affected by injury situations?

**🔍 CONTEXTUAL FACTORS**
• Recent form and momentum (focus on team performance trends)
• Schedule spot and rest factors (if known)
• Home/away performance and venue factors
• Stylistic matchups and coaching adjustments
• Motivation factors (playoff implications, rivalry intensity)

⚠️ CRITICAL RESTRICTIONS - DO NOT CITE UNLESS PROVIDED:
• DO NOT cite specific ATS records (e.g., "7-3 ATS last 10") unless provided in data above
• DO NOT cite specific head-to-head records (e.g., "won 7 of last 10 meetings") unless provided
• DO NOT cite specific travel narratives (e.g., "coming off 3-game road trip") unless provided
• DO NOT cite specific rest advantages (e.g., "3 days rest vs 1 day") unless provided
• DO NOT reference specific players by name unless they appear in the INJURY REPORT above
• ROSTER VALIDATION: Only mention players who are confirmed on the current roster via injury data
• If you don't have the data, focus on the factors we DO have (team stats, injuries, efficiency metrics)

**⚖️ RISK ASSESSMENT**
• What could prevent ${favoredTeam} from covering?
• Which factors are most uncertain?
• What's the worst-case scenario for this pick?
• How much margin for error do we have?

**💡 FINAL VERDICT**
• Synthesize all factors into a clear conclusion
• Restate confidence level with justification
• Specific prediction: "We project ${favoredTeam} to win by approximately [X] points, comfortably covering the ${input.marketLine} spread"

CRITICAL REQUIREMENTS:
- Use bullet points for ALL sections (no paragraphs)
- **ONLY use statistics provided in the ACTUAL TEAM STATISTICS section above**
- **DO NOT cite any rankings, ATS records, head-to-head records, or travel schedules unless explicitly provided**
- **DO NOT hallucinate or invent any numbers - use ONLY the data given**
- Be specific with the numbers provided (ORtg, DRtg, NetRtg, Pace, 3P%, Turnovers)
- Show creative analytical thinking by connecting the provided stats to matchup advantages
- Quality over speed - take time to think deeply
- Avoid generic statements - every point should be specific to THIS game
- No clichés or hype language
- This will be reviewed against actual results, so be precise

LENGTH: 400-600 words (prioritize quality over brevity)

Return ONLY the bullet-point analysis (no JSON, no extra formatting).`
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
            content: 'You are an elite sports betting analyst with deep expertise in NBA analytics. Your analysis is thorough, data-driven, and creative. You identify market inefficiencies that others miss. Quality and accuracy matter more than speed. Your work will be reviewed against actual game results.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        max_tokens: 1500,  // Increased from 800 to allow for 400-600 word analysis
        temperature: 0.8   // Increased from 0.7 for more creative analytical thinking
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

