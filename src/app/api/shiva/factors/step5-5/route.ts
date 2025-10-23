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
  const { sport, betType, game_data, prediction_data } = inputs
  
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
          console.log('[SHIVA:Step5.5] Processing Bold Player Predictions:', {
            run_id,
            sport,
            betType,
            game_data,
            prediction_data
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

          // For now, return mock data since we don't have AI integration yet
          // TODO: Integrate with OpenAI/Perplexity API for real predictions
          const mockPredictions = {
            predictions: [
              {
                player: "Shai Gilgeous-Alexander",
                team: game_data.away_team,
                prediction: "Will score 30+ points and dish 8+ assists",
                reasoning: "SGA has been in elite form, averaging 32.4 PPG in his last 5 games. The Pacers defense ranks 28th in opponent PPG, creating a favorable matchup for the Thunder's primary scorer.",
                confidence: "High"
              },
              {
                player: "Tyrese Haliburton",
                team: game_data.home_team,
                prediction: "Will record 25+ points and 12+ assists",
                reasoning: "Haliburton thrives in high-paced games and has been exceptional at home. With the predicted total suggesting an offensive showcase, he should easily exceed his season averages.",
                confidence: "High"
              },
              {
                player: "Pascal Siakam",
                team: game_data.home_team,
                prediction: "Will grab 10+ rebounds and score 20+ points",
                reasoning: "Siakam's versatility will be key in a high-scoring game. His ability to score in transition and crash the boards should lead to a strong double-double performance.",
                confidence: "Medium"
              }
            ],
            summary: `These bold predictions align perfectly with our ${prediction_data.pick_direction} pick. The predicted total of ${prediction_data.predicted_total} points suggests an offensive explosion, and these key players are positioned to drive that scoring with their recent form and favorable matchups.`
          }
          
          const responseBody = {
            run_id,
            bold_predictions: mockPredictions,
            ai_prompt: aiPrompt,
            generated_at: new Date().toISOString(),
            confidence: prediction_data.confidence,
            pick_direction: prediction_data.pick_direction
          }
          
          if (writeAllowed) {
            // Store bold predictions
            const upd = await admin.from('runs').update({ 
              bold_predictions: mockPredictions,
              ai_prompt: aiPrompt
            }).eq('run_id', run_id)
            if (upd.error) throw new Error(upd.error.message)
          }
          
          // Structured logging
          console.log('[SHIVA:Step5.5]', {
            run_id,
            inputs: { sport, betType, game_data, prediction_data },
            outputs: {
              prediction_count: mockPredictions.predictions.length,
              pick_direction: prediction_data.pick_direction,
              confidence: prediction_data.confidence,
            },
            writeAllowed,
            latencyMs: Date.now() - startTime,
            status: 200,
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
            error: 'Only NBA TOTAL bets supported for Bold Player Predictions'
          }, 
          status: 400 
        }
      }
    }
  })
}
