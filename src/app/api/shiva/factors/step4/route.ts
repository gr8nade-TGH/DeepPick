import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const Step4Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({ ai_provider: z.enum(['openai', 'perplexity']), home_team: z.string().min(1), away_team: z.string().min(1) }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(6), z.literal(7)]),
      name: z.string().min(1),
      weight_total_pct: z.number().finite(),
      raw_values_json: z.unknown(),
      parsed_values_json: z.record(z.unknown()),
      normalized_value: z.number().finite(),
      caps_applied: z.boolean(),
      cap_reason: z.string().nullable(),
    }).strict()),
    pace_and_predictions: z.object({
      statmuse_pace: z.object({ okc_query: z.string().optional(), hou_query: z.string().optional(), okc_pace: z.number(), hou_pace: z.number() }).strict(),
      pace_exp: z.number(),
      delta_100: z.union([z.number(), z.string()]),
      delta_100_value: z.number(),
      spread_pred_points: z.number(),
      league_avg_ortg: z.number(),
      ortg_hat: z.record(z.number()),
      total_pred_points: z.number(),
      scores: z.object({ home_pts: z.number(), away_pts: z.number() }).strict(),
      winner: z.string(),
      conf7_score: z.union([z.number(), z.string()]),
      conf7_score_value: z.number(),
    }).strict(),
    meta: z.object({ ai_provider: z.enum(['openai', 'perplexity']) }).strict(),
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

  const { run_id, results } = parse.data
  return withIdempotency({
    runId: run_id,
    step: 'step4',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      if (writeAllowed) {
        for (const f of results.factors) {
          const ins = await admin.from('factors').insert({
            run_id,
            factor_no: f.factor_no,
            raw_values_json: f.raw_values_json,
            parsed_values_json: f.parsed_values_json,
            normalized_value: f.normalized_value,
            weight_applied: f.weight_total_pct,
            caps_applied: f.caps_applied,
            cap_reason: f.cap_reason ?? null,
          })
          if (ins.error) throw new Error(ins.error.message)
        }
      }
      if (writeAllowed) {
        // Single transaction: update conf7 on runs table
        const upd = await admin.from('runs').update({ conf7: results.pace_and_predictions.conf7_score_value }).eq('run_id', run_id)
        if (upd.error) throw new Error(upd.error.message)
      }
      
      const responseBody = {
        run_id,
        predictions: {
          pace_exp: results.pace_and_predictions.pace_exp,
          delta_100: results.pace_and_predictions.delta_100_value,
          spread_pred_points: results.pace_and_predictions.spread_pred_points,
          total_pred_points: results.pace_and_predictions.total_pred_points,
          scores: { home: results.pace_and_predictions.scores.home_pts, away: results.pace_and_predictions.scores.away_pts },
          winner: results.pace_and_predictions.winner,
          conf7_score: results.pace_and_predictions.conf7_score_value,
        },
      }
      
      // Structured logging
      console.log('[SHIVA:Step4]', {
        run_id,
        inputs: {
          ai_provider: results.meta.ai_provider,
        },
        outputs: {
          pace_exp: results.pace_and_predictions.pace_exp,
          spread_pred: results.pace_and_predictions.spread_pred_points,
          total_pred: results.pace_and_predictions.total_pred_points,
          conf7: results.pace_and_predictions.conf7_score_value,
        },
        writeAllowed,
        latencyMs: Date.now() - startTime,
        status: 200,
      })
      
      return {
        body: responseBody,
        status: 200,
      }
    }
  })
}


