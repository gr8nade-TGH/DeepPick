import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
export const runtime = 'nodejs'
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
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = CardSchema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const runId = parse.data.run_id
  return withIdempotency({
    runId,
    step: 'card',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      if (writeAllowed) {
        const ins = await admin.from('insight_cards').insert({ run_id: runId, rendered_json: parse.data.card }).select('run_id').single()
        if (ins.error) throw new Error(ins.error.message)
      }
      return { body: { run_id: runId, insight_card_id: `card_${runId}` }, status: 200 }
    }
  })
}


