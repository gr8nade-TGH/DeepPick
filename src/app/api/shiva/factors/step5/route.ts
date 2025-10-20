import { z } from 'zod'
import { ensureApiEnabled, ensureWritesEnabled, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const Step5Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    active_snapshot_id: z.string().min(1),
    spread_pred_points: z.number(),
    total_pred_points: z.number(),
    pick_side_team: z.string().min(1),
    snapshot: z.object({ spread: z.object({ fav_team: z.string(), line: z.number() }).strict(), total: z.object({ line: z.number() }).strict() }).strict(),
    conf7_score: z.number(),
  }).strict(),
  results: z.object({
    market_edge: z.object({
      edge_side_points: z.number(),
      edge_side_norm: z.number(),
      edge_total_points: z.number(),
      edge_total_norm: z.number(),
      dominant: z.enum(['side', 'total']),
      conf_market_adj: z.union([z.string(), z.number()]),
      conf_market_adj_value: z.number(),
    }).strict(),
    confidence: z.object({ conf7: z.number(), conf_final: z.number() }).strict(),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeErr = ensureWritesEnabled()
  if (writeErr) return writeErr
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = Step5Schema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const admin = getSupabaseAdmin()
  const { run_id, results } = parse.data

  const f8 = results.market_edge
  const ins = await admin.from('factors').insert({
    run_id,
    factor_no: 8,
    raw_values_json: results,
    parsed_values_json: { dominant: f8.dominant },
    normalized_value: 0,
    weight_applied: 30.0,
    caps_applied: false,
    cap_reason: null,
  })
  if (ins.error) return jsonError('DB_ERROR', ins.error.message, 500)

  const upd = await admin.from('runs').update({ conf_market_adj: f8.conf_market_adj_value, conf_final: results.confidence.conf_final }).eq('run_id', run_id)
  if (upd.error) return jsonError('DB_ERROR', upd.error.message, 500)

  return jsonOk({ run_id, conf_final: results.confidence.conf_final, dominant: f8.dominant, conf_market_adj: f8.conf_market_adj_value })
}


