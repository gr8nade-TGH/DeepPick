import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
export const runtime = 'nodejs'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const PickSchema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    conf_final: z.number(),
    edge_dominant: z.enum(['side', 'total']),
    side_data: z.object({ pick_team: z.string(), spread_pred: z.number(), market_spread: z.number() }).optional(),
    total_data: z.object({ total_pred: z.number(), market_total: z.number() }).optional(),
  }).strict(),
  results: z.object({
    decision: z.object({ pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), pick_side: z.string(), line: z.number(), units: z.number(), reason: z.string() }).strict(),
    persistence: z.object({ picks_row: z.object({ id: z.string(), run_id: z.string(), sport: z.literal('NBA'), matchup: z.string(), confidence: z.number(), units: z.number(), pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), selection: z.string(), created_at_utc: z.string() }).strict() }).strict(),
  }).strict()
}).strict()

export async function POST(request: Request) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = PickSchema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const { run_id, results } = parse.data
  type PickBody = {
    run_id: string
    decision: string
    confidence: number
    pick: null | { id: string; run_id: string; pick_type: 'SPREAD' | 'MONEYLINE' | 'TOTAL'; selection: string; units: number; confidence: number }
  }
  return withIdempotency<PickBody>({
    runId: run_id,
    step: 'pick',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      if (!results.persistence?.picks_row) {
        return { body: { run_id, decision: 'PASS', confidence: parse.data.inputs.conf_final, pick: null }, status: 200 }
      }
      const r = results.persistence.picks_row
      const ins = await admin.from('picks').insert({
        id: r.id,
        game_id: null,
        pick_type: results.decision.pick_type.toLowerCase(),
        selection: r.selection,
        odds: 0,
        units: r.units,
        game_snapshot: {},
        status: 'pending',
        is_system_pick: true,
        confidence: r.confidence,
        reasoning: results.decision.reason,
        algorithm_version: 'shiva_v1',
        run_id,
      })
      if (ins.error) throw new Error(ins.error.message)
      return { body: { run_id, decision: 'PICK', confidence: r.confidence, pick: { id: r.id, run_id, pick_type: results.decision.pick_type, selection: r.selection, units: r.units, confidence: r.confidence } }, status: 200 }
    }
  })
}


