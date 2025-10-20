import { z } from 'zod'
import { ensureApiEnabled, ensureWritesEnabled, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const CardSchema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    final_pick: z.object({ pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), selection: z.string(), units: z.number(), pred_score: z.object({ home: z.number(), away: z.number() }).strict(), conf_final: z.number() }).strict()
  }).strict(),
  card: z.object({ header: z.record(z.unknown()), prediction: z.record(z.unknown()), factors: z.array(z.record(z.unknown())), audit: z.record(z.unknown()) }).strict()
}).strict()

export async function POST(request: Request) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeErr = ensureWritesEnabled()
  if (writeErr) return writeErr
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = CardSchema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const admin = getSupabaseAdmin()
  const ins = await admin.from('insight_cards').insert({ run_id: parse.data.run_id, rendered_json: parse.data.card }).select('run_id').single()
  if (ins.error) return jsonError('DB_ERROR', ins.error.message, 500)
  return jsonOk({ run_id: parse.data.run_id, insight_card_id: `card_${parse.data.run_id}` })
}


