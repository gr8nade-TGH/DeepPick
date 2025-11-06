import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { fetchPlayerInjuriesForTeams } from '@/lib/data-sources/mysportsfeeds-api'
import { getTeamAbbrev } from '@/lib/data-sources/team-mappings'
import { formatDateForAPI } from '@/lib/data-sources/season-utils'
export const runtime = 'nodejs'

const Step5_5Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
    ai_provider: z.enum(['perplexity', 'openai']).default('openai').optional(),
    game_data: z.object({
      home_team: z.string(),
      away_team: z.string(),
      game_date: z.string(),
    }).strict(),
    prediction_data: z.object({
      predicted_total: z.number().optional(),
      predicted_margin: z.number().optional(),
      market_total: z.number().optional(),
      market_spread: z.number().optional(),
      pick_direction: z.enum(['OVER', 'UNDER', 'HOME', 'AWAY']).optional(),
      selection: z.string().optional(),
      confidence: z.number(),
      factors_summary: z.string(),
    }).strict(),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const startTime = Date.now()
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = Step5_5Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step5.5]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const { run_id, inputs } = parse.data
  const { sport, betType, game_data, prediction_data, ai_provider = 'perplexity' } = inputs

  return withIdempotency({
    runId: run_id,
    step: 'step5-5',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()

      // Process NBA TOTAL and SPREAD bets
      if (sport === 'NBA' && (betType === 'TOTAL' || betType === 'SPREAD')) {
        try {
          console.log('[SHIVA:Step5.5] ===== STARTING BOLD PREDICTIONS =====')
          console.log('[SHIVA:Step5.5] Processing Bold Player Predictions:', {
            run_id,
            sport,
            betType,
            game_data,
            prediction_data
          })

          // Fetch injury data from MySportsFeeds
          let injuryData: any = null
          try {
            const gameDate = formatDateForAPI(new Date(game_data.game_date))
            const awayAbbrev = getTeamAbbrev(game_data.away_team)
            const homeAbbrev = getTeamAbbrev(game_data.home_team)

            console.log('[SHIVA:Step5.5] Fetching injury data:', {
              gameDate,
              teams: [awayAbbrev, homeAbbrev]
            })

            injuryData = await fetchPlayerInjuriesForTeams(gameDate, [awayAbbrev, homeAbbrev])

            console.log('[SHIVA:Step5.5] Injury data fetched:', {
              totalPlayers: injuryData.players?.length || 0,
              injuredPlayers: injuryData.players?.filter((p: any) => p.currentInjury).length || 0
            })
          } catch (injuryError) {
            console.warn('[SHIVA:Step5.5] Failed to fetch injury data, continuing without it:', {
              error: injuryError instanceof Error ? injuryError.message : String(injuryError)
            })
          }

          // Format injury data for AI prompt
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

          // Generate AI prompt based on bet type
          let aiPrompt = ''

          if (betType === 'TOTAL') {
            const edge = Math.abs((prediction_data.predicted_total || 0) - (prediction_data.market_total || 0))
            aiPrompt = `You are an expert NBA analyst specializing in player performance predictions.

GAME CONTEXT:
- Matchup: ${game_data.away_team} @ ${game_data.home_team}
- Game Date: ${game_data.game_date}
- Predicted Total: ${prediction_data.predicted_total} points
- Market Total: ${prediction_data.market_total} points
- Pick Direction: ${prediction_data.pick_direction}
- Confidence: ${prediction_data.confidence}/10.0
- Edge: ${edge.toFixed(1)} points

KEY FACTORS ANALYSIS:
${prediction_data.factors_summary}

INJURY REPORT:
${injuryContext}

TASK:
Generate 2-4 BOLD player predictions that SUPPORT our ${prediction_data.pick_direction} prediction.

CRITICAL: Your predictions MUST align with the ${prediction_data.pick_direction} pick. DO NOT predict outcomes that would contradict this pick.

PREDICTION CRITERIA:
- If OVER: Focus on players likely to EXCEED their season averages (high scoring, efficient shooting, fast pace)
- If UNDER: Focus on players likely to UNDERPERFORM their season averages (defensive struggles, poor shooting, slow pace)
- Consider injury impact (missing stars, role players stepping up)
- Consider recent form (hot/cold streaks)
- Consider matchup advantages/disadvantages

REQUIREMENTS:
1. Each prediction must be SPECIFIC and MEASURABLE
   ✅ Good: "Jayson Tatum will score 30+ points and grab 8+ rebounds"
   ❌ Bad: "Tatum will have a good game"

2. Predictions MUST SUPPORT our ${prediction_data.pick_direction} pick
   - OVER picks: Predict high-scoring performances, efficient shooting, fast-paced play
   - UNDER picks: Predict defensive lockdowns, poor shooting nights, slow-paced grind
   - NEVER predict outcomes that would push the total in the opposite direction

3. Use PROVIDED DATA (injury reports, recent stats) in your reasoning

4. Be BOLD but REALISTIC - these are high-conviction predictions that support our thesis

5. Assign confidence levels based on:
   - HIGH: Player has 3+ game streak supporting prediction + favorable matchup
   - MEDIUM: Player has mixed recent form but favorable matchup
   - LOW: Prediction is bold but has risk factors

EXAMPLES:
For OVER 223.5 pick:
✅ "Luka Doncic will score 35+ points and dish 10+ assists" (supports OVER)
❌ "Luka Doncic will struggle to 18 points on poor shooting" (contradicts OVER)

For UNDER 223.5 pick:
✅ "Both teams will shoot under 42% from the field due to elite defense" (supports UNDER)
❌ "Steph Curry will explode for 45 points on 10 threes" (contradicts UNDER)

FORMAT:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Data-driven explanation using injury reports and recent stats",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief assessment of how these predictions support the ${prediction_data.pick_direction} pick"
}`
          } else if (betType === 'SPREAD') {
            const edge = Math.abs(prediction_data.predicted_margin || 0)
            const favoredTeam = (prediction_data.predicted_margin || 0) > 0 ? game_data.away_team : game_data.home_team
            aiPrompt = `You are an expert NBA analyst specializing in player performance predictions.

GAME CONTEXT:
- Matchup: ${game_data.away_team} @ ${game_data.home_team}
- Game Date: ${game_data.game_date}
- Predicted Margin: ${prediction_data.predicted_margin} points (${favoredTeam} favored)
- Market Spread: ${prediction_data.market_spread}
- Pick: ${prediction_data.selection}
- Confidence: ${prediction_data.confidence}/10.0
- Edge: ${edge.toFixed(1)} points

KEY FACTORS ANALYSIS:
${prediction_data.factors_summary}

INJURY REPORT:
${injuryContext}

TASK:
Generate 2-4 BOLD player predictions that SUPPORT our ${prediction_data.selection} pick.

CRITICAL: Your predictions MUST align with the ${prediction_data.selection} pick. DO NOT predict outcomes that would contradict this pick.

PREDICTION CRITERIA:
- If picking FAVORITE: Focus on star players dominating, role players contributing, opponent stars struggling
- If picking UNDERDOG: Focus on opponent stars struggling, underdog stars stepping up, favorable matchups
- Consider injury impact (missing defenders, offensive weapons)
- Consider recent form (momentum, confidence)
- Consider matchup advantages (size, speed, shooting)

REQUIREMENTS:
1. Each prediction must be SPECIFIC and MEASURABLE
   ✅ Good: "Luka Doncic will score 35+ points and dish 10+ assists"
   ❌ Bad: "Luka will play well"

2. Predictions MUST SUPPORT our ${prediction_data.selection} pick
   - If picking favorite: Predict dominant performances from favorite's stars + struggles from underdog
   - If picking underdog: Predict struggles from favorite's stars + breakout performances from underdog
   - NEVER predict outcomes that would help the opposite team cover

3. Use PROVIDED DATA (injury reports, recent stats) in your reasoning

4. Be BOLD but REALISTIC - these are high-conviction predictions that support our thesis

5. Assign confidence levels based on:
   - HIGH: Player has 3+ game streak supporting prediction + favorable matchup
   - MEDIUM: Player has mixed recent form but strong historical vs opponent
   - LOW: Prediction is bold but has risk factors (injury concern, tough matchup)

EXAMPLES:
For "Phoenix Suns -5.5" pick (picking favorite):
✅ "Kevin Durant will score 32+ points on 55% shooting" (supports favorite covering)
✅ "Clippers will shoot under 40% from field due to Suns defense" (supports favorite covering)
❌ "Kawhi Leonard will dominate for 38 points" (contradicts favorite covering)

For "Los Angeles Clippers +5.5" pick (picking underdog):
✅ "Kawhi Leonard will score 30+ and lock down Durant defensively" (supports underdog covering)
✅ "Suns will struggle with turnovers, committing 18+" (supports underdog covering)
❌ "Kevin Durant will explode for 40 points on 65% shooting" (contradicts underdog covering)

FORMAT:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Data-driven explanation using injury reports and recent stats",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief assessment of how these predictions support the ${prediction_data.selection} pick"
}`
          }

          // Call OpenAI API to generate bold predictions
          console.log('[SHIVA:Step5.5] Calling OpenAI API for bold predictions...')

          let boldPredictions: any
          let aiCallSuccess = false

          try {
            console.log('[SHIVA:Step5.5] Using OpenAI gpt-4o-mini for bold predictions')
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
                    content: 'You are an expert NBA analyst specializing in player performance predictions. Always respond with valid JSON.'
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
              const errorText = await response.text()
              throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
            }

            const aiResponse = await response.json()
            const aiContent = aiResponse.choices?.[0]?.message?.content

            if (!aiContent) {
              throw new Error('No content in AI response')
            }

            // Parse AI response
            boldPredictions = JSON.parse(aiContent)
            aiCallSuccess = true

            console.log('[SHIVA:Step5.5] AI predictions generated successfully:', {
              predictionCount: boldPredictions.predictions?.length || 0,
              hasSummary: !!boldPredictions.summary
            })

          } catch (aiError) {
            console.error('[SHIVA:Step5.5] OpenAI call failed, using fallback mock data:', {
              error: aiError instanceof Error ? aiError.message : String(aiError)
            })

            // Fallback to mock data if AI fails
            const pickInfo = betType === 'TOTAL'
              ? `${prediction_data.pick_direction} ${prediction_data.market_total}`
              : prediction_data.selection

            boldPredictions = {
              predictions: [
                {
                  player: "Star Player",
                  team: game_data.away_team,
                  prediction: betType === 'TOTAL'
                    ? "Will exceed season averages in scoring"
                    : "Will dominate the matchup with strong all-around performance",
                  reasoning: `Based on our ${pickInfo} prediction and favorable matchup conditions.`,
                  confidence: "Medium"
                },
                {
                  player: "Key Player",
                  team: game_data.home_team,
                  prediction: betType === 'TOTAL'
                    ? "Will contribute significantly to the total"
                    : "Will provide crucial support in key moments",
                  reasoning: `Aligns with our ${pickInfo} pick and current game dynamics.`,
                  confidence: "Medium"
                }
              ],
              summary: `These predictions support our ${pickInfo} pick based on the current matchup analysis.`,
              _fallback: true,
              _error: aiError instanceof Error ? aiError.message : String(aiError)
            }
          }

          const responseBody = {
            run_id,
            bold_predictions: boldPredictions,
            injury_summary: injuryData,
            ai_prompt: aiPrompt,
            generated_at: new Date().toISOString(),
            confidence: prediction_data.confidence,
            bet_type: betType,
            ai_call_success: aiCallSuccess
          }

          if (writeAllowed) {
            // Store bold predictions and injury summary in runs table
            const upd = await admin.from('runs').update({
              bold_predictions: boldPredictions,
              injury_summary: injuryData
            }).eq('run_id', run_id)
            if (upd.error) throw new Error(upd.error.message)
          }

          // Structured logging
          console.log('[SHIVA:Step5.5]', {
            run_id,
            inputs: { sport, betType, game_data, prediction_data },
            outputs: {
              prediction_count: boldPredictions.predictions?.length || 0,
              confidence: prediction_data.confidence,
              ai_call_success: aiCallSuccess,
              used_fallback: boldPredictions._fallback || false,
              has_injury_data: !!injuryData
            },
            writeAllowed,
            latencyMs: Date.now() - startTime,
            status: 200,
          })

          console.log('[SHIVA:Step5.5] ===== BOLD PREDICTIONS COMPLETE =====')
          console.log('[SHIVA:Step5.5] Final response body:', {
            run_id: responseBody.run_id,
            predictionCount: responseBody.bold_predictions.predictions?.length || 0,
            hasSummary: !!responseBody.bold_predictions.summary,
            confidence: responseBody.confidence,
            betType: betType,
            aiCallSuccess: aiCallSuccess
          })

          return { body: responseBody, status: 200 }
        } catch (error) {
          console.error('[SHIVA:Step5.5] Error processing Bold Player Predictions:', {
            run_id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          return {
            body: {
              run_id,
              bold_predictions: { predictions: [], summary: 'Error generating predictions' },
              injury_summary: null,
              ai_prompt: '',
              generated_at: new Date().toISOString(),
              confidence: 0,
              bet_type: (betType === 'SPREAD' || betType === 'TOTAL') ? betType : 'TOTAL',
              ai_call_success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            status: 500
          }
        }
      } else {
        // For non-NBA or unsupported bet types
        return {
          body: {
            run_id,
            bold_predictions: { predictions: [], summary: 'Unsupported bet type' },
            injury_summary: null,
            ai_prompt: '',
            generated_at: new Date().toISOString(),
            confidence: 0,
            bet_type: (betType === 'SPREAD' || betType === 'TOTAL') ? betType : 'TOTAL',
            ai_call_success: false,
            error: `Only NBA TOTAL and SPREAD bets supported for Bold Player Predictions (received: ${sport} ${betType})`
          },
          status: 400
        }
      }
    }
  })
}
