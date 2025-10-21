import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { computeTotalsFactors } from '@/lib/cappers/shiva-v1/factors/nba-totals'
export const runtime = 'nodejs'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const Step3Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    teams: z.object({ home: z.string().min(1), away: z.string().min(1) }).strict(),
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
    ai_provider: z.enum(['perplexity', 'openai']),
    news_window_hours: z.number().finite(),
  }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      key: z.string().min(1),
      name: z.string().min(1),
      weight_total_pct: z.number().finite(),
      raw_values_json: z.unknown(),
      parsed_values_json: z.record(z.unknown()),
      normalized_value: z.number().finite(),
      caps_applied: z.boolean(),
      cap_reason: z.string().nullable(),
      notes: z.string().nullable().optional(),
    }).strict()),
    meta: z.object({ 
      ai_provider: z.enum(['perplexity', 'openai']),
      factor_version: z.string().optional(),
    }).passthrough(),
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
  const parse = Step3Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step3]', {
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
    step: 'step3',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      // Branch on NBA/TOTAL vs legacy factors
      let factorsToProcess: any[]
      let factorVersion: string
      
      if (sport === 'NBA' && betType === 'TOTAL') {
        // Use new NBA totals factors
        const totalsResult = await computeTotalsFactors({
          game_id: run_id, // Use run_id as game_id for now
          away: inputs.teams.away,
          home: inputs.teams.home,
          sport: 'NBA',
          betType: 'TOTAL',
          leagueAverages: {
            pace: 100.1,
            ORtg: 110.0,
            DRtg: 110.0,
            threePAR: 0.39,
            FTr: 0.22,
            threePstdev: 0.036
          }
        })
        
        factorsToProcess = totalsResult.factors
        factorVersion = totalsResult.factor_version
      } else {
        // Use legacy factors (existing logic)
        factorsToProcess = results.factors
        factorVersion = 'legacy_v1'
      }
      
      const capsApplied = factorsToProcess.filter(f => f.caps_applied).length
      
      if (writeAllowed) {
        // Single transaction: insert all factors
        for (const f of factorsToProcess) {
          const ins = await admin.from('factors').insert({
            run_id,
            factor_no: f.factor_no,
            raw_values_json: f.raw_values_json,
            parsed_values_json: f.parsed_values_json,
            normalized_value: f.normalized_value,
            weight_applied: f.weight_total_pct || 0,
            caps_applied: f.caps_applied,
            cap_reason: f.cap_reason ?? null,
            notes: f.notes ?? null,
          })
          if (ins.error) throw new Error(ins.error.message)
        }
      }
      
      const responseBody = { 
        run_id, 
        factors: factorsToProcess,
        factor_count: factorsToProcess.length,
        factor_version: factorVersion
      }
      
      // Structured logging
      console.log('[SHIVA:Step3]', {
        run_id,
        inputs: {
          ai_provider: results.meta.ai_provider,
        },
        outputs: {
          factor_count: results.factors.length,
          caps_applied: capsApplied,
        },
        writeAllowed,
        latencyMs: Date.now() - startTime,
        status: 200,
      })
      
      return { body: responseBody, status: 200 }
    }
  })
}


