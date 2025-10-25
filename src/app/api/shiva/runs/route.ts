import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
export const runtime = 'nodejs'

const CreateRunSchema = z.object({
  run_id: z.string().uuid().optional(), // Accept pre-generated run_id
  game: z.object({
    game_id: z.string().min(1),
    home: z.string().min(1),
    away: z.string().min(1),
    start_time_utc: z.string().min(1),
  }),
  effectiveProfile: z.any().optional(), // Allow effectiveProfile for context
}) // Allow extra keys for forward compatibility

export async function POST(request: Request) {
  const startTime = Date.now()
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = CreateRunSchema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:CreateRun]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      body: body,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const { run_id: providedRunId, game } = parse.data
  const game_id = game.game_id
  const sport = 'NBA'
  const capper = 'SHIVA'
  
  const admin = getSupabaseAdmin()

  // Use provided run_id or generate one
  const run_id = providedRunId || crypto.randomUUID()
  
  console.debug('[SHIVA:CreateRun]', {
    providedRunId,
    generatedRunId: run_id,
    game_id,
  })

  // Idempotency short-circuit (reuse existing non-voided run)
  const existing = await admin.from('runs').select('run_id, state').eq('game_id', game_id).eq('capper', capper).neq('state', 'VOIDED').maybeSingle()
  if (existing.data) {
    console.log('[SHIVA:CreateRun]', {
      game_id,
      run_id: existing.data.run_id,
      status: 'existing',
      state: existing.data.state,
      latencyMs: Date.now() - startTime,
    })
    
    // Add X-Dry-Run header
    return new Response(JSON.stringify({ run_id: existing.data.run_id, state: existing.data.state }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Dry-Run': writeAllowed ? '0' : '1',
      },
    })
  }

  // Create new run
  if (!writeAllowed) {
    // Dry-run: return the provided/generated run_id
    console.log('[SHIVA:CreateRun]', {
      game_id,
      run_id,
      status: 'created (dry-run)',
      writeAllowed: false,
      latencyMs: Date.now() - startTime,
    })
    
    return new Response(JSON.stringify({ run_id, state: 'IN-PROGRESS' }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'X-Dry-Run': '1',
      },
    })
  }
  
  // Single transaction: insert run
  const insert = await admin.from('runs').insert({ game_id, sport, capper, state: 'IN-PROGRESS' }).select('run_id, state').single()
  if (insert.error) {
    console.error('[SHIVA:CreateRun]', {
      error: 'DB_ERROR',
      message: insert.error.message,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('DB_ERROR', insert.error.message, 500)
  }
  
  console.log('[SHIVA:CreateRun]', {
    game_id,
    run_id: insert.data.run_id,
    home_team: game.home,
    away_team: game.away,
    status: 'created',
    writeAllowed: true,
    latencyMs: Date.now() - startTime,
  })
  
  return new Response(JSON.stringify({ run_id: insert.data.run_id, state: insert.data.state }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'X-Dry-Run': '0',
    },
  })
}


