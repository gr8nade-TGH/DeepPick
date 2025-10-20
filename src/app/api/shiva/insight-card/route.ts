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
  const startTime = Date.now()
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = CardSchema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:InsightCard]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const runId = parse.data.run_id
  return withIdempotency({
    runId,
    step: 'card',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      if (writeAllowed) {
        // Single transaction: insert insight card
        const ins = await admin.from('insight_cards').insert({ 
          run_id: runId, 
          rendered_json: parse.data.card 
        }).select('run_id').single()
        if (ins.error) throw new Error(ins.error.message)
      }
      
      const responseBody = { run_id: runId, insight_card_id: `card_${runId}` }
      
      // Structured logging
      console.log('[SHIVA:InsightCard]', {
        run_id: runId,
        inputs: {
          pick_type: parse.data.inputs.final_pick.pick_type,
          units: parse.data.inputs.final_pick.units,
          conf_final: parse.data.inputs.final_pick.conf_final,
        },
        outputs: {
          insight_card_id: `card_${runId}`,
        },
        writeAllowed,
        latencyMs: Date.now() - startTime,
        status: 200,
      })
      
      return { body: responseBody, status: 200 }
    }
  })
}


