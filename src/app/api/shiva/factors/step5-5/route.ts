import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const Step5_5Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
    ai_provider: z.enum(['perplexity', 'openai']).default('perplexity').optional(),
    game_data: z.object({
      home_team: z.string(),
      away_team: z.string(),
      game_date: z.string(),
    }).strict(),
    prediction_data: z.object({
      predicted_total: z.number(),
      pick_direction: z.enum(['OVER', 'UNDER']),
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

      // Only process NBA TOTAL bets for now
      if (sport === 'NBA' && betType === 'TOTAL') {
        try {
          console.log('[SHIVA:Step5.5] ===== STARTING BOLD PREDICTIONS =====')
          console.log('[SHIVA:Step5.5] Processing Bold Player Predictions:', {
            run_id,
            sport,
            betType,
            game_data,
            prediction_data
          })

          // Debug: Log input validation
          console.log('[SHIVA:Step5.5] Input validation:', {
            hasGameData: !!game_data,
            hasPredictionData: !!prediction_data,
            gameDataKeys: game_data ? Object.keys(game_data) : [],
            predictionDataKeys: prediction_data ? Object.keys(prediction_data) : []
          })

          // Generate AI prompt for bold player predictions
          const aiPrompt = `You are an expert NBA analyst tasked with making BOLD player predictions for an upcoming game.

GAME CONTEXT:
- Matchup: ${game_data.away_team} @ ${game_data.home_team}
- Game Date: ${game_data.game_date}
- Predicted Total: ${prediction_data.predicted_total} points
- Pick Direction: ${prediction_data.pick_direction}
- Confidence: ${prediction_data.confidence}/5.0
- Key Factors: ${prediction_data.factors_summary}

TASK:
Generate 2-4 BOLD player predictions that align with the ${prediction_data.pick_direction} prediction. If we're predicting OVER, focus on players likely to exceed expectations. If UNDER, focus on players likely to underperform.

REQUIREMENTS:
1. Each prediction should be specific and measurable (e.g., "Player X will score 25+ points")
2. Predictions must align with the ${prediction_data.pick_direction} direction
3. Consider recent form, matchups, injuries, and team dynamics
4. Be bold but realistic - these are high-confidence predictions
5. Include reasoning for each prediction
6. Focus on key players who can significantly impact the total

FORMAT:
Return a JSON object with this structure:
{
  "predictions": [
    {
      "player": "Player Name",
      "team": "Team Name",
      "prediction": "Specific measurable prediction",
      "reasoning": "Why this prediction is likely",
      "confidence": "High/Medium/Low"
    }
  ],
  "summary": "Brief overall assessment of why these predictions support the ${prediction_data.pick_direction} pick"
}

Research recent news, injury reports, and statistical trends to make the most accurate predictions possible.`

          // Call AI API to generate bold predictions
          console.log('[SHIVA:Step5.5] Calling AI API for bold predictions...', { ai_provider })

          let boldPredictions: any
          let aiCallSuccess = false

          try {
            // Call AI provider (Perplexity or OpenAI)
            let response: Response

            if (ai_provider === 'openai') {
              console.log('[SHIVA:Step5.5] Using OpenAI for bold predictions')
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
            } else {
              console.log('[SHIVA:Step5.5] Using Perplexity for bold predictions')
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
                      content: 'You are an expert NBA analyst specializing in player performance predictions. Always respond with valid JSON.'
                    },
                    {
                      role: 'user',
                      content: aiPrompt
                    }
                  ],
                  max_tokens: 1500,
                  temperature: 0.7
                })
              })
            }

            if (!response.ok) {
              throw new Error(`${ai_provider} API error: ${response.status} ${response.statusText}`)
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
              provider: ai_provider,
              hasSummary: !!boldPredictions.summary
            })

          } catch (aiError) {
            console.error('[SHIVA:Step5.5] AI call failed, using fallback mock data:', {
              error: aiError instanceof Error ? aiError.message : String(aiError),
              provider: ai_provider
            })

            // Fallback to mock data if AI fails
            boldPredictions = {
              predictions: [
                {
                  player: "Star Player",
                  team: game_data.away_team,
                  prediction: "Will exceed season averages in scoring",
                  reasoning: `Based on the ${prediction_data.pick_direction} prediction and favorable matchup conditions.`,
                  confidence: "Medium"
                },
                {
                  player: "Key Player",
                  team: game_data.home_team,
                  prediction: "Will contribute significantly to the total",
                  reasoning: `Aligns with our ${prediction_data.pick_direction} pick and predicted total of ${prediction_data.predicted_total} points.`,
                  confidence: "Medium"
                }
              ],
              summary: `These predictions support our ${prediction_data.pick_direction} pick. The predicted total of ${prediction_data.predicted_total} points suggests these key players will perform as expected.`,
              _fallback: true,
              _error: aiError instanceof Error ? aiError.message : String(aiError)
            }
          }

          const responseBody = {
            run_id,
            bold_predictions: boldPredictions,
            ai_prompt: aiPrompt,
            generated_at: new Date().toISOString(),
            confidence: prediction_data.confidence,
            pick_direction: prediction_data.pick_direction,
            ai_provider,
            ai_call_success: aiCallSuccess
          }

          if (writeAllowed) {
            // Store bold predictions
            const upd = await admin.from('runs').update({
              bold_predictions: boldPredictions,
              ai_prompt: aiPrompt
            }).eq('run_id', run_id)
            if (upd.error) throw new Error(upd.error.message)
          }

          // Structured logging
          console.log('[SHIVA:Step5.5]', {
            run_id,
            inputs: { sport, betType, game_data, prediction_data, ai_provider },
            outputs: {
              prediction_count: boldPredictions.predictions?.length || 0,
              pick_direction: prediction_data.pick_direction,
              confidence: prediction_data.confidence,
              ai_call_success: aiCallSuccess,
              used_fallback: boldPredictions._fallback || false
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
            pickDirection: responseBody.pick_direction,
            aiProvider: ai_provider,
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
              ai_prompt: '',
              generated_at: new Date().toISOString(),
              confidence: 0,
              pick_direction: 'OVER' as const,
              ai_provider,
              ai_call_success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            status: 500
          }
        }
      } else {
        // For non-NBA or non-TOTAL, return unsupported
        return {
          body: {
            run_id,
            bold_predictions: { predictions: [], summary: 'Unsupported bet type' },
            ai_prompt: '',
            generated_at: new Date().toISOString(),
            confidence: 0,
            pick_direction: 'OVER' as const,
            ai_provider,
            ai_call_success: false,
            error: 'Only NBA TOTAL bets supported for Bold Player Predictions'
          },
          status: 400
        }
      }
    }
  })
}
