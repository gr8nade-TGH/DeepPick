import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
export const runtime = 'nodejs'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const Step3Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    teams: z.object({ home: z.string().min(1), away: z.string().min(1) }).strict(),
    ai_provider: z.enum(['perplexity', 'openai']),
    news_window_hours: z.number().finite(),
  }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      name: z.string().min(1),
      weight_total_pct: z.number().finite(),
      raw_values_json: z.unknown(),
      parsed_values_json: z.record(z.unknown()),
      normalized_value: z.number().finite(),
      caps_applied: z.boolean(),
      cap_reason: z.string().nullable(),
      notes: z.string().nullable().optional(),
    }).strict()),
    meta: z.object({ ai_provider: z.enum(['perplexity', 'openai']) }).passthrough(),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = Step3Schema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const { run_id, results } = parse.data
  return withIdempotency({
    runId: run_id,
    step: 'step3',
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
            notes: f.notes ?? null,
          })
          if (ins.error) throw new Error(ins.error.message)
        }
      }
      return { body: { run_id, factor_count: results.factors.length }, status: 200 }
    }
  })
}


