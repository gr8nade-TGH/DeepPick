import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const Step5Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    base_confidence: z.number().finite(),
    predicted_total: z.number().finite(),
    market_total_line: z.number().finite(),
    pick_direction: z.enum(['OVER', 'UNDER']),
  }).strict(),
  results: z.object({
    final_factor: z.object({
      name: z.string(),
      edge_pts: z.number(),
      edge_factor: z.number(),
      confidence_before: z.number(),
      confidence_after: z.number(),
    }).strict(),
    units: z.number().min(0).max(5),
    final_pick: z.object({
      type: z.literal('TOTAL'),
      selection: z.string(),
      units: z.number(),
      confidence: z.number(),
    }).strict(),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('[SHIVA:Step5] === ROUTE CALLED ===')
  
  const apiErr = ensureApiEnabled()
  if (apiErr) {
    console.log('[SHIVA:Step5] API not enabled:', apiErr)
    return apiErr
  }
  
  const writeAllowed = isWriteAllowed()
  console.log('[SHIVA:Step5] Write allowed:', writeAllowed)
  
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') {
    console.log('[SHIVA:Step5] Invalid idempotency key:', key)
    return key
  }

  const body = await request.json().catch(() => null)
  console.log('[SHIVA:Step5] Request body:', JSON.stringify(body, null, 2))
  console.log('[SHIVA:Step5] Idempotency key:', key)
  const parse = Step5Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step5]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const { run_id, inputs, results } = parse.data
  const { base_confidence, predicted_total, market_total_line, pick_direction } = inputs
  
  return withIdempotency({
    runId: run_id,
    step: 'step5',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      // Calculate market edge
      const marketEdgePts = predicted_total - market_total_line
      
      // Calculate edge factor: clamp(edgePts / 10, -1, 1)
      const edgeFactor = Math.max(-1, Math.min(1, marketEdgePts / 10))
      
      // Adjust confidence: clamp(base + (edgeFactor * 1.0), 0, 5)
      const adjustedConfidence = Math.max(0, Math.min(5, base_confidence + (edgeFactor * 1.0)))
      
      // Calculate units based on final confidence
      let units = 0
      if (adjustedConfidence >= 4.5) units = 5
      else if (adjustedConfidence >= 4.0) units = 3
      else if (adjustedConfidence >= 3.5) units = 2
      else if (adjustedConfidence >= 2.5) units = 1
      
      // Generate final pick
      const line = market_total_line.toFixed(1)
      const selection = `${pick_direction} ${line}`
      
      const finalPick = {
        type: 'TOTAL' as const,
        selection,
        units,
        confidence: adjustedConfidence
      }
      
      if (writeAllowed) {
        // Store final confidence and pick
        const upd = await admin.from('runs').update({ 
          conf_final: adjustedConfidence,
          final_factor: results.final_factor.name,
          edge_pts: marketEdgePts,
          edge_factor: edgeFactor
        }).eq('run_id', run_id)
        if (upd.error) throw new Error(upd.error.message)
      }
      
      const responseBody = {
        run_id,
        final_factor: {
          name: 'Edge vs Market',
          edge_pts: marketEdgePts,
          edge_factor: edgeFactor,
          confidence_before: base_confidence,
          confidence_after: adjustedConfidence,
        },
        units,
        final_pick: finalPick,
        conf_final: adjustedConfidence,
        dominant: 'total',
        conf_market_adj: edgeFactor,
      }
      
      // Structured logging
      console.log('[SHIVA:Step5Final]', {
        run_id,
        inputs: {
          base_confidence,
          predicted_total,
          market_total_line,
          pick_direction,
        },
        outputs: {
          edge_pts: marketEdgePts,
          edge_factor: edgeFactor,
          confidence_after: adjustedConfidence,
          units,
        },
        writeAllowed,
        latencyMs: Date.now() - startTime,
        status: 200,
      })
      
      return { body: responseBody, status: 200 }
    }
  })
}
