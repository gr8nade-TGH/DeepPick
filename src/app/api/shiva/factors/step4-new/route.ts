import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { calculateConfidence } from '@/lib/cappers/shiva-v1/confidence-calculator'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const Step4NewSchema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
  }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
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
  const parse = Step4NewSchema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step4New]', {
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
    step: 'step4-new',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      // Only process NBA TOTAL bets with new system
      if (sport === 'NBA' && betType === 'TOTAL') {
        // Extract factor weights from the factors
        const factorWeights = results.factors.reduce((acc, factor) => {
          acc[factor.key] = factor.weight_total_pct
          return acc
        }, {} as Record<string, number>)
        
        // Calculate confidence using new system
        const confidenceResult = calculateConfidence({
          factors: results.factors,
          factorWeights,
          confSource: 'nba_totals_v1'
        })
        
        // Generate basic predictions (we'll enhance this later)
        const predictedTotal = 230.0 // Placeholder - will be calculated from factors
        const predictedScores = {
          home: 115,
          away: 115
        }
        
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
            pace_exp: 100.0, // Placeholder
            delta_100: 0.0, // Placeholder
            spread_pred_points: 0.0, // Placeholder
            total_pred_points: predictedTotal,
            scores: predictedScores,
            winner: 'TBD', // Placeholder
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
            base_confidence: confidenceResult.confScore,
            signed_sum: confidenceResult.edgeRaw,
            factor_count: results.factors.length,
          },
          writeAllowed,
          latencyMs: Date.now() - startTime,
          status: 200,
        })
        
        return { body: responseBody, status: 200 }
      } else {
        // For non-NBA or non-TOTAL, return legacy response
        return jsonError('UNSUPPORTED', 'Only NBA TOTAL bets supported in new system', 400)
      }
    }
  })
}
