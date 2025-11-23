/**
 * Bold Predictions Generator
 * 
 * Generates AI-powered bold player predictions for SHIVA picks
 * Uses OpenAI gpt-4o-mini with MySportsFeeds injury data
 * 
 * This is a standalone function that can be called directly without HTTP requests
 */

import { fetchPlayerInjuriesForTeams } from '@/lib/data-sources/mysportsfeeds-api'
import { fetchTeamPlayerStats } from '@/lib/data-sources/mysportsfeeds-players'
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

    // Fetch real player stats from MySportsFeeds for both teams
    let awayPlayerStats: any[] = []
    let homePlayerStats: any[] = []

    try {
      console.log('[BoldPredictions] Fetching real player stats from MySportsFeeds...')

      const [awayStats, homeStats] = await Promise.all([
        fetchTeamPlayerStats(input.game.away_team),
        fetchTeamPlayerStats(input.game.home_team)
      ])

      awayPlayerStats = awayStats || []
      homePlayerStats = homeStats || []

      console.log('[BoldPredictions] Player stats fetched:', {
        awayPlayers: awayPlayerStats.length,
        homePlayers: homePlayerStats.length,
        totalPlayers: awayPlayerStats.length + homePlayerStats.length
      })
    } catch (statsError) {
      console.error('[BoldPredictions] Failed to fetch player stats:', {
        error: statsError instanceof Error ? statsError.message : String(statsError)
      })
      // Continue without player stats - OpenAI will use its training data as fallback
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

    // Format real player stats from MySportsFeeds
    const formatPlayerStats = (players: any[], teamName: string) => {
      if (!players || players.length === 0) {
        return `No current-season PLAYER stats available for ${teamName} (team-level stats are available in professional analysis)`
      }

      // Get top 5 players by minutes played
      const topPlayers = players
        .filter(p => p.averages && p.averages.avgMinutes > 15) // Only players with significant minutes
        .sort((a, b) => (b.averages?.avgMinutes || 0) - (a.averages?.avgMinutes || 0))
        .slice(0, 5)

      if (topPlayers.length === 0) {
        return `No current-season PLAYER stats available for ${teamName} (team-level stats are available in professional analysis)`
      }

      return topPlayers.map(p => {
        const name = `${p.player.firstName} ${p.player.lastName}`
        const ppg = p.averages.avgPoints?.toFixed(1) || '0.0'
        const rpg = p.averages.avgRebounds?.toFixed(1) || '0.0'
        const apg = p.averages.avgAssists?.toFixed(1) || '0.0'
        const mpg = p.averages.avgMinutes?.toFixed(1) || '0.0'
        const gp = p.stats.gamesPlayed || 0
        return `  ${name}: ${ppg} PPG, ${rpg} RPG, ${apg} APG, ${mpg} MPG (${gp} games)`
      }).join('\n')
    }

    const awayStatsContext = formatPlayerStats(awayPlayerStats, input.game.away_team)
    const homeStatsContext = formatPlayerStats(homePlayerStats, input.game.home_team)

    // Check if we have player stats for at least one team
    const hasAwayStats = awayPlayerStats && awayPlayerStats.length > 0
    const hasHomeStats = homePlayerStats && homePlayerStats.length > 0

    // If no player stats available for either team, return early with helpful message
    if (!hasAwayStats && !hasHomeStats) {
      console.warn('[BoldPredictions] No player stats available for either team - skipping bold predictions')
      return {
        bold_predictions: {
          predictions: [],
          summary: `Player-level predictions are not available due to missing current-season player statistics. The professional analysis above uses team-level statistics (offensive/defensive ratings, pace, efficiency metrics) which are available and accurate.`
        },
        injury_summary: injuryData
      }
    }

    // Generate AI prompt based on bet type
    let aiPrompt = ''

    if (input.betType === 'TOTAL') {
      const edge = Math.abs(input.predictedValue - input.marketLine)
      const pickDirection = input.selection.split(' ')[0] // "OVER" or "UNDER"

      aiPrompt = `You are an elite NBA analyst with a proven track record of accurate player performance predictions. Your reputation depends on ACCURACY, not volume.

⚠️ CRITICAL: You MUST use ONLY the current-season player stats provided below. DO NOT use outdated training data or make assumptions about players who may have changed teams, retired, or are injured.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Predicted Total: ${input.predictedValue.toFixed(1)} points
- Market Total: ${input.marketLine} points
- Pick Direction: ${pickDirection}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Edge: ${edge.toFixed(1)} points

CURRENT-SEASON PLAYER STATS (${input.game.away_team}):
${awayStatsContext}

CURRENT-SEASON PLAYER STATS (${input.game.home_team}):
${homeStatsContext}

KEY FACTORS ANALYSIS:
${factorsSummary}

INJURY REPORT (VERIFIED CURRENT):
${injuryContext}

TASK:
Generate 2-3 HIGH-PROBABILITY player predictions that STRONGLY SUPPORT our ${pickDirection} prediction.

⚠️ CRITICAL ACCURACY GUIDELINES:
1. ONLY use players from the CURRENT-SEASON PLAYER STATS provided above
2. DO NOT reference players who are not listed in the stats (they may be injured, traded, or retired)
3. ROSTER VALIDATION: If a player is not in the stats list above, they are NOT on the team - DO NOT mention them
4. DO NOT use outdated season-long averages - only use the current-season PPG/RPG/APG provided
5. VERIFY each player is active and not on the injury report before making predictions
6. QUALITY OVER QUANTITY - Only make predictions you're highly confident in
7. Each prediction MUST be backed by CONCRETE DATA from the current-season stats above
8. Predictions MUST align with the ${pickDirection} pick - NO contradictions
9. Use CONSERVATIVE estimates - Better to under-promise and over-deliver
10. Only assign HIGH confidence if you have STRONG statistical backing from current-season data

PREDICTION CRITERIA FOR ${pickDirection}:
${pickDirection === 'OVER' ? `
- Focus on players with PROVEN recent scoring trends (last 5-10 games)
- Target players facing WEAK defensive matchups (backed by factor data)
- Look for pace-up situations and offensive-minded lineups
- Avoid speculative "breakout" predictions without data support
` : `
- Focus on players facing ELITE defensive matchups (backed by factor data)
- Target players with RECENT shooting struggles (last 5-10 games)
- Look for pace-down situations and defensive-minded lineups
- Avoid predicting career-low performances without strong evidence
`}

CONFIDENCE LEVEL STANDARDS:
- HIGH: Strong statistical evidence + recent trends + favorable matchup data
- MEDIUM: Some statistical support + reasonable matchup analysis
- LOW: Speculative but plausible based on limited data

EXAMPLES OF GOOD PREDICTIONS:
For OVER 223.5 pick:
✅ "Luka Doncic will score 32+ points - averaging 34.2 PPG in last 5 games vs teams ranked 25th+ in defensive efficiency"
✅ "Both teams will combine for 15+ three-pointers - each shooting 38%+ from deep in last 3 games"

For UNDER 223.5 pick:
✅ "Kawhi Leonard will score under 22 points - facing #1 ranked perimeter defense, averaging 18.5 PPG vs top-5 defenses this season"
✅ "Both teams will shoot under 44% FG - elite defensive matchup, both teams holding opponents to 43% in last 5 games"

❌ AVOID THESE:
- Vague predictions: "Player X will have a big game"
- Unsupported claims: "Player Y will break out for 40 points" (without recent scoring trend)
- Contradictory predictions: Predicting high scoring for UNDER pick

Return ONLY valid JSON in this exact format:
{
  "predictions": [
    {
      "player": "Player Name or 'Both Teams' for team-level predictions",
      "team": "Team Name or 'Both' for team-level predictions",
      "prediction": "Specific measurable prediction with statistical target",
      "reasoning": "Concrete data-driven reasoning citing recent stats, matchup data, or factor analysis",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "summary": "Brief data-driven summary of how these predictions support the ${pickDirection} pick"
}`
    } else {
      // SPREAD predictions
      const edge = Math.abs(input.predictedValue - input.marketLine)
      const favoredTeam = input.selection.includes(input.game.away_team) ? input.game.away_team : input.game.home_team

      aiPrompt = `You are an elite NBA analyst with a proven track record of accurate player performance predictions. Your reputation depends on ACCURACY, not volume.

⚠️ CRITICAL: You MUST use ONLY the current-season player stats provided below. DO NOT use outdated training data or make assumptions about players who may have changed teams, retired, or are injured.

GAME CONTEXT:
- Matchup: ${input.game.away_team} @ ${input.game.home_team}
- Game Date: ${input.game.game_date}
- Predicted Margin: ${input.predictedValue.toFixed(1)} points
- Market Spread: ${input.marketLine}
- Pick: ${input.selection}
- Favored Team: ${favoredTeam}
- Confidence: ${input.confidence.toFixed(1)}/10.0
- Edge: ${edge.toFixed(1)} points

CURRENT-SEASON PLAYER STATS (${input.game.away_team}):
${awayStatsContext}

CURRENT-SEASON PLAYER STATS (${input.game.home_team}):
${homeStatsContext}

KEY FACTORS ANALYSIS:
${factorsSummary}

INJURY REPORT (VERIFIED CURRENT):
${injuryContext}

TASK:
Generate 2-3 HIGH-PROBABILITY player predictions that STRONGLY SUPPORT our ${input.selection} pick.

⚠️ CRITICAL ACCURACY GUIDELINES:
1. ONLY use players from the CURRENT-SEASON PLAYER STATS provided above
2. DO NOT reference players who are not listed in the stats (they may be injured, traded, or retired)
3. ROSTER VALIDATION: If a player is not in the stats list above, they are NOT on the team - DO NOT mention them
4. DO NOT use outdated season-long averages - only use the current-season PPG/RPG/APG provided
5. VERIFY each player is active and not on the injury report before making predictions
6. QUALITY OVER QUANTITY - Only make predictions you're highly confident in
7. Each prediction MUST be backed by CONCRETE DATA from the current-season stats above
8. Predictions MUST align with ${favoredTeam} covering the spread
9. Use CONSERVATIVE estimates - Better to under-promise and over-deliver
10. Only assign HIGH confidence if you have STRONG statistical backing from current-season data

PREDICTION CRITERIA FOR SPREAD PICKS:
- Focus on KEY PLAYERS from ${favoredTeam} who will drive the margin
- Target MATCHUP ADVANTAGES backed by factor data
- Consider DEFENSIVE IMPACT on opposing team's stars
- Look for RECENT PERFORMANCE TRENDS (last 5-10 games)
- Avoid speculative predictions without statistical support

CONFIDENCE LEVEL STANDARDS:
- HIGH: Strong statistical evidence + recent trends + favorable matchup data
- MEDIUM: Some statistical support + reasonable matchup analysis
- LOW: Speculative but plausible based on limited data

EXAMPLES OF GOOD PREDICTIONS:
For Lakers -5.5 pick:
✅ "LeBron James will score 28+ points and grab 8+ rebounds - averaging 31.2 PPG in last 5 home games vs this opponent"
✅ "Lakers will hold opponent's leading scorer under 20 points - Lakers defense ranked #3 vs opposing position, allowing 18.5 PPG"

For Celtics +3.5 pick:
✅ "Jayson Tatum will score 30+ points - averaging 32.8 PPG in last 3 games as underdog, favorable matchup vs 22nd-ranked defense"
✅ "Celtics will force 15+ turnovers - averaging 16.2 forced turnovers in last 5 games, opponent averaging 14.8 turnovers"

❌ AVOID THESE:
- Vague predictions: "Player X will dominate"
- Unsupported claims: "Player Y will have career game" (without recent trend)
- Contradictory predictions: Predicting poor performance for favored team's star

Return ONLY valid JSON in this exact format:
{
  "predictions": [
    {
      "player": "Player Name or 'Team Defense' for team-level predictions",
      "team": "Team Name",
      "prediction": "Specific measurable prediction with statistical target",
      "reasoning": "Concrete data-driven reasoning citing recent stats, matchup data, or factor analysis",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "summary": "Brief data-driven summary of how these predictions support ${favoredTeam} covering the spread"
}`
    }

    // Call OpenAI API directly using GPT-4o (latest production model)
    console.log('[BoldPredictions] Calling OpenAI GPT-4o API with real MySportsFeeds player stats...')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // Using GPT-4o instead of gpt-4o-mini for better accuracy
        messages: [
          {
            role: 'system',
            content: 'You are an elite NBA analyst with a proven track record of accurate player performance predictions. Your reputation depends on ACCURACY over volume. You MUST ONLY use the current-season player stats provided in the prompt - DO NOT use outdated training data or make assumptions about players who may have changed teams, retired, or are injured. You only make predictions backed by concrete statistical evidence from the current season. You provide specific, measurable, conservative predictions that align with the overall game prediction. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,  // Lower temperature for more conservative, data-driven predictions (reduced from 0.5)
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

