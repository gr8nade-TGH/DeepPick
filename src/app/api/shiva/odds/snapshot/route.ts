import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
export const runtime = 'nodejs'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const SnapshotSchema = z.object({
  run_id: z.string().min(1),
  snapshot: z.object({
    game_id: z.string().min(1),
    sport: z.literal('NBA'),
    home_team: z.string().min(1),
    away_team: z.string().min(1),
    start_time_utc: z.string().min(1),
    captured_at_utc: z.string().min(1),
    books_considered: z.number().finite(),
    moneyline: z.object({ home_avg: z.number().finite(), away_avg: z.number().finite() }).strict(),
    spread: z.object({ fav_team: z.string().min(1), line: z.number().finite(), odds: z.number().finite() }).strict(),
    total: z.object({ line: z.number().finite(), over_odds: z.number().finite(), under_odds: z.number().finite() }).strict(),
    raw_payload: z.unknown(),
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
  const parse = SnapshotSchema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Snapshot]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const runId = parse.data.run_id
  return withIdempotency({
    runId,
    step: 'snapshot',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      if (writeAllowed) {
        // Single transaction: deactivate old, insert new active snapshot
        const deact = await admin.from('odds_snapshots').update({ is_active: false }).eq('run_id', runId).eq('is_active', true)
        if (deact.error) throw new Error(deact.error.message)
        
        const ins = await admin.from('odds_snapshots').insert({ 
          run_id: runId, 
          payload_json: parse.data.snapshot, 
          is_active: true 
        }).select('snapshot_id, is_active').single()
        if (ins.error) throw new Error(ins.error.message)
        
        console.log('[SHIVA:Snapshot]', {
          run_id: runId,
          snapshot_id: ins.data.snapshot_id,
          inputs: {
            books_considered: parse.data.snapshot.books_considered,
            spread_line: parse.data.snapshot.spread.line,
            total_line: parse.data.snapshot.total.line,
          },
          outputs: {
            snapshot_id: ins.data.snapshot_id,
            is_active: true,
          },
          writeAllowed: true,
          latencyMs: Date.now() - startTime,
          status: 200,
        })
        
        return { 
          body: { 
            snapshot_id: ins.data.snapshot_id, 
            is_active: ins.data.is_active, 
            snapshot: parse.data.snapshot
          }, 
          status: 200 
        }
      }
      
      // Dry-run: simulate a snapshot id
      console.log('[SHIVA:Snapshot]', {
        run_id: runId,
        snapshot_id: 'dryrun_snapshot',
        writeAllowed: false,
        latencyMs: Date.now() - startTime,
        status: 200,
      })
      
      return { 
        body: { 
          snapshot_id: 'dryrun_snapshot', 
          is_active: true, 
          snapshot: parse.data.snapshot
        }, 
        status: 200 
      }
    }
  })
}


