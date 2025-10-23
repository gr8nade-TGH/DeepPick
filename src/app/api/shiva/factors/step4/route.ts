import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { calculateConfidence } from '@/lib/cappers/shiva-v1/confidence-calculator'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const Step4Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
  }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
      key: z.string().min(1),
      name: z.string().min(1),
      weight_total_pct: z.number().finite(),
      normalized_value: z.number().finite(), // This is our signal sᵢ
      raw_values_json: z.unknown(),
      parsed_values_json: z.record(z.unknown()),
      caps_applied: z.boolean(),
      cap_reason: z.string().nullable(),
      notes: z.string().nullable().optional(),
    }).strict()),
    factor_version: z.string(),
    meta: z.object({
      conf_source: z.string(),
    }).optional(),
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
  const parse = Step4Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step4]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const { run_id, inputs, results } = parse.data
  const { sport, betType } = inputs
  
  return withIdempotency({
    runId: run_id,
    step: 'step4',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      // Only process NBA TOTAL bets with new system
      if (sport === 'NBA' && betType === 'TOTAL') {
        try {
          console.log('[SHIVA:Step4] Processing NBA TOTAL bet:', {
            run_id,
            sport,
            betType,
            factorCount: results.factors.length
          })
          
          // Extract factor weights from the factors
          const factorWeights = results.factors.reduce((acc, factor) => {
            acc[factor.key] = factor.weight_total_pct
            return acc
          }, {} as Record<string, number>)
          
          // Calculate confidence using new system
          const confidenceResult = calculateConfidence({
            factors: results.factors.map(f => ({
              ...f,
              raw_values_json: f.raw_values_json as Record<string, any>,
              notes: f.notes || undefined
            })),
            factorWeights,
            confSource: 'nba_totals_v1'
          })
          
          console.log('[SHIVA:Step4] Confidence calculation:', {
            factorWeights,
            factorCount: results.factors.length,
            confidenceResult
          })
          
          // Generate real score predictions from factor signals
          const leagueAverageTotal = 225.0 // NBA league average total
          
          // Calculate factor adjustments to the total
          let totalAdjustment = 0
          const factorAdjustments: Record<string, number> = {}
          
          for (const factor of results.factors) {
            const signal = factor.normalized_value || 0
            const weight = factorWeights[factor.key] || 0
            const maxPoints = 5.0 // All factors now have 5.0 max points
            
            // Calculate adjustment: signal × maxPoints × (weight/100)
            const adjustment = signal * maxPoints * (weight / 100)
            totalAdjustment += adjustment
            factorAdjustments[factor.key] = adjustment
          }
          
          // Calculate predicted total
          const predictedTotal = Math.max(180, Math.min(280, leagueAverageTotal + totalAdjustment))
          
          // Split into home/away scores (simplified - could be enhanced with team-specific data)
          const homeScore = Math.round(predictedTotal / 2 + (Math.random() - 0.5) * 4) // Add some variance
          const awayScore = Math.round(predictedTotal - homeScore)
          
          const predictedScores = {
            home: homeScore,
            away: awayScore
          }
          
          // Determine winner
          const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie'
          
          if (writeAllowed) {
            // Store confidence calculation
            const upd = await admin.from('runs').update({ 
              conf7: confidenceResult.confScore,
              conf_source: confidenceResult.confSource
            }).eq('run_id', run_id)
            if (upd.error) throw new Error(upd.error.message)
          }
          
          const responseBody = {
            run_id,
            predictions: {
              league_average_total: leagueAverageTotal,
              total_adjustment: totalAdjustment,
              factor_adjustments: factorAdjustments,
              total_pred_points: predictedTotal,
              scores: predictedScores,
              winner: winner,
              conf7_score: confidenceResult.confScore,
            },
            confidence: {
              base_confidence: confidenceResult.confScore,
              signed_sum: confidenceResult.edgeRaw,
              factor_contributions: confidenceResult.factorContributions,
              conf_source: confidenceResult.confSource
            },
            conf_source: confidenceResult.confSource,
          }
          
          // Structured logging
          console.log('[SHIVA:Step4New]', {
            run_id,
            inputs: { sport, betType },
            outputs: {
              league_average_total: leagueAverageTotal,
              total_adjustment: totalAdjustment,
              predicted_total: predictedTotal,
              predicted_scores: predictedScores,
              winner: winner,
              base_confidence: confidenceResult.confScore,
              signed_sum: confidenceResult.edgeRaw,
              factor_count: results.factors.length,
            },
            factor_adjustments: factorAdjustments,
            writeAllowed,
            latencyMs: Date.now() - startTime,
            status: 200,
          })
          
          return jsonOk(responseBody)
        } catch (error) {
          console.error('[SHIVA:Step4] Error processing NBA TOTAL bet:', {
            run_id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          return jsonError('PROCESSING_ERROR', 'Error processing NBA TOTAL bet', 500, { 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      } else {
        // For non-NBA or non-TOTAL, return legacy response
        return jsonError('UNSUPPORTED', 'Only NBA TOTAL bets supported in new system', 400)
      }
    }
  })
}
