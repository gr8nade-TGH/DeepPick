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
  console.log('[SHIVA:Step4] === ROUTE CALLED ===')
  
  const apiErr = ensureApiEnabled()
  if (apiErr) {
    console.log('[SHIVA:Step4] API not enabled:', apiErr)
    return apiErr
  }
  
  const writeAllowed = isWriteAllowed()
  console.log('[SHIVA:Step4] Write allowed:', writeAllowed)
  
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') {
    console.log('[SHIVA:Step4] Invalid idempotency key:', key)
    return key
  }

  const body = await request.json().catch(() => null)
  console.log('[SHIVA:Step4] Request body:', JSON.stringify(body, null, 2))
  console.log('[SHIVA:Step4] Body type:', typeof body)
  console.log('[SHIVA:Step4] Body keys:', body ? Object.keys(body) : 'null')
  console.log('[SHIVA:Step4] Idempotency key:', key)
  
  const parse = Step4Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step4] Schema validation failed:', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      body: body,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }
  
  console.log('[SHIVA:Step4] Schema validation passed')

  const { run_id, inputs, results } = parse.data
  const { sport, betType } = inputs
  
  console.log('[SHIVA:Step4] Parsed data:', { run_id, sport, betType, factorCount: results.factors.length })
  
  return withIdempotency({
    runId: run_id,
    step: 'step4',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      console.log('[SHIVA:Step4] ===== EXEC FUNCTION CALLED =====')
      console.log('[SHIVA:Step4] exec() started, run_id:', run_id)
      
      // Simple test response to verify exec is working
      const testResponse = {
        run_id,
        test: 'exec_function_working',
        timestamp: new Date().toISOString()
      }
      
      console.log('[SHIVA:Step4] Returning test response:', testResponse)
      return jsonOk(testResponse)
    }
  })
}
