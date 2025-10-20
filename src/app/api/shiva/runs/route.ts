import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
export const runtime = 'nodejs'

const CreateRunSchema = z.object({
  game_id: z.string().min(1),
  sport: z.literal('NBA'),
  capper: z.literal('SHIVA'),
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  start_time_utc: z.string().min(1),
}).strict()

export async function POST(request: Request) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = CreateRunSchema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const { game_id, sport, capper } = parse.data
  const admin = getSupabaseAdmin()

  // Idempotency short-circuit (reuse existing)
  const existing = await admin.from('runs').select('run_id, state').eq('game_id', game_id).eq('capper', capper).neq('state', 'VOIDED').maybeSingle()
  if (existing.data) {
    return jsonOk({ run_id: existing.data.run_id, state: existing.data.state }, 200)
  }

  // Create new run
  if (!writeAllowed) {
    // Dry-run: simulate new run id
    return jsonOk({ run_id: 'dryrun_run', state: 'IN-PROGRESS' }, 201)
  }
  const insert = await admin.from('runs').insert({ game_id, sport, capper, state: 'IN-PROGRESS' }).select('run_id, state').single()
  if (insert.error) return jsonError('DB_ERROR', insert.error.message, 500)
  return jsonOk({ run_id: insert.data.run_id, state: insert.data.state }, 201)
}


