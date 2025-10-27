import { createHash } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { jsonOk } from './route-helpers'

export interface IdempotencyExecArgs<TBody> {
  runId: string
  step: string
  idempotencyKey: string
  writeAllowed: boolean
  exec: () => Promise<{ body: TBody; status: number }>
}

function stableStringify(obj: unknown): string {
  const seen = new WeakSet()
  const ordered = (input: any): any => {
    if (input && typeof input === 'object') {
      if (seen.has(input)) return null
      seen.add(input)
      if (Array.isArray(input)) return input.map(ordered)
      const keys = Object.keys(input).sort()
      const out: Record<string, any> = {}
      for (const k of keys) {
        const v = (input as any)[k]
        if (v === undefined) continue
        out[k] = ordered(v)
      }
      return out
    }
    return input
  }
  return JSON.stringify(ordered(obj))
}

function hashResponse(str: string): string {
  return createHash('sha256').update(str).digest('hex')
}

export async function withIdempotency<TBody>(args: IdempotencyExecArgs<TBody>): Promise<Response> {
  const admin = getSupabaseAdmin()

  // Check existing idempotency record
  const existing = await admin
    .from('idempotency_keys')
    .select('response_json, status_code')
    .eq('run_id', args.runId)
    .eq('step', args.step)
    .eq('key', args.idempotencyKey)
    .maybeSingle()

  if (existing.data && existing.data.response_json) {
    // TEMPORARY FIX: Always execute Steps 3, 4, 5 and pick fresh to bypass cached empty responses
    if (args.step === 'step3' || args.step === 'step4' || args.step === 'step5') {
      console.log(`[Idempotency:${args.step}] Bypassing cached response for ${args.step}:`, {
        runId: args.runId,
        step: args.step,
        key: args.idempotencyKey,
        cachedResponse: existing.data.response_json,
        statusCode: existing.data.status_code
      })
      // Continue to execution instead of returning cached response
    } else if (args.step === 'pick') {
      // For pick step, always execute to ensure PASS runs are saved
      console.log(`[Idempotency:${args.step}] Bypassing cached response for pick step (executing to save PASS runs):`, {
        runId: args.runId,
        step: args.step,
        key: args.idempotencyKey,
        hasCachedResponse: !!existing.data.response_json
      })
      // Continue to execution instead of returning cached response
    } else {
      console.log(`[Idempotency:${args.step}] Returning cached response:`, {
        runId: args.runId,
        step: args.step,
        key: args.idempotencyKey,
        cachedResponse: existing.data.response_json,
        statusCode: existing.data.status_code
      })
      return new Response(JSON.stringify(existing.data.response_json), {
        status: existing.data.status_code ?? 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // Dry-run path: compute but do not persist
  if (!args.writeAllowed) {
    console.log(`[Idempotency:${args.step}] Executing dry-run for step:`, {
      runId: args.runId,
      step: args.step,
      key: args.idempotencyKey
    })
    try {
      const result = await args.exec()
      console.log(`[Idempotency:${args.step}] Dry-run exec completed:`, {
        hasBody: !!result,
        bodyKeys: result ? Object.keys(result.body || {}) : [],
        status: result?.status
      })
      
      // Add debugging info to response for client visibility
      const responseBody = {
        ...(result.body as any),
        _idempotency_debug: {
          step: args.step,
          runId: args.runId,
          key: args.idempotencyKey,
          execCompleted: true,
          bodyKeys: result ? Object.keys(result.body || {}) : []
        }
      }
      
      return new Response(JSON.stringify(responseBody), {
        status: result.status,
        headers: { 
          'Content-Type': 'application/json', 
          'X-Dry-Run': '1', 
          'Idempotency-Skip': 'true' 
        }
      })
    } catch (error) {
      console.error(`[Idempotency:${args.step}] Dry-run error:`, error)
      return new Response(JSON.stringify({
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          step: args.step,
          runId: args.runId
        }
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          'X-Dry-Run': '1', 
          'Idempotency-Skip': 'true' 
        }
      })
    }
  }

  // Execute and persist idempotent response
  try {
    const result = await args.exec()
  const canonical = stableStringify(result.body)
  const responseHash = hashResponse(canonical)

  const ins = await admin.from('idempotency_keys').insert({
    run_id: args.runId,
    step: args.step,
    key: args.idempotencyKey,
    response_json: JSON.parse(canonical),
    status_code: result.status,
    response_hash: responseHash,
  })
  if (ins.error) {
    // If conflict, re-read and return stored
    const reread = await admin
      .from('idempotency_keys')
      .select('response_json, status_code')
      .eq('run_id', args.runId)
      .eq('step', args.step)
      .eq('key', args.idempotencyKey)
      .maybeSingle()
    if (reread.data && reread.data.response_json) {
      return new Response(JSON.stringify(reread.data.response_json), {
        status: reread.data.status_code ?? 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 
      'Content-Type': 'application/json',
      'X-Dry-Run': '0'
    }
  })
  } catch (error) {
    console.error(`[Idempotency:${args.step}] Write error:`, error)
    return new Response(JSON.stringify({
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        step: args.step,
        runId: args.runId
      }
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'X-Dry-Run': '0'
      }
    })
  }
}


